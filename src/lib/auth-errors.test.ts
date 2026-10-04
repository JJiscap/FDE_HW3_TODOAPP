import { describe, expect, it } from "vitest";
import {
  GENERIC_AUTH_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  USERNAME_TAKEN_MESSAGE,
  authErrorMessage,
} from "./auth-errors";

describe("authErrorMessage", () => {
  it("says the Username is taken when sign-up hits an existing User", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toBe(
      USERNAME_TAKEN_MESSAGE,
    );
    expect(authErrorMessage({ code: "email_exists" })).toBe(
      USERNAME_TAKEN_MESSAGE,
    );
    expect(USERNAME_TAKEN_MESSAGE).toBe("Username already taken");
  });

  it("recognises a taken Username from the message when there is no code", () => {
    expect(authErrorMessage({ message: "User already registered" })).toBe(
      USERNAME_TAKEN_MESSAGE,
    );
  });

  it("gives one message for a wrong password and an unknown Username", () => {
    // Supabase reports both cases with the same code, and we must not
    // reveal which part was wrong.
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(
      authErrorMessage({ message: "Invalid login credentials", status: 400 }),
    ).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(INVALID_CREDENTIALS_MESSAGE).toBe("Invalid username or password");
  });

  it("never leaks Supabase wording or the synthetic email", () => {
    const message = authErrorMessage({
      code: "something_new",
      message: "Database error for alice@todoapp.invalid",
      status: 500,
    });
    expect(message).toBe(GENERIC_AUTH_MESSAGE);
    expect(message).not.toContain("todoapp.invalid");
  });

  it("falls back to a generic message for unknown, empty or non-error input", () => {
    expect(authErrorMessage({})).toBe(GENERIC_AUTH_MESSAGE);
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_MESSAGE);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_MESSAGE);
    expect(authErrorMessage("boom")).toBe(GENERIC_AUTH_MESSAGE);
  });
});
