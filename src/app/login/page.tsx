import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Log in · To-do app",
};

// A server component: it only lays out the page. All the interactive parts
// (typing, live rules, the Log in / Sign up toggle) live in <LoginForm />,
// which is a client component. Logged-in visitors never see this page: the
// proxy (src/proxy.ts) sends them to the home page first.
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">To-do app</h1>
      <LoginForm />
    </main>
  );
}
