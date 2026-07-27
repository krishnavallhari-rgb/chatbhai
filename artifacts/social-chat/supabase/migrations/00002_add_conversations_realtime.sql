-- Enable Realtime for conversations table
-- This allows the client to receive live updates when conversations are modified
-- (e.g., updated_at changes when a new message is sent)
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
