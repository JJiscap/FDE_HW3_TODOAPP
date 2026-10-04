import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: fast, offline, no database. Integration tests that talk to the
// real Supabase test project have their own config: vitest.integration.config.ts.
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
