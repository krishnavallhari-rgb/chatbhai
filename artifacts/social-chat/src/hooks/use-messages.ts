/**
 * Production-ready messaging hooks with Supabase Realtime.
 *
 * Architecture:
 * - One Realtime channel per conversation (not per component mount).
 * - All postgres_changes handlers are registered BEFORE .subscribe().
 * - Optimistic messages use temporary client IDs that are reconciled
 *   with the real database row when the INSERT fires via Realtime or
 *   when the sendMessage promise resolves.
 * - Deduplication is ID-based: the same DB id is never inserted twice.
 * - Cleanup always calls supabase.removeChannel() via the registry,
 *   preventing leaked subscriptions.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/store';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createChannel, registerChannel, unregisterChannel } from '@/lib/realtime';

const PAGE_SIZE = 50;

/* ── Database row shapes ────────────────────────────────────────────────── */

interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_text: string;
  message_type: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

interface DbMessageRead {
  message_id: string;
  user_id: string;
  read_at: string;
}

/* ── Mapping helpers ────────────────────────────────────────────────────── */

function mapDbMessage(
  msg: DbMessage,
  readUserIds: Set<string>,
  currentUserId: string,
): Message {
  const myRead = readUserIds.has(currentUserId);
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    text: msg.encrypted_text,
    timestamp: msg.created_at,
    status: myRead ? 'seen' : 'sent',
  };
}

