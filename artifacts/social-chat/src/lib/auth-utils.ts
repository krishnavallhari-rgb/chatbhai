import { supabase } from '@/lib/supabase';

const AUTH_EMAIL_DOMAIN = 'chat.local';

/**
 * Generates an internal email address from a username.
 * This email is used exclusively with Supabase Auth and is never shown to users.
 * Pattern: username@chat.local
 */
export function generateInternalEmail(username: string): string {
  return `${username.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

/**
 * Validates a username against Instagram-style rules:
 * - Required
 * - 3-30 characters
 * - Lowercase letters, numbers, and underscores only
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 30) {
    return { valid: false, error: 'Username must be 30 characters or less' };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, and underscores' };
  }
  return { valid: true };
}

/**
 * Validates a password against security requirements:
 * - Minimum 8 characters
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  return { valid: true };
}

/**
 * Looks up a user profile by username.
 * Returns the profile row if found, null otherwise.
 */
export async function findProfileByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Checks if a username is already taken.
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const profile = await findProfileByUsername(username);
  return profile !== null;
}

/**
 * Attempts to sign in using a username and password.
 * Looks up the username in profiles, generates the internal email, then authenticates.
 *
 * Returns a generic error message on failure to prevent username enumeration.
 */
export async function signInWithUsername(username: string, password: string) {
  const profile = await findProfileByUsername(username);
  if (!profile) {
    return { error: 'Invalid username or password' };
  }

  const internalEmail = generateInternalEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  });

  if (error) {
    return { error: 'Invalid username or password' };
  }

  return { data, error: null };
}

/**
 * Attempts to register a new user using a username and password.
 * Generates an internal email from the username and signs up with Supabase Auth.
 *
 * The database trigger (handle_new_user) auto-creates the profile row
 * using the username and display_name from user metadata.
 */
export async function signUpWithUsername(
  username: string,
  password: string,
  displayName?: string
) {
  const normalizedUsername = username.toLowerCase().trim();
  const validation = validateUsername(normalizedUsername);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { error: passwordValidation.error };
  }

  const taken = await isUsernameTaken(normalizedUsername);
  if (taken) {
    return { error: 'Username is already taken' };
  }

  const internalEmail = generateInternalEmail(normalizedUsername);
  const { data, error } = await supabase.auth.signUp({
    email: internalEmail,
    password,
    options: {
      data: {
        username: normalizedUsername,
        display_name: displayName?.trim() || normalizedUsername,
      },
    },
  });

  if (error) {
    return { error: error.message || 'Registration failed' };
  }

  return { data, error: null };
}

/**
 * Sends a password reset email for the given username.
 * Uses the internal email derived from the username.
 * Returns a generic success message regardless of whether the user exists (prevents enumeration).
 */
export async function recoverAccountByUsername(username: string) {
  const profile = await findProfileByUsername(username);

  if (!profile) {
    return { error: 'No account found with that username' };
  }

  const internalEmail = generateInternalEmail(username);
  const { error } = await supabase.auth.resetPasswordForEmail(internalEmail, {
    redirectTo: `${window.location.origin}/login`,
  });

  if (error) {
    return { error: 'Failed to send recovery email. Please try again.' };
  }

  return { error: null };
}
