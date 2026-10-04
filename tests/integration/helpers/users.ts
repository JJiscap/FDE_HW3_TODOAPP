import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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
function randomUsername(): string {
  const bytes = randomBytes(12);
  let suffix = "";
  for (const byte of bytes) suffix += USERNAME_CHARS[byte % USERNAME_CHARS.length];
  return `test_${suffix}`; // 17 characters
}

/**
 * Creates a throwaway User in the Supabase test project and signs them in.
 *
 * The login email is derived from the Username, as the app does (see
 * docs/adr/0001). `email_confirm: true` marks it verified so sign-in works
 * straight away, with no email being sent. The Username is also stored in
 * `user_metadata`, which is what the Profile trigger will read once it exists
 * (this helper works without the trigger too).
 */
export async function createTestUser(): Promise<TestUser> {
  const admin = createAdminClient();
  const username = randomUsername();
  const password = randomBytes(18).toString("base64url"); // 24 characters

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: `${username}@todoapp.invalid`,
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
  createdUserIds.push(id);

  // Sign in with a fresh anon client, like a real browser would.
  const client = createAnonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: `${username}@todoapp.invalid`,
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
 * Deletes every User created by createTestUser() in this test file. Call it
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
