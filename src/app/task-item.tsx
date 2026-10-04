"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Task } from "@/lib/tasks";

// One row of the Task list. It is a client component because it reacts to
// clicks and talks to the API. The page (a server component) fetches the
// Tasks and renders one of these per Task; after every change we call
// router.refresh() so the page re-fetches the list from the server.
export default function TaskItem({ task }: { task: Task }) {
  const router = useRouter();

  // True while a request is in flight; the row's controls are disabled then
  // so a double click cannot send the same request twice.
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Both controls share this: send the request, then react to the status.
  async function send(init: RequestInit) {
    if (busy) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tasks/${task.id}`, init);

      if (response.ok) {
        router.refresh(); // show the new state (or the Task gone)
        return;
      }

      // Friendly wording only; never show raw server messages.
      if (response.status === 404) {
        setMessage("This Task no longer exists. Refreshing your list.");
        router.refresh();
      } else if (response.status === 401) {
        setMessage("Your session has ended. Please log in again.");
      } else {
        setMessage("We couldn't update that Task. Please try again.");
      }
    } catch {
      // fetch itself failed, for example the network is down.
      setMessage(
        "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleToggle() {
    return send({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
  }

  function handleDelete() {
    // Deleting is permanent, so ask first.
    if (
      !window.confirm(`Delete the Task "${task.title}"? This cannot be undone.`)
    ) {
      return;
    }
    return send({ method: "DELETE" });
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-start gap-3">
        {/* The label wraps the checkbox and the title, so clicking the title
            also toggles it. Screen readers read "Mark as Completed: <title>"
            plus the checked state. */}
        <label className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggle}
            disabled={busy}
            className="mt-0.5 size-5 shrink-0 accent-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          />
          {/* break-words so a long title wraps instead of widening the page.
              A Completed Task is struck through AND muted, so it never
              depends on colour alone (the checked box is a third cue). */}
          <span
            className={`break-words ${
              task.completed ? "text-zinc-500 line-through" : ""
            }`}
          >
            <span className="sr-only">Mark as Completed: </span>
            {task.title}
          </span>
        </label>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          aria-label={`Delete Task: ${task.title}`}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      {/* Always in the page so screen readers announce the text when it
          appears; empty:hidden keeps it from taking space while empty. */}
      <p
        role="alert"
        aria-live="polite"
        className="text-sm text-red-600 empty:hidden"
      >
        {message}
      </p>
    </li>
  );
}
