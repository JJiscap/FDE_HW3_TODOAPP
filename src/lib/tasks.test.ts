import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createTask, deleteTask, isTaskId, setCompleted } from "./tasks";

// Only the parts that never reach the database (an invalid title, an id that
// is not a UUID) are tested here, without a database. Everything that talks to the database is covered by
// tests/integration/tasks.test.ts against the real Supabase test project.

// A stand-in client that fails the test if the code touches it in any way.
const throwingClient = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(
        `The client was used (${String(property)}) but invalid input must not reach the database`,
      );
    },
  },
) as unknown as SupabaseClient;

describe("createTask with an invalid title", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["only tabs and newlines", "\t\n "],
    ["201 characters", "a".repeat(201)],
  ])(
    "returns invalid_title for a title that is %s, without using the client",
    async (_label, title) => {
      await expect(createTask(throwingClient, title)).resolves.toEqual({
        ok: false,
        reason: "invalid_title",
      });
    },
  );
});

describe("isTaskId", () => {
  it.each([
    "3f2b8c1e-9d4a-4b6f-8a1c-0e5d7f9a2b3c",
    "3F2B8C1E-9D4A-4B6F-8A1C-0E5D7F9A2B3C",
    "00000000-0000-0000-0000-000000000000",
  ])("accepts the UUID %s", (id) => {
    expect(isTaskId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["a number", "123"],
    ["one character too short", "3f2b8c1e-9d4a-4b6f-8a1c-0e5d7f9a2b3"],
    ["one character too long", "3f2b8c1e-9d4a-4b6f-8a1c-0e5d7f9a2b3cd"],
    ["a non-hex character", "3f2b8c1e-9d4a-4b6f-8a1c-0e5d7f9a2b3g"],
    ["no dashes", "3f2b8c1e9d4a4b6f8a1c0e5d7f9a2b3c"],
    ["surrounding spaces", " 3f2b8c1e-9d4a-4b6f-8a1c-0e5d7f9a2b3c "],
    ["a trailing newline", "3f2b8c1e-9d4a-4b6f-8a1c-0e5d7f9a2b3c\n"],
    ["SQL-looking text", "1 or 1=1"],
  ])("rejects %s", (_label, id) => {
    expect(isTaskId(id)).toBe(false);
  });
});

describe("a Task id that is not a UUID is not found, without using the client", () => {
  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["a number", "123"],
  ])("setCompleted with an id that is %s", async (_label, id) => {
    await expect(setCompleted(throwingClient, id, true)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["a number", "123"],
  ])("deleteTask with an id that is %s", async (_label, id) => {
    await expect(deleteTask(throwingClient, id)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
