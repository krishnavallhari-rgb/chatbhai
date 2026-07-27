/**
 * Follow / Unfollow hook.
 *
 * Uses the handle_follow / handle_unfollow PostgreSQL functions
 * so that the follow + notification are created atomically.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useFollow() {
  const [loading, setLoading] = useState(false);

  const follow = useCallback(async (targetUserId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('handle_follow', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Follow failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unfollow = useCallback(async (targetUserId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('handle_unfollow', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Unfollow failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { follow, unfollow, loading };
}
