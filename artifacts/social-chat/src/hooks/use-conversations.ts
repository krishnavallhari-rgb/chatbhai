/**
 * Conversation hooks with optional Realtime updates.
 *
 * useConversations – fetches all conversations for the current user and
 *   subscribes to live updates (new messages, read receipts, conversation
 *   timestamp changes) so the sidebar stays current without polling.
 *
 * useConversation – fetches a single conversation by ID (used for the
 *   chat header). No realtime needed here.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Message, Conversation } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/store';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createChannel, registerChannel, unregisterChannel } from '@/lib/realtime';
import { ensureConversationMembers } from '@/lib/conversations';

/**
 * Get member IDs for a conversation via SECURITY DEFINER RPC (bypasses RLS).
 * Falls back to direct SELECT if RPC fails.
 */
async function getMemberIdsViaRpc(conversationId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_conversation_member_ids', {
    p_conv_id: conversationId,
  });

  if (!error && data) {
    const rows = data as any[];
    return rows
      .map((r: any) => (typeof r === 'string' ? r : r.user_id ?? r.id ?? r.get_conversation_member_ids))
      .filter(Boolean);
  }

  console.warn('[Chat] RPC getMemberIds failed:', error?.message, '— falling back to SELECT');

  const { data: fallback, error: fErr } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);

  if (fErr) return [];
  return (fallback || []).map((m: any) => m.user_id as string);
}

/* ── Database row shapes ────────────────────────────────────────────────── */

interface DbProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verified?: boolean;
}

interface DbConversation {
  id: string;
  is_group: boolean;
  group_name: string | null;
  created_at: string;
  updated_at: string;
}

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

function mapProfileToUser(p: DbProfile | null | undefined): User {
  if (!p) {
    return {
      id: '',
      name: 'Unknown User',
      username: 'unknown',
      avatar: '/images/placeholder.svg',
      bio: '',
      followers: 0,
      following: 0,
      verified: false,
    };
  }
  return {
    id: p.id,
    name: p.display_name || p.username || 'Unknown User',
    username: p.username || 'unknown',
    avatar: p.avatar_url || '/images/placeholder.svg',
    bio: p.bio || '',
    followers: 0,
    following: 0,
    verified: p.verified ?? false,
  };
}

/** Fetch profiles for a set of user IDs – explicit query, no join needed. */
async function fetchProfilesForUsers(userIds: string[]): Promise<Map<string, DbProfile>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    console.warn('[Chat] fetchProfilesForUsers: no valid user IDs provided');
    return new Map();
  }

  console.log('[Chat] fetchProfilesForUsers: fetching', uniqueIds.length, 'profiles');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .in('id', uniqueIds);

  if (error) {
    console.error('[Chat] fetchProfilesForUsers ERROR:', error.message, error);
    return new Map();
  }

  console.log('[Chat] fetchProfilesForUsers: got', (data || []).length, 'rows');

  const map = new Map<string, DbProfile>();
  for (const row of data || []) {
    map.set(row.id, row as DbProfile);
  }
  return map;
}

function mapDbMessageToMessage(
  msg: DbMessage,
  reads: DbMessageRead[],
  currentUserId: string,
): Message {
  const myRead = reads.find(r => r.user_id === currentUserId);
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    text: msg.encrypted_text,
    timestamp: msg.created_at,
    status: myRead ? 'seen' : 'sent',
  };
}

/** Sort conversations by most-recently-updated first. */
function sortByUpdated(convs: Conversation[]): Conversation[] {
  return [...convs].sort((a, b) => {
    const aTime = a.lastMessage
      ? new Date(a.lastMessage.timestamp).getTime()
      : 0;
    const bTime = b.lastMessage
      ? new Date(b.lastMessage.timestamp).getTime()
      : 0;
    return bTime - aTime;
  });
}

/* ── Channel namespace ──────────────────────────────────────────────────── */
const CONV_LIST_NS = 'conversation-list-realtime';

/* ═══════════════════════════════════════════════════════════════════════════
   useConversations
   ═══════════════════════════════════════════════════════════════════════════ */

