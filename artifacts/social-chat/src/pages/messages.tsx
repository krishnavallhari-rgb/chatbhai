/**
 * Messages page – wired to Supabase Realtime.
 *
 * All data comes from Supabase. No mock data.
 *
 * ROOT CAUSE FIX: The original code defined `Sidebar` and `ChatArea` as
 * arrow functions inside the component body, then rendered them as
 * `<Sidebar />` and `<ChatArea />`. Because the function reference changes
 * on every render (closure), React treats them as different component types
 * and unmounts/remounts them — destroying the Input DOM node each time.
 * The fix is to inline the JSX directly.
 */

import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Paperclip, Smile, Mic, Send,
  Edit2, Check, CheckCheck, Search,
  MessageCircle, User, Trash2, MoreVertical
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChatHeader from "@/components/chat-header";

import { useCurrentUser } from "@/lib/store";
import { useConversations } from "@/hooks/use-conversations";
import {
  useMessages,
  useRealtimeMessages,
  useSendMessage,
  useMarkAsRead,
  useDeleteConversation,
} from "@/hooks/use-messages";

export default function Messages({ params }: { params?: { id?: string } }) {
  const [, setLocation] = useLocation();
  const selectedConvId = params?.id;
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUser = useCurrentUser();
  const { conversations, loading: convLoading } = useConversations();

  const selectedConv = useMemo(
    () => conversations.find(c => c.id === selectedConvId),
    [conversations, selectedConvId],
  );

  const otherUsers = useMemo(
    () =>
      currentUser?.id && selectedConv?.members
        ? selectedConv.members.filter(m => m.id !== currentUser.id)
        : [],
    [selectedConv, currentUser],
  );

  useEffect(() => {
    if (selectedConv) {
      console.log('[Chat] ═══════════════════════════════════════');
      console.log('[Chat] messages.tsx - Current User ID:', currentUser?.id);
      console.log('[Chat] messages.tsx - Selected conv:', selectedConv.id.slice(0, 8));
      console.log('[Chat] messages.tsx - Conv members:', selectedConv.members?.map(m => ({
        id: m.id.slice(0, 8),
        name: m.name,
        username: '@' + m.username,
      })));
      console.log('[Chat] messages.tsx - otherUsers:', otherUsers.map(m => ({
        id: m.id.slice(0, 8),
        name: m.name,
        username: '@' + m.username,
      })));
      console.log('[Chat] messages.tsx - otherUsers.length:', otherUsers.length);
      if (otherUsers.length === 0) {
        console.error('[Chat] messages.tsx - ⚠️ otherUsers is EMPTY!');
        console.error('[Chat] messages.tsx - This means either:');
        console.error('[Chat] messages.tsx -   1. No conversation members exist');
        console.error('[Chat] messages.tsx -   2. The only member is the current user');
        console.error('[Chat] messages.tsx -   3. Members have missing/empty profiles');
      }
    }
  }, [selectedConv, otherUsers, currentUser]);

  const {
    messages,
    addOptimisticMessage,
    reconcileMessage,
    addMessage,
    updateMessage,
    removeMessage,
  } = useMessages(selectedConvId);

  const { sendMessage, sending } = useSendMessage();
  const { markAsRead } = useMarkAsRead();
  const { deleteConversation } = useDeleteConversation();

  const handleDeleteFromSidebar = useCallback(async (convId: string) => {
    const success = await deleteConversation(convId);
    if (success && convId === selectedConvId) {
      setLocation("/messages");
    }
  }, [deleteConversation, selectedConvId, setLocation]);

  // ── Realtime ─────────────────────────────────────────────────────────
  useRealtimeMessages(selectedConvId, {
    onNewMessage: addMessage,
    onUpdateMessage: updateMessage,
    onRemoveMessage: removeMessage,
    onReadReceipt: (messageId, readerId) => {
      if (readerId !== currentUser?.id) {
        updateMessage(messageId, { status: "seen" });
      }
    },
  });

  useEffect(() => {
    if (selectedConvId) markAsRead(selectedConvId);
  }, [selectedConvId, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedConvId]);

  // ── Send handler ─────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !selectedConvId || !currentUser || sending) return;

    const text = inputText.trim();
    setInputText("");

    const tempId = addOptimisticMessage({
      id: "",
      conversationId: selectedConvId,
      senderId: currentUser.id,
      text,
      timestamp: new Date().toISOString(),
      status: "sent",
    });

    const realMsg = await sendMessage(selectedConvId, text);

    if (realMsg) {
      reconcileMessage(tempId, realMsg);
    } else {
      removeMessage(tempId);
    }
  }, [
    inputText,
    selectedConvId,
    currentUser,
    sending,
    addOptimisticMessage,
    sendMessage,
    reconcileMessage,
    removeMessage,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Helpers ───────────────────────────────────────────────────────────
  const getOthers = useCallback(
    (convId: string) => {
      const conv = conversations.find(c => c.id === convId);
      return conv?.members?.filter(m => m.id !== currentUser?.id) || [];
    },
    [conversations, currentUser],
  );

  // ── Memoized sidebar row ─────────────────────────────────────────────
  const ConversationRow = memo(function ConversationRow({
    conv,
    isActive,
    onDelete,
  }: {
    conv: (typeof conversations)[number];
    isActive: boolean;
    onDelete: (convId: string) => void;
  }) {
    const others = getOthers(conv.id);
    const title = conv.isGroup ? conv.groupName : others[0]?.name;
    const avatar = conv.isGroup ? null : others[0]?.avatar;
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
      <div className="relative group/row">
        <div
          className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
        >
          <Link href={`/messages/${conv.id}`} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              {conv.isGroup ? (
                <div className="w-14 h-14 rounded-full bg-accent flex flex-wrap p-1 gap-0.5 relative">
                  {others.slice(0, 3).map(u => (
                    <Avatar key={u.id} className="w-5 h-5">
                      <AvatarImage src={u.avatar} />
                    </Avatar>
                  ))}
                </div>
              ) : (
                <Avatar className="w-14 h-14 border border-background">
                  <AvatarImage src={avatar || ""} />
                  <AvatarFallback>{title?.[0]}</AvatarFallback>
                </Avatar>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h3
                  className={`font-semibold text-sm truncate ${
                    isActive ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {title}
                </h3>
                {conv.lastMessage && (
                  <span
                    className={`text-xs whitespace-nowrap ml-2 ${
                      isActive
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatDistanceToNow(
                      new Date(conv.lastMessage.timestamp),
                    ).replace("about ", "")}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center gap-2">
                <p
                  className={`text-sm truncate ${
                    isActive
                      ? "text-primary-foreground/90"
                      : "text-muted-foreground"
                  } ${
                    conv.unreadCount > 0 && !isActive
                      ? "font-semibold text-foreground"
                      : ""
                  }`}
                >
                  {conv.lastMessage?.senderId === currentUser?.id ? "You: " : ""}
                  {conv.lastMessage?.text || "No messages yet"}
                </p>
                {conv.unreadCount > 0 && !isActive && (
                  <div className="shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* 3-dot menu */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.preventDefault()}
                  className={`p-1.5 rounded-full transition-all
                    ${isActive
                      ? "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                      : "text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground hover:bg-accent"
                    }`}
                  aria-label="Chat options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

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
                onClick={() => onDelete(conv.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  });

  // ── Online / last-seen status (DM only) ──────────────────────────────
  const { isOnline, onlineLabel } = useMemo(() => {
    const otherUserIds = new Set(otherUsers.map(u => u.id));
    const lastOtherMsg = [...messages]
      .reverse()
      .find(m => otherUserIds.has(m.senderId));
    const lastSeenTs = lastOtherMsg
      ? new Date(lastOtherMsg.timestamp).getTime()
      : 0;
    const online = Date.now() - lastSeenTs < 2 * 60 * 1000;
    const label = online
      ? "Active now"
      : lastSeenTs > 0
        ? `Active ${formatDistanceToNow(new Date(lastSeenTs)).replace("about ", "")} ago`
        : "";
    return { isOnline: online, onlineLabel: label };
  }, [messages, otherUsers]);

  // ── Render ────────────────────────────────────────────────────────────
  // IMPORTANT: Sidebar and ChatArea JSX are inlined directly here (NOT
  // defined as separate component functions) to prevent React from
  // unmounting/remounting them on every render. Defining them as
  // arrow functions inside the component body and rendering with
  // <Sidebar /> causes a new component type reference each render,
  // which destroys the Input DOM node and loses focus.

  return (
    <div className="flex w-full h-[100dvh] overflow-hidden bg-background">
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <div
        className={`w-full md:w-[350px] lg:w-[400px] h-full flex flex-col bg-card border-r border-border shrink-0 ${
          selectedConvId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold">Messages</h2>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Edit2 className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              className="pl-9 h-10 bg-accent/50 rounded-xl border-none"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map(conv => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                isActive={conv.id === selectedConvId}
                onDelete={handleDeleteFromSidebar}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ═══════════════ CHAT AREA ═══════════════ */}
      {!selectedConv ? (
        <div className="hidden md:flex flex-1 items-center justify-center bg-background/50 flex-col gap-4 text-center p-8">
          <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Your Messages</h2>
            <p className="text-muted-foreground max-w-md">
              Send private photos and messages to a friend or group.
            </p>
          </div>
          <Button className="rounded-xl">Send Message</Button>
        </div>
      ) : (
        <div
          className={`flex-1 flex flex-col bg-background h-full ${
            !selectedConvId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* ── Chat Header ─────────────────────────────────── */}
          <ChatHeader
            conversation={selectedConv}
            otherUsers={otherUsers}
            isOnline={isOnline}
            onlineLabel={onlineLabel}
            currentUserId={currentUser?.id}
            loading={convLoading && !selectedConv}
          />

          {/* ── Messages ────────────────────────────────────── */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => {
                const isMine = msg.senderId === currentUser?.id;
                const showAvatar =
                  !isMine &&
                  (i === messages.length - 1 ||
                    messages[i + 1].senderId !== msg.senderId);
                const sender = selectedConv.members?.find(
                  m => m.id === msg.senderId,
                );

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isMine && (
                      <div className="w-8 shrink-0 flex items-end">
                        {showAvatar && (
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={sender?.avatar} />
                          </Avatar>
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[70%] flex flex-col ${
                        isMine ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Display name — clickable dropdown */}
                      {!isMine && showAvatar && sender && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="text-xs font-semibold text-primary mb-1 hover:underline cursor-pointer px-1 -ml-1 rounded focus:outline-none"
                              type="button"
                            >
                              {sender.name}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side="top"
                            align="start"
                            sideOffset={4}
                            className="w-48"
                          >
                            <DropdownMenuLabel className="p-0">
                              <div className="flex items-center gap-2 px-2 py-1.5">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={sender.avatar} />
                                  <AvatarFallback className="text-xs">
                                    {sender.name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {sender.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    @{sender.username}
                                  </p>
                                </div>
                              </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setLocation(`/profile/${sender.username}`)
                              }
                            >
                              <User className="w-4 h-4" />
                              View Profile
                            </DropdownMenuItem>
                            {sender.bio && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setLocation(`/profile/${sender.username}`)
                                }
                              >
                                <MessageCircle className="w-4 h-4" />
                                About
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border border-border text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="text-[15px] leading-relaxed">
                          {msg.text}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isMine &&
                          (msg.status === "seen" ? (
                            <CheckCheck className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-muted-foreground" />
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* ── Input ───────────────────────────────────────── */}
          <div className="p-4 bg-background">
            <div className="bg-card border border-border rounded-full p-1 pl-4 flex items-center shadow-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground shrink-0 rounded-full w-8 h-8"
                  >
                    <Smile className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="w-fit p-0 border-border"
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setInputText(prev => prev + emojiData.emoji);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    lazyLoadEmojis
                    width={320}
                    height={400}
                  />
                </PopoverContent>
              </Popover>
              <Input
                ref={inputRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className="flex-1 bg-transparent border-none focus-visible:ring-0 shadow-none px-2"
              />
              {inputText.length > 0 ? (
                <Button
                  size="icon"
                  className="rounded-full shrink-0 h-9 w-9"
                  onClick={handleSend}
                  disabled={sending}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              ) : (
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground shrink-0 rounded-full w-8 h-8"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground shrink-0 rounded-full w-8 h-8 mr-1"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
