# 01: Supabase projects ready

**What to build:** Two Supabase projects, a demo project and a separate test project, configured so a Username can sign up with a password and no email verification, plus the local and CI configuration that lets the app and its tests reach them. All steps are the user's own; no keys are shared in chat.

**Blocked by:** None (can start immediately). Assumes the scaffold and CI pull request is merged.

**Status:** ready-for-human

- [ ] Demo project and a new test project both exist
- [ ] In both projects, Confirm email is off and minimum password length is 8
- [ ] Git-ignored env files exist locally for the dev server, the tests (including the test project's service-role key, used only for test cleanup) and Docker, copied from the committed template
- [ ] Three GitHub repo secrets exist for the CI integration job: test project URL, anon key, service-role key
- [ ] The service-role key appears nowhere in the repo, the Vercel settings or chat
