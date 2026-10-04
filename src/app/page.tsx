import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

// A server component: it runs on the server for each request, so it can read
// the session cookies and ask the database who the signed-in User is.
export default async function Home() {
  const supabase = await createClient();

  // getUser() asks Supabase Auth to verify the session, so a forged cookie
  // cannot pass. (getSession() would trust the cookie as-is.) The proxy has
  // already redirected logged-out visitors, but we check again here: this
  // page must never rely on a different file having done its job.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Row Level Security lets a User read only their own Profile, so the
  // `.eq("id", ...)` is just to ask for exactly one row.
  // maybeSingle() returns null instead of an error when there is no row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">To-do app</h1>
      <p className="text-zinc-600">
        {profile ? (
          <>
            Signed in as <strong className="text-zinc-900">{profile.username}</strong>
          </>
        ) : (
          // Graceful fallback: the Profile row is missing or could not be
          // read. The User is still logged in, so do not crash the page.
          "Signed in (your profile could not be loaded)"
        )}
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
