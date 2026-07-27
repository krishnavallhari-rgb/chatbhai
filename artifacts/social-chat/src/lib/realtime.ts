/**
 * Realtime channel management utilities.
 *
 * Provides deterministic, idempotent channel registration that prevents
 * duplicate subscriptions across React strict-mode double-renders,
 * rapid conversation switches, and HMR reloads.
 *
 * Channels are tracked in module-level Maps keyed by (namespace, key).
 * registerChannel always cleans up a stale channel before registering the new one.
 * unregisterChannel only removes the channel if it is still the one we registered.
 *
 * createChannel generates unique Supabase channel names so that the client
 * never reuses an already-subscribed channel object (which would cause
 * "cannot add postgres_changes callbacks after subscribe()" errors).
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const registries = new Map<string, Map<string, RealtimeChannel>>();

function getRegistry(namespace: string): Map<string, RealtimeChannel> {
  if (!registries.has(namespace)) {
    registries.set(namespace, new Map());
  }
  return registries.get(namespace)!;
}

/** Monotonically increasing counter appended to channel names. */
let channelSeq = 0;

/**
 * Creates a Supabase Realtime channel with a guaranteed-unique name.
 *
 * The Supabase JS client internally deduplicates channels by name —
 * if `supabase.channel('foo')` is called while a channel named 'foo'
 * still exists (e.g. during React StrictMode double-render), it returns
 * the old (already-subscribed) object, and calling `.on()` on it throws:
 *   "cannot add postgres_changes callbacks after subscribe()"
 *
 * By appending a monotonic sequence number, each call to createChannel
 * always produces a fresh channel that the Supabase client treats as new.
 *
 * The registry keys remain stable (they use our own namespace + key), so
 * cleanup logic is unaffected.
 */
export function createChannel(baseName: string): RealtimeChannel {
  return supabase.channel(`${baseName}--${++channelSeq}`);
}

/**
 * Removes any existing channel under (namespace, key), then registers the new one.
 * Safe to call multiple times for the same key – always idempotent.
 */
export function registerChannel(
  namespace: string,
  key: string,
  channel: RealtimeChannel,
): void {
  const reg = getRegistry(namespace);
  const existing = reg.get(key);
  if (existing) {
    supabase.removeChannel(existing);
  }
  reg.set(key, channel);
}

/**
 * Removes the channel only if it is still the one registered under (namespace, key).
 * Prevents a late cleanup from tearing down a newer channel.
 */
export function unregisterChannel(
  namespace: string,
  key: string,
  channel: RealtimeChannel,
): void {
  const reg = getRegistry(namespace);
  if (reg.get(key) === channel) {
    supabase.removeChannel(channel);
    reg.delete(key);
  }
}
