import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// In Next.js 16 "middleware" is called "proxy". This function runs before a
// page or API route is handled, so it is the place to refresh the login
// session and redirect visitors who are not allowed on a page. The work is in
// src/lib/supabase/session.ts; this file only connects it to Next.js.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything EXCEPT static assets: Next's own files, the favicon
    // and images. Otherwise the CSS, JS and images of the login page would be
    // redirected to /login and the page would look broken. API routes are
    // included on purpose (the session is refreshed for them), but
    // updateSession never redirects them.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
