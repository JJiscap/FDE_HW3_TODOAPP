// The one module that owns Task operations (see spec "Data module").
//
// Every function takes a Supabase client that is already signed in as a User
// and runs as that User. Which Tasks the User may see or change is decided by
// Row Level Security in the database (docs/adr/0002), not by filtering here.
// Route handlers stay thin: they only translate these results into HTTP codes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateTaskTitle } from "./validation";

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  /** ISO timestamp from the database. */
  createdAt: string;
};

// The columns we read back, and the shape the database returns them in.
const TASK_COLUMNS = "id, title, completed, created_at";

type TaskRow = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at,
  };
}

// Postgres error code for "a CHECK constraint failed" (here: the title rule).
const CHECK_VIOLATION = "23514";

export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; reason: "invalid_title" };

/**
 * The signed-in User's Tasks, newest first. Throws if the database fails
 * unexpectedly (a missing Task list is never reported as an empty list).
 */
export async function listTasks(client: SupabaseClient): Promise<Task[]> {
  // No filter on user_id: Row Level Security already limits the rows to the
  // signed-in User's own.
  const { data, error } = await client
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not list Tasks: ${error.message}`);
  return (data as TaskRow[]).map(toTask);
}

/**
 * Adds a Task for the signed-in User. The title is validated with
 * validateTaskTitle (trimmed, 1-200 characters) and the trimmed value is what
 * is stored. An invalid title returns `invalid_title`, whether it was caught
 * here or by the database CHECK. Any other database failure throws.
 */
export async function createTask(
  client: SupabaseClient,
  rawTitle: string,
): Promise<CreateTaskResult> {
  const title = validateTaskTitle(rawTitle);
  if (!title.valid) return { ok: false, reason: "invalid_title" };

  // Store the trimmed value. user_id is not sent: the column default fills it
  // from the session, and the insert policy checks it is the User's own.
  const { data, error } = await client
    .from("tasks")
    .insert({ title: title.value })
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    // The database re-checks the title rule; if it still says no, that is the
    // same answer as an invalid title.
    if (error.code === CHECK_VIOLATION) {
      return { ok: false, reason: "invalid_title" };
    }
    throw new Error(`Could not create the Task: ${error.message}`);
  }
  return { ok: true, task: toTask(data as TaskRow) };
}
