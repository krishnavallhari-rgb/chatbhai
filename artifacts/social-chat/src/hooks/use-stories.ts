import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface StoryItem {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar: string;
}

export function useStories() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);

      // Get stories from last 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      setStories((data || []).map(s => {
        const author = profileMap.get(s.user_id);
        return {
          id: s.id,
          user_id: s.user_id,
          image_url: s.image_url,
          created_at: s.created_at,
          author_name: author?.name || 'Unknown',
          author_username: author?.username || 'unknown',
          author_avatar: author?.avatar || '',
        };
      }));
    } catch (err) {
      console.error('Stories fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const addStory = useCallback(async (imageUrl: string): Promise<boolean> => {
    const { error } = await supabase.from('stories').insert({ image_url: imageUrl });
    if (error) { console.error('Add story error:', error); return false; }
    await fetchStories();
    return true;
  }, [fetchStories]);

  return { stories, loading, addStory, refresh: fetchStories };
}
