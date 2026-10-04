"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TASK_TITLE_MAX_LENGTH, validateTaskTitle } from "@/lib/validation";

// The "add a Task" form on the home page. It is a client component because it
// reacts to every key press. Rules come from src/lib/validation.ts, the same
// ones the server uses, so the form and the API cannot disagree.
export default function AddTaskForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  // Red rules only appear once the visitor has clicked into the field and
  // left it (or tried to submit), so a fresh form is not covered in errors.
  const [touched, setTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Recalculated on every render, so rules and counter update live.
  const result = validateTaskTitle(title);
  const overLimit = result.remaining < 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser's own page reload
    setTouched(true);
    if (!result.valid || submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      // result.value is the trimmed title; that is what gets stored.
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: result.value }),
      });

      if (!response.ok) {
        // Friendly wording only; never show raw server messages.
        setErrorMessage(
          response.status === 401
            ? "Your session has ended. Please log in again."
            : response.status === 400
              ? "That title isn't valid. Use 1 to 200 characters."
              : "We couldn't add your Task. Please try again.",
        );
        return;
      }

      // Success: empty the box and ask the server page to re-fetch the list.
      setTitle("");
      setTouched(false);
      router.refresh();
    } catch {
      // fetch itself failed, for example the network is down.
      setErrorMessage(
        "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1.5">
      <label htmlFor="task-title" className="text-sm font-medium">
        New Task
      </label>
      {/* Stacks on narrow screens, sits side by side from "sm" up. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="task-title"
          name="title"
          type="text"
          autoComplete="off"
          placeholder="What needs doing?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !result.valid}
          aria-describedby={
            touched ? "task-title-rules task-title-count" : "task-title-count"
          }
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900"
        />
        <button
          type="submit"
          disabled={!result.valid || submitting}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Adding…" : "Add Task"}
        </button>
      </div>

      {/* Character counter: turns red when over the limit. */}
      <p
        id="task-title-count"
        className={`text-right text-sm ${overLimit ? "text-red-600" : "text-zinc-600"}`}
      >
        {result.length} / {TASK_TITLE_MAX_LENGTH}
      </p>

      {touched && (
        <ul id="task-title-rules" className="flex flex-col gap-0.5 text-sm">
          {result.rules.map((rule) => (
            <li
              key={rule.id}
              className={rule.met ? "text-green-700" : "text-red-600"}
            >
              <span aria-hidden="true">{rule.met ? "✓ " : "✗ "}</span>
              <span className="sr-only">{rule.met ? "Met: " : "Not met: "}</span>
              {rule.message}
            </li>
          ))}
        </ul>
      )}

      {/* Always in the page so screen readers announce the text when it appears. */}
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-red-600">
        {errorMessage}
      </p>
    </form>
  );
}
