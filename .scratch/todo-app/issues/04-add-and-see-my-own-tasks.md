# 04: Add and see my own Tasks

**What to build:** A logged-in User can add Tasks and see their list. They never see another User's Tasks. Tasks are stored per User and isolation is enforced by Row Level Security, not by application filtering (ADR 0002).

**Blocked by:** 03: Sign up and log in with a Username

**Status:** ready-for-agent

- [ ] A Task has a title, a Completed flag (initially open) and a creation time, and belongs to exactly one User
- [ ] A title is trimmed and must be 1–200 characters; the form shows a red message when it is empty or too long, plus a character counter; the server and the database both reject invalid titles with a 400 from the API
- [ ] Listing and creating Tasks are available through the API; a request with no session gets 401
- [ ] The home page shows the User's Tasks, newest first, and an add form
- [ ] The Tasks table and its policies are in a migration file; a User can only read and insert their own rows; inserting a row for another User is rejected
- [ ] Integration tests with two Users prove each sees only their own Tasks and that invalid titles are rejected; the API handlers stay thin, only translating the data module's result into 401, 400 or 404 (no handler-level tests; see the spec's testing decisions)
- [ ] The user applies the migration to both Supabase projects
