-- 0001_profiles.sql
--
-- Creates the Profile table: one row per User, holding their Username.
-- (The tasks table is added by a later migration.)
--
-- HOW TO APPLY (you do this by hand, once per Supabase project):
--   1. Open the Supabase dashboard for the project.
--   2. Go to "SQL Editor" and click "New query".
--   3. Paste this whole file and click "Run".
--   4. Do the same in BOTH projects: the demo project and the test project.
-- It is safe to run more than once: it only creates what is missing and
-- replaces the trigger, function and policy with identical copies.
--
-- Why a table in "public" next to "auth.users"? Supabase Auth keeps its own
-- users table (auth.users) that our app must not change. The profiles table
-- holds the app's own data about each User, keyed by the same id.
-- See docs/adr/0001 and docs/adr/0002 for the decisions behind this file.


-- 1. THE TABLE ---------------------------------------------------------------

-- "if not exists" makes the statement a no-op when the table already exists.
create table if not exists public.profiles (
  -- Same id as the Auth user. "on delete cascade" means deleting a User in
  -- Supabase Auth automatically deletes their Profile too (no orphan rows).
  id uuid primary key references auth.users (id) on delete cascade,

  -- The Username. "unique" means no two Users can share one, and "not null"
  -- means a Profile cannot exist without one.
  username text not null unique,

  -- When the Profile was created; filled in by the database automatically.
  created_at timestamptz not null default now(),

  -- The database-side copy of the Username rule (the sign-up form checks the
  -- same rule, but a form can be bypassed and the database cannot): 3 to 20
  -- characters, each a lowercase letter, a digit or an underscore.
  -- "~" means "matches this regular expression".
  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,20}$')
);


-- 2. THE TRIGGER THAT CREATES A PROFILE AT SIGN-UP --------------------------

-- A "trigger function" is code the database runs automatically when
-- something happens. This one runs for every new row in auth.users and creates
-- the matching Profile.
--
-- The Username is taken from the login EMAIL (<username>@todoapp.invalid, see
-- docs/adr/0001), never from the extra sign-up data. Anyone can call the Auth
-- API directly and send whatever data they like, but the email is also what
-- they log in with, so deriving the Username from it means nobody can register
-- one email while claiming a different Username (which would lock the real
-- owner of that Username out). Emails on any other domain are refused, so a
-- real address can never end up in the app.
-- "create or replace" updates the function if it already exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
-- "security definer" = run with the powers of the function's owner, not of the
-- person signing up. We need that because clients are not allowed to insert
-- into profiles themselves (see the policies below); only this function is.
security definer
-- An empty search_path means "do not guess which schema a name lives in".
-- This blocks a known attack where someone plants a look-alike table in
-- another schema. The price: every name below must include its schema.
set search_path = ''
as $$
begin
  -- "new" is the auth.users row that was just inserted. Raising an exception
  -- here cancels the whole sign-up (the User row is rolled back too).
  -- The email must be exactly <username>@todoapp.invalid. Checking the WHOLE
  -- address with one pattern ("~" = matches a regular expression) matters: a
  -- looser "ends with @todoapp.invalid" test would let "bob@x@todoapp.invalid"
  -- through and the split below would then hand out the Username "bob".
  -- A missing email (null) is refused too. The Auth service already lowercases
  -- emails; lower() is just a belt-and-braces guard.
  if new.email is null
     or lower(new.email) !~ '^[a-z0-9_]{3,20}@todoapp\.invalid$' then
    raise exception 'Sign-ups must use a <username>@todoapp.invalid login email';
  end if;

  -- split_part(text, '@', 1) is everything before the "@": the Username. The
  -- CHECK constraint on profiles re-checks the format as the last line of
  -- defence.
  insert into public.profiles (id, username)
  values (new.id, split_part(lower(new.email), '@', 1));

  -- A trigger that runs "after insert" must still return the row.
  return new;
end;
$$;

-- Only the trigger should ever run this function. By default every role may
-- call new functions, so take that permission away from everyone who could
-- reach it over the public API ("public" = every role, plus the two named).
-- The trigger keeps working: Postgres checks this permission when the trigger
-- is created, not each time it fires.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- A trigger cannot be "created or replaced", so drop any old copy first.
drop trigger if exists on_auth_user_created on auth.users;

-- Run the function once for each new row in auth.users, right after it is
-- inserted. If the function raises an error (for example a malformed
-- Username), the whole insert is rolled back: no User and no Profile.
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- 3. ROW LEVEL SECURITY: WHO MAY SEE AND CHANGE PROFILES --------------------

-- Turn on Row Level Security (RLS). Once on, a client can touch only the rows
-- that a policy explicitly allows; with no policy, it sees nothing.
-- Running this twice does no harm.
alter table public.profiles enable row level security;

-- Belt and braces: remove every table permission from the two client roles
-- ("anon" = not logged in, "authenticated" = logged in), then give back only
-- the one they need. Even if someone later adds a policy by mistake, clients
-- still cannot write Profiles directly.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Drop the old copy of the policy first so this file can be re-run.
drop policy if exists "Users can read their own profile" on public.profiles;

-- A User may read only the Profile row whose id is their own. auth.uid() is
-- the id of whoever is logged in; wrapping it in "(select ...)" lets Postgres
-- compute it once per query instead of once per row.
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- There is deliberately NO insert, update or delete policy. Clients cannot
-- write Profiles at all: the trigger above creates them, and deleting the
-- User deletes them (cascade).
