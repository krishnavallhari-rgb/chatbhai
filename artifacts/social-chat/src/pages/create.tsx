import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ImagePlus, MapPin, Tag, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function Create() {
  const [, setLocation] = useLocation();
  const currentUser = useCurrentUser();
  const [caption, setCaption] = useState("");
  const [location, setPostLocation] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);
    setError(null);

    try {
      let imageUrl = '/images/placeholder.svg';

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() || 'jpg';
        const path = `posts/${currentUser.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('media')
          .upload(path, selectedFile, { contentType: selectedFile.type });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      } else if (!caption.trim()) {
        setError("Add an image or caption");
        setSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase.from('posts').insert({
        user_id: currentUser.id,
        image_url: imageUrl,
        caption: caption.trim() || '',
      });
      if (insertErr) throw insertErr;

      setLocation("/feed");
    } catch (err: any) {
      setError(err.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-2xl mx-auto p-4 md:p-8 pb-24 md:pb-8"
    >
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Post</h1>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/feed")}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative w-full aspect-square md:aspect-video rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden
            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"}
            ${preview ? "border-transparent" : ""}`}
        >
          {preview ? (
            <>
              <img src={preview} alt="preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreview(null); setSelectedFile(null); }}
                className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Drop your photo here</p>
                <p className="text-sm mt-1">or click to browse</p>
              </div>
              <span className="text-xs bg-accent rounded-full px-3 py-1">JPG, PNG, WebP up to 10MB</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* Author */}
        {currentUser && (
          <div className="flex items-center gap-3 py-2">
            <Avatar className="w-10 h-10 border border-border">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback>{currentUser.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">@{currentUser.username}</p>
            </div>
          </div>
        )}

        {/* Caption */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Caption</label>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption... use #hashtags and @mentions"
            className="min-h-[120px] resize-none rounded-xl border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          />
          <p className="text-xs text-muted-foreground text-right">{caption.length}/2200</p>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={location}
              onChange={(e) => setPostLocation(e.target.value)}
              placeholder="Add location"
              className="pl-9 rounded-xl border-border bg-card"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl h-12 font-semibold"
            onClick={() => setLocation("/feed")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 rounded-xl h-12 font-semibold shadow-lg shadow-primary/20"
            disabled={submitting || (!preview && !caption.trim())}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {submitting ? 'Sharing...' : 'Share Post'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