export function useConversations() {
  const currentUser = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Expose a stable setter so the realtime effect can use it.
  const setConversationsRef = useRef(setConversations);
  setConversationsRef.current = setConversations;

  /* ── Initial fetch ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.id;
    let cancelled = false;

    async function fetchConversations() {
      try {
        setLoading(true);

        console.log('[Chat] ═══════════════════════════════════════');
        console.log('[Chat] Current User ID:', uid);

        const { data: memberships, error: memErr } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', uid);

        if (memErr) throw memErr;
        console.log('[Chat] Step1 - Memberships found:', memberships?.length ?? 0, memberships);

        if (!memberships || memberships.length === 0) {
          console.warn('[Chat] Step1 - NO MEMBERSHIPS! User', uid, 'is not in any conversation_members row.');
          console.warn('[Chat] Step1 - This means the conversation_members table is missing this user.');
          console.warn('[Chat] Step1 - Fix: Run the SQL migration 00007 in Supabase SQL Editor.');
          if (!cancelled) setConversations([]);
          return;
        }

        const convIds = memberships.map(m => m.conversation_id);
        console.log('[Chat] Step2 - Conversation IDs:', convIds);

        const { data: convs, error: convErr } = await supabase
          .from('conversations')
          .select('*')
          .in('id', convIds)
          .order('updated_at', { ascending: false });

        if (convErr) throw convErr;
        console.log('[Chat] Step3 - Conversations loaded:', convs?.length ?? 0);

        if (!convs || cancelled) return;

        const results: Conversation[] = [];

        // Step 1 – collect every member user_id across all conversations
        const convMemberIds = new Map<string, string[]>();
        const allUserIds: string[] = [];

        for (const conv of convs as DbConversation[]) {
          let ids: string[] = await getMemberIdsViaRpc(conv.id);
          console.log('[Chat] Step4 - Conv', conv.id.slice(0, 8), '→ member IDs:', ids, '(count:', ids.length, ')');

          // Auto-repair: if a DM has fewer than 2 members, try to fix it
          if (!conv.is_group && ids.length < 2 && !cancelled) {
            console.warn('[Chat] ⚠️ DM', conv.id.slice(0, 8), 'has only', ids.length, 'member(s) — attempting repair');
            const missingUserId = ids.find(id => id !== uid);
            if (missingUserId) {
              // Other user is present but current user is missing — self-insert
              await ensureConversationMembers(conv.id, missingUserId);
            } else {
              // Only current user is present — we don't know who the other user is
              // Try to find them from messages table
              const { data: otherMsgs } = await supabase
                .from('messages')
                .select('sender_id')
                .eq('conversation_id', conv.id)
                .neq('sender_id', uid)
                .limit(1);
              if (otherMsgs && otherMsgs.length > 0) {
                const otherId = otherMsgs[0].sender_id;
                console.log('[Chat] Found other user from messages:', otherId.slice(0, 8));
                await ensureConversationMembers(conv.id, otherId);
              }
            }

            // Re-fetch members after repair
            ids = await getMemberIdsViaRpc(conv.id);
            console.log('[Chat] Step4r - After repair, Conv', conv.id.slice(0, 8), '→ member IDs:', ids, '(count:', ids.length, ')');
          }

          convMemberIds.set(conv.id, ids);
          allUserIds.push(...ids);
        }

        const uniqueIds = [...new Set(allUserIds)];
        console.log('[Chat] Step5 - All unique member IDs to fetch profiles for:', uniqueIds);

        // Step 2 – fetch ALL profiles in one query
        const profileMap = await fetchProfilesForUsers(allUserIds);

        console.log('[Chat] Step6 - Profile map contents:');
        for (const [id, profile] of profileMap) {
          console.log('[Chat]   ', id.slice(0, 8), '→', profile.display_name, '@' + profile.username);
        }

        // Step 3 – build conversations with resolved profiles
        for (const conv of convs as DbConversation[]) {
          const participants = convMemberIds.get(conv.id) || [];

          const { data: lastMsgs, error: lmErr } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1);

          if (lmErr) throw lmErr;

          const { data: allMsgs, error: amErr } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', conv.id)
            .is('deleted_at', null)
            .neq('sender_id', uid);

          if (amErr) throw amErr;

          let unreadCount = 0;
          if (allMsgs && allMsgs.length > 0) {
            const msgIds = allMsgs.map(m => m.id);
            const { data: reads, error: rErr } = await supabase
              .from('message_reads')
              .select('message_id')
              .in('message_id', msgIds)
              .eq('user_id', uid);

            if (rErr) throw rErr;
            const readIds = new Set((reads || []).map(r => r.message_id));
            unreadCount = msgIds.filter(id => !readIds.has(id)).length;
          }

          let lastMessage: Message | undefined;
          if (lastMsgs && lastMsgs.length > 0) {
            const lm = lastMsgs[0] as DbMessage;
            const { data: lmReads } = await supabase
              .from('message_reads')
              .select('*')
              .eq('message_id', lm.id);

            lastMessage = mapDbMessageToMessage(
              lm,
              (lmReads || []) as DbMessageRead[],
              uid,
            );
          }

          const allMembers: User[] = participants
            .map(id => {
              const profile = profileMap.get(id);
              if (!profile) {
                console.error('[Chat] Step7 - MISSING PROFILE for user ID:', id.slice(0, 8), '— profileMap has', profileMap.size, 'entries');
              }
              return mapProfileToUser(profile);
            })
            .filter(u => u.id !== '');

          console.log('[Chat] Step7 - Conv', conv.id.slice(0, 8), '→ allMembers:', allMembers.map(u => ({ name: u.name, username: '@' + u.username, id: u.id.slice(0, 8) })));

          results.push({
            id: conv.id,
            participants,
            lastMessage,
            unreadCount,
            isGroup: conv.is_group,
            groupName: conv.group_name || undefined,
            members: allMembers,
          });
        }

        // ── Deduplicate: same conversation ID ────────────────────────
        const seenIds = new Set<string>();
        const dedupedById = results.filter((c) => {
          if (seenIds.has(c.id)) return false;
          seenIds.add(c.id);
          return true;
        });

        // ── Deduplicate DMs: same member pair → keep most recent ────
        const seenPairs = new Map<string, Conversation>();
        const deduped = dedupedById.filter((c) => {
          if (c.isGroup) return true;
          const key = [...(c.participants || [])].sort().join(',');
          const existing = seenPairs.get(key);
          if (!existing) {
            seenPairs.set(key, c);
            return true;
          }
          // Keep the one with the most recent message
          const curTime = c.lastMessage ? new Date(c.lastMessage.timestamp).getTime() : 0;
          const exTime = existing.lastMessage ? new Date(existing.lastMessage.timestamp).getTime() : 0;
          if (curTime > exTime) {
            seenPairs.set(key, c);
            return false; // remove existing (will be replaced)
          }
          return false; // remove current (existing is newer)
        });

        if (deduped.length !== results.length) {
          console.log('[Chat] Deduped', results.length, '→', deduped.length, 'conversations');
        }

        if (!cancelled) setConversations(deduped);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchConversations();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  /* ── Realtime subscription ────────────────────────────────────────── */
  // Subscribes to:
  //   1. messages INSERT  → update lastMessage, reorder, increment unread
  //   2. conversations UPDATE → re-sort by updated_at
  //   3. message_reads INSERT → decrement unread count

  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.id;

    const channel = createChannel(`conversation-list-${uid}`)

      // ── New message arrived ─────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload: RealtimePostgresChangesPayload<DbMessage>) => {
          const newMsg = payload.new as DbMessage;
          if (!newMsg || newMsg.deleted_at) return;

          const mapped: Message = {
            id: newMsg.id,
            conversationId: newMsg.conversation_id,
            senderId: newMsg.sender_id,
            text: newMsg.encrypted_text,
            timestamp: newMsg.created_at,
            status: newMsg.sender_id === uid ? 'seen' : 'sent',
          };

          setConversationsRef.current(prev => {
            const idx = prev.findIndex(c => c.id === newMsg.conversation_id);
            if (idx === -1) return prev;

            const conv = prev[idx];
            const updated: Conversation = {
              ...conv,
              lastMessage: mapped,
              unreadCount:
                newMsg.sender_id !== uid
                  ? conv.unreadCount + 1
                  : conv.unreadCount,
            };

            const next = [...prev];
            next.splice(idx, 1);
            return sortByUpdated([updated, ...next]);
          });
        },
      )

      // ── Conversation updated (e.g. updated_at touched by sender) ───
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload: RealtimePostgresChangesPayload<DbConversation>) => {
          const updated = payload.new as DbConversation;
          setConversationsRef.current(prev => {
            const idx = prev.findIndex(c => c.id === updated.id);
            if (idx === -1) return prev;
            // Re-sort; the conversation's lastMessage timestamp is the
            // primary sort key, so just triggering a re-render is enough.
            return sortByUpdated([...prev]);
          });
        },
      )

      // ── Someone read a message → decrement unread ───────────────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        async (payload: RealtimePostgresChangesPayload<DbMessageRead>) => {
          const read = payload.new as DbMessageRead;

          // Only care when the current user's messages are read by someone
          // else, OR when we ourselves mark messages as read.
          // Look up which conversation this message belongs to.
          const { data: msg } = await supabase
            .from('messages')
            .select('conversation_id, sender_id')
            .eq('id', read.message_id)
            .single();

          if (!msg) return;

          // If the reader is the current user, decrement unread for that
          // conversation (we just opened it and marked messages as read).
          if (read.user_id === uid) {
            setConversationsRef.current(prev => {
              const idx = prev.findIndex(
                c => c.id === msg.conversation_id,
              );
              if (idx === -1) return prev;
              const conv = prev[idx];
              if (conv.unreadCount <= 0) return prev;
              const next = [...prev];
              next[idx] = {
                ...conv,
                unreadCount: conv.unreadCount - 1,
              };
              return next;
            });
          }
        },
      )

      // ── Membership deleted → remove conversation from sidebar ────
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const deleted = payload.old as { conversation_id: string; user_id: string } | undefined;
          if (!deleted?.conversation_id) return;
          console.log('[Chat] Membership deleted for conv:', deleted.conversation_id.slice(0, 8));
          setConversationsRef.current(prev =>
            prev.filter(c => c.id !== deleted.conversation_id),
          );
        },
      )

      // All handlers registered – now subscribe.
      .subscribe();

    registerChannel(CONV_LIST_NS, uid, channel);

    return () => {
      unregisterChannel(CONV_LIST_NS, uid, channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  return { conversations, loading, error };
}

/* ═══════════════════════════════════════════════════════════════════════════
   useConversation – single conversation detail (no realtime needed)
   ═══════════════════════════════════════════════════════════════════════════ */

export function useConversation(id: string | undefined) {
  const currentUser = useCurrentUser();
  const [conversation, setConversation] = useState<Conversation | undefined>();
  const [otherUsers, setOtherUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !currentUser) {
      setConversation(undefined);
      setOtherUsers([]);
      return;
    }

    const currentUid = currentUser.id;
    const convId = id;
    let cancelled = false;

    async function fetchConv() {
      setLoading(true);
      try {
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', convId)
          .single();

        if (convErr) throw convErr;
        if (!conv || cancelled) return;

        const dc = conv as DbConversation;

        let participants = await getMemberIdsViaRpc(convId);

        // Auto-repair: if a DM has fewer than 2 members, try to fix it
        if (!dc.is_group && participants.length < 2 && !cancelled) {
          console.warn('[Conv] ⚠️ useConversation: DM', convId.slice(0, 8), 'has only', participants.length, 'member(s) — repairing');

          const missingUserId = participants.find(p => p !== currentUid);
          if (missingUserId) {
            await ensureConversationMembers(convId, missingUserId);
          } else {
            // Only self present — find other from messages
            const { data: otherMsgs } = await supabase
              .from('messages')
              .select('sender_id')
              .eq('conversation_id', convId)
              .neq('sender_id', currentUid)
              .limit(1);
            if (otherMsgs && otherMsgs.length > 0) {
              await ensureConversationMembers(convId, otherMsgs[0].sender_id);
            }
          }

          // Re-fetch members after repair
          participants = await getMemberIdsViaRpc(convId);
          console.log('[Conv] After repair, participants:', participants.map(p => p.slice(0, 8)));
        }

        // Fetch profiles separately – no join needed
        const profileMap = await fetchProfilesForUsers(participants);

        const allMembers: User[] = participants
          .map(uid => mapProfileToUser(profileMap.get(uid)))
          .filter(u => u.id !== '');

        const others: User[] = allMembers.filter(
          u => u.id !== currentUid,
        );

        if (!cancelled) {
          setConversation({
            id: dc.id,
            participants,
            isGroup: dc.is_group,
            groupName: dc.group_name || undefined,
            unreadCount: 0,
            members: allMembers,
          });
          setOtherUsers(others);
        }
      } catch (err) {
        console.error('Failed to fetch conversation:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchConv();
    return () => {
      cancelled = true;
    };
  }, [id, currentUser]);

  return { conversation, otherUsers, loading };
}
