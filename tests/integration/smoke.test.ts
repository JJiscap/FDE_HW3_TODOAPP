import { afterAll, describe, expect, it } from "vitest";
import { cleanupTestUsers, createTestUser } from "./helpers/users";

afterAll(cleanupTestUsers);

// If this fails, first check that the Supabase TEST project is reachable and
// not paused (free-tier projects pause after about a week idle), and that the
// three SUPABASE_TEST_* variables are set. Then look for a real bug.
describe("Supabase test project connectivity (check it is reachable and not paused)", () => {
  it("creates a throwaway User and signs them in", async () => {
    const user = await createTestUser();

    const { data, error } = await user.client.auth.getSession();

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.session?.user.id).toBe(user.id);
  });
});
