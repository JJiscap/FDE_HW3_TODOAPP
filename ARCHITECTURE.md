# Architecture

How the to-do app is put together, and how one click travels from the browser to the database and back. Terms like **User**, **Task** and **Completed** are defined in [GLOSSARY.md](GLOSSARY.md).

## The big picture

```
 Browser ──► Vercel (one Next.js app) ──► Supabase
             • pages (React)              • Auth: logins, password hashes
             • API routes (/api/tasks)    • Postgres: profiles, tasks
             • proxy (session + redirect) • Row Level Security
```

There is **one** app. The pages and the API live in the same Next.js project and deploy together ([ADR 0003](docs/adr/0003-single-nextjs-app-docker-for-local-and-ci.md)). Supabase is the only other moving part: it holds the Users and the Tasks and decides who may touch which row.

```
src/
├── proxy.ts                 # runs before every request: session refresh, login redirect
├── app/
│   ├── login/               # login / sign-up page and form
│   ├── page.tsx             # the Task list page (server-rendered)
│   ├── add-task-form.tsx    # "add a Task" form (browser)
│   ├── task-item.tsx        # one Task row: checkbox + delete (browser)
│   ├── actions.ts           # the log-out server action
│   └── api/tasks/           # the API: route.ts and [id]/route.ts
└── lib/
    ├── validation.ts        # the rules (Username, password, title) + messages
    ├── tasks.ts             # the data module: all Task database operations
    ├── auth-errors.ts       # Supabase auth errors -> friendly messages
    └── supabase/            # how to build a Supabase client (browser, server, proxy)
supabase/migrations/         # the database schema and security rules (SQL)
tests/integration/           # tests against a real Supabase test project
```

## Front end

- **`/login`** is one form with a Log in / Sign up toggle. It shows the rules live (red until met, green once met) and keeps the button disabled until the input is valid. The rules come from `src/lib/validation.ts`, the same module the API uses, so the form and the server can never disagree about what is valid. It talks to Supabase Auth directly from the browser. Your Username becomes the login email `<username>@todoapp.invalid` ([ADR 0001](docs/adr/0001-usernames-map-to-synthetic-emails.md)); the person never sees that.
- **`/`** (`page.tsx`) is rendered on the server. It asks who is signed in, reads the Username from `profiles`, loads the Tasks through the data module, and renders the list. If loading the Tasks fails it shows a friendly error rather than an empty list.
- **`add-task-form.tsx` and `task-item.tsx`** run in the browser. They call the API with `fetch`, then `router.refresh()` so the server re-renders the list with fresh data. Failures show a plain message and leave the list unchanged.
- **Log out** is a server action (`actions.ts`) that ends the session and sends you to `/login`.

## The proxy (session and redirects)

`src/proxy.ts` runs before every request except static files. (In this version of Next.js the old `middleware` file is called `proxy`.) It does two jobs, implemented in `src/lib/supabase/session.ts`:

1. **Refresh the session.** Login tokens expire. The proxy asks Supabase for the verified claims and writes any renewed token back into the cookies.
2. **Redirect.** A logged-out visitor to a page goes to `/login`; a logged-in visitor to `/login` goes to `/`. API routes are never redirected; they answer for themselves.

It verifies the token's signature (`getClaims()`), rather than believing the cookie (`getSession()`), because a visitor can edit a cookie. It is only a first, cheap gate; the real protection is in the database.

## API routes

| Route | Does | Success | Failure |
| --- | --- | --- | --- |
| `GET /api/tasks` | List my Tasks, newest first | `200 {tasks}` | `401` |
| `POST /api/tasks` | Add a Task `{title}` | `201 {task}` | `401`, `400` (bad title) |
| `PATCH /api/tasks/:id` | Complete or reopen `{completed}` | `200 {task}` | `401`, `400`, `404` |
| `DELETE /api/tasks/:id` | Delete a Task | `204` | `401`, `404` |

The handlers are deliberately thin. Each one (1) asks Supabase who is calling (`getUser()` verifies the session with Auth), (2) checks the request body, (3) calls the data module, and (4) turns the module's answer into a status code. Anything unexpected becomes a generic `500`; the real error goes only to the server log.

The codes mean: `401` no session, `400` the request itself is bad, `404` no such Task **for you**. An id that is missing, malformed, or belongs to someone else all give the identical `404` body, so the API never reveals which ids exist.

## The data module (`src/lib/tasks.ts`)

The one place that talks to the `tasks` table: `listTasks`, `createTask`, `setCompleted`, `deleteTask`. Each takes a Supabase client that is already signed in as the caller, and returns either success or a reason (`invalid_title`, `not_found`).

