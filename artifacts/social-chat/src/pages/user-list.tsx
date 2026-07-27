/**
 * User list page – used for both /:username/followers and /:username/following.
 *
 * Fetches the list of users from Supabase via useFollowers / useFollowing,
 * and shows a follow/unfollow button for each user.
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useProfile, useFollowers, useFollowing } from "@/hooks/use-profile";
import { useFollow } from "@/hooks/use-follow";
import { useCurrentUser } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User } from "@/lib/mock-data";

export default function UserList({
  params,
  mode,
}: {
  params: { username: string };
  mode: "followers" | "following";
}) {
  const [, setLocation] = useLocation();
  const currentUser = useCurrentUser();
  const { profile, loading: profileLoading } = useProfile(params.username);
  const { users, loading: listLoading } =
    mode === "followers"
      ? useFollowers(profile?.id)
      : useFollowing(profile?.id);
  const { follow, unfollow } = useFollow();

  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[600px] mx-auto min-h-[100dvh] bg-background border-l border-r border-border pb-24 md:pb-8"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md p-4 border-b border-border flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setLocation(`/profile/${params.username}`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">
          {profileLoading ? "..." : `@${params.username}`} {title}
        </h1>
      </div>

      {listLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!listLoading && users.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="font-medium">No {mode} yet</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {users.map(user => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={currentUser?.id === user.id}
            currentUserId={currentUser?.id}
            follow={follow}
            unfollow={unfollow}
          />
        ))}
      </div>
    </motion.div>
  );
}

function UserRow({
  user,
  isSelf,
  currentUserId,
  follow: followFn,
  unfollow: unfollowFn,
}: {
  user: User;
  isSelf: boolean;
  currentUserId?: string;
  follow: (id: string) => Promise<boolean>;
  unfollow: (id: string) => Promise<boolean>;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);

  // Check if current user follows this user
  useEffect(() => {
    if (isSelf || !currentUserId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle();
      setIsFollowing(!!data);
      setLoading(false);
    })();
  }, [user.id, currentUserId, isSelf]);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    if (isFollowing) {
      const ok = await unfollowFn(user.id);
      if (ok) setIsFollowing(false);
    } else {
      const ok = await followFn(user.id);
      if (ok) setIsFollowing(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors">
      <Link href={`/profile/${user.username}`}>
        <Avatar className="w-12 h-12 cursor-pointer">
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name[0]}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${user.username}`}>
          <span className="font-semibold text-sm cursor-pointer hover:underline">
            {user.username}
          </span>
        </Link>
        <p className="text-sm text-muted-foreground truncate">{user.name}</p>
      </div>
      {!isSelf && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          className={`rounded-xl font-semibold text-xs h-8 px-4 shrink-0 transition-colors ${
            isFollowing && hovered
              ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              : ""
          }`}
          onClick={handleToggle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          disabled={loading}
        >
          {loading ? "..." : isFollowing ? (hovered ? "Unfollow" : "Following") : "Follow"}
        </Button>
      )}
    </div>
  );
}
