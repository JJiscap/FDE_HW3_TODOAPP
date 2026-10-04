import { afterAll, describe, expect, it } from "vitest";
import { usernameToLoginEmail } from "@/lib/validation";
import { createAdminClient, createAnonClient } from "./helpers/clients";
import {
  cleanupTestUsers,
  createTestUser,
  randomPassword,
  randomUsername,
  trackTestUser,
} from "./helpers/users";

afterAll(cleanupTestUsers);

// These tests need supabase/migrations/0001_profiles.sql to be applied to the
// Supabase TEST project first (SQL Editor > paste > Run). Without it, nothing
// creates Profiles, so almost every test below fails.

// True if the Auth service holds a User with this email. It reads the User
// list with the admin client, one page at a time, and stops when it finds the
// email or runs out of pages.
async function userExists(email: string): Promise<boolean> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`Could not list Users: ${error.message}`);
    if (data.users.some((user) => user.email === email)) return true;
    if (data.users.length < 200) return false; // last page
  }
  return false;
}

// Login-email local parts (the part before the "@") the database must refuse,
// with the reason each is wrong. The Username is derived from the email, so
// these are Usernames the app would never send but an attacker could try.
const MALFORMED_USERNAMES = [
  ["too short", "ab"],
  ["too long (21 characters)", "a".repeat(21)],
  ["a space", "bad name"],
  ["an extra @ sign", "bad@name"],
  ["a symbol", "bad-name!"],
  ["empty", ""],
] as const;

describe("a Profile is created automatically at sign-up", () => {
  it("signing up through the public sign-up call creates a Profile the User can read", async () => {
    const username = randomUsername();
    const client = createAnonClient();

    const { data, error } = await client.auth.signUp({
      email: usernameToLoginEmail(username),
      password: randomPassword(),
      options: { data: { username } },
    });
    // Register for cleanup before any assertion that could fail.
    if (data.user) trackTestUser(data.user.id);

    // Supabase accepted the synthetic ".invalid" email domain.
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
    // With "Confirm email" off, sign-up returns a session straight away. If
    // this fails, check Authentication > Providers > Email in the dashboard.
    expect(data.session).not.toBeNull();

    // The same client now holds the new User's session, so it can read their
    // own Profile (and only theirs).
    const { data: profiles, error: readError } = await client
      .from("profiles")
      .select("id, username");
    expect(readError).toBeNull();
    expect(profiles).toEqual([{ id: data.user!.id, username }]);
  });

  it("deleting a User deletes their Profile too", async () => {
    const user = await createTestUser();
    const admin = createAdminClient();

    // The Profile exists before the User is deleted...
    const before = await admin.from("profiles").select("id").eq("id", user.id);
    expect(before.data).toHaveLength(1);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    expect(error).toBeNull();

    // ...and is gone afterwards.
    const after = await admin.from("profiles").select("id").eq("id", user.id);
    expect(after.error).toBeNull();
    expect(after.data).toEqual([]);
  });
});

describe("the database rejects a bad Username or email, even when the forms are bypassed", () => {
  // The admin client skips the app's validation, so this sends crafted emails
  // straight to the Auth service, like an attacker calling the API directly.
  it.each(MALFORMED_USERNAMES)(
    "refuses a Username that is %s, leaving no User and no Profile",
    async (_reason, badUsername) => {
      const admin = createAdminClient();
      // usernameToLoginEmail would (rightly) refuse a bad name, so build the
      // email by hand.
      const email = `${badUsername}@todoapp.invalid`;

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
      });
      // If the database wrongly allowed it, make sure the User is cleaned up.
      if (data?.user) trackTestUser(data.user.id);

      expect(error).not.toBeNull();
      expect(data?.user ?? null).toBeNull();
      // The failed insert was rolled back as a whole: no User was left behind.
      expect(await userExists(email)).toBe(false);
    },
  );

  it("refuses a login email on any other domain (no real addresses)", async () => {
    const admin = createAdminClient();
    const email = `${randomUsername()}@example.com`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
    });
    if (data?.user) trackTestUser(data.user.id);

    expect(error).not.toBeNull();
    expect(await userExists(email)).toBe(false);
  });

  it("refuses a malformed Username sent through the public sign-up call", async () => {
    const email = "ab@todoapp.invalid"; // 2 characters: too short
    const client = createAnonClient();

    const { data, error } = await client.auth.signUp({
      email,
      password: randomPassword(),
    });
    if (data.user) trackTestUser(data.user.id);

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect(await userExists(email)).toBe(false);
  });

  it("ignores a Username in the sign-up metadata, so nobody can squat another's Username", async () => {
    const victim = randomUsername(); // the Username the attacker wants
    const attacker = randomUsername(); // the email they actually register
    const client = createAnonClient();

    const { data, error } = await client.auth.signUp({
      email: usernameToLoginEmail(attacker),
      password: randomPassword(),
      options: { data: { username: victim } },
    });
    if (data.user) trackTestUser(data.user.id);
    expect(error).toBeNull();

    // The Profile carries the Username from the email, not from the metadata.
    const { data: profiles } = await client.from("profiles").select("username");
    expect(profiles).toEqual([{ username: attacker }]);

    // So the real owner can still take the Username they wanted.
    const owner = createAnonClient();
    const { data: ownerData, error: ownerError } = await owner.auth.signUp({
      email: usernameToLoginEmail(victim),
      password: randomPassword(),
    });
    if (ownerData.user) trackTestUser(ownerData.user.id);
    expect(ownerError).toBeNull();
  });

  it("refuses a second sign-up for a Username that is already taken", async () => {
    const existing = await createTestUser();
    const client = createAnonClient();

    // The same Username means the same login email, which Auth already holds.
    const { data, error } = await client.auth.signUp({
      email: usernameToLoginEmail(existing.username),
      password: randomPassword(),
    });
    if (data.user && data.user.id !== existing.id) trackTestUser(data.user.id);

    expect(error).not.toBeNull();
  });
});

