/**
 * Profile fetching hook.
 *
 * Loads a user profile by username from Supabase along with
 * follower count, following count, post count, and whether the
 * current user is following this profile.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/store';
import type { User } from '@/lib/mock-data';

export interface ProfileWithStats extends User {
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing: boolean;
  isSelf: boolean;
}

interface DbProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

function mapProfile(p: DbProfile): User {
  return {
    id: p.id,
    name: p.display_name,
    username: p.username,
    avatar: p.avatar_url || '/images/placeholder.svg',
    bio: p.bio || '',
    followers: 0,
    following: 0,
    verified: false,
  };
}

/**
 * Fetch a profile by username, including follower/following/post counts
 * and whether the current user follows this profile.
 */
export function useProfile(username: string | undefined) {
  const currentUser = useCurrentUser();
  const [profile, setProfile] = useState<ProfileWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!username) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch the profile row
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profErr || !prof) {
        setError('User not found');
        setProfile(null);
        setLoading(false);
        return;
      }

      const user = mapProfile(prof as DbProfile);
      const isSelf = currentUser?.id === user.id;

      // 2. Count followers (people following this user)
      const { count: followerCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id)
        .eq('status', 'accepted');

      // 3. Count following (people this user follows)
      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id)
        .eq('status', 'accepted');

      // 4. Count posts
      const { count: postCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 5. Check if current user follows this profile
      let isFollowing = false;
      if (currentUser && !isSelf) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', user.id)
          .eq('status', 'accepted')
          .maybeSingle();

        isFollowing = !!followRow;
      }

      setProfile({
        ...user,
        followerCount: followerCount || 0,
        followingCount: followingCount || 0,
        postCount: postCount || 0,
        isFollowing,
        isSelf,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [username, currentUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /** Re-fetch after follow/unfollow to update counts. */
  const refresh = useCallback(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refresh };
}

/**
 * Fetch a list of followers for a given user ID.
 */
export function useFollowers(userId: string | undefined) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setUsers([]); setLoading(false); return; }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('follows')
          .select('follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)')
          .eq('following_id', userId)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });

        if (!cancelled && data) {
          setUsers(
            data
              .map((r: any) => r.profiles)
              .filter(Boolean)
              .map(mapProfile),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return { users, loading };
}

/**
 * Fetch a list of users that a given user ID is following.
 */
export function useFollowing(userId: string | undefined) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setUsers([]); setLoading(false); return; }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('follows')
          .select('following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)')
          .eq('follower_id', userId)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false });

        if (!cancelled && data) {
          setUsers(
            data
              .map((r: any) => r.profiles)
              .filter(Boolean)
              .map(mapProfile),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return { users, loading };
}
