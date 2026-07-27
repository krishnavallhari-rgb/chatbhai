-- 00009: post_likes, comments, stories tables + RLS

-- ── 1. Post Likes ───────────────────────────────────────────────────────

CREATE TABLE post_likes (
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id    UUID REFERENCES posts(id)    ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are viewable by everyone"
  ON post_likes FOR SELECT USING (true);

CREATE POLICY "Users can insert own likes"
  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_post_likes_post ON post_likes (post_id);

-- ── 2. Comments ──────────────────────────────────────────────────────────

CREATE TABLE post_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID REFERENCES posts(id)    ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON post_comments FOR SELECT USING (true);

CREATE POLICY "Users can insert own comments"
  ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_post_comments_post ON post_comments (post_id, created_at);

-- ── 3. Stories ───────────────────────────────────────────────────────────

CREATE TABLE stories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url  TEXT NOT NULL DEFAULT '/images/placeholder.svg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories are viewable by everyone"
  ON stories FOR SELECT USING (true);

CREATE POLICY "Users can insert own stories"
  ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_stories_user     ON stories (user_id);
CREATE INDEX idx_stories_created  ON stories (created_at DESC);

-- ── 4. Helper functions for post counts ──────────────────────────────────

CREATE OR REPLACE FUNCTION handle_post_like(target_post_id UUID)
RETURNS JSON AS $$
DECLARE
  uid UUID := auth.uid();
  already_liked BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM post_likes WHERE user_id = uid AND post_id = target_post_id)
    INTO already_liked;

  IF already_liked THEN
    DELETE FROM post_likes WHERE user_id = uid AND post_id = target_post_id;
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_post_id;
    RETURN json_build_object('liked', false, 'likes_count', (SELECT likes_count FROM posts WHERE id = target_post_id));
  ELSE
    INSERT INTO post_likes (user_id, post_id) VALUES (uid, target_post_id);
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = target_post_id;
    RETURN json_build_object('liked', true, 'likes_count', (SELECT likes_count FROM posts WHERE id = target_post_id));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_post_comment(target_post_id UUID, comment_content TEXT)
RETURNS JSON AS $$
DECLARE
  uid UUID := auth.uid();
  new_comment post_comments%ROWTYPE;
BEGIN
  INSERT INTO post_comments (post_id, user_id, content)
    VALUES (target_post_id, uid, comment_content)
    RETURNING * INTO new_comment;

  UPDATE posts SET comments_count = comments_count + 1 WHERE id = target_post_id;

  RETURN json_build_object(
    'id', new_comment.id,
    'post_id', new_comment.post_id,
    'user_id', new_comment.user_id,
    'content', new_comment.content,
    'created_at', new_comment.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_post_comment_count(target_post_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM post_comments WHERE post_id = target_post_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_post_like_counts(target_user_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(SUM(likes_count), 0)::INT FROM posts WHERE user_id = target_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 5. Storage bucket for media uploads ──────────────────────────────────
-- NOTE: Run this separately in Supabase Dashboard > Storage if bucket doesn't exist:
--   CREATE BUCKET "media" WITH (public = true);
--
-- Or via SQL (Supabase allows this):
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view media"
  ON storage.objects FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
