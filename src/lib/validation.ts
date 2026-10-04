export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

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
