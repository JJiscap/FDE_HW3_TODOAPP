# To-do app

A web app where each person signs up with a username and password and keeps a private list of tasks. You can add a Task, mark it Completed (and reopen it) and delete it. Nobody else can see or change your Tasks.

- **Live:** https://fde-hw-3-todoapp.vercel.app
- **Stack:** Next.js 16 (pages and API in one app), Supabase (Postgres database and login), Vercel (hosting), Docker (local and CI only), GitHub Actions (CI).
- **How it works inside:** read [ARCHITECTURE.md](ARCHITECTURE.md). Words like *User*, *Task* and *Completed* are defined in [GLOSSARY.md](GLOSSARY.md). Big decisions are in [docs/adr/](docs/adr/).

## Run it on your computer

You need Node 22 and a Supabase project (the free tier is fine).

1. **Create the database.** In your Supabase project, run the three files in `supabase/migrations/` in order (SQL editor, or the Supabase CLI). They create the `profiles` and `tasks` tables and the Row Level Security rules.
2. **Relax the login rules for the demo.** Supabase dashboard, Authentication:
   - turn **Confirm email** off (the app has no mail flow, see ADR 0001);
   - set the minimum password length to 8, with no required character types (the app enforces its own rules).
3. **Install and configure.**

   ```bash
   nvm use                       # Node 22, from .nvmrc
   npm ci
   cp .env.example .env.local    # then fill in the two values, see below
   npm run dev                   # http://localhost:3000
   ```

