-- 0002_tasks.sql
--
-- Creates the Tasks table: each row is one Task and belongs to exactly one
-- User. Row Level Security makes sure a User can only read and add their own.
-- Run 0001_profiles.sql first (this file does not depend on it, but the app
-- needs both). Completing and deleting Tasks is added by a later migration.
--
-- HOW TO APPLY (you do this by hand, once per Supabase project):
--   1. Open the Supabase dashboard for the project.
--   2. Go to "SQL Editor" and click "New query".
--   3. Paste this whole file and click "Run".
--   4. Do the same in BOTH projects: the demo project and the test project.
-- It is safe to run more than once: it only creates what is missing and
-- replaces the policies with identical copies.
--
-- See docs/adr/0002 for why isolation lives in the database (Row Level
-- Security) and not in the app's code.


-- 1. THE TABLE ---------------------------------------------------------------

-- "if not exists" makes the statement a no-op when the table already exists.
create table if not exists public.tasks (
  -- A random unique id for each Task, made by the database.
  id uuid primary key default gen_random_uuid(),

  -- The User who owns the Task: the same id as in Supabase Auth's users table.
  -- "on delete cascade" means deleting a User deletes their Tasks too (no
  -- orphan rows).
  --
  -- "default auth.uid()" fills this in from the logged-in session when a row
  -- is inserted, so the app never sends a user_id at all. (If a client does
  -- send one, the insert policy below checks that it is their own.)
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  -- What the User typed. "not null" means a Task cannot exist without a title.
  title text not null,

  -- Whether the User has marked the Task Completed. New Tasks start open.
  completed boolean not null default false,

  -- When the Task was created; filled in by the database automatically. The
  -- list is shown newest first using this column.
  created_at timestamptz not null default now(),

  -- The database-side copy of the title rule (the add form and the API check
  -- the same rule, but those can be bypassed and the database cannot):
  -- 1 to 200 characters. char_length counts characters (so an emoji counts as
  -- one), the same way the app counts them.
  constraint tasks_title_length
    check (char_length(title) between 1 and 200),

  -- The title must already be trimmed: "btrim" removes ordinary spaces from
  -- both ends, so this rejects a title with a space at either end. The app
  -- trims before saving (validateTaskTitle in src/lib/validation.ts), so
  -- honest requests always pass.
  --
  -- This rule is deliberately only about ORDINARY spaces. JavaScript's trim()
  -- also strips other whitespace such as the non-breaking space, while
  -- Postgres btrim only strips ordinary spaces unless told otherwise. If the
  -- database tried to match JavaScript exactly it would be easy to get
  -- subtly wrong, and a title that merely starts with an odd space is
  -- harmless. So the database enforces the strict, simple rule, and the app
  -- sends the value it trimmed itself.
  constraint tasks_title_trimmed
    check (title = btrim(title))
);


-- 2. AN INDEX FOR THE TASK LIST ---------------------------------------------

-- An index is like the index of a book: it lets the database jump straight to
-- one User's Tasks, already sorted newest first, instead of reading every row
-- in the table. "if not exists" makes this safe to run again.
create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);


-- 3. ROW LEVEL SECURITY: WHO MAY SEE AND ADD TASKS --------------------------

-- Turn on Row Level Security (RLS). Once on, a client can touch only the rows
-- that a policy explicitly allows; with no policy, it sees nothing.
-- Running this twice does no harm.
alter table public.tasks enable row level security;

-- Belt and braces: remove every table permission from the two client roles
-- ("anon" = not logged in, "authenticated" = logged in), then give back only
-- what they need: reading and adding. Not logged in means no access at all.
-- (Updating and deleting are granted by a later migration.)
revoke all on table public.tasks from anon, authenticated;
grant select, insert on table public.tasks to authenticated;

-- Drop the old copies of the policies first so this file can be re-run.
drop policy if exists "Users can read their own tasks" on public.tasks;
drop policy if exists "Users can add their own tasks" on public.tasks;

-- A User may read only the rows whose user_id is their own. auth.uid() is the
-- id of whoever is logged in; wrapping it in "(select ...)" lets Postgres
-- compute it once per query instead of once per row.
create policy "Users can read their own tasks"
  on public.tasks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- A User may add a row only if its user_id is their own. This is what stops
-- someone calling the API directly and creating a Task for another User.
-- ("with check" tests the new row; "using" above tests existing rows.)
create policy "Users can add their own tasks"
  on public.tasks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
