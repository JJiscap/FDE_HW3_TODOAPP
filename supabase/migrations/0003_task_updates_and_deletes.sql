-- 0003_task_updates_and_deletes.sql
--
-- Lets a User mark their own Tasks Completed (and reopen them) and delete
-- them. Two safety rules are enforced here, in the database, so they hold
-- even if someone calls the API directly and skips the app:
--   * a User can only ever change or delete THEIR OWN Tasks, and
--   * the only thing a User can change on a Task is the Completed flag
--     (never the title, the owner or the creation time).
-- Run 0002_tasks.sql first: this file builds on the tasks table it creates.
--
-- HOW TO APPLY (you do this by hand, once per Supabase project):
--   1. Open the Supabase dashboard for the project.
--   2. Go to "SQL Editor" and click "New query".
--   3. Paste this whole file and click "Run".
--   4. Do the same in BOTH projects: the demo project and the test project.
-- It is safe to run more than once: the grants simply repeat and the
-- policies are replaced with identical copies.
--
-- See docs/adr/0002 for why isolation lives in the database (Row Level
-- Security) and not in the app's code.


-- 1. PERMISSIONS: WHAT A LOGGED-IN USER MAY DO TO THE TABLE ------------------

-- Permissions come in two layers. This section is the first layer: which
-- kinds of change the "authenticated" role (a logged-in User) may attempt at
-- all. Section 2 below is the second layer: which ROWS they may change.
-- A change must pass both layers. "anon" (not logged in) gets nothing new.

-- Start from a clean slate for UPDATE so that running this file again can
-- never leave an older, wider permission behind. (Revoking UPDATE on the
-- whole table also removes any UPDATE given on single columns.)
revoke update on table public.tasks from anon, authenticated;

-- A column-level grant: the User may UPDATE only the "completed" column.
-- Trying to change title, user_id, created_at or id is refused by the
-- database with a "permission denied" error, whatever the policies say. This
-- is what stops a client from renaming a Task, giving it to another User, or
-- rewriting its history by calling the API directly.
grant update (completed) on public.tasks to authenticated;

-- A logged-in User may attempt to delete Tasks (which ones is decided below).
grant delete on table public.tasks to authenticated;


-- 2. ROW LEVEL SECURITY: WHICH TASKS A USER MAY CHANGE OR DELETE -------------

-- Row Level Security was already switched on by 0002_tasks.sql. Drop the old
-- copies of the policies first so this file can be re-run.
drop policy if exists "Users can update their own tasks" on public.tasks;
drop policy if exists "Users can delete their own tasks" on public.tasks;

-- A User may update only the rows whose user_id is their own. auth.uid() is
-- the id of whoever is logged in; wrapping it in "(select ...)" lets Postgres
-- compute it once per query instead of once per row.
--
-- "using" decides which EXISTING rows the User can touch. Another User's row
-- is simply invisible to the update, so the request affects zero rows and
-- returns no error (the app turns "zero rows" into "not found", exactly as if
-- the Task did not exist). "with check" tests the row AFTER the change and
-- says it must still belong to the User; together with the column-level grant
-- above, a Task can never be handed over to someone else.
create policy "Users can update their own tasks"
  on public.tasks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A User may delete only the rows whose user_id is their own. Again, another
-- User's row is invisible, so deleting it affects zero rows and raises no
-- error.
create policy "Users can delete their own tasks"
  on public.tasks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
