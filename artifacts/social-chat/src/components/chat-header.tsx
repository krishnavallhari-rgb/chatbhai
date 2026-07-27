/**
 * ChatHeader – Premium modern chat header component.
 *
 * Features:
 * - 72px height with proper padding
 * - 56px circular avatar with gradient fallback
 * - Online/last-seen/typing status
 * - Verified badge support
 * - Clickable profile navigation
 * - Hover animations on avatar + username
 * - Tooltips on every action button
 * - Subtle hover ripple effect
 * - Smooth framer-motion slide animation
 * - Fully responsive (mobile/tablet/desktop)
 * - ARIA labels + keyboard navigation
 * - Sticky with backdrop blur
 * - Premium bottom border
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Phone,
  Video,
  Search,
  Images,
  MoreHorizontal,
  BadgeCheck,
  User,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as UserType } from "@/lib/mock-data";
import { useDeleteConversation } from "@/hooks/use-messages";

/* ── Props ─────────────────────────────────────────────────────────────── */

interface ChatHeaderProps {
  /** The selected conversation (undefined when no chat is open). */
  conversation: {
    id: string;
    isGroup: boolean;
    groupName?: string;
    members?: UserType[];
  } | null;
  /** Other participants (filtered to exclude current user). */
  otherUsers: UserType[];
  /** Whether the primary other user is "online" (active < 2 min ago). */
  isOnline: boolean;
  /** Human-readable status label, e.g. "Active now" or "Active 3h ago". */
  onlineLabel: string;
  /** Current user ID for group member filtering. */
  currentUserId?: string;
  /** True while conversation data is still being fetched. */
  loading?: boolean;
}

/* ── Gradient fallback for missing avatars ──────────────────────────────── */