function sortByTime(msgs: Message[]): Message[] {
  return [...msgs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/* ── Constants for channel namespaces ───────────────────────────────────── */
const CONVERSATION_NS = 'conversation-realtime';
const UNREAD_NS = 'unread-realtime';

/* ═══════════════════════════════════════════════════════════════════════════
   useMessages – message list state with optimistic support
   ═══════════════════════════════════════════════════════════════════════════ */

export function useMessages(conversationId: string | undefined) {
  const currentUser = useCurrentUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestTimestamp = useRef<string | null>(null);

  // Track temporary IDs of optimistic messages so we can reconcile later.
  const optimisticIds = useRef(new Set<string>());

  /* ── Fetch (initial or older page) ──────────────────────────────────── */

  const fetchMessages = useCallback(
    async (older = false) => {
      if (!conversationId || !currentUser) return;

      setLoading(true);
      try {
        let query = supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (older && oldestTimestamp.current) {
          query = query.lt('created_at', oldestTimestamp.current);
        }

        const { data: msgs, error: msgsErr } = await query;
        if (msgsErr) throw msgsErr;
        if (!msgs) return;

        const dbMsgs = msgs as DbMessage[];
        if (dbMsgs.length < PAGE_SIZE) setHasMore(false);

        if (dbMsgs.length > 0) {
          const lastCreated = dbMsgs[dbMsgs.length - 1].created_at;
          if (!older || lastCreated < (oldestTimestamp.current || '')) {
            oldestTimestamp.current = lastCreated;
          }
        }

        // Batch-fetch read receipts for this page of messages.
        const msgIds = dbMsgs.map(m => m.id);
        const { data: reads } = await supabase
          .from('message_reads')
          .select('*')
          .in('message_id', msgIds);

        const readMap = new Map<string, Set<string>>();
        for (const msgId of msgIds) readMap.set(msgId, new Set());
        for (const r of (reads || []) as DbMessageRead[]) {
          readMap.get(r.message_id)?.add(r.user_id);
        }

        const mapped = dbMsgs.map(m =>
          mapDbMessage(m, readMap.get(m.id) || new Set(), currentUser.id),
        );

        setMessages(prev => {
          if (older) {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = mapped.filter(m => !existingIds.has(m.id));
            return sortByTime([...prev, ...newOnes]);
          }
          return sortByTime(mapped);
        });
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, currentUser],
  );

  // Reset and fetch whenever the conversation changes.
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    oldestTimestamp.current = null;
    optimisticIds.current.clear();
    if (conversationId) fetchMessages(false);
  }, [conversationId, fetchMessages]);

  const fetchMore = useCallback(() => {
    if (!loading && hasMore) fetchMessages(true);
  }, [fetchMessages, loading, hasMore]);

  /* ── State mutators ─────────────────────────────────────────────────── */

  /** Add a message with dedup by ID. Safe for both Realtime and manual use. */
  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return sortByTime([...prev, msg]);
    });
  }, []);

  /**
   * Insert an optimistic (not-yet-persisted) message into the list.
   * Returns the temporary ID so the caller can reconcile later.
   */
  const addOptimisticMessage = useCallback((msg: Message): string => {
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    optimisticIds.current.add(tempId);
    setMessages(prev => sortByTime([...prev, { ...msg, id: tempId }]));
    return tempId;
  }, []);

  /**
   * Replace a temporary optimistic message with the real database row.
   * Handles race conditions where the Realtime INSERT may have already
   * added the real message before this call completes.
   */
  const reconcileMessage = useCallback((tempId: string, realMsg: Message) => {
    optimisticIds.current.delete(tempId);
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === tempId);
      if (idx === -1) {
        // Optimistic already removed (e.g. Realtime arrived first).
        if (prev.some(m => m.id === realMsg.id)) return prev;
        return sortByTime([...prev, realMsg]);
      }
      // If Realtime already inserted the real message, just drop the optimistic.
      if (prev.some(m => m.id === realMsg.id)) {
        return sortByTime(prev.filter(m => m.id !== tempId));
      }
      const next = [...prev];
      next[idx] = realMsg;
      return sortByTime(next);
    });
  }, []);

  const updateMessage = useCallback(
    (msgId: string, updates: Partial<Message>) => {
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, ...updates } : m)),
      );
    },
    [],
  );

  const removeMessage = useCallback((msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  }, []);

  return {
    messages,
    loading,
    hasMore,
    fetchMore,
    addMessage,
    addOptimisticMessage,
    reconcileMessage,
    updateMessage,
    removeMessage,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   useRealtimeMessages – one channel per conversation
   ═══════════════════════════════════════════════════════════════════════════ */

export function useRealtimeMessages(
  conversationId: string | undefined,
  callbacks: {
    onNewMessage: (msg: Message) => void;
    onUpdateMessage: (id: string, updates: Partial<Message>) => void;
    onRemoveMessage: (id: string) => void;
    onReadReceipt: (messageId: string, readerId: string) => void;
  },
) {
  const currentUser = useCurrentUser();

  // Keep a ref so the effect body always calls the latest callbacks
  // without being re-subscribed every render.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const cid = conversationId;
    const uid = currentUser.id;

    // ── Build the channel with ALL handlers BEFORE subscribe() ────────
    const channel = createChannel(`conversation-${cid}`)

      // INSERT on messages – new message in this conversation
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${cid}`,
        },
        async (payload: RealtimePostgresChangesPayload<DbMessage>) => {
          const newMsg = payload.new as DbMessage;
          if (!newMsg || newMsg.deleted_at) return;

          // Fetch read status for the new message.
          const { data: reads } = await supabase
            .from('message_reads')
            .select('*')
            .eq('message_id', newMsg.id);

          const readSet = new Set(
            (reads || []).map((r: DbMessageRead) => r.user_id),
          );
          const mapped = mapDbMessage(newMsg, readSet, uid);
          callbacksRef.current.onNewMessage(mapped);
        },
      )

      // UPDATE on messages – edit or soft-delete
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${cid}`,
        },
        (payload: RealtimePostgresChangesPayload<DbMessage>) => {
          const updated = payload.new as DbMessage;
          if (updated.deleted_at) {
            callbacksRef.current.onRemoveMessage(updated.id);
          } else if (updated.edited_at) {
            callbacksRef.current.onUpdateMessage(updated.id, {
              text: updated.encrypted_text,
              timestamp: updated.edited_at,
            });
          }
        },
      )

      // INSERT on message_reads – someone read a message.
      // We do NOT filter at the database level because the read receipt
      // only carries message_id + user_id, not conversation_id.
      // The callback is responsible for checking relevance.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload: RealtimePostgresChangesPayload<DbMessageRead>) => {
          const read = payload.new as DbMessageRead;
          callbacksRef.current.onReadReceipt(read.message_id, read.user_id);
        },
      )

      // All handlers registered – now subscribe.
      .subscribe();

    // Register in the module-level registry (cleans up any stale channel).
    registerChannel(CONVERSATION_NS, cid, channel);

    return () => {
      unregisterChannel(CONVERSATION_NS, cid, channel);
    };
    // callbacksRef is stable; currentUser changes are rare and handled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUser]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   useSendMessage – insert + update conversation timestamp
   ═══════════════════════════════════════════════════════════════════════════ */

