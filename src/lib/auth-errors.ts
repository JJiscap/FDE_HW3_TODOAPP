// Turns an error from Supabase Auth into the message we show the visitor.
//
// Why a separate function? Supabase's own wording ("Invalid login credentials",
// "User already registered") is meant for developers, and it mentions emails
// (our synthetic `name@todoapp.invalid` address, see docs/adr/0001). The
// visitor only knows a Username, so we choose our own text here. The function
// is pure (no network, no React), so it is easy to unit test.

export const USERNAME_TAKEN_MESSAGE = "Username already taken";
export const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password";
export const GENERIC_AUTH_MESSAGE = "Something went wrong. Please try again.";

/** The few fields of a Supabase `AuthError` we look at. */
type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  return typeof error === "object" && error !== null;
}

/**
 * Pick the user-facing message for a Supabase Auth error.
 *
 * - Sign-up with a Username that exists maps to "Username already taken".
 * - A failed login maps to ONE message, whether the Username does not exist
 *   or the password is wrong. Supabase already returns the same error for
 *   both; keeping a single message here means we never reveal which part was
 *   wrong (so strangers cannot discover which Usernames exist).
 * - Anything else gets a generic message, never Supabase's raw text.
 *
 * `code` is Supabase's stable machine-readable identifier, so we prefer it.
 * The message check is only a safety net for responses that carry no code.
 */
export function authErrorMessage(error: unknown): string {
  if (!isAuthErrorLike(error)) return GENERIC_AUTH_MESSAGE;

  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return USERNAME_TAKEN_MESSAGE;
  }
  if (error.code === "invalid_credentials") {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  const text = error.message?.toLowerCase() ?? "";
  if (text.includes("already registered")) return USERNAME_TAKEN_MESSAGE;
  if (text.includes("invalid login credentials")) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  return GENERIC_AUTH_MESSAGE;
}
