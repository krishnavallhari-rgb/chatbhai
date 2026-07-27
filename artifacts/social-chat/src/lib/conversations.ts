/**
 * Conversation creation / lookup utility.
 *
 * Every DM conversation MUST have exactly 2 rows in conversation_members.
 * After creation, we VERIFY member count = 2 or throw an error.
 *
 * IMPORTANT: Direct SELECT on conversation_members is blocked by RLS in
 * PostgREST context when looking at OTHER users' rows. We use SECURITY
 * DEFINER RPC functions for both reading and writing members.
 */

import { supabase } from '@/lib/supabase';

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Get member IDs via SECURITY DEFINER RPC (bypasses RLS).
 * Falls back to direct SELECT if RPC fails.
 */
async function getMemberIds(conversationId: string): Promise<string[]> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'get_conversation_member_ids',
    { p_conv_id: conversationId },
  );

  if (!rpcErr && rpcData) {
    const rows = rpcData as any[];
    const ids = rows
      .map((row: any) => (typeof row === 'string' ? row : row.user_id ?? row.id ?? row.get_conversation_member_ids))
      .filter(Boolean);
    console.log('[Conv] getMemberIds via RPC:', ids.length, 'members');
    return ids;
  }

  console.warn('[Conv] RPC getMemberIds failed:', rpcErr?.message, '— falling back to SELECT');

  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);

  if (error) throw new Error(`Failed to fetch members: ${error.message}`);
  return (data || []).map((m: any) => m.user_id as string);
}

async function verifyMemberCount(
  conversationId: string,
  senderId: string,
  recipientId: string,
): Promise<string[]> {
  const memberIds = await getMemberIds(conversationId);

  console.log('[Conv] Verify:', {
    conversationId: conversationId.slice(0, 8),
    senderId: senderId.slice(0, 8),
    recipientId: recipientId.slice(0, 8),
    memberCount: memberIds.length,
    members: memberIds.map((id) => id.slice(0, 8)),
  });

  if (memberIds.length !== 2) {
    console.error('[Conv] CRITICAL: member count is', memberIds.length, '— expected 2');
    throw new Error(
      `Conversation ${conversationId.slice(0, 8)} has ${memberIds.length} members, expected 2`,
    );
  }

  console.log('[Conv] Verified: conversation has exactly 2 members');
  return memberIds;
}

/* ── Main: open or create conversation ──────────────────────────────────── */

export async function openOrCreateConversation(
  otherUserId: string,
): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const senderId = session?.user?.id;
  if (!senderId || senderId === otherUserId) return null;

  console.log('[Conv] ═══════════════════════════════════════');
  console.log('[Conv] openOrCreateConversation', {
    senderId: senderId.slice(0, 8),
    recipientId: otherUserId.slice(0, 8),
  });

  // ── 1. Find my conversation IDs (self-lookup works with RLS) ───

  const { data: myMembers, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', senderId);

  if (memErr) {
    console.error('[Conv] Failed to fetch my memberships:', memErr.message);
  }

  if (myMembers && myMembers.length > 0) {
    const myConvIds = myMembers.map((m) => m.conversation_id);

    // Check each conversation for the other user via RPC (bypasses RLS)
    for (const convId of myConvIds) {
      const memberIds = await getMemberIds(convId);

      if (memberIds.includes(otherUserId)) {
        console.log('[Conv] Found existing conversation:', convId.slice(0, 8));

        if (memberIds.length < 2) {
          console.warn('[Conv] Existing conversation has', memberIds.length, 'members — repairing');
          await insertBothMembers(convId, senderId, otherUserId);
          await verifyMemberCount(convId, senderId, otherUserId);
        }

        return convId;
      }
    }
  }

  // ── 2. Create new conversation ─────────────────────────────────

  const { data: newConv, error: convErr } = await supabase
    .from('conversations')
    .insert({ is_group: false })
    .select('id')
    .single();

  if (convErr || !newConv) {
    console.error('[Conv] Create failed:', convErr);
    return null;
  }

  const convId = newConv.id;
  console.log('[Conv] Created:', convId.slice(0, 8));

  // ── 3. Insert BOTH members ─────────────────────────────────────

  await insertBothMembers(convId, senderId, otherUserId);

  // ── 4. VERIFY: must have exactly 2 members ─────────────────────

  await verifyMemberCount(convId, senderId, otherUserId);

  console.log('[Conv] ═══════════════════════════════════════');

  return convId;
}

/* ── Insert both members into a conversation ────────────────────────────── */

async function insertBothMembers(
  conversationId: string,
  senderId: string,
  recipientId: string,
): Promise<void> {
  console.log('[Conv] Inserting both members:', {
    conversationId: conversationId.slice(0, 8),
    senderId: senderId.slice(0, 8),
    recipientId: recipientId.slice(0, 8),
  });

  // Method 1: RPC with SECURITY DEFINER (bypasses RLS — most reliable)
  const { error: rpcErr } = await supabase.rpc('add_conversation_members', {
    p_conv_id: conversationId,
    p_user_ids: [senderId, recipientId],
  });

  if (!rpcErr) {
    console.log('[Conv] Members inserted via RPC');
    return;
  }

  console.warn('[Conv] RPC failed:', rpcErr.message, '— trying batch insert');

  // Method 2: Batch insert
  const { error: batchErr } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: conversationId, user_id: senderId },
      { conversation_id: conversationId, user_id: recipientId },
    ]);

  if (!batchErr) {
    console.log('[Conv] Batch insert succeeded');
    return;
  }

  console.warn('[Conv] Batch insert failed:', batchErr.message, '— trying one-by-one');

  // Method 3: One-by-one
  const { error: e1 } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conversationId, user_id: senderId });

  if (e1 && e1.code !== '23505') console.error('[Conv] Self insert failed:', e1.message);

  const { error: e2 } = await supabase
    .from('conversation_members')
    .insert({ conversation_id: conversationId, user_id: recipientId });

  if (e2 && e2.code !== '23505') console.error('[Conv] Other insert failed:', e2.message);
}

/* ── Ensure conversation has both participants ──────────────────────────── */

export async function ensureConversationMembers(
  conversationId: string,
  otherUserId: string,
): Promise<{ selfPresent: boolean; otherPresent: boolean }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const currentUserId = session?.user?.id;
  if (!currentUserId) return { selfPresent: false, otherPresent: false };

  const memberIds = await getMemberIds(conversationId);
  const selfPresent = memberIds.includes(currentUserId);
  const otherPresent = memberIds.includes(otherUserId);

  console.log('[Conv] ensureConversationMembers:', {
    conversationId: conversationId.slice(0, 8),
    selfPresent,
    otherPresent,
    memberCount: memberIds.length,
  });

  if (!selfPresent || !otherPresent) {
    await insertBothMembers(conversationId, currentUserId, otherUserId);

    const finalIds = await getMemberIds(conversationId);
    return {
      selfPresent: finalIds.includes(currentUserId),
      otherPresent: finalIds.includes(otherUserId),
    };
  }

  return { selfPresent, otherPresent };
}
