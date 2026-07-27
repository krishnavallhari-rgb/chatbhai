/**
 * Notifications page – loads from Supabase with Realtime updates.
 *
 * Shows follow, like, comment, and mention notifications.
 * Follow notifications include a "Follow Back" button.
 */

import { motion } from "framer-motion";
import { Link } from "wouter";
import { useNotifications } from "@/hooks/use-notifications";
import { useFollow } from "@/hooks/use-follow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/store";

const IconMap: Record<
  string,
  { icon: typeof Heart; color: string }
> = {
  follow: { icon: UserPlus, color: "text-secondary bg-secondary/10" },
  like: { icon: Heart, color: "text-destructive bg-destructive/10" },
  comment: { icon: MessageCircle, color: "text-primary bg-primary/10" },
  mention: { icon: AtSign, color: "text-warning bg-warning/10" },
};

/** Check if the current user follows a given user. */
function useIsFollowing(targetUserId: string | null) {
  const currentUser = useCurrentUser();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!currentUser || !targetUserId || targetUserId === currentUser.id) {
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', targetUserId)
        .eq('status', 'accepted')
        .maybeSingle();
      setIsFollowing(!!data);
    })();
  }, [currentUser, targetUserId]);

  const setFollowing = useCallback((val: boolean) => setIsFollowing(val), []);

  return { isFollowing, setFollowing };
}

export default function Notifications() {
  const {
    notifications,
    loading,
    markAllAsRead,
  } = useNotifications();
  const { follow, unfollow } = useFollow();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-[600px] mx-auto min-h-[100dvh] bg-background border-l border-r border-border pb-24 md:pb-8"
    >
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary font-medium"
          onClick={markAllAsRead}
        >
          Mark all read
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm mt-1">
            When someone interacts with you, you'll see it here.
          </p>
        </div>
      )}

      <div className="divide-y divide-border">
        {notifications.map(notif => {
          const { icon: Icon, color } =
            IconMap[notif.type] || IconMap.follow;

          return (
            <NotificationItem
              key={notif.id}
              notif={notif}
              Icon={Icon}
              color={color}
              follow={follow}
              unfollow={unfollow}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

function NotificationItem({
  notif,
  Icon,
  color,
  follow: followFn,
  unfollow: unfollowFn,
}: {
  notif: ReturnType<typeof useNotifications> extends { notifications: (infer T)[] }
    ? T
    : never;
  Icon: typeof Heart;
  color: string;
  follow: (id: string) => Promise<boolean>;
  unfollow: (id: string) => Promise<boolean>;
}) {
  const { isFollowing, setFollowing } = useIsFollowing(
    notif.type === 'follow' ? notif.actorId : null,
  );

  const handleFollowBack = async () => {
    if (isFollowing) {
      await unfollowFn(notif.actorId);
      setFollowing(false);
    } else {
      await followFn(notif.actorId);
      setFollowing(true);
    }
  };

  const actorName = notif.actor?.username || 'unknown';
  const actorAvatar = notif.actor?.avatar_url || undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`p-4 flex items-start gap-4 transition-colors hover:bg-accent/50 ${!notif.read ? 'bg-primary/5' : ''}`}
    >
      <div className="relative shrink-0">
        <Link href={`/profile/${actorName}`}>
          <Avatar className="w-12 h-12 cursor-pointer">
            <AvatarImage src={actorAvatar} />
            <AvatarFallback>{actorName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div
          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${color} border-2 border-background`}
        >
          <Icon
            className="w-3.5 h-3.5"
            fill={notif.type === 'like' ? 'currentColor' : 'none'}
          />
        </div>
      </div>

      <div className="flex-1 pt-1">
        <p className="text-sm text-foreground">
          <Link href={`/profile/${actorName}`}>
            <span className="font-semibold cursor-pointer hover:underline mr-1">
              {actorName}
            </span>
          </Link>
          {notif.type === 'follow' && 'started following you.'}
          {notif.type === 'like' && 'liked your post.'}
          {notif.type === 'comment' && 'commented on your post.'}
          {notif.type === 'mention' && 'mentioned you.'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notif.timestamp))} ago
        </p>
      </div>

      {notif.type === 'follow' && (
        <Button
          size="sm"
          variant={isFollowing ? 'outline' : 'default'}
          className="shrink-0 h-8 rounded-lg font-semibold text-xs"
          onClick={handleFollowBack}
        >
          {isFollowing ? 'Following' : 'Follow Back'}
        </Button>
      )}

      {!notif.read && (
        <div className="w-2 h-2 rounded-full bg-primary mt-3 shrink-0" />
      )}
    </motion.div>
  );
}
