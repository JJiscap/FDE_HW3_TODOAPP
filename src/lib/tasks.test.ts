import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createTask } from "./tasks";

// Only the part of createTask that never reaches the database is tested here,
// without a database. Everything that talks to the database is covered by
// tests/integration/tasks.test.ts against the real Supabase test project.

// A stand-in client that fails the test if the code touches it in any way.
const throwingClient = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(
        `The client was used (${String(property)}) but an invalid title must not reach the database`,
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