const GRADIENTS = [
  "from-rose-400 to-purple-500",
  "from-sky-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-pink-500",
  "from-cyan-400 to-blue-500",
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/* ── Shared button wrapper with hover + ripple ─────────────────────────── */

function HeaderIconButton({
  tooltip,
  onClick,
  children,
  className = "",
  ariaLabel,
}: {
  tooltip: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          onClick={onClick}
          className={`relative rounded-full h-10 w-10 text-muted-foreground
            hover:text-foreground hover:bg-accent/80
            transition-all duration-200 ease-out
            active:scale-90 active:bg-accent
            focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
            ${className}`}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

export default function ChatHeader({
  conversation,
  otherUsers,
  isOnline,
  onlineLabel,
  currentUserId,
  loading = false,
}: ChatHeaderProps) {
  const [, setLocation] = useLocation();

  const isGroup = conversation?.isGroup ?? false;

  const displayUser = !isGroup ? otherUsers[0] : undefined;

  const { deleteConversation, deleting } = useDeleteConversation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    if (!conversation) return;
    const success = await deleteConversation(conversation.id);
    setDeleteOpen(false);
    if (success) {
      setLocation("/messages");
    }
  };

  if (conversation) {
    console.log('[Chat] ChatHeader - otherUsers:', otherUsers.length, otherUsers.map(u => ({ name: u.name, username: '@' + u.username, id: u.id.slice(0, 8) })));
    console.log('[Chat] ChatHeader - displayUser:', displayUser ? { name: displayUser.name, username: '@' + displayUser.username } : 'UNDEFINED');
  }

  const displayName = displayUser?.name || 'Unknown User';
  const displayUsername = displayUser?.username || 'unknown';
  const displayAvatar = displayUser?.avatar || '/images/placeholder.svg';
  const displayId = displayUser?.id || '';

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const profileHref =
    !isGroup && displayUser
      ? `/profile/${displayUser.username}`
      : undefined;

  if (loading && !conversation) {
    return (
      <div
        className="sticky top-0 z-20
          h-[72px] px-5 md:px-6
          flex items-center justify-between gap-4
          bg-background/80 backdrop-blur-xl
          border-b border-[#E5E7EB]
          shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <Skeleton className="w-14 h-14 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>
    );
  }

  if (!conversation) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <motion.header
        key={conversation.id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        role="banner"
        aria-label="Chat header"
        className="sticky top-0 z-20
          h-[72px] px-5 md:px-6
          flex items-center justify-between gap-4
          bg-background/80 backdrop-blur-xl
          border-b border-[#E5E7EB]
          shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        {/* ── Left section: back + avatar + info ──────────────── */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Mobile back button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to conversations"
            onClick={() => setLocation("/messages")}
            className="md:hidden shrink-0 rounded-full h-10 w-10 -ml-2
              text-muted-foreground hover:text-foreground hover:bg-accent/80
              transition-all duration-200 active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* ── Avatar ────────────────────────────────────────── */}
          {isGroup ? (
            <GroupAvatar
              users={otherUsers}
              groupName={conversation.groupName}
            />
          ) : (
            <Link href={profileHref || "#"}>
              <div
                className="relative shrink-0 cursor-pointer group/avatar"
                role="link"
                aria-label={`View ${displayName}'s profile`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLocation(profileHref || "#");
                  }
                }}
              >
                <Avatar
                  className="w-14 h-14 ring-2 ring-background
                    transition-transform duration-200
                    group-hover/avatar:scale-105"
                >
                  <AvatarImage
                    src={displayAvatar}
                    alt={displayName}
                  />
                  <AvatarFallback
                    className={`text-lg font-bold text-white bg-gradient-to-br ${getGradient(
                      displayId,
                    )}`}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator */}
                {isOnline && (
                  <span
                    className="absolute bottom-0.5 right-0.5
                      w-3.5 h-3.5 bg-green-500
                      border-[2.5px] border-background rounded-full
                      shadow-[0_0_0_1px_rgba(34,197,94,0.3)]
                      animate-pulse"
                    aria-label="Online"
                  />
                )}
              </div>
            </Link>
          )}

          {/* ── Name + status ─────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {isGroup ? (
              <div className="min-w-0">
                <h2
                  className="text-[17px] font-bold leading-tight truncate
                    text-foreground"
                >
                  {conversation.groupName || "Group Chat"}
                </h2>
                <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                  {otherUsers.length} member{otherUsers.length !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <Link href={profileHref || "#"}>
                <div className="cursor-pointer group/name min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2
                      className="text-[17px] font-bold leading-tight truncate
                        text-foreground
                        transition-colors duration-150
                        group-hover/name:text-primary"
                    >
                      {displayName}
                    </h2>
                    {displayUser?.verified && (
                      <BadgeCheck
                        className="w-[18px] h-[18px] text-primary shrink-0 fill-primary/20"
                        aria-label="Verified account"
                      />
                    )}
                  </div>
                  <p
                    className="text-[13px] text-muted-foreground leading-tight
                      truncate mt-0.5
                      transition-colors duration-150
                      group-hover/name:text-foreground/70"
                  >
                    @{displayUsername}
                  </p>
                </div>
              </Link>
            )}

            {/* Status line */}
            {onlineLabel && (
              <p
                className={`text-[12px] leading-tight mt-0.5 font-medium
                  transition-colors duration-300
                  ${isOnline ? "text-green-500" : "text-muted-foreground"}`}
                aria-live="polite"
              >
                {isOnline && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />
                )}
                {onlineLabel}
              </p>
            )}
          </div>
        </div>

        {/* ── Right section: action buttons ───────────────────── */}
        <div className="flex items-center gap-1 shrink-0">
          <HeaderIconButton
            tooltip="Audio Call"
            ariaLabel="Start audio call"
            className="hidden sm:flex"
          >
            <Phone className="w-[18px] h-[18px]" />
          </HeaderIconButton>

          <HeaderIconButton
            tooltip="Video Call"
            ariaLabel="Start video call"
            className="hidden sm:flex"
          >
            <Video className="w-[18px] h-[18px]" />
          </HeaderIconButton>

          <HeaderIconButton
            tooltip="Search Messages"
            ariaLabel="Search in this conversation"
            className="hidden md:flex"
          >
            <Search className="w-[18px] h-[18px]" />
          </HeaderIconButton>

          <HeaderIconButton
            tooltip="Shared Media"
            ariaLabel="View shared photos and files"
            className="hidden md:flex"
          >
            <Images className="w-[18px] h-[18px]" />
          </HeaderIconButton>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="More options"
                className="relative rounded-full h-10 w-10 text-muted-foreground
                  hover:text-foreground hover:bg-accent/80
                  transition-all duration-200 ease-out
                  active:scale-90 active:bg-accent
                  focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-52"
            >
              {!isGroup && displayUser && (
                <>
                  <DropdownMenuLabel className="p-0">
                    <div className="flex items-center gap-2.5 px-2.5 py-2">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={displayAvatar} />
                        <AvatarFallback
                          className={`text-xs font-bold text-white bg-gradient-to-br ${getGradient(
                            displayId,
                          )}`}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          @{displayUsername}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() =>
                  setLocation(`/profile/${displayUser?.username || 'unknown'}`)
                }
              >
                <User className="w-4 h-4" />
                View Profile
              </DropdownMenuItem>
              {displayUser?.bio && (
                <DropdownMenuItem
                  onClick={() =>
                    setLocation(`/profile/${displayUser.username}`)
                  }
                >
                  <MessageCircle className="w-4 h-4" />
                  About
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.header>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove you from the conversation. You won't be able to see these messages anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

/* ── Group avatar sub-component ──────────────────────────────────────────── */

function GroupAvatar({
  users,
  groupName,
}: {
  users: UserType[];
  groupName?: string;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-muted
          border-2 border-background
          flex items-center justify-center overflow-hidden
          transition-transform duration-200 hover:scale-105"
      >
        <div className="flex flex-wrap gap-0 p-1 justify-center items-center">
          {users.slice(0, 4).map((u, idx) => (
            <Avatar
              key={u.id}
              className="w-[20px] h-[20px] rounded-full ring-1 ring-background"
              style={{ marginLeft: idx > 0 ? -5 : 0 }}
            >
              <AvatarImage src={u.avatar} />
              <AvatarFallback
                className={`text-[7px] font-bold text-white bg-gradient-to-br ${getGradient(
                  u.id,
                )}`}
              >
                {(u.name || '?')[0]}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
      {users.length > 4 && (
        <div
          className="absolute -bottom-0.5 -right-0.5
            w-5 h-5 bg-primary text-primary-foreground
            rounded-full flex items-center justify-center
            text-[9px] font-bold
            border-2 border-background
            shadow-sm"
        >
          +{users.length - 4}
        </div>
      )}
    </div>
  );
}
