import { describe, expect, it } from "vitest";
import {
  validatePassword,
  validateTaskTitle,
  validateUsername,
  type FieldResult,
} from "./validation";

function ruleById(result: FieldResult, id: string) {
  const rule = result.rules.find((r) => r.id === id);
  if (!rule) throw new Error(`no rule with id "${id}"`);
  return rule;
}

describe("validateUsername", () => {
  it("accepts a lowercase Username and returns it unchanged", () => {
    const result = validateUsername("alice");
    expect(result.valid).toBe(true);
    expect(result.value).toBe("alice");
  });

  it("lowercases and trims, so Alice and alice are the same Username", () => {
    expect(validateUsername("Alice").value).toBe("alice");
    expect(validateUsername("  ALICE_01  ").value).toBe("alice_01");
    expect(validateUsername("  ALICE_01  ").valid).toBe(true);
  });

  describe("characters rule", () => {
    it.each(["alice", "a1b2c3", "___", "a_b", "123", "ALICE"])(
      "accepts %s",
      (raw) => {
        const result = validateUsername(raw);
        expect(ruleById(result, "characters")).toEqual({
          id: "characters",
          message: "Letters, numbers and underscore only",
          met: true,
        });
        expect(result.valid).toBe(true);
      },
    );

    it.each([
      ["hyphen", "ali-ce"],
      ["inner space", "ali ce"],
      ["at sign", "ali@ce"],
      ["dot", "ali.ce"],
      ["accented letter", "alicé"],
      ["Thai letter", "สมชาย"],
      ["emoji", "ali😀ce"],
      ["a whole email", "alice@todoapp.invalid"],
    ])("rejects %s", (_name, raw) => {
      const result = validateUsername(raw);
      expect(ruleById(result, "characters").met).toBe(false);
      expect(result.valid).toBe(false);
    });

    it("reports the characters rule independently of the length rule", () => {
      const tooShortButClean = validateUsername("ab");
      expect(ruleById(tooShortButClean, "length").met).toBe(false);
      expect(ruleById(tooShortButClean, "characters").met).toBe(true);

      const longEnoughButDirty = validateUsername("a-b");
      expect(ruleById(longEnoughButDirty, "length").met).toBe(true);
      expect(ruleById(longEnoughButDirty, "characters").met).toBe(false);
    });
  });

  describe("length rule", () => {
    it.each([
      [2, false],
      [3, true],
      [20, true],
      [21, false],
    ])("%i characters -> met: %s", (length, met) => {
      const result = validateUsername("a".repeat(length));
      expect(ruleById(result, "length")).toEqual({
        id: "length",
        message: "3–20 characters",
        met,
      });
      expect(result.valid).toBe(met);
    });

    it("counts after trimming, so surrounding spaces do not help", () => {
      expect(validateUsername("  ab  ").valid).toBe(false);
    });

    it("rejects the empty string and whitespace only", () => {
      for (const raw of ["", "   "]) {
        const result = validateUsername(raw);
        expect(result.value).toBe("");
        expect(result.valid).toBe(false);
        expect(ruleById(result, "length").met).toBe(false);
      }
    });
  });
});

describe("validatePassword", () => {
  it.each([
    [0, false],
    [7, false],
    [8, true],
    [9, true],
    [200, true],
  ])("%i characters -> valid: %s", (length, valid) => {
    const result = validatePassword("x".repeat(length));
    expect(result.valid).toBe(valid);
    expect(result.rules).toEqual([
      { id: "min-length", message: "At least 8 characters", met: valid },
    ]);
  });

  it("returns the password exactly as typed, never trimmed or altered", () => {
    const typed = "  Pass Word 1  ";
    expect(validatePassword(typed).value).toBe(typed);
  });

  it("counts surrounding spaces as characters", () => {
    expect(validatePassword("       a").valid).toBe(true);
  });

  it("has no other rules: any characters are fine", () => {
    expect(validatePassword("12345678").valid).toBe(true);
    expect(validatePassword("PASSWORD").valid).toBe(true);
    expect(validatePassword("........").valid).toBe(true);
  });

  it("counts an emoji as one character", () => {
    expect(validatePassword("😀".repeat(7)).valid).toBe(false);
    expect(validatePassword("😀".repeat(8)).valid).toBe(true);
  });
});

describe("validateTaskTitle", () => {
  it("accepts a normal title and returns it trimmed", () => {
    const result = validateTaskTitle("  Buy milk  ");
    expect(result.valid).toBe(true);
    expect(result.value).toBe("Buy milk");
  });

  it("keeps inner whitespace and case untouched", () => {
    expect(validateTaskTitle("Call  BOB").value).toBe("Call  BOB");
  });

  describe("not-empty rule", () => {
    it.each([
      ["empty string", ""],
      ["spaces only", "     "],
      ["tabs and newlines only", "\t\n \r\n"],
      ["non-breaking and ideographic spaces only", " 　"],
    ])("is unmet for %s", (_name, raw) => {
      const result = validateTaskTitle(raw);
      expect(result.value).toBe("");
      expect(result.valid).toBe(false);
      expect(ruleById(result, "not-empty")).toEqual({
        id: "not-empty",
        message: "Title can't be empty",
        met: false,
      });
      // Nothing is too long, so that rule is not flagged.
      expect(ruleById(result, "max-length").met).toBe(true);
    });

    it("is met by a single character", () => {
      const result = validateTaskTitle("a");
      expect(ruleById(result, "not-empty").met).toBe(true);
      expect(result.valid).toBe(true);
    });
  });

  describe("max-length rule", () => {
    it.each([
      [199, true],
      [200, true],
      [201, false],
    ])("%i characters -> met: %s", (size, met) => {
      const result = validateTaskTitle("a".repeat(size));
      expect(ruleById(result, "max-length")).toEqual({
        id: "max-length",
        message: "200 characters maximum",
        met,
      });
      expect(ruleById(result, "not-empty").met).toBe(true);
      expect(result.valid).toBe(met);
    });

    it("counts Unicode code points, not UTF-16 units (matches Postgres char_length)", () => {
      // 200 emoji are 400 UTF-16 code units but 200 code points: allowed.
      expect(validateTaskTitle("😀".repeat(200)).valid).toBe(true);
      expect(validateTaskTitle("😀".repeat(201)).valid).toBe(false);
    });

    it("measures the trimmed title, so padding does not push it over", () => {
      expect(validateTaskTitle(` ${"a".repeat(200)} `).valid).toBe(true);
    });
  });

  describe("character counter", () => {
    it("reports used and remaining characters", () => {
      const result = validateTaskTitle("Buy milk");
      expect(result.length).toBe(8);
      expect(result.remaining).toBe(192);
    });

    it("starts at 0 used and 200 remaining", () => {
      const result = validateTaskTitle("");
      expect(result.length).toBe(0);
      expect(result.remaining).toBe(200);
    });

    it("counts trimmed code points and goes negative past the limit", () => {
      expect(validateTaskTitle("  😀😀  ").length).toBe(2);
      expect(validateTaskTitle("😀".repeat(200)).remaining).toBe(0);
      expect(validateTaskTitle("a".repeat(203)).remaining).toBe(-3);
    });
  });
});
