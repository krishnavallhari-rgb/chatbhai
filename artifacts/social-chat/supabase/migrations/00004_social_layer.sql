-- ============================================================
-- 00004: Social layer – follows, notifications, posts, searches
-- ============================================================

-- ── 1. Follows ─────────────────────────────────────────────────────────

CREATE TABLE follows (
  follower_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status        VARCHAR(20) DEFAULT 'accepted'
                CHECK (status IN ('accepted', 'pending')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Everyone can see follow relationships (needed for profile counts)
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT USING (true);

-- A user can follow someone else
CREATE POLICY "Users can insert follows"
  ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- A user can update follow status on rows where they are the following party
-- (to accept/reject follow requests)
CREATE POLICY "Users can update incoming follow requests"
  ON follows FOR UPDATE USING (auth.uid() = following_id);

-- A user can unfollow (delete their own follow)
CREATE POLICY "Users can delete own follows"
  ON follows FOR DELETE USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_follower  ON follows (follower_id);
CREATE INDEX idx_follows_following ON follows (following_id);
CREATE INDEX idx_follows_status    ON follows (status);

-- ── 2. Notifications ───────────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        VARCHAR(30) NOT NULL
              CHECK (type IN ('follow', 'like', 'comment', 'mention')),
  entity_type VARCHAR(30),
  entity_id   UUID,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

-- System (and other users via triggers) can insert notifications
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX idx_notifications_unread     ON notifications (user_id) WHERE read = FALSE;

-- ── 3. Recent searches ─────────────────────────────────────────────────

CREATE TABLE recent_searches (
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  searched_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  searched_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, searched_user_id)
);

ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recent searches"
  ON recent_searches FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recent searches"
  ON recent_searches FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recent searches"
  ON recent_searches FOR DELETE USING (auth.uid() = user_id);

-- ── 4. Posts (minimal – for profile count) ─────────────────────────────

CREATE TABLE posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url      TEXT NOT NULL DEFAULT '/images/placeholder.svg',
  caption        TEXT DEFAULT '',
  likes_count    INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT USING (true);

CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_posts_user_id    ON posts (user_id);
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);

-- ── 5. Enable Realtime ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- ── 6. Helper functions ────────────────────────────────────────────────

-- Create a follow + notification in one call
CREATE OR REPLACE FUNCTION public.handle_follow(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  actor UUID := auth.uid();
BEGIN
  IF actor = target_user_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  INSERT INTO public.follows (follower_id, following_id, status)
  VALUES (actor, target_user_id, 'accepted')
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  -- Only create notification if a new follow was inserted
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, actor_id, type, entity_type, entity_id)
    VALUES (target_user_id, actor, 'follow', 'follow', target_user_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unfollow: delete the follow row
CREATE OR REPLACE FUNCTION public.handle_unfollow(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.follows
  WHERE follower_id = auth.uid() AND following_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
