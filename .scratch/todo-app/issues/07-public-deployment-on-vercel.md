# 07: Public deployment on Vercel

**What to build:** The app is live on a public URL, so the definition of done can be checked: two Users can log in and each sees only their own Tasks. The user does the dashboard steps; the agent provides a short checklist.

**Blocked by:** 05: Complete, reopen and delete my Tasks

**Status:** ready-for-human

- [ ] The repo is imported in Vercel as one project, set to Node 22
- [ ] Only the two public environment variables are set on Vercel; the service-role key is not
- [ ] Every push to the main branch deploys automatically
- [ ] On the public URL, in two separate browser profiles, two Users sign up and log in and each sees only their own Tasks
- [ ] Deleting or completing the other User's Task is not possible and returns not-found
