// The rules for Usernames, passwords and Task titles, in one place.
//
// Both the forms (in the browser, to show live feedback) and the API (on the
// server, which must never trust the browser) import this file, so the two
// can never disagree. It is plain functions with no imports: no network, no
// database, no React. That is what makes it quick to unit test.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
/**
 * Reserved (RFC 6761) domain for synthetic login emails. ".invalid" can never
 * be a real address, so no mail can ever be delivered to it. See docs/adr/0001.
 */
export const LOGIN_EMAIL_DOMAIN = "todoapp.invalid";
export const PASSWORD_MIN_LENGTH = 8;
export const TASK_TITLE_MIN_LENGTH = 1;
export const TASK_TITLE_MAX_LENGTH = 200;

const USERNAME_CHARACTERS = /^[a-z0-9_]*$/;

/** One rule a form can show: red while `met` is false, neutral/green after. */
export type Rule = {
  id: string;
  message: string;
  met: boolean;
};

export type FieldResult = {
  /** The normalised value to submit. */
  value: string;
  rules: Rule[];
  valid: boolean;
};

/**
 * Length in Unicode code points, which is what Postgres `char_length` counts
 * (so the database check agrees with this one). `text.length` would count an
 * emoji as 2 because JavaScript strings are UTF-16; spreading the string
 * (`[...text]`) iterates whole characters instead.
 */
function codePointCount(text: string): number {
  return [...text].length;
}

function fieldResult(value: string, rules: Rule[]): FieldResult {
  return { value, rules, valid: rules.every((rule) => rule.met) };
}

/**
 * A Username is trimmed and lowercased, so `Alice` and `alice` are the same
 * Username. While the box is empty the "characters" rule counts as met (there
 * is nothing wrong yet) and only the "length" rule is red.
 */
export function validateUsername(raw: string): FieldResult {
  const value = raw.trim().toLowerCase();
  const size = codePointCount(value);
  return fieldResult(value, [
    {
      id: "length",
      message: `${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters`,
      met: size >= USERNAME_MIN_LENGTH && size <= USERNAME_MAX_LENGTH,
    },
    {
      id: "characters",
      message: "Letters, numbers and underscore only",
      met: USERNAME_CHARACTERS.test(value),
    },
  ]);
}

/** Passwords are returned exactly as typed: no trimming, no case change. */
export function validatePassword(raw: string): FieldResult {
  return fieldResult(raw, [
    {
      id: "min-length",
      message: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: codePointCount(raw) >= PASSWORD_MIN_LENGTH,
    },
  ]);
}

export type TaskTitleResult = FieldResult & {
  /** Code points used by the trimmed title (for a character counter). */
  length: number;
  /** Code points left before the limit; negative once over it. */
  remaining: number;
};

/**
 * Submit `value` (the trimmed title), not the raw input. JavaScript `trim()`
 * also strips non-breaking and ideographic spaces, while Postgres `btrim` only
 * strips ordinary spaces by default, so the database check must run on the
 * trimmed value this function returns.
 */
export function validateTaskTitle(raw: string): TaskTitleResult {
  const value = raw.trim();
  const size = codePointCount(value);
  return {
    ...fieldResult(value, [
      {
        id: "not-empty",
        message: "Title can't be empty",
        met: size >= TASK_TITLE_MIN_LENGTH,
      },
      {
        id: "max-length",
        message: `${TASK_TITLE_MAX_LENGTH} characters maximum`,
        met: size <= TASK_TITLE_MAX_LENGTH,
      },
    ]),
    length: size,
    remaining: TASK_TITLE_MAX_LENGTH - size,
  };
}

/**
 * The synthetic email Supabase Auth logs a Username in with (docs/adr/0001).
 * Takes the normalised Username (validateUsername(...).value) and throws on
 * anything else. Re-checking here, rather than trusting the caller, means a
 * malformed value (an "@", a space, uppercase) can never reach the auth
 * service, even if a caller forgets to validate first.
 */
export function usernameToLoginEmail(username: string): string {
  const result = validateUsername(username);
  if (!result.valid || result.value !== username) {
    throw new Error("Invalid Username: cannot build a login email");
  }
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}
