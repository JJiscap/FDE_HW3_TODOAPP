import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for code that runs on the SERVER: server components,
 * server actions and route handlers.
 *
 * What is a cookie here? When a User logs in, Supabase gives the browser a
 * session (a signed token) and the browser stores it in cookies. The browser
 * then sends those cookies with every request, so this client can act as that
 * User. `cookies()` from Next.js is how we read the request's cookies.
 *
 * Create a NEW client for every request (call this function inside the
 * component or handler), never at the top of a file, so that one visitor's
 * cookies can never leak into another visitor's request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server components are not allowed to write cookies, so this
          // throws when we are called from one. That is fine: the proxy
          // (src/proxy.ts) refreshes the session and writes the cookies on
          // every request, so ignoring the error here is safe. Server
          // actions and route handlers can write cookies and do so normally.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component; the proxy handles it.
          }
        },
      },
    },
  );
}
