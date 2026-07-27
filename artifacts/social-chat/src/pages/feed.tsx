import { useFeed } from '@/hooks/use-feed';
import { useStories } from '@/hooks/use-stories';
import { PostCard } from '@/components/post-card';
import { StoriesBar } from '@/components/stories-bar';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Feather, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/lib/store';
import { Button } from '@/components/ui/button';

export default function Feed() {
  const currentUser = useCurrentUser();
  const { posts, loading, error, toggleLike, addComment } = useFeed();
  const { stories, loading: storiesLoading } = useStories();

  return (
    <div className="w-full max-w-2xl mx-auto pb-24 md:pb-8">
      {/* Stories */}
      <StoriesBar stories={stories} loading={storiesLoading} />

      {/* Floating create button */}
      <Link href="/create" className="fixed bottom-24 right-6 md:bottom-8 md:right-auto md:ml-[34rem] z-40">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 cursor-pointer"
        >
          <Feather className="w-6 h-6" />
        </motion.div>
      </Link>

      {/* Feed posts */}
      <div className="px-0 sm:px-4 mt-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-destructive font-medium">Failed to load feed</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-lg font-semibold text-foreground">No posts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first post or follow people to see their posts here.
            </p>
            <Link href="/create">
              <Button className="mt-4 rounded-xl">Create a Post</Button>
            </Link>
          </div>
        )}

        {posts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            index={i}
            onLike={toggleLike}
            onComment={addComment}
          />
        ))}
      </div>
    </div>
  );
}
