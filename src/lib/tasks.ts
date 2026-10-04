// The one module that owns Task operations (see spec "Data module").
//
// Every function takes a Supabase client that is already signed in as a User
// and runs as that User. Which Tasks the User may see or change is decided by
// Row Level Security in the database (docs/adr/0002), not by filtering here.
// Route handlers stay thin: they only translate these results into HTTP codes.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  /** ISO timestamp from the database. */
  createdAt: string;
};

export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; reason: "invalid_title" };

/**
 * The signed-in User's Tasks, newest first. Throws if the database fails
 * unexpectedly (a missing Task list is never reported as an empty list).
 */
export async function listTasks(client: SupabaseClient): Promise<Task[]> {
  void client;
  throw new Error("listTasks: not implemented yet");
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
  void client;
  void rawTitle;
  throw new Error("createTask: not implemented yet");
}
