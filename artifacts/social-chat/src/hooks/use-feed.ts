import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface FeedPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  has_liked: boolean;
  author_name: string;
  author_username: string;
  author_avatar: string;
}

export function useFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      const { data: posts, error: postsErr } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsErr) throw postsErr;

      // Get all author profiles
      const authorIds = [...new Set((posts || []).map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar')
        .in('id', authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Get current user's liked posts
      let likedPostIds = new Set<string>();
      if (uid) {
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', uid)
          .in('post_id', (posts || []).map(p => p.id));

        likedPostIds = new Set((likes || []).map(l => l.post_id));
      }

      const feedPosts: FeedPost[] = (posts || []).map(p => {
        const author = profileMap.get(p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          image_url: p.image_url,
          caption: p.caption || '',
          likes_count: p.likes_count || 0,
          comments_count: p.comments_count || 0,
          created_at: p.created_at,
          has_liked: likedPostIds.has(p.id),
          author_name: author?.name || 'Unknown',
          author_username: author?.username || 'unknown',
          author_avatar: author?.avatar || '',
        };
      });

      setPosts(feedPosts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const toggleLike = useCallback(async (postId: string) => {
    const { data, error } = await supabase.rpc('handle_post_like', { target_post_id: postId });
    if (error) { console.error('Like error:', error); return; }
    const result = data as { liked: boolean; likes_count: number };
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      has_liked: result.liked,
      likes_count: result.likes_count,
    } : p));
  }, []);

  const addComment = useCallback(async (postId: string, content: string): Promise<boolean> => {
    const { error } = await supabase.rpc('add_post_comment', {
      target_post_id: postId,
      comment_content: content,
    });
    if (error) { console.error('Comment error:', error); return false; }
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      comments_count: p.comments_count + 1,
    } : p));
    return true;
  }, []);

  const addPost = useCallback(async (imageUrl: string, caption: string): Promise<boolean> => {
    const { error } = await supabase.from('posts').insert({
      image_url: imageUrl,
      caption,
    });
    if (error) { console.error('Add post error:', error); return false; }
    await fetchPosts();
    return true;
  }, [fetchPosts]);

  return { posts, loading, error, toggleLike, addComment, addPost, refresh: fetchPosts };
}
