/**
 * Profile page – loads all data from Supabase.
 *
 * Shows avatar, username, display name, bio, followers/following/post
 * counts, and follow/unfollow button. Posts grid shows real posts
 * from the posts table (empty until posts are created).
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/use-profile";
import { useFollow } from "@/hooks/use-follow";
import { openOrCreateConversation } from "@/lib/conversations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid, PlaySquare, Bookmark, Settings, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface DbPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export default function Profile({ params }: { params: { username: string } }) {
  const [, setLocation] = useLocation();
  const { profile, loading, error, refresh } = useProfile(params.username);
  const { follow, unfollow, loading: followLoading } = useFollow();
  const [posts, setPosts] = useState<DbPost[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [followHovered, setFollowHovered] = useState(false);

  // Fetch posts for this profile
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setPosts((data || []) as DbPost[]);
    })();
  }, [profile?.id]);

  // Find existing conversation for the "Message" button
  const handleMessage = async () => {
    if (!profile || profile.isSelf) return;
    setMsgLoading(true);
    try {
      const convId = await openOrCreateConversation(profile.id);
      if (convId) setLocation(`/messages/${convId}`);
    } finally {
      setMsgLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    if (profile.isFollowing) {
      await unfollow(profile.id);
    } else {
      await follow(profile.id);
    }
    refresh();
  };

  // ── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4">
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center">
          <span className="text-4xl">?</span>
        </div>
        <h2 className="text-xl font-bold">{error || 'User not found'}</h2>
        <Button variant="outline" onClick={() => setLocation('/feed')}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[900px] mx-auto min-h-[100dvh] pb-24 md:pb-8"
    >
      {/* Header/Cover */}
      <div className="h-48 md:h-64 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-slate-800 dark:to-slate-700 w-full relative" />

      <div className="px-4 md:px-8 relative -mt-16 sm:-mt-20">
        <div className="flex justify-between items-end mb-4">
          <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-background shadow-lg">
            <AvatarImage src={profile.avatar} />
            <AvatarFallback className="text-4xl">{profile.name[0]}</AvatarFallback>
          </Avatar>

          <div className="flex gap-2 pb-4">
            {profile.isSelf ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl font-semibold"
                  onClick={() => setLocation("/profile/edit")}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setLocation("/settings")}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={profile.isFollowing ? "outline" : "default"}
                  className={`rounded-xl font-semibold w-28 transition-colors ${
                    profile.isFollowing && followHovered
                      ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      : ""
                  }`}
                  onClick={handleFollowToggle}
                  onMouseEnter={() => setFollowHovered(true)}
                  onMouseLeave={() => setFollowHovered(false)}
                  disabled={followLoading}
                >
                  {followLoading
                    ? "..."
                    : profile.isFollowing
                      ? (followHovered ? "Unfollow" : "Following")
                      : "Follow"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl font-semibold"
                  onClick={handleMessage}
                  disabled={msgLoading}
                >
                  {msgLoading ? "..." : "Message"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {profile.name}
          </h1>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>

        {profile.bio && (
          <div className="mt-4 text-foreground whitespace-pre-wrap">
            {profile.bio}
          </div>
        )}

        <div className="flex gap-6 mt-6 border-y border-border py-4">
          <div className="flex flex-col">
            <span className="font-bold text-lg">{profile.postCount}</span>
            <span className="text-muted-foreground text-sm">Posts</span>
          </div>
          <Link
            href={`/profile/${profile.username}/followers`}
            className="flex flex-col cursor-pointer hover:opacity-80"
          >
            <span className="font-bold text-lg">{profile.followerCount}</span>
            <span className="text-muted-foreground text-sm">Followers</span>
          </Link>
          <Link
            href={`/profile/${profile.username}/following`}
            className="flex flex-col cursor-pointer hover:opacity-80"
          >
            <span className="font-bold text-lg">{profile.followingCount}</span>
            <span className="text-muted-foreground text-sm">Following</span>
          </Link>
        </div>

        <Tabs defaultValue="posts" className="mt-6 w-full">
          <TabsList className="w-full flex bg-transparent border-b border-border rounded-none h-auto p-0 space-x-8 justify-start overflow-x-auto scrollbar-none">
            <TabsTrigger
              value="posts"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-4 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Grid className="w-4 h-4 mr-2" /> Posts
            </TabsTrigger>
            <TabsTrigger
              value="reels"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-4 text-muted-foreground data-[state=active]:text-foreground"
            >
              <PlaySquare className="w-4 h-4 mr-2" /> Reels
            </TabsTrigger>
            {profile.isSelf && (
              <TabsTrigger
                value="saved"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-4 text-muted-foreground data-[state=active]:text-foreground"
              >
                <Bookmark className="w-4 h-4 mr-2" /> Saved
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="posts" className="mt-4 focus-visible:outline-none">
            <div className="grid grid-cols-3 gap-1 md:gap-4">
              {posts.length > 0 ? (
                posts.map(post => (
                  <div
                    key={post.id}
                    className="aspect-square bg-muted cursor-pointer group relative overflow-hidden md:rounded-xl"
                  >
                    <img
                      src={post.image_url}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 text-white font-bold transition">
                      <div className="flex items-center gap-1">
                        <Heart className="w-5 h-5 fill-current" />{" "}
                        {post.likes_count}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-20 text-center text-muted-foreground">
                  No posts yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reels" className="mt-4 focus-visible:outline-none">
            <div className="py-20 text-center text-muted-foreground">
              No reels yet.
            </div>
          </TabsContent>

          <TabsContent
            value="saved"
            className="mt-4 focus-visible:outline-none"
          >
            <div className="py-20 text-center text-muted-foreground">
              No saved posts yet.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}
