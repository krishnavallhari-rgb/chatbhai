import { motion } from "framer-motion";
import { Link } from "wouter";
import { POSTS, USERS } from "@/lib/mock-data";
import { Search, Compass, TrendingUp, Grid, Image as ImageIcon, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function Explore() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full max-w-[1000px] mx-auto min-h-[100dvh] pb-24 md:pb-8"
    >
      {/* Search Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border p-4">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            placeholder="Search for people, hashtags, or places..." 
            className="pl-10 h-12 bg-accent/50 border-none rounded-2xl w-full"
          />
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-8">
        
        {/* Suggested Users */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Suggested for you
          </h2>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-4">
            {USERS.slice(1, 6).map(user => (
              <div key={user.id} className="min-w-[140px] bg-card border border-border p-4 rounded-2xl flex flex-col items-center gap-2 text-center">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm truncate w-24">{user.username}</div>
                  <div className="text-xs text-muted-foreground truncate w-24">{user.name}</div>
                </div>
                <button className="mt-2 w-full bg-primary text-primary-foreground text-xs font-bold py-1.5 rounded-lg hover:bg-primary/90 transition">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Trending Categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
          {["For You", "Design", "Photography", "Travel", "Architecture", "Art"].map(cat => (
            <button key={cat} className="px-4 py-2 rounded-full border border-border bg-card hover:bg-accent text-sm font-medium whitespace-nowrap transition">
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {POSTS.map((post, i) => (
            <div 
              key={post.id} 
              className={`relative aspect-square group cursor-pointer overflow-hidden ${i % 5 === 0 ? 'col-span-2 row-span-2' : ''} md:rounded-xl`}
            >
              <img src={post.image} alt={post.caption} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center gap-4">
                <div className="flex items-center text-white font-bold gap-1">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  {post.likes}
                </div>
                <div className="flex items-center text-white font-bold gap-1">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                  {post.comments}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
