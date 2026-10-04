"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import {
  usernameToLoginEmail,
  validatePassword,
  validateUsername,
  type FieldResult,
} from "@/lib/validation";

type Mode = "login" | "signup";

export default function LoginForm() {
  const router = useRouter();

  // What the form remembers between key presses.
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // A field is "touched" once the visitor has clicked into it and left it
  // (or tried to submit). Until then we do not show red rules, so a fresh
  // form is not covered in errors.
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The rules come from src/lib/validation.ts, the same ones the server uses.
  // They are recalculated on every render, so the list updates live as the
  // visitor types.
  const usernameResult = validateUsername(username);
  const passwordResult = validatePassword(password);
  const formIsValid = usernameResult.valid && passwordResult.valid;

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser's own page reload
    if (!formIsValid || submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    const supabase = createClient();
    // usernameResult.value is the Username trimmed and lowercased, so
    // "Alice" and "alice" are the same User. Supabase logs in with an email,
    // so we turn the Username into our synthetic one (docs/adr/0001).
    const email = usernameToLoginEmail(usernameResult.value);

    const { data, error } = isSignup
      ? await supabase.auth.signUp({
          email,
          password: passwordResult.value,
          // The database trigger reads this to create the Profile.
          options: { data: { username: usernameResult.value } },
        })
      : await supabase.auth.signInWithPassword({
          email,
          password: passwordResult.value,
        });

    // Sign-up logs the User in straight away, so a missing session means
    // something unexpected happened even though there was no error.
    if (error || !data.session) {
      setErrorMessage(authErrorMessage(error));
      setSubmitting(false);
      return;
    }

    // The session cookie is now set. Go home; refresh() makes Next.js
    // re-render server components so they see the new cookie.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div
        role="group"
        aria-label="Log in or sign up"
        className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1"
      >
        <ModeButton
          active={!isSignup}
          onClick={() => switchMode("login")}
          label="Log in"
        />
        <ModeButton
          active={isSignup}
          onClick={() => switchMode("signup")}
          label="Sign up"
        />
      </div>

      <Field
        id="username"
        label="Username"
        type="text"
        autoComplete="username"
        value={username}
        onChange={setUsername}
        onBlur={() => setUsernameTouched(true)}
        result={usernameResult}
        touched={usernameTouched}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        value={password}
        onChange={setPassword}
        onBlur={() => setPasswordTouched(true)}
        result={passwordResult}
        touched={passwordTouched}
      />

      {/* Always in the page so screen readers announce the text when it appears. */}
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-red-600">
        {errorMessage}
      </p>

      <button
        type="submit"
        disabled={!formIsValid || submitting}
        className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
      </button>
    </form>
  );
}

function ModeButton(props: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-zinc-900 ${
        props.active
          ? "bg-white shadow-sm"
          : "text-zinc-600 hover:text-zinc-900"
      }`}
    >
      {props.label}
    </button>
  );
}

// One labelled input plus its list of rules. Rules appear only once the field
// is touched: red while unmet, calm green once met. The words "Met" / "Not met"
// are there for screen readers (and colour-blind visitors), not just colour.
function Field(props: {
  id: string;
  label: string;
  type: "text" | "password";
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  result: FieldResult;
  touched: boolean;
}) {
  const { id, result, touched } = props;
  const rulesId = `${id}-rules`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {props.label}
      </label>
      <input
        id={id}
        name={id}
        type={props.type}
        autoComplete={props.autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        aria-invalid={touched && !result.valid}
        aria-describedby={touched ? rulesId : undefined}
        className="rounded-lg border border-zinc-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900"
      />
      {touched && (
        <ul id={rulesId} className="flex flex-col gap-0.5 text-sm">
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
    </div>
  );
}
