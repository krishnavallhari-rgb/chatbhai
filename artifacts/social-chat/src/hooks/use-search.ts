/**
 * Search hook.
 *
 * Provides debounced user search, suggested users, and recent searches.
 * All backed by Supabase.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/store';
import type { User } from '@/lib/mock-data';

interface DbProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
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

export function useSearch() {
  const currentUser = useCurrentUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [suggested, setSuggested] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounced search ────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim().toLowerCase();
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio')
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .neq('id', currentUser?.id || '')
          .limit(20);

        setResults((data || []).map(mapProfile));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentUser]);

  // ── Suggested users (random 5 that the user doesn't follow) ────────

  const fetchSuggested = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Get IDs of users we already follow
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id);

      const followingIds = new Set(
        (following || []).map((f: any) => f.following_id),
      );
      followingIds.add(currentUser.id);

      // Get 20 random profiles, then filter client-side
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .not('id', 'in', `(${Array.from(followingIds).join(',')})`)
        .limit(20);

      const profiles = (data || []).map(mapProfile);
      // Shuffle and take 5
      const shuffled = profiles.sort(() => Math.random() - 0.5);
      setSuggested(shuffled.slice(0, 5));
    } catch {
      setSuggested([]);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

  // ── Recent searches ─────────────────────────────────────────────────

  const fetchRecent = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { data } = await supabase
        .from('recent_searches')
        .select('searched_user_id, profiles!recent_searches_searched_user_id_fkey(id, username, display_name, avatar_url, bio)')
        .eq('user_id', currentUser.id)
        .order('searched_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentSearches(
          data
            .map((r: any) => r.profiles)
            .filter(Boolean)
            .map(mapProfile),
        );
      }
    } catch {
      setRecentSearches([]);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const addRecentSearch = useCallback(
    async (userId: string) => {
      if (!currentUser) return;
      await supabase.from('recent_searches').upsert({
        user_id: currentUser.id,
        searched_user_id: userId,
        searched_at: new Date().toISOString(),
      });
      fetchRecent();
    },
    [currentUser, fetchRecent],
  );

  const removeRecentSearch = useCallback(
    async (userId: string) => {
      if (!currentUser) return;
      await supabase
        .from('recent_searches')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('searched_user_id', userId);
      fetchRecent();
    },
    [currentUser, fetchRecent],
  );

  const clearRecentSearches = useCallback(async () => {
    if (!currentUser) return;
    await supabase
      .from('recent_searches')
      .delete()
      .eq('user_id', currentUser.id);
    setRecentSearches([]);
  }, [currentUser]);

  return {
    query,
    setQuery,
    results,
    suggested,
    recentSearches,
    loading,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    refreshSuggested: fetchSuggested,
  };
}