It contains **no `user_id` filter**. That is deliberate: the database already hides other Users' rows, so a Task that is not yours simply matches zero rows, and the module reports `not_found`. It also rejects ids that are not UUIDs before asking the database, which would otherwise raise an error instead of finding nothing.

This module is the main test seam: integration tests call it with two real signed-in clients, with no HTTP in between.

## Database and Row Level Security

Three migrations in `supabase/migrations/`:

| File | Creates |
| --- | --- |
| `0001_profiles.sql` | `profiles(id, username, created_at)`. A trigger on `auth.users` creates a Profile at sign-up. The Username is **derived from the login email**, never from anything the client sends, and any email not shaped `<3-20 of a-z 0-9 _>@todoapp.invalid` is refused. A CHECK also enforces the Username format. |
| `0002_tasks.sql` | `tasks(id, user_id, title, completed, created_at)`. `user_id` defaults to the caller (`auth.uid()`). CHECKs: title 1-200 characters and already trimmed. RLS on, with select and insert policies. |
| `0003_task_updates_and_deletes.sql` | Update and delete policies, plus a **column-level grant**: clients may update only `completed`, never `title` or `user_id`. |

**Row Level Security (RLS)** means Postgres adds a hidden `WHERE` to every query. Here the policy is `user_id = auth.uid()`: whatever SQL arrives, the caller only ever sees, updates or deletes their own rows ([ADR 0002](docs/adr/0002-isolation-enforced-by-row-level-security.md)). Inserting a Task with someone else's `user_id` is refused too. Because this holds in the database, a bug in the app code cannot leak Tasks, and the app only needs the public anon key.

## One request, traced: "complete a Task"

You tick the checkbox on a Task.

1. **Browser.** `task-item.tsx` disables that row and sends `PATCH /api/tasks/<id>` with `{"completed": true}`. The browser attaches the session cookie automatically.
2. **Proxy.** `proxy.ts` runs first. It verifies the token, refreshes it if needed, and lets API paths through.
3. **Route handler.** `api/tasks/[id]/route.ts` calls `getUser()`. No user means `401`. It checks the body is JSON with a boolean `completed`, else `400`.
4. **Data module.** `setCompleted(supabase, id, true)` checks `id` looks like a UUID, then runs `update tasks set completed = true where id = <id>` as the signed-in User.
5. **Database.** Postgres applies the policy `user_id = auth.uid()` on top. If the Task is yours, one row changes and comes back. If it belongs to someone else, or does not exist, **zero rows** match.
6. **Back up the chain.** Zero rows becomes `{ok:false, reason:"not_found"}`, which the handler turns into `404 {"error":"Task not found"}`. One row becomes `200 {task}`.
7. **Browser.** On success `task-item.tsx` calls `router.refresh()`; the server re-renders `page.tsx` with a fresh `listTasks`, and the Task now shows struck through. On failure the row re-enables and shows a message.

If someone edits the request to target another User's Task id, steps 1-4 behave the same, and step 5 returns nothing. That is the "try to break it" case.

## Docker and CI, explained for a beginner

### Docker

An **image** is a sealed snapshot of the app plus everything it needs to run (Node, the built code). A **container** is one running copy of an image. The `Dockerfile` is the recipe for the image; `compose.yaml` records how to build and run it, so one command does it:

```bash
docker compose up --build -d --wait
```

The recipe has three stages: `deps` installs packages, `builder` compiles the app, and `runner` copies only the built output into a small final image that runs as a non-root user. Two details worth knowing:

- Next.js bakes `NEXT_PUBLIC_*` values into the compiled code at **build** time, so they are passed as build arguments from your git-ignored `.env`. Setting them only when the container starts would be too late.
- The container exists so the app can be run and checked the same way everywhere. Vercel does not use it; it builds from source.

Every line of both files is commented, and [docs/docker.md](docs/docker.md) lists the everyday commands.

### CI (GitHub Actions)

**CI** (continuous integration) is a robot that re-checks the project on a clean machine every time you open a pull request or push to `main`, so "works on my laptop" cannot hide a break. It is defined in `.github/workflows/ci.yml` and has three jobs that run in parallel:

| Job | Checks |
| --- | --- |
| `checks` | `npm ci`, lint, typecheck, unit tests, production build |
| `integration` | The integration tests against the Supabase test project. Uses three repository secrets. Skipped for pull requests from forks, because forks cannot read secrets. |
| `docker` | Builds the image, starts the container, waits for it to be healthy, and fetches `/login`. Uses placeholder Supabase values, since it only proves the container boots and serves the page. |

A pull request is meant to merge only when all three are green. The workflow only has read access to the repo, and secrets exist only inside the integration job.
