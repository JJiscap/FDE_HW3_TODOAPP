import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usernameToLoginEmail } from "@/lib/validation";
import { createAdminClient, createAnonClient } from "./clients";

export type TestUser = {
  id: string;
  username: string;
  password: string;
  /** An anon client already signed in as this User. */
  client: SupabaseClient;
};

// Every User created during this test run, so cleanupTestUsers() can delete
// them all. (Vitest gives each test file its own copy of this module, so each
// file cleans up only its own Users.)
const createdUserIds: string[] = [];

const USERNAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

// A random Username that obeys the app's rules: 3-20 characters of a-z, 0-9
// and _. The "test_" prefix makes leftovers easy to spot in the dashboard.
export function randomUsername(): string {
  const bytes = randomBytes(12);
  let suffix = "";
  for (const byte of bytes) suffix += USERNAME_CHARS[byte % USERNAME_CHARS.length];
  return `test_${suffix}`; // 17 characters
}

// 24 random characters, plus a fixed "aA1!" tail. The tail guarantees a
// lowercase letter, an uppercase letter, a digit and a symbol, so the
// password is accepted even if the Supabase project's Auth setting
// "Password requirements" demands all four (random text alone only
// sometimes contains every kind).
export function randomPassword(): string {
  return `${randomBytes(18).toString("base64url")}aA1!`;
}

/**
 * Registers a User that a test created some other way (for example by signing
 * up through an anon client), so cleanupTestUsers() deletes them too. Call it
 * as soon as you have the id, before any assertion that could fail.
 */
export function trackTestUser(id: string): void {
  createdUserIds.push(id);
}

/**
 * Creates a throwaway User in the Supabase test project and signs them in.
 *
 * The login email is derived from the Username, as the app does (see
 * docs/adr/0001). `email_confirm: true` marks it verified so sign-in works
 * straight away, with no email being sent. The Username is also stored in
 * `user_metadata`, which is what the Profile trigger reads to create the
 * User's Profile (supabase/migrations/0001_profiles.sql; this helper works
 * without the migration too, but then the User has no Profile).
 */
export async function createTestUser(): Promise<TestUser> {
  const admin = createAdminClient();
  const username = randomUsername();
  const password = randomPassword();
  const email = usernameToLoginEmail(username);

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
  if (createError || !created.user) {
    throw new Error(
      `Could not create a test User (is the Supabase test project reachable and not paused?): ${createError?.message ?? "no user returned"}`,
    );
  }
  const id = created.user.id;
  trackTestUser(id);

  // Sign in with a fresh anon client, like a real browser would.
  const client = createAnonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(
      `Test User was created but could not sign in: ${signInError.message}`,
    );
  }

  return { id, username, password, client };
}

/**
 * Deletes every User created by createTestUser() or registered with
 * trackTestUser() in this test file. Call it
 * from `afterAll`. Users that are already gone are skipped, and one failure
 * does not stop the rest from being cleaned up.
 */
export async function cleanupTestUsers(): Promise<void> {
  if (createdUserIds.length === 0) return; // nothing to do, no client needed

  const admin = createAdminClient();
  const ids = createdUserIds.splice(0); // take all, leaving the list empty
  const failures: string[] = [];

  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    // 404 / "not found" means someone already deleted them: that is fine.
    if (error && error.status !== 404 && !/not found/i.test(error.message)) {
      failures.push(`${id}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Could not delete some test Users (delete them in the Supabase dashboard under Authentication):\n${failures.join("\n")}`,
    );
  }
}
