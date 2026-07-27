import { useState } from 'react';
import { FeedPost } from '@/hooks/use-feed';
import { useComments, CommentItem } from '@/hooks/use-comments';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentUser } from '@/lib/store';

interface PostCardProps {
  post: FeedPost;
  index: number;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => Promise<boolean>;
}

export function PostCard({ post, index, onLike, onComment }: PostCardProps) {
  const currentUser = useCurrentUser();
  const [liked, setLiked] = useState(post.has_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLike = () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
    onLike(post.id);
  };

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikesCount(prev => prev + 1);
      onLike(post.id);
    }
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 1000);
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onComment(post.id, commentText.trim());
    if (ok) setCommentText('');
    setSubmitting(false);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-card border border-border sm:rounded-2xl overflow-hidden mb-6 mx-0 sm:mx-4 lg:mx-auto max-w-xl shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link href={`/profile/${post.author_username}`} className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-border">
            <AvatarImage src={post.author_avatar} />
            <AvatarFallback>{post.author_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <span className="font-semibold text-sm hover:underline">{post.author_username}</span>
            <span className="block text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at))} ago
            </span>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full">
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {/* Image */}
      <div
        className="relative w-full aspect-[4/5] bg-muted cursor-pointer overflow-hidden group"
        onDoubleClick={handleDoubleTap}
      >
        <img
          src={post.image_url}
          alt={post.caption}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <AnimatePresence>
          {showHeartAnim && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`transition-all active:scale-75 ${liked ? 'text-destructive' : 'text-foreground hover:text-muted-foreground'}`}
          >
            <Heart className={`w-7 h-7 ${liked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-foreground hover:text-muted-foreground transition-colors"
          >
            <MessageCircle className="w-7 h-7" />
          </button>
          <button className="text-foreground hover:text-muted-foreground transition-colors">
            <Send className="w-7 h-7" />
          </button>
        </div>
        <button className="text-foreground hover:text-muted-foreground transition-colors active:scale-75">
          <Bookmark className="w-7 h-7" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        <p className="font-semibold text-sm mb-1">{likesCount.toLocaleString()} likes</p>
        {post.caption && (
          <p className="text-sm">
            <Link href={`/profile/${post.author_username}`}>
              <span className="font-semibold mr-2 hover:underline">{post.author_username}</span>
            </Link>
            {post.caption.split(' ').map((word, i) => {
              if (word.startsWith('#')) return <span key={i} className="text-primary cursor-pointer hover:underline">{word} </span>;
              if (word.startsWith('@')) return <span key={i} className="text-primary font-medium cursor-pointer hover:underline">{word} </span>;
              return <span key={i}>{word} </span>;
            })}
          </p>
        )}

        {post.comments_count > 0 && !showComments && (
          <button
            onClick={() => setShowComments(true)}
            className="text-muted-foreground text-sm mt-2 font-medium hover:text-foreground transition-colors"
          >
            View all {post.comments_count} comments
          </button>
        )}
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CommentsList postId={post.id} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comment input */}
      {currentUser && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
          <Avatar className="w-7 h-7">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
          </Avatar>
          <Input
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCommentSubmit(); }}
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={handleCommentSubmit}
            disabled={!commentText.trim() || submitting}
            className="text-primary text-sm font-semibold opacity-50 hover:opacity-100 transition-opacity disabled:opacity-25"
          >
            Post
          </button>
        </div>
      )}
    </motion.article>
  );
}

function CommentsList({ postId }: { postId: string }) {
  const { comments, loading } = useComments(postId);

  if (loading) return <div className="px-4 py-3 text-sm text-muted-foreground">Loading comments...</div>;
  if (comments.length === 0) return <div className="px-4 py-3 text-sm text-muted-foreground">No comments yet</div>;

  return (
    <div className="px-4 py-2 space-y-3 max-h-64 overflow-y-auto">
      {comments.map(c => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar className="w-6 h-6 shrink-0 mt-0.5">
            <AvatarImage src={c.author_avatar} />
            <AvatarFallback className="text-xs">{c.author_name[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-semibold mr-1">{c.author_username}</span>
              {c.content}
            </p>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at))} ago
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
