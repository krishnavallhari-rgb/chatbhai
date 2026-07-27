-- ============================================================
-- 00006: Fix missing conversation_members
--
-- ROOT CAUSE: test1's conversation_members rows were deleted.
-- The RLS INSERT policy's EXISTS subquery fails to resolve
-- auth.uid() correctly, blocking re-insertion of other users.
--
-- FIX:
--   1. Recreate add_conversation_members as SECURITY DEFINER
--   2. Backfill missing members
--   3. Fix the INSERT policy for authenticated users
-- ============================================================

-- 1. Recreate the function with SECURITY DEFINER
DROP FUNCTION IF EXISTS public.add_conversation_members(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.add_conversation_members(p_conv_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT p_conv_id, unnest(p_user_ids)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 2. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_conversation_members(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_conversation_members(uuid, uuid[]) TO anon;

-- 3. Backfill: ensure both users are in both conversations
INSERT INTO conversation_members (conversation_id, user_id)
SELECT '5c0b8b1f-c28a-448f-9643-8d3b2346ba26', unnest(ARRAY[
  'd9bdf852-5ed6-45d5-9f8a-cbd9ee3257ce'::uuid,
  '8401a4bd-574e-4c93-9f2a-2fdbbba16bfe'::uuid
])
ON CONFLICT DO NOTHING;

INSERT INTO conversation_members (conversation_id, user_id)
SELECT '524767c8-d7b4-4cfb-82ee-16a494d2d0cb', unnest(ARRAY[
  'd9bdf852-5ed6-45d5-9f8a-cbd9ee3257ce'::uuid,
  '8401a4bd-574e-4c93-9f2a-2fdbbba16bfe'::uuid
])
ON CONFLICT DO NOTHING;

-- 4. Fix the INSERT policy
--    The original policy's EXISTS subquery fails in PostgREST INSERT context.
--    Drop and recreate with explicit TO authenticated binding.
DROP POLICY IF EXISTS "Members can add members" ON conversation_members;

CREATE POLICY "Members can add members"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );
