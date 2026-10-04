export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
/** Reserved (RFC 6761) domain for synthetic login emails. See docs/adr/0001. */
export const LOGIN_EMAIL_DOMAIN = "todoapp.invalid";
export const PASSWORD_MIN_LENGTH = 8;
export const TASK_TITLE_MIN_LENGTH = 1;
export const TASK_TITLE_MAX_LENGTH = 200;

const USERNAME_CHARACTERS = /^[a-z0-9_]*$/;

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

/** Length in Unicode code points (what Postgres char_length counts). */
function length(text: string): number {
  return [...text].length;
}

function fieldResult(value: string, rules: Rule[]): FieldResult {
  return { value, rules, valid: rules.every((rule) => rule.met) };
}

/** Passwords are returned exactly as typed: no trimming, no case change. */
export function validatePassword(raw: string): FieldResult {
  return fieldResult(raw, [
    {
      id: "min-length",
      message: "At least 8 characters",
      met: length(raw) >= PASSWORD_MIN_LENGTH,
    },
  ]);
}

export type TaskTitleResult = FieldResult & {
  /** Code points used by the trimmed title (for a character counter). */
  length: number;
  /** Code points left before the limit; negative once over it. */
  remaining: number;
};

export function validateTaskTitle(raw: string): TaskTitleResult {
  const value = raw.trim();
  const size = length(value);
  return {
    ...fieldResult(value, [
      { id: "not-empty", message: "Title can't be empty", met: size >= TASK_TITLE_MIN_LENGTH },
      { id: "max-length", message: "200 characters maximum", met: size <= TASK_TITLE_MAX_LENGTH },
    ]),
    length: size,
    remaining: TASK_TITLE_MAX_LENGTH - size,
  };
}

/**
 * The synthetic email Supabase Auth logs a Username in with (docs/adr/0001).
 * Takes the normalised Username (validateUsername(...).value) and throws on
 * anything else, so a malformed value can never reach the auth service.
 */
export function usernameToLoginEmail(username: string): string {
  const result = validateUsername(username);
  if (!result.valid || result.value !== username) {
    throw new Error("Invalid Username: cannot build a login email");
  }
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}

export function validateUsername(raw: string): FieldResult {
  const value = raw.trim().toLowerCase();
  const size = length(value);
  return fieldResult(value, [
    {
      id: "length",
      message: "3–20 characters",
      met: size >= USERNAME_MIN_LENGTH && size <= USERNAME_MAX_LENGTH,
    },
    {
      id: "characters",
      message: "Letters, numbers and underscore only",
      met: USERNAME_CHARACTERS.test(value),
    },
  ]);
}
