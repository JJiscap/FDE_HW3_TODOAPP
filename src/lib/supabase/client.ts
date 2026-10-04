import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for code that runs in the BROWSER (client components such
 * as the login form).
 *
 * It uses only the two public environment variables. The anon key is safe to
 * ship to the browser because it can do nothing beyond what Row Level
 * Security allows (docs/adr/0002). Next.js only exposes variables whose name
 * starts with NEXT_PUBLIC_ to browser code, and it replaces them where they
 * are written literally, so do not read them through a helper or a loop.
 *
 * The session lives in cookies, which is why the server (and the proxy) can
 * see who is logged in too.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
