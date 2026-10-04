import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createTask, deleteTask, listTasks, setCompleted } from "@/lib/tasks";
import { createAdminClient, createAnonClient } from "./helpers/clients";
import { cleanupTestUsers, createTestUser } from "./helpers/users";

afterAll(cleanupTestUsers);

// These tests need supabase/migrations/0003_task_updates_and_deletes.sql (and
// 0001, 0002) to be applied to the Supabase TEST project first (SQL Editor >
// paste > Run). Without it, completing and deleting are refused by the
// database, so the tests below fail.

// One Task exactly as stored, read with the admin client (which skips Row
// Level Security) so a test can prove what is REALLY in the table. Returns
// null when the row does not exist.
async function storedTask(id: string) {
  const { data, error } = await createAdminClient()
    .from("tasks")
    .select("id, user_id, title, completed, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the stored Task: ${error.message}`);
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

describe("a User completing, reopening and deleting their own Task", () => {
  it("completes a Task, and the list and the table show it", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "finish report");

    const result = await setCompleted(user.client, task.id, true);

    expect(result).toEqual({
      ok: true,
      task: { ...task, completed: true },
    });
    expect((await listTasks(user.client))[0]).toEqual({
      ...task,
      completed: true,
    });
    expect((await storedTask(task.id))?.completed).toBe(true);
  });

  it("reopens a completed Task", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "toggle me");
    await setCompleted(user.client, task.id, true);

    const result = await setCompleted(user.client, task.id, false);

    expect(result).toEqual({ ok: true, task });
    expect((await listTasks(user.client))[0].completed).toBe(false);
    expect((await storedTask(task.id))?.completed).toBe(false);
  });

  it("completing an already completed Task still succeeds", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "twice");
    await setCompleted(user.client, task.id, true);

    const again = await setCompleted(user.client, task.id, true);

    expect(again).toEqual({ ok: true, task: { ...task, completed: true } });
  });

  it("changes nothing but the Completed flag", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "keep my details");
    const before = await storedTask(task.id);

    await setCompleted(user.client, task.id, true);

    expect(await storedTask(task.id)).toEqual({ ...before, completed: true });
  });

  it("deletes a Task permanently, and the list no longer shows it", async () => {
    const user = await createTestUser();
    const keep = await mustCreate(user.client, "keep");
    const doomed = await mustCreate(user.client, "delete me");

    await expect(deleteTask(user.client, doomed.id)).resolves.toEqual({
      ok: true,
    });

    expect((await listTasks(user.client)).map((t) => t.id)).toEqual([keep.id]);
    expect(await storedTask(doomed.id)).toBeNull();
    expect(await storedTask(keep.id)).not.toBeNull();
  });

  it("deleting the same Task a second time is not found", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "once only");
    await deleteTask(user.client, task.id);

    await expect(deleteTask(user.client, task.id)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("a User cannot complete or delete another User's Task", () => {
  it("completing it is not found, and the Task is unchanged", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const task = await mustCreate(alice.client, "alice's task");
    const before = await storedTask(task.id);

    const result = await setCompleted(bob.client, task.id, true);

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(await storedTask(task.id)).toEqual(before);
    expect(await listTasks(alice.client)).toEqual([task]);
  });

  it("reopening it is not found, and a completed Task stays completed", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const task = await mustCreate(alice.client, "alice done");
    await setCompleted(alice.client, task.id, true);
    const before = await storedTask(task.id);
    expect(before?.completed).toBe(true);

    const result = await setCompleted(bob.client, task.id, false);

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(await storedTask(task.id)).toEqual(before);
  });

  it("deleting it is not found, and the Task is still there", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const task = await mustCreate(alice.client, "alice keeps this");
    const before = await storedTask(task.id);

    const result = await deleteTask(bob.client, task.id);

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(await storedTask(task.id)).toEqual(before);
    expect(await listTasks(alice.client)).toEqual([task]);
  });

  it("does not touch Bob's own Tasks either", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const aliceTask = await mustCreate(alice.client, "alice's");
    const bobTask = await mustCreate(bob.client, "bob's");

    await deleteTask(bob.client, aliceTask.id);
    await setCompleted(bob.client, aliceTask.id, true);

    expect(await listTasks(bob.client)).toEqual([bobTask]);
  });
});

