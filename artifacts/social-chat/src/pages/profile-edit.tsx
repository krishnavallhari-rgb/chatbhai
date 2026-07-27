import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useApp, useCurrentUser } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfileEdit() {
  const [, setLocation] = useLocation();
  const { setCurrentUser } = useApp();
  const currentUser = useCurrentUser();
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: name.trim(),
          bio: bio.trim(),
        })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      setCurrentUser({
        ...currentUser,
        name: name.trim(),
        bio: bio.trim(),
      });

      setLocation(`/profile/${currentUser.username}`);
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-[600px] mx-auto min-h-[100dvh] bg-background border-l border-r border-border pb-24 md:pb-8"
    >
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation(`/profile/${currentUser?.username || ''}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Edit Profile</h1>
        </div>
        <Button onClick={handleSave} className="rounded-xl font-semibold px-6" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="p-6 space-y-8">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Cover & Avatar */}
        <div className="relative">
          <div className="h-32 md:h-48 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-slate-800 dark:to-slate-700 w-full rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <div className="absolute -bottom-12 left-6 relative w-24 h-24 mt(-12) group cursor-pointer">
            <div className="absolute -top-12">
              <Avatar className="w-24 h-24 border-4 border-background shadow-lg bg-card">
                <AvatarImage src={currentUser?.avatar} />
                <AvatarFallback>{currentUser?.name?.[0] || '?'}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-8">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Display Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="h-12 rounded-xl bg-card border-border"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Username</label>
            <Input 
              value={username} 
              disabled
              className="h-12 rounded-xl bg-card border-border opacity-60 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Username cannot be changed after registration.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Bio</label>
            <Textarea 
              value={bio} 
              onChange={e => setBio(e.target.value)}
              className="min-h-[100px] rounded-xl bg-card border-border resize-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border mt-8">
          <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
          <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-white rounded-xl">
            Deactivate Account
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
