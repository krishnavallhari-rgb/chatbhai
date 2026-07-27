import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CommentItem {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar: string;
}

export function useComments(postId: string | null) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId) { setComments([]); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (cancelled || error) { setLoading(false); return; }

      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      setComments((data || []).map(c => {
        const author = profileMap.get(c.user_id);
        return {
          id: c.id,
          post_id: c.post_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          author_name: author?.name || 'Unknown',
          author_username: author?.username || 'unknown',
          author_avatar: author?.avatar || '',
        };
      }));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [postId]);

  return { comments, loading };
}
