-- ============================================================
-- 00003: Fix auth ↔ profiles sync
--
-- Problem:  Users exist in auth.users but NOT in public.profiles,
--           so username-based login fails (can't look up the user).
--
-- Root cause: The handle_new_user trigger from 00001 either wasn't
-- applied, or users were created before it existed.
--
-- Fix:
--   1. Recreate handle_new_user() with ON CONFLICT safety
--   2. Recreate the trigger
--   3. Backfill profiles for ALL existing auth.users missing one
--   4. Ensure username uniqueness via constraint
-- ============================================================

-- ── 1. Recreate the trigger function with robust defaults ──────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio)
  VALUES (
    NEW.id,
    -- Prefer the username from signup metadata; fall back to email prefix
    COALESCE(
      LOWER(TRIM(NEW.raw_user_meta_data->>'username')),
      LOWER(SPLIT_PART(NEW.email, '@', 1))
    ),
    -- Prefer display_name from metadata; fall back to username
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      COALESCE(
        LOWER(TRIM(NEW.raw_user_meta_data->>'username')),
        LOWER(SPLIT_PART(NEW.email, '@', 1))
      )
    ),
    NULL,  -- avatar_url: let user set it later
    ''     -- bio: empty by default
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists (idempotent) — do nothing
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Recreate the trigger ───────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Backfill: create profiles for auth.users missing them ──────────

INSERT INTO public.profiles (id, username, display_name, avatar_url, bio)
SELECT
  au.id,
  -- Username: prefer metadata, else email prefix
  COALESCE(
    LOWER(TRIM(au.raw_user_meta_data->>'username')),
    LOWER(SPLIT_PART(au.email, '@', 1))
  ),
  -- Display name: prefer metadata, else username
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'display_name'), ''),
    COALESCE(
      LOWER(TRIM(au.raw_user_meta_data->>'username')),
      LOWER(SPLIT_PART(au.email, '@', 1))
    )
  ),
  NULL,
  ''
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── 4. Deduplicate usernames if any collisions exist ──────────────────
-- If two auth.users ended up with the same username (unlikely but safe),
-- append a numeric suffix to the later one.

DO $$
DECLARE
  dup RECORD;
  suffix INT;
BEGIN
  FOR dup IN
    SELECT id, username,
           ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) AS rn
    FROM public.profiles
    WHERE username IN (
      SELECT username FROM public.profiles GROUP BY username HAVING COUNT(*) > 1
    )
  LOOP
    IF dup.rn > 1 THEN
      suffix := dup.rn;
      UPDATE public.profiles
      SET username = dup.username || '_' || suffix
      WHERE id = dup.id;
    END IF;
  END LOOP;
END $$;

-- ── 5. Ensure username uniqueness going forward ───────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON profiles (username);

-- ── 6. Grant necessary permissions for the trigger function ───────────
-- SECURITY DEFINER already runs as owner, but ensure USAGE on schema

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
