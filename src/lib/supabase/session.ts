import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** The only page a logged-out visitor may see. */
const LOGIN_PATH = "/login";

/**
 * Called by src/proxy.ts on every matching request. It does two jobs:
 *
 * 1. Keep the session fresh. A session token expires after a while; Supabase
 *    swaps it for a new one (a "refresh") when we ask who the User is. The
 *    new token has to be written back into the cookies of BOTH the request
 *    (so pages rendered next see it) and the response (so the browser keeps
 *    it). That is what the `setAll` function below does.
 * 2. Redirect: logged-out visitors go to /login, logged-in visitors go away
 *    from /login to the home page.
 *
 * Why getClaims() and not getSession()? Session data comes from cookies, and
 * a cookie is something the visitor controls: anybody can edit it. getSession()
 * just believes what the cookie says. getClaims() checks the token's signature
 * against Supabase's keys (and getUser() asks the Auth server directly), so a
 * forged cookie is rejected. Never base a "is this person logged in?" decision
 * on getSession() on the server.
 *
 * This is only a first, cheap gate. The real protection of the data is Row
 * Level Security in the database (docs/adr/0002), which does not depend on
 * this code.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write the refreshed cookies onto the request, then build a new
          // response from that request and write them onto it as well.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not put any code between creating the client and this call: it is
  // what triggers the refresh described above.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;

  // API routes answer 401 themselves (ticket 04). A redirect to an HTML page
  // would be the wrong answer for a program calling the API, but we still
  // want the cookie refresh above to have run for them.
  if (pathname.startsWith("/api")) return response;

  const isLoginPage = pathname === LOGIN_PATH;
  if (!isLoggedIn && !isLoginPage) return redirectTo(request, response, LOGIN_PATH);
  if (isLoggedIn && isLoginPage) return redirectTo(request, response, "/");

  return response;
}

/**
 * Build a redirect that keeps the cookies the refresh may have just written.
 * Returning a plain NextResponse.redirect would drop them and could log the
 * User out.
 */
function redirectTo(
  request: NextRequest,
  refreshed: NextResponse,
  path: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  refreshed.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
