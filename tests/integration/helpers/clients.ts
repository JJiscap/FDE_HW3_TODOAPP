import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getTestEnv } from "./env";

// Tests run in plain Node, not a browser, so there is nowhere to keep a login
// session. These options stop the clients from trying to store or refresh one,
// which keeps each client fully independent of the others.
const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/**
 * Admin client: uses the service-role key, which bypasses Row Level Security.
 * Tests may use it ONLY to create and delete throwaway Users. Never use it to
 * act as a User, and never copy it into app code.
 */
export function createAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getTestEnv();
  return createClient(url, serviceRoleKey, NO_SESSION);
}

/**
 * Anon client: uses the public anon key, exactly like the real app. It is
 * subject to Row Level Security, so it sees only what a signed-in User may see.
 * Each call returns a fresh, independent client (one per simulated User).
 */
export function createAnonClient(): SupabaseClient {
  const { url, anonKey } = getTestEnv();
  return createClient(url, anonKey, NO_SESSION);
}
