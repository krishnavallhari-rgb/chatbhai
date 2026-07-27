-- ============================================================
-- 00008: Delete conversation system
--
-- Adds:
--   1. delete_conversation() – removes user from conversation_members.
--      If the conversation becomes empty, deletes it entirely
--      (cascade deletes messages, reads, etc.)
--   2. RLS DELETE policy on conversation_members
-- ============================================================

-- 1. Delete conversation function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_count int;
BEGIN
  -- Remove the current user from conversation_members
  DELETE FROM conversation_members
  WHERE conversation_id = p_conv_id
    AND user_id = auth.uid();

  -- Check how many members remain
  SELECT count(*) INTO member_count
  FROM conversation_members
  WHERE conversation_id = p_conv_id;

  -- If no members left, delete the conversation entirely (cascade)
  IF member_count = 0 THEN
    DELETE FROM conversations WHERE id = p_conv_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;

-- 2. Allow users to delete their own membership rows
DROP POLICY IF EXISTS "Users can delete own membership" ON conversation_members;

CREATE POLICY "Users can delete own membership"
  ON conversation_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Enable Realtime for conversation_members (so DELETE events are broadcast)
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