export function useSendMessage() {
  const currentUser = useCurrentUser();
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      text: string,
    ): Promise<Message | null> => {
      if (!currentUser || !text.trim()) return null;

      setSending(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: currentUser.id,
            encrypted_text: text.trim(),
            message_type: 'text',
          })
          .select()
          .single();

        if (error) throw error;

        // Touch the conversation so the list re-sorts.
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        if (!data) return null;

        const dbMsg = data as DbMessage;
        return {
          id: dbMsg.id,
          conversationId: dbMsg.conversation_id,
          senderId: dbMsg.sender_id,
          text: dbMsg.encrypted_text,
          timestamp: dbMsg.created_at,
          status: 'sent' as const,
        };
      } catch (err) {
        console.error('Failed to send message:', err);
        return null;
      } finally {
        setSending(false);
      }
    },
    [currentUser],
  );

  return { sendMessage, sending };
}

/* ═══════════════════════════════════════════════════════════════════════════
   useUnreadCount – global unread badge (sidebar / mobile tab bar)
   ═══════════════════════════════════════════════════════════════════════════ */

export function useUnreadCount() {
  const currentUser = useCurrentUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    async function fetchUnread() {
      try {
        const { data: memberships } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', currentUser!.id);

        if (!memberships || memberships.length === 0) {
          if (!cancelled) setCount(0);
          return;
        }

        const convIds = memberships.map(m => m.conversation_id);

        const { data: msgs } = await supabase
          .from('messages')
          .select('id, conversation_id')
          .in('conversation_id', convIds)
          .is('deleted_at', null)
          .neq('sender_id', currentUser!.id);

        if (!msgs || msgs.length === 0) {
          if (!cancelled) setCount(0);
          return;
        }

        const msgIds = msgs.map(m => m.id);
        const { data: reads } = await supabase
          .from('message_reads')
          .select('message_id')
          .in('message_id', msgIds)
          .eq('user_id', currentUser!.id);

        const readIds = new Set((reads || []).map(r => r.message_id));
        const unread = msgIds.filter(id => !readIds.has(id)).length;
        if (!cancelled) setCount(unread);
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    fetchUnread();

    const uid = currentUser.id;

    // One global channel that recalculates on any message or read change.
    const channel = createChannel(`unread-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        fetchUnread,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reads' },
        fetchUnread,
      )
      .subscribe();

    registerChannel(UNREAD_NS, uid, channel);

    return () => {
      cancelled = true;
      unregisterChannel(UNREAD_NS, uid, channel);
    };
  }, [currentUser]);

  return count;
}

/* ═══════════════════════════════════════════════════════════════════════════
   useDeleteConversation – remove yourself from a DM conversation
   ═══════════════════════════════════════════════════════════════════════════ */

export function useDeleteConversation() {
  const currentUser = useCurrentUser();
  const [deleting, setDeleting] = useState(false);

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<boolean> => {
      if (!currentUser) return false;

      setDeleting(true);
      try {
        const { error } = await supabase.rpc('delete_conversation', {
          p_conv_id: conversationId,
        });

        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Failed to delete conversation:', err);
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [currentUser],
  );

  return { deleteConversation, deleting };
}

/* ═══════════════════════════════════════════════════════════════════════════
   useMarkAsRead – insert read receipts for all unread messages
   ═══════════════════════════════════════════════════════════════════════════ */

export function useMarkAsRead() {
  const currentUser = useCurrentUser();

  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUser) return;

      // Fetch messages sent by others that we haven't read yet.
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUser.id)
        .is('deleted_at', null);

      if (!msgs || msgs.length === 0) return;

      const msgIds = msgs.map(m => m.id);

      // Find which ones we already read.
      const { data: existingReads } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', msgIds)
        .eq('user_id', currentUser.id);

      const readIds = new Set((existingReads || []).map(r => r.message_id));
      const unreadIds = msgIds.filter(id => !readIds.has(id));

      if (unreadIds.length === 0) return;

      // Bulk-insert read receipts. This fires Realtime events that update
      // the sender's check-marks in real time.
      await supabase.from('message_reads').insert(
        unreadIds.map(id => ({
          message_id: id,
          user_id: currentUser.id,
        })),
      );
    },
    [currentUser],
  );

  return { markAsRead };
}
