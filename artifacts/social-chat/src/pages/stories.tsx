import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { STORIES, USERS } from '@/lib/mock-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Heart, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function Stories({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const userId = params.id;
  const user = USERS.find(u => u.id === userId);
  
  // Find all stories for this user
  const userStories = STORIES.filter(s => s.userId === userId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const currentStory = userStories[currentIndex];

  useEffect(() => {
    if (!currentStory) return;

    const DURATION = 5000;
    const interval = 50;
    
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          handleNext();
          return 0;
        }
        return p + (100 / (DURATION / interval));
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, currentStory]);

  const handleNext = () => {
    if (currentIndex < userStories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      setLocation('/');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    } else {
      setLocation('/');
    }
  };

  if (!user || userStories.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white z-50">
        Story not found.
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      
      {/* Container to maintain aspect ratio on desktop */}
      <div className="w-full max-w-md h-full md:h-[90vh] md:rounded-3xl overflow-hidden relative bg-zinc-900 shadow-2xl">
        
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-4 px-3 bg-gradient-to-b from-black/50 to-transparent">
          {userStories.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{ 
                  width: i === currentIndex ? `${progress}%` : i < currentIndex ? '100%' : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-20 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border border-white/20">
              <AvatarImage src={user.avatar} />
            </Avatar>
            <div>
              <p className="font-semibold text-white text-sm shadow-sm">{user.username}</p>
              <p className="text-xs text-white/70 shadow-sm">2h</p>
            </div>
          </div>
          <button onClick={() => setLocation('/')} className="text-white p-2">
            <X className="w-6 h-6 drop-shadow-md" />
          </button>
        </div>

        {/* Image */}
        <div className="w-full h-full relative">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentStory.id}
              initial={{ opacity: 0.5, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.5 }}
              transition={{ duration: 0.3 }}
              src={currentStory.image} 
              alt="Story" 
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
          
          {/* Tap zones */}
          <div 
            className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" 
            onClick={handlePrev} 
          />
          <div 
            className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer" 
            onClick={handleNext} 
          />
        </div>

        {/* Footer (Reactions) */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-4 pb-8 md:pb-4">
          <Input 
            placeholder={`Reply to ${user.username}...`} 
            className="bg-transparent border-white/40 text-white placeholder:text-white/60 h-12 rounded-full focus-visible:ring-white/50 focus-visible:border-white/50"
          />
          <button className="text-white hover:scale-110 transition shrink-0">
            <Heart className="w-8 h-8" />
          </button>
          <button className="text-white hover:scale-110 transition shrink-0">
            <Send className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
