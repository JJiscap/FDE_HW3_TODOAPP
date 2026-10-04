// One Task by id: PATCH marks it Completed (or reopens it), DELETE removes it.
//
// Like the list route, these handlers are deliberately thin. They only
// (1) find out who is asking and (2) translate the data module's result
// (src/lib/tasks.ts) into an HTTP status code.
//
// "Not found" is ONE answer for every case: an id that does not exist, an id
// that belongs to another User, or an id that is not even a valid id. The
// response is identical each time, so the API never reveals which ids exist.

import { createClient } from "@/lib/supabase/server";
import { deleteTask, setCompleted } from "@/lib/tasks";

// In this version of Next.js, `params` is a Promise, so we `await` it.
type Context = { params: Promise<{ id: string }> };

// Generic message for anything unexpected; the real error goes to the server
// log only (same helper shape as src/app/api/tasks/route.ts).
function serverError(error: unknown) {
  console.error("Task API failed:", error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

function notFound() {
  return Response.json({ error: "Task not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
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

    // The body must be JSON like {"completed": true}. Anything else is the
    // caller's mistake, so it is a 400, not a 500.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const completed =
      typeof body === "object" && body !== null
        ? (body as { completed?: unknown }).completed
        : undefined;
    if (typeof completed !== "boolean") {
      return Response.json(
        { error: "completed must be true or false" },
        { status: 400 },
      );
    }

    const { id } = await params;
    const result = await setCompleted(supabase, id, completed);
    if (!result.ok) return notFound();
    return Response.json({ task: result.task }, { status: 200 });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const { id } = await params;
    const result = await deleteTask(supabase, id);
    if (!result.ok) return notFound();
    // 204 means "done, and there is nothing to send back".
    return new Response(null, { status: 204 });
  } catch (error) {
    return serverError(error);
  }
}
