import { afterAll, describe, expect, it } from "vitest";
import { createTask, listTasks } from "@/lib/tasks";
import { createAdminClient, createAnonClient } from "./helpers/clients";
import { cleanupTestUsers, createTestUser } from "./helpers/users";

afterAll(cleanupTestUsers);

// These tests need supabase/migrations/0002_tasks.sql (and 0001) to be applied
// to the Supabase TEST project first (SQL Editor > paste > Run). Without it
// there is no tasks table, so almost every test below fails.

// The Tasks stored for a User, read with the admin client (which skips Row
// Level Security) so a test can prove what is REALLY in the table, whatever a
// User's own view says.
async function storedTasks(userId: string) {
  const { data, error } = await createAdminClient()
    .from("tasks")
    .select("id, title, completed")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not read stored Tasks: ${error.message}`);
  return data;
}

// Creates a Task and fails the test with a clear message if it was refused.
async function mustCreate(
  client: Parameters<typeof createTask>[0],
  title: string,
) {
  const result = await createTask(client, title);
  if (!result.ok) throw new Error(`Expected the Task to be created: ${title}`);
  return result.task;
}

describe("each User sees only their own Tasks", () => {
  it("lists only the signed-in User's Tasks, newest first", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    const a1 = await mustCreate(alice.client, "alice first");
    const b1 = await mustCreate(bob.client, "bob only");
    const a2 = await mustCreate(alice.client, "alice second");

    const aliceTasks = await listTasks(alice.client);
    expect(aliceTasks.map((t) => t.id)).toEqual([a2.id, a1.id]);
    expect(aliceTasks.map((t) => t.title)).toEqual([
      "alice second",
      "alice first",
    ]);

    const bobTasks = await listTasks(bob.client);
    expect(bobTasks.map((t) => t.id)).toEqual([b1.id]);
  });

  it("a new Task appears first in the list", async () => {
    const user = await createTestUser();
    await mustCreate(user.client, "older");
    const newest = await mustCreate(user.client, "newest");

    const tasks = await listTasks(user.client);
    expect(tasks[0].id).toBe(newest.id);
    expect(tasks).toHaveLength(2);
  });

  it("a User with no Tasks gets an empty list, not an error", async () => {
    const user = await createTestUser();
    await expect(listTasks(user.client)).resolves.toEqual([]);
  });

  it("cannot read another User's Task by its exact id", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const secret = await mustCreate(alice.client, "alice secret");

    // Bob asks for Alice's Task by id: no row, and no error that would reveal
    // the id exists.
    const { data, error } = await bob.client
      .from("tasks")
      .select("id, title")
      .eq("id", secret.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("creating a Task", () => {
  it("returns the trimmed title, not completed, with an id and a creation time", async () => {
    const user = await createTestUser();

    const result = await createTask(user.client, "  buy milk  ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.task.title).toBe("buy milk");
    expect(result.task.completed).toBe(false);
    expect(result.task.id).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.task.createdAt))).toBe(false);

    // What is stored is the trimmed title too, and it is the User's own.
    const stored = await storedTasks(user.id);
    expect(stored).toEqual([
      { id: result.task.id, title: "buy milk", completed: false },
    ]);
  });

  it("belongs to the signed-in User even though the app never sends a user_id", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "mine");

    const { data } = await createAdminClient()
      .from("tasks")
      .select("user_id")
      .eq("id", task.id)
      .single();
    expect(data?.user_id).toBe(user.id);
  });
});

describe("invalid titles are rejected and nothing is stored", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["201 characters", "a".repeat(201)],
    ["201 emoji (201 characters, 402 UTF-16 units)", "😀".repeat(201)],
  ])("%s", async (_label, title) => {
    const user = await createTestUser();

    const result = await createTask(user.client, title);

    expect(result).toEqual({ ok: false, reason: "invalid_title" });
    expect(await storedTasks(user.id)).toEqual([]);
    expect(await listTasks(user.client)).toEqual([]);
  });

  it("accepts a title of exactly 200 characters", async () => {
    const user = await createTestUser();
    const title = "a".repeat(200);

    const task = await mustCreate(user.client, title);

    expect(task.title).toBe(title);
    expect(await storedTasks(user.id)).toHaveLength(1);
  });

  it("counts characters, not UTF-16 units: 200 emoji are accepted", async () => {
    const user = await createTestUser();
    const title = "😀".repeat(200); // 200 characters, but 400 UTF-16 units

    const task = await mustCreate(user.client, title);

    expect(task.title).toBe(title);
    expect([...task.title]).toHaveLength(200);
  });
});

describe("the database rejects bad titles even when the app is bypassed", () => {
  // These go through the raw client, like an attacker calling the API directly
  // with a valid login but skipping the app's own checks. The error code
  // 23514 is Postgres's "check constraint violated".
  it.each([
    ["empty", ""],
    ["201 characters", "a".repeat(201)],
    ["a leading space", " padded"],
    ["a trailing space", "padded "],
  ])("refuses a title that is %s", async (_label, title) => {
    const user = await createTestUser();

    const { data, error } = await user.client
      .from("tasks")
      .insert({ title })
      .select();

    expect(error?.code).toBe("23514");
    expect(data).toBeNull();
    expect(await storedTasks(user.id)).toEqual([]);
  });
});

describe("a User cannot create a Task for someone else", () => {
  it("rejects an insert that names another User as the owner, and stores nothing", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    // Alice tries to plant a Task in Bob's list.
    const { data, error } = await alice.client
      .from("tasks")
      .insert({ title: "planted by alice", user_id: bob.id })
      .select();

    expect(error).not.toBeNull();
    expect(data).toBeNull();

    // Nothing was stored for either User, and Bob sees nothing.
    expect(await storedTasks(bob.id)).toEqual([]);
    expect(await storedTasks(alice.id)).toEqual([]);
    expect(await listTasks(bob.client)).toEqual([]);
  });
});

describe("a logged-out visitor can do nothing with Tasks", () => {
  it("reads no Tasks", async () => {
    const user = await createTestUser();
    await mustCreate(user.client, "private");
    const loggedOut = createAnonClient();

    const { data, error } = await loggedOut
      .from("tasks")
      .select("id, title")
      .eq("user_id", user.id);

    // Either the request is refused or it returns no rows; both are safe.
    expect(error !== null || data?.length === 0).toBe(true);
  });

  it("cannot insert a Task, and nothing is stored", async () => {
    const user = await createTestUser();
    const loggedOut = createAnonClient();

    const { data, error } = await loggedOut
      .from("tasks")
      .insert({ title: "from nobody", user_id: user.id })
      .select();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
    expect(await storedTasks(user.id)).toEqual([]);
  });
});

describe("deleting a User", () => {
  it("deletes their Tasks too, and leaves other Users' Tasks alone", async () => {
    const leaving = await createTestUser();
    const staying = await createTestUser();
    await mustCreate(leaving.client, "goes away 1");
    await mustCreate(leaving.client, "goes away 2");
    await mustCreate(staying.client, "stays");

    // The Tasks exist before the User is deleted...
    expect(await storedTasks(leaving.id)).toHaveLength(2);

    const { error } = await createAdminClient().auth.admin.deleteUser(
      leaving.id,
    );
    expect(error).toBeNull();

    // ...and are gone afterwards, while the other User's Task is untouched.
    expect(await storedTasks(leaving.id)).toEqual([]);
    expect(await storedTasks(staying.id)).toHaveLength(1);
  });
});