describe("an id that matches no Task is not found", () => {
  it("a random valid UUID: complete and delete both say not found", async () => {
    const user = await createTestUser();
    const missing = randomUUID();

    await expect(setCompleted(user.client, missing, true)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(deleteTask(user.client, missing)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it.each([["abc"], ["123"], [""], ["1 or 1=1"]])(
    "an id that is not a UUID (%j) says not found rather than throwing",
    async (id) => {
      const user = await createTestUser();
      const task = await mustCreate(user.client, "untouched");

      await expect(setCompleted(user.client, id, true)).resolves.toEqual({
        ok: false,
        reason: "not_found",
      });
      await expect(deleteTask(user.client, id)).resolves.toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(await listTasks(user.client)).toEqual([task]);
    },
  );
});

describe("the database allows a User to change only the Completed flag", () => {
  // These go through the raw client, like an attacker calling the API directly
  // with a valid login but skipping the app. The column-level permission in
  // 0003_task_updates_and_deletes.sql refuses any column except "completed".
  // A test passes if the request is refused OR changes nothing; what matters
  // is that the stored row is exactly as it was.

  it("cannot rename a Task", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "original title");
    const before = await storedTask(task.id);

    const { data, error } = await user.client
      .from("tasks")
      .update({ title: "renamed" })
      .eq("id", task.id)
      .select();

    expect(error !== null || data?.length === 0).toBe(true);
    expect(await storedTask(task.id)).toEqual(before);
  });

  it("cannot give a Task to another User", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const task = await mustCreate(alice.client, "mine, not yours");
    const before = await storedTask(task.id);

    const { data, error } = await alice.client
      .from("tasks")
      .update({ user_id: bob.id })
      .eq("id", task.id)
      .select();

    expect(error !== null || data?.length === 0).toBe(true);
    expect(await storedTask(task.id)).toEqual(before);
    expect(await listTasks(bob.client)).toEqual([]);
  });

  it("cannot change the creation time", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "dated");
    const before = await storedTask(task.id);

    const { data, error } = await user.client
      .from("tasks")
      .update({ created_at: "2000-01-01T00:00:00Z" })
      .eq("id", task.id)
      .select();

    expect(error !== null || data?.length === 0).toBe(true);
    expect(await storedTask(task.id)).toEqual(before);
  });

  it("a raw update that also tries to change the title is refused as a whole", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "all or nothing");
    const before = await storedTask(task.id);

    const { error } = await user.client
      .from("tasks")
      .update({ completed: true, title: "sneaky" })
      .eq("id", task.id);

    expect(error).not.toBeNull();
    expect(await storedTask(task.id)).toEqual(before);
  });
});

describe("a logged-out visitor cannot change or delete Tasks", () => {
  it("cannot update a Task", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "private");
    const before = await storedTask(task.id);
    const loggedOut = createAnonClient();

    const { data, error } = await loggedOut
      .from("tasks")
      .update({ completed: true })
      .eq("id", task.id)
      .select();

    expect(error !== null || data?.length === 0).toBe(true);
    expect(await storedTask(task.id)).toEqual(before);
  });

  it("cannot delete a Task", async () => {
    const user = await createTestUser();
    const task = await mustCreate(user.client, "private");
    const before = await storedTask(task.id);
    const loggedOut = createAnonClient();

    const { data, error } = await loggedOut
      .from("tasks")
      .delete()
      .eq("id", task.id)
      .select();

    expect(error !== null || data?.length === 0).toBe(true);
    expect(await storedTask(task.id)).toEqual(before);
  });
});