### Environment variables

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Docker `.env`, Vercel | Your project URL, `https://<ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | The project's anon (publishable) key. Public by design, see Security below. |
| `SUPABASE_TEST_URL` | `.env.test`, GitHub secret | URL of a **separate** Supabase project used only by the integration tests. |
| `SUPABASE_TEST_ANON_KEY` | same | That test project's anon key. |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | same | That test project's service-role key. Used only by test code to create and delete throwaway Users. Never put it in app code, in `.env.local`, or on Vercel. |

All real env files (`.env`, `.env.local`, `.env.test`) are git-ignored. Only the templates `.env.example` and `.env.test.example` are committed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest). Fast, need no network or database. |
| `npm run test:integration` | Integration tests against the real Supabase **test** project. Need `.env.test`. |
| `npm run build` | Production build |

### Tests

- **Unit tests** (`src/**/*.test.ts`) cover the rules (username, password and title validation), the auth error messages and the data module with a fake database client.
- **Integration tests** (`tests/integration/`) sign real throwaway Users up on the test project and check what the database really does: two Users cannot read, complete or delete each other's Tasks, an empty or oversized title is rejected, a client cannot change a title or an owner, and the profile trigger refuses bad Usernames. Each test cleans up the Users it made.

To run the integration tests, copy `.env.test.example` to `.env.test`, fill in the three `SUPABASE_TEST_*` values, apply the migrations to the test project too, then `npm run test:integration`. Use a project that holds nothing you care about.

## Run it in Docker

Docker runs the same app as a container. It is for checking the app locally and in CI; Vercel ignores it ([ADR 0003](docs/adr/0003-single-nextjs-app-docker-for-local-and-ci.md)). New to Docker? [docs/docker.md](docs/docker.md) explains the words and every command.

```bash
cp .env.example .env              # fill in the two NEXT_PUBLIC_ values
docker compose up --build -d --wait
# open http://localhost:3000
docker compose logs -f app        # watch the logs
docker compose down               # stop and remove the container
```

## Deploy on Vercel

1. Push the repo to GitHub and **Import** it as a new project in Vercel (framework: Next.js, detected automatically).
2. Under **Environment Variables** add only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the demo project's values). Do **not** add the service-role key.
3. Make sure the project uses Node 22.x (Project Settings, Node.js Version). `package.json` also pins `22.x`.
4. Deploy. Every push to `main` redeploys. You do not need Vercel's optional Supabase integration; the two variables are enough.
5. No Supabase redirect or site-URL setting is needed, because the app sends no email links.

## Security notes

- **Passwords are hashed.** The app never sees or stores a password beyond passing it to Supabase Auth, which stores only a bcrypt hash. There is no password column in this app's tables.
- **Nothing secret is in git.** Real env files and any `.db` file are git-ignored, and a scan of the files and the full history finds no keys. The only keys in the app are the URL and the anon key.
- **The anon key is public by design.** It ships to every browser. It can do nothing beyond what Row Level Security allows the signed-in User, which is why isolation lives in the database ([ADR 0002](docs/adr/0002-isolation-enforced-by-row-level-security.md)). The powerful service-role key is not used by the app and is never on Vercel or in Docker.
- **Another User's Task looks like a missing one.** Reading, completing or deleting an id that is not yours returns the same `404` as an id that does not exist, so ids cannot be probed. No session gives `401`, bad input gives `400`.
- **Session cookies** are managed by `@supabase/ssr`; the server verifies the session with Supabase on every request instead of trusting the cookie.

## Known limits

- **No password reset.** Logins use made-up emails (`<username>@todoapp.invalid`, [ADR 0001](docs/adr/0001-usernames-map-to-synthetic-emails.md)), so no email can be sent. A User who forgets a password must make a new account.
- **Free-tier Supabase projects pause after about a week of inactivity.** The site and the CI integration job then fail until you un-pause the project in the Supabase dashboard.
- **Supabase's own password policy still applies** on top of the app's. If sign-up shows a "password too weak" message, loosen the project's password requirements as in the setup above.
- **Production would need a hosted database.** This app already uses hosted Postgres (Supabase), which is what makes it work on Vercel. A file database such as SQLite, as in the original brief, cannot persist on Vercel's read-only, short-lived servers. For real use, move off the free tier, turn on backups and add real email login.
- No due dates, priorities or sharing. Out of scope on purpose.

## Break it checklist

Run these on https://fde-hw-3-todoapp.vercel.app with two browser profiles (or one normal and one private window), **User A** and **User B**. Tick each as you go.

| # | Try this | Expected |
| --- | --- | --- |
| 1 | Sign up as `alice_test` and as `bob_test` (any 8+ character passwords). Add Tasks as each. | Each page shows only that User's Tasks. |
| 2 | Reload as each, log out, log back in. | Tasks are still there, and still only your own. |
| 3 | As A, copy a Task id from the network tab (DevTools, Network, the `/api/tasks` response). As B, in the console: `fetch("/api/tasks/<A's id>", {method:"DELETE"}).then(r => r.status)` | `404`. A's Task is still there after A reloads. |
| 4 | Same as 3 but `fetch("/api/tasks/<A's id>", {method:"PATCH", headers:{"content-type":"application/json"}, body:'{"completed":true}'}).then(r => r.status)` | `404`, and A's Task is not Completed. |
| 5 | Try to add an empty title, then only spaces. | The form shows a red rule and the button stays disabled. Via the API (`fetch("/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:'{"title":"   "}'})`): `400`. |
| 6 | Add a title over 200 characters. | The counter goes red and the button is disabled. Via the API: `400`. |
| 7 | Log in with a wrong password. | "Invalid username or password". |
| 8 | Sign up with a Username that already exists. | "Username already taken". |
| 9 | Log out, then open `/`. | Redirected to `/login`. |
| 10 | Logged out, open `/api/tasks`. | `401` `{"error":"Not signed in"}`. |
| 11 | Complete a Task, reload, reopen it, delete it (confirm the prompt). | Each change sticks after a reload. |

### Recorded results

Run on the public URL, 2026-10-04.

| # | Result | How it was checked |
| --- | --- | --- |
| 9 | Pass: `307` to `/login` | `curl` |
| 10 | Pass: `401` | `curl` on `GET /api/tasks` |
| 5 (API) | Pass at the auth layer: `POST /api/tasks` logged out gives `401`; a signed-in empty title is covered by tests | `curl`, plus `tests/integration/tasks.test.ts` |
| 3, 4 | Backed by the integration tests (another User's id gives `not_found`, and the Task is unchanged) | `npm run test:integration` |
| 1, 2, 6, 7, 8, 11 | _To fill in by hand_ | Needs signed-in Users, so create them yourself on the public URL |

The rows marked "to fill in" involve creating accounts on the live demo, which is left to the person running the checklist.
