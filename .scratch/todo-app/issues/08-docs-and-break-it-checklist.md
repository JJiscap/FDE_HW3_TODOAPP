# 08: Docs and "break it" checklist

**What to build:** Documentation so a newcomer can set up, run, test and understand the app, and a "break it" checklist that proves the behaviour on the public URL.

**Blocked by:** 06: Run the app as a container, 07: Public deployment on Vercel

**Status:** ready-for-agent

- [ ] The README covers setup, environment variables, scripts, running unit and integration tests, Docker commands, the Vercel steps, security notes (passwords hashed by Supabase Auth, nothing secret in git, anon key public by design) and known limits (no password reset, free-tier Supabase pausing, synthetic emails)
- [ ] An architecture document walks through the front end, the API routes, the data module, the schema and Row Level Security, and traces one request through them, plus a section explaining Docker and CI for a beginner
- [ ] The "break it" checklist covers: two Users see only their own Tasks, another User's Task id returns not-found, an empty title is rejected, a wrong password and a duplicate Username show errors, and a logged-out visit redirects to login
- [ ] The checklist has been run by hand on the public URL and the results recorded
- [ ] A secrets scan of the repo finds nothing, and all env files are confirmed git-ignored
