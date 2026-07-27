import { StoryItem } from '@/hooks/use-stories';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from 'lucide-react';
import { useCurrentUser } from '@/lib/store';

interface StoriesBarProps {
  stories: StoryItem[];
  loading: boolean;
}

export function StoriesBar({ stories, loading }: StoriesBarProps) {
  const currentUser = useCurrentUser();

  // Group stories by user_id, keep most recent per user
  const storyByUser = new Map<string, StoryItem>();
  for (const s of stories) {
    if (!storyByUser.has(s.user_id)) storyByUser.set(s.user_id, s);
  }

  return (
    <div className="w-full bg-background border-b border-border py-4 pl-4 overflow-x-auto scrollbar-none flex gap-4">
      {/* My Story Add */}
      {currentUser && (
        <div className="flex flex-col items-center gap-1 shrink-0 w-[72px]">
          <div className="relative w-16 h-16 rounded-full p-[2px] bg-border cursor-pointer">
            <Avatar className="w-full h-full border-2 border-background">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center border-2 border-background">
              <Plus className="w-3 h-3" strokeWidth={3} />
            </div>
          </div>
          <span className="text-xs text-muted-foreground truncate w-full text-center">Your story</span>
        </div>
      )}

      {loading && stories.length === 0 && (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0 w-[72px]">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="w-12 h-2 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Others Stories */}
      {[...storyByUser.values()].map(story => (
        <div key={story.id} className="flex flex-col items-center gap-1 shrink-0 w-[72px] group cursor-pointer">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-primary to-purple-500 group-hover:scale-105 transition-transform duration-200">
            <Avatar className="w-full h-full border-2 border-background">
              <AvatarImage src={story.author_avatar} />
              <AvatarFallback>{story.author_name[0]}</AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs font-medium text-foreground truncate w-full text-center">
            {story.author_username}
          </span>
        </div>
      ))}

      {!loading && stories.length === 0 && (
        <div className="flex items-center text-sm text-muted-foreground">
          No stories yet
        </div>
      )}
    </div>
  );
}
