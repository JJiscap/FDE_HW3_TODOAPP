# 06: Run the app as a container

**What to build:** The whole app runs as a single Docker container started with one compose command, for local checks and CI parity. Vercel does not use this (ADR 0003). Written for a Docker beginner, with every line commented.

**Blocked by:** 05: Complete, reopen and delete my Tasks

**Status:** ready-for-agent

- [ ] One command builds and starts the app, and the login page opens in the browser on port 3000
- [ ] The Supabase URL and anon key reach the build from the git-ignored env file as build arguments, because the app inlines them at build time; no secret is baked into the repo
- [ ] The image is multi-stage, runs as a non-root user, and uses the same Node version as the rest of the project
- [ ] A new CI job builds the image, validates the compose file, runs the container and smoke-checks the login page
- [ ] The README or architecture notes (or comments) explain how to start, stop and rebuild, and what each Dockerfile and compose line does
