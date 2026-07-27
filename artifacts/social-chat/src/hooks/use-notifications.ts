/**
 * Notifications hook.
 *
 * Fetches notifications for the current user and subscribes to
 * Realtime INSERT events so new notifications appear instantly.
 * Also provides mark-as-read functionality.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/store';
import { createChannel, registerChannel, unregisterChannel } from '@/lib/realtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  type: 'follow' | 'like' | 'comment' | 'mention';
  entityType?: string;
  entityId?: string;
  read: boolean;
  timestamp: string;
  // Joined from profiles
  actor?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface DbNotification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

const NOTIF_NS = 'notifications-realtime';

function mapNotification(n: DbNotification): Notification {
  return {
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    type: n.type as Notification['type'],
    entityType: n.entity_type || undefined,
    entityId: n.entity_id || undefined,
    read: n.read,
    timestamp: n.created_at,
    actor: n.profiles || undefined,
  };
}

export function useNotifications() {
  const currentUser = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const notifsRef = useRef(notifications);
  notifsRef.current = notifications;

  // ── Initial fetch ──────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (!error && data) {
          const mapped = data.map(mapNotification);
          setNotifications(mapped);
          setUnreadCount(mapped.filter(n => !n.read).length);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser]);

  // ── Realtime subscription ──────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.id;

    const channel = createChannel(`notifications-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${uid}`,
        },
        async (payload: RealtimePostgresChangesPayload<DbNotification>) => {
          const raw = payload.new as DbNotification;

          // Fetch the actor profile
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', raw.actor_id)
            .single();

          const notif: Notification = {
            ...mapNotification(raw),
            actor: prof || undefined,
          };

          setNotifications(prev => [notif, ...prev]);
          setUnreadCount(prev => prev + 1);
        },
      )
      .subscribe();

    registerChannel(NOTIF_NS, uid, channel);

    return () => {
      unregisterChannel(NOTIF_NS, uid, channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // ── Actions ────────────────────────────────────────────────────────

  const markAsRead = useCallback(
    async (notifId: string) => {
      if (!currentUser) return;

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId)
        .eq('user_id', currentUser.id);

      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, read: true } : n)),
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    },
    [currentUser],
  );

  const markAllAsRead = useCallback(async () => {
    if (!currentUser) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', currentUser.id)
      .eq('read', false);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [currentUser]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
