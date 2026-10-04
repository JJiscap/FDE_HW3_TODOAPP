import { describe, expect, it } from "vitest";
import { validateUsername, type FieldResult } from "./validation";

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
