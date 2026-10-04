import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Integration tests: they talk to the REAL Supabase test project over the
// network, so they are slower and need credentials. They are kept apart from
// the fast unit tests (vitest.config.ts), which only look inside src/.
//
// Credentials come from two places:
//   - locally: the git-ignored .env.test file (copy .env.test.example)
//   - in CI: real environment variables, set from GitHub repository secrets
// If both exist, the real environment variable wins.
export default defineConfig(({ mode }) => {
  // loadEnv reads .env.test (because mode is "test"). The empty prefix ""
  // means "load every variable", not only ones starting with VITE_.
  const fileEnv = loadEnv(mode, process.cwd(), "");

  // Only use a value from the file when the variable is not already set in the
  // real environment, so CI secrets always take precedence.
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) env[key] = value;
  }

  return {
    resolve: {
      // Mirrors the "@/*" path alias from tsconfig.json.
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
      environment: "node",
      include: ["tests/integration/**/*.test.ts"],
      env,
      // Network calls are slower than unit tests, so allow more time.
      testTimeout: 30_000,
      hookTimeout: 30_000,
      // Run test files one after another, not in parallel, so tests that
      // create and delete Users cannot get in each other's way.
      fileParallelism: false,
    },
  };
});
