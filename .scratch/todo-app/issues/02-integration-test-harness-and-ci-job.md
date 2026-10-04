# 02: Integration-test harness and CI job

**What to build:** A way to run tests against the real Supabase test project, locally and in CI, so later slices can prove Row Level Security isolation instead of mocking it. This is a prefactor: it changes no user-facing behaviour.

**Blocked by:** 01: Supabase projects ready

**Status:** ready-for-agent

- [ ] A separate command runs integration tests, distinct from the fast unit tests, loading the test project's environment from the git-ignored test env file
- [ ] A connectivity smoke test passes against the test project
- [ ] A helper can create and clean up throwaway Users for tests, using the service-role key only inside the test code
- [ ] A separate CI job runs the integration tests using the repo secrets, and is skipped for pull requests from forks
- [ ] CI shows a clearly named integration check, so a paused free-tier test project is easy to recognise as the cause of a failure
- [ ] The comments explain each CI step for a beginner
