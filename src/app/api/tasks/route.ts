// The Tasks API: GET lists the signed-in User's Tasks, POST adds one.
//
// These handlers are deliberately thin. They only (1) find out who is asking
// and (2) translate the data module's result (src/lib/tasks.ts) into an HTTP
// status code. The real rules live in the data module and the database.

import { createClient } from "@/lib/supabase/server";
import { createTask, listTasks } from "@/lib/tasks";

// A generic message for anything unexpected, so internal details (database
// errors, stack traces) never reach the browser. The real error goes to the
// server log only.
function serverError(error: unknown) {
  console.error("Tasks API failed:", error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    // getUser() asks Supabase Auth to verify the session (getSession() would
    // trust the cookie as-is).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const tasks = await listTasks(supabase);
    return Response.json({ tasks }, { status: 200 });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    // The body must be JSON like {"title": "Buy milk"}. Anything else is the
    // caller's mistake, so it is a 400, not a 500.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const title =
      typeof body === "object" && body !== null
        ? (body as { title?: unknown }).title
        : undefined;
    if (typeof title !== "string") {
      return Response.json({ error: "A title is required" }, { status: 400 });
    }

    const result = await createTask(supabase, title);
    if (!result.ok) {
      return Response.json(
        { error: "Title must be 1-200 characters" },
        { status: 400 },
      );
    }
    return Response.json({ task: result.task }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
