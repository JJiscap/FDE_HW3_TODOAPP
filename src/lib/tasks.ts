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

// The shape of a Task id: 8-4-4-4-12 hex digits, either case. `$` would also
// match before a trailing newline, so the end is checked with a lookahead.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\s\S])/i;

/**
 * Whether `id` looks like a Task id (a UUID). An id that does not can never
 * match a Task, and must not be sent to the database, which would answer with
 * an error instead of "no rows".
 */
export function isTaskId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export type TaskChangeResult =
  | { ok: true; task: Task }
  | { ok: false; reason: "not_found" };

export type DeleteTaskResult = { ok: true } | { ok: false; reason: "not_found" };

/**
 * Marks a Task Completed or reopens it. `not_found` when no row was changed:
 * the id does not exist, belongs to another User (Row Level Security hides it,
 * so it looks exactly like a missing id), or is not a valid id at all. Only
 * `completed` can be changed; the title never is. Other failures throw.
 */
export async function setCompleted(
  client: SupabaseClient,
  id: string,
  completed: boolean,
): Promise<TaskChangeResult> {
  // An id that is not a UUID cannot match any Task. Answer without asking the
  // database: Postgres would raise an error (22P02) instead of finding nothing.
  if (!isTaskId(id)) return { ok: false, reason: "not_found" };

  // Only `completed` is sent (the database also refuses any other column).
  // No filter on user_id: Row Level Security hides other Users' rows, so
  // they simply match nothing. The changed row is selected back so an empty
  // result means "nothing was changed".
  const { data, error } = await client
    .from("tasks")
    .update({ completed })
    .eq("id", id)
    .select(TASK_COLUMNS);

  if (error) throw new Error(`Could not update the Task: ${error.message}`);
  const rows = data as TaskRow[];
  if (rows.length === 0) return { ok: false, reason: "not_found" };
  return { ok: true, task: toTask(rows[0]) };
}

/**
 * Permanently deletes a Task. `not_found` when no row was deleted (same cases
 * as setCompleted). Other failures throw.
 */
export async function deleteTask(
  client: SupabaseClient,
  id: string,
): Promise<DeleteTaskResult> {
  if (!isTaskId(id)) return { ok: false, reason: "not_found" };

  // The deleted row's id is selected back only so rows can be counted: zero
  // means the Task is missing or not this User's (Row Level Security hides it).
  const { data, error } = await client
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw new Error(`Could not delete the Task: ${error.message}`);
  if ((data as { id: string }[]).length === 0) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}
