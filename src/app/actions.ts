"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// A server action: a function that runs on the server when a <form> that
// points at it is submitted. Server actions may write cookies, which is what
// logging out needs (it clears the session cookies).
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // redirect() throws on purpose to stop this function; keep it last and
  // outside any try/catch.
  redirect("/login");
}