describe("a User can read only their own Profile", () => {
  it("cannot read another User's Profile by id, and lists only their own", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    // Alice asks for Bob's Profile by his exact id: no row, and no error that
    // would reveal the id exists.
    const other = await alice.client
      .from("profiles")
      .select("id, username")
      .eq("id", bob.id);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);

    // Alice asks for every Profile and still gets only her own.
    const all = await alice.client.from("profiles").select("id, username");
    expect(all.error).toBeNull();
    expect(all.data).toEqual([{ id: alice.id, username: alice.username }]);
  });

  it("cannot read any Profile when not logged in", async () => {
    const user = await createTestUser();
    const loggedOut = createAnonClient();

    const { data, error } = await loggedOut
      .from("profiles")
      .select("id, username")
      .eq("id", user.id);

    // Either the request is refused or it returns no rows; both are safe.
    expect(error !== null || data?.length === 0).toBe(true);
  });
});

describe("a User cannot write their Profile directly", () => {
  // A write counts as blocked if the database refuses it (error) or if it
  // matches no rows. Either way, the checks afterwards read the Profile with
  // the admin client to prove nothing actually changed.

  it("cannot change their own Username", async () => {
    const user = await createTestUser();

    const { data, error } = await user.client
      .from("profiles")
      .update({ username: "hacked_name" })
      .eq("id", user.id)
      .select();
    expect(error !== null || data?.length === 0).toBe(true);

    const stored = await createAdminClient()
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    expect(stored.data?.username).toBe(user.username);
  });

  it("cannot change another User's Username", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    const { data, error } = await alice.client
      .from("profiles")
      .update({ username: "hacked_name" })
      .eq("id", bob.id)
      .select();
    expect(error !== null || data?.length === 0).toBe(true);

    const stored = await createAdminClient()
      .from("profiles")
      .select("username")
      .eq("id", bob.id)
      .single();
    expect(stored.data?.username).toBe(bob.username);
  });

  it("cannot insert a Profile", async () => {
    const user = await createTestUser();

    // Try a Profile for a made-up id, then a second one for their own id
    // (which already has a Profile, so this would also clash on the key).
    const fakeId = "00000000-0000-4000-8000-000000000000";
    const forFake = await user.client
      .from("profiles")
      .insert({ id: fakeId, username: "made_up_user" })
      .select();
    expect(forFake.error !== null || forFake.data?.length === 0).toBe(true);

    const forSelf = await user.client
      .from("profiles")
      .insert({ id: user.id, username: "another_name" })
      .select();
    expect(forSelf.error !== null || forSelf.data?.length === 0).toBe(true);

    const fake = await createAdminClient()
      .from("profiles")
      .select("id")
      .eq("id", fakeId);
    expect(fake.data).toEqual([]);
  });

  it("cannot delete their Profile", async () => {
    const user = await createTestUser();

    const { data, error } = await user.client
      .from("profiles")
      .delete()
      .eq("id", user.id)
      .select();
    expect(error !== null || data?.length === 0).toBe(true);

    const stored = await createAdminClient()
      .from("profiles")
      .select("id")
      .eq("id", user.id);
    expect(stored.data).toHaveLength(1);
  });
});
