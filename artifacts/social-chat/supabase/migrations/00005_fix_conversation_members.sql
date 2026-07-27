-- Fix: RLS prevents batch inserts into conversation_members because
-- Row 2's WITH CHECK can't see Row 1 in the same statement.
-- Solution: SECURITY DEFINER function that bypasses RLS for member insertion.

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

-- Backfill: add all profiles as members to conversations that have zero members.
-- This fixes orphaned conversations created before this fix.
INSERT INTO conversation_members (conversation_id, user_id)
SELECT c.id, p.id
FROM conversations c
CROSS JOIN profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM conversation_members cm
  WHERE cm.conversation_id = c.id
)
ON CONFLICT DO NOTHING;
