import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: fast, offline, no database. Integration tests that talk to the
// real Supabase test project get their own config (added with the schema slice).
export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
