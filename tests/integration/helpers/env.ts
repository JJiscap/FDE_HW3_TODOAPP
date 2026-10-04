// Reads the three settings the integration tests need to reach the Supabase
// TEST project. The names are fixed because they must match the GitHub secret
// names used by the "integration" job in .github/workflows/ci.yml.

export type TestEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

const REQUIRED_VARS = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
] as const;

export function getTestEnv(): TestEnv {
  // A variable counts as missing if it is unset or only whitespace.
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    // Only the NAMES are printed, never the values.
    throw new Error(
      `Integration tests need these environment variables, but they are missing or empty: ${missing.join(", ")}.\n` +
        "Locally: copy .env.test.example to .env.test and fill in the values from your Supabase TEST project " +
        "(Project Settings > API).\n" +
        "In CI: add them as GitHub repository secrets with exactly these names (Settings > Secrets and variables > Actions).",
    );
  }

  return {
    url: process.env.SUPABASE_TEST_URL!.trim(),
    anonKey: process.env.SUPABASE_TEST_ANON_KEY!.trim(),
    serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!.trim(),
  };
}
