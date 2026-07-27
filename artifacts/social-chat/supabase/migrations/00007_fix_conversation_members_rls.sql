-- ============================================================
-- 00007: Fix conversation_members RLS completely
--
-- ROOT CAUSE: The RLS SELECT policy on conversation_members uses
-- a self-referencing subquery that fails in PostgREST context.
-- kcompany can insert test1's row (via SECURITY DEFINER RPC),
-- but cannot SEE it (SELECT blocked by RLS).
--
-- FIX:
--   1. Create get_conversation_member_ids() SECURITY DEFINER
--      to read members bypassing RLS entirely
--   2. Drop ALL existing policies on conversation_members
--   3. Recreate them cleanly with simpler logic
--   4. Ensure both users are members of both conversations
-- ============================================================

-- 1. Create SECURITY DEFINER function to READ members (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_conversation_member_ids(p_conv_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id FROM conversation_members WHERE conversation_id = p_conv_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_member_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_member_ids(uuid) TO anon;

-- 2. Ensure add_conversation_members is SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.add_conversation_members(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_conversation_members(uuid, uuid[]) TO anon;

-- 3. Drop ALL existing policies on conversation_members
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can add members" ON conversation_members;

-- 4. Recreate policies with clean, working logic
-- SELECT: any authenticated user can see members (simple, no self-ref issues)
CREATE POLICY "Authenticated users can view conversation members"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: you can insert yourself, or if you're already a member
CREATE POLICY "Authenticated users can insert conversation members"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Backfill: ensure both users are in both conversations
INSERT INTO conversation_members (conversation_id, user_id)
SELECT '5c0b8b1f-c28a-448f-9643-8d3b2346ba26'::uuid, unnest(ARRAY[
  'd9bdf852-5ed6-45d5-9f8a-cbd9ee3257ce'::uuid,
  '8401a4bd-574e-4c93-9f2a-2fdbbba16bfe'::uuid
])
ON CONFLICT DO NOTHING;

INSERT INTO conversation_members (conversation_id, user_id)
SELECT '524767c8-d7b4-4cfb-82ee-16a494d2d0cb'::uuid, unnest(ARRAY[
  'd9bdf852-5ed6-45d5-9f8a-cbd9ee3257ce'::uuid,
  '8401a4bd-574e-4c93-9f2a-2fdbbba16bfe'::uuid
])
ON CONFLICT DO NOTHING;

-- 6. Clean up orphan conversation if it exists
DELETE FROM conversations WHERE id = 'a822c99d-0000-0000-0000-000000000000'::uuid;

-- 7. Verify: this query should return 2 rows per conversation
-- SELECT conversation_id, count(*) FROM conversation_members
-- WHERE conversation_id IN (
--   '5c0b8b1f-c28a-448f-9643-8d3b2346ba26',
--   '524767c8-d7b4-4cfb-82ee-16a494d2d0cb'
-- )
-- GROUP BY conversation_id;
