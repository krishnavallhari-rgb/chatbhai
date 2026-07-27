/**
 * Search page – live search against Supabase profiles.
 *
 * Shows suggested users and recent searches when the query is empty.
 * Live-searches as the user types (debounced 300ms).
 * Each user row includes a Message button that creates/reuses a
 * private conversation.
 */

import { motion } from "framer-motion";
import { SearchIcon, X, Clock, Trash2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/hooks/use-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { openOrCreateConversation } from "@/lib/conversations";

export default function Search() {
  const [, setLocation] = useLocation();
  const {
    query,
    setQuery,
    results,
    suggested,
    recentSearches,
    loading,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useSearch();

  const handleUserClick = (userId: string) => {
    addRecentSearch(userId);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[600px] mx-auto min-h-[100dvh] bg-background border-l border-r border-border"
    >
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md p-4 border-b border-border">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-12 h-12 bg-accent/50 rounded-xl border-none focus-visible:ring-1 focus-visible:ring-primary text-base"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2">
        {/* Loading */}
        {loading && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Searching...
          </div>
        )}

        {/* No results */}
        {query && !loading && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No results found for "{query}"
          </div>
        )}

        {/* Search results */}
        {results.length > 0 && (
          <div className="space-y-1">
            {results.map(user => (
              <UserRow
                key={user.id}
                user={user}
                onUserClick={handleUserClick}
                setLocation={setLocation}
              />
            ))}
          </div>
        )}

        {/* Default view: recent searches + suggested */}
        {!query && (
          <div className="p-4 space-y-8">
            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent Searches
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive text-xs h-8"
                    onClick={clearRecentSearches}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear all
                  </Button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onUserClick={handleUserClick}
                      setLocation={setLocation}
                      onRemove={() => removeRecentSearch(user.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggested users */}
            {suggested.length > 0 && (
              <div>
                <h3 className="font-semibold text-muted-foreground mb-4">
                  Suggested for you
                </h3>
                <div className="space-y-1">
                  {suggested.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onUserClick={handleUserClick}
                      setLocation={setLocation}
                    />
                  ))}
                </div>
              </div>
            )}

            {recentSearches.length === 0 && suggested.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Search for users</p>
                <p className="text-sm mt-1">
                  Find people by username or display name
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Shared user row with avatar, name, and Message button. */
function UserRow({
  user,
  onUserClick,
  setLocation,
  onRemove,
}: {
  user: { id: string; username: string; name: string; avatar: string };
  onUserClick: (userId: string) => void;
  setLocation: (path: string) => void;
  onRemove?: () => void;
}) {
  const [msgLoading, setMsgLoading] = useState(false);

  const handleMessage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMsgLoading(true);
    try {
      const convId = await openOrCreateConversation(user.id);
      if (convId) setLocation(`/messages/${convId}`);
    } finally {
      setMsgLoading(false);
    }
  };

  return (
    <Link href={`/profile/${user.username}`} onClick={() => onUserClick(user.id)}>
      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors cursor-pointer">
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">{user.username}</span>
          <p className="text-sm text-muted-foreground truncate">{user.name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-9 h-9 text-muted-foreground hover:text-primary"
            onClick={handleMessage}
            disabled={msgLoading}
            title={`Message ${user.username}`}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          {onRemove && (
            <button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
