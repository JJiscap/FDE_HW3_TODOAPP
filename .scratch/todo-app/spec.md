# Spec: To-do app

**Status:** ready-for-agent

## Problem Statement

People want a simple, private place to keep a list of things they need to do. Existing shared lists leak other people's items, and a person using a shared device or a public URL needs confidence that only they can see and change their own Tasks. For this homework the app must also be demonstrably secure: passwords are never stored in plain text, no secret credentials are published, and two different Users on the public URL each see only their own Tasks.

## Solution

A web app where a visitor signs up with a Username and password, then manages a private list of Tasks: add a Task, mark it Completed or reopen it, and delete it. Every Task belongs to exactly one User and no other User can see or change it. The forms tell the visitor, live and in red, which rule they have not met yet. The app is hosted publicly, backed by a hosted database and login service, and can also be run locally as a container.

## User Stories

1. As a visitor, I want to sign up with a Username and password, so that I get my own private Task list
2. As a visitor, I want the sign-up form to show in red which Username rule I have not met yet, so that I can fix it without guessing
3. As a visitor, I want the sign-up form to show in red when my password is too short, so that I know the minimum before I submit
4. As a visitor, I want the submit button disabled until the form is valid, so that I cannot send a broken sign-up
5. As a visitor, I want my Username lowercased automatically, so that `Alice` and `alice` are the same User and I cannot confuse them
6. As a visitor, I want a clear "Username already taken" message, so that I know to choose another
7. As a visitor, I want sign-up to log me in straight away, so that I can start adding Tasks without a second step
8. As a User, I want to log in with my Username and password, so that I can reach my Tasks from any browser
9. As a User, I want a wrong password to show "Invalid username or password" without revealing which part was wrong, so that strangers cannot discover which Usernames exist
10. As a User, I want to log out, so that the next person on a shared device cannot see my Tasks
11. As a visitor who is not logged in, I want to be sent to the login page when I open the home page, so that I never see a broken or empty list
12. As a User, I want my session to survive a page refresh, so that I am not asked to log in constantly
13. As a User, I want to see my Username on the home page, so that I know which User I am logged in as
14. As a User, I want to add a Task by typing a title, so that I can capture something to do
15. As a User, I want leading and trailing spaces trimmed from a title, so that accidental whitespace does not create odd Tasks
16. As a User, I want a red message when I try to add an empty title, so that I understand why nothing was added
17. As a User, I want a character counter and a red message when a title passes 200 characters, so that I can shorten it before submitting
18. As a User, I want a newly added Task to appear at the top of my list, so that I can see it worked
19. As a User, I want to see only my own Tasks, so that my list stays private
20. As a User, I want to mark a Task Completed, so that I can track what is finished
21. As a User, I want to reopen a Completed Task, so that I can fix an accidental click
22. As a User, I want Completed Tasks to look different from open ones, so that I can scan my list quickly
23. As a User, I want to delete a Task, so that I can remove things I no longer need
24. As a User, I want my Tasks to still be there after I log out and back in, so that I can rely on the list
25. As a User, I want another User to be unable to see, complete or delete my Tasks even if they guess an id, so that my list is truly private
26. As a User, I want an attempt on someone else's Task to behave as "not found", so that the app never reveals which Task ids exist
27. As a User, I want a friendly error if something fails while saving, so that I know to retry
28. As a User on a phone, I want the pages to be usable at a narrow width, so that I can manage Tasks on the go
29. As the app owner, I want passwords stored only as hashes by the login service, so that nobody, including me, can read them
30. As the app owner, I want no secret key committed to the public repository, so that the project is safe to share
31. As the app owner, I want the database itself to reject a malformed Username or an invalid title, so that bypassing the forms cannot corrupt data
32. As the app owner, I want each User deleted together with their Profile and Tasks, so that no orphan data remains
33. As a developer, I want a fast unit-test command, so that I can check the validation rules in seconds
34. As a developer, I want an integration-test command against a separate test database, so that my demo data is never touched by tests
35. As a developer, I want CI to run lint, typecheck, tests and a build on every pull request, so that broken changes are caught before merging
36. As a developer, I want to start the whole app with one container command, so that I can check it runs the way CI sees it
37. As a developer, I want every Docker and CI line commented, so that I, as a beginner, can learn from them
38. As the homework reviewer, I want two Users to log in on the public URL and see only their own Tasks, so that the definition of done is demonstrable
39. As the homework reviewer, I want a README and an architecture walkthrough, so that I can understand how a request travels through the layers
40. As the homework reviewer, I want a "break it" checklist with recorded results, so that the security claims are evidenced

## Implementation Decisions

- **Product shape:** one web application, pages and API together, deployed as a single project. Docker is for local and CI parity only; hosting does not use it (ADR 0003).
- **Identity:** the hosted login service identifies people by email, so a Username is mapped in code to a synthetic address on a reserved domain; the Username is never shown as an email. Email confirmation is off for the demo, and password reset is impossible by design (ADR 0001).
- **Profile:** each User has a Profile holding the canonical Username, created automatically by a database trigger at sign-up. The trigger takes the Username from the login email, not from client-supplied sign-up data (which could claim someone else's Username), and refuses any other email domain. A database check enforces the Username format. A User can read only their own Profile and cannot write it directly. Login resolves the Username to the synthetic address in code, so Profiles never need to be publicly readable.
- **Username and password rules:** Username is 3–20 characters of lowercase letters, digits and underscore, lowercased on input; password is at least 8 characters, enforced by the login service's setting.
- **Task:** a title, a Completed flag (initially open) and a creation time, owned by one User. A title is trimmed and must be 1–200 characters; the database enforces the same limit. Completion is a toggle and deletion is permanent. Deleting a User removes their Profile and Tasks.
- **Isolation:** enforced by Row Level Security in the database, using the anonymous key plus the User's session. The service-role key is never used by the deployed app (ADR 0002). Another User's Task affects zero rows, which the data module reports as not found.
- **Shared validation module:** one module owns the Username, password and title rules and their user-facing messages, used by both the forms and the server.
- **Data module:** one module owns Task operations (list, create, set Completed, delete) for a given signed-in client and returns a not-found result when no row is affected. Route handlers stay thin: they translate that result into 401 (no session), 400 (invalid input) or 404.
- **API contract:** list and create Tasks; update Completed and delete by id. Status codes: 401 no session, 400 invalid input, 404 not found or not yours.
- **Session:** cookie-based, refreshed by middleware on each request; logged-out visitors are redirected to the login page.
- **Forms:** live inline rule messages in red once a field is touched, disabled submit until valid, a character counter on the Task title.
- **Schema delivery:** a migration file in the repo is the source of truth; the user applies it to both Supabase projects.
- **Hosting:** the app on Vercel with only the two public environment variables; the database and login on Supabase.
- **Secrets:** all real env files are git-ignored; only a template with placeholders is committed; the test project's service-role key lives only in a git-ignored local file and a GitHub secret, used only to clean up test Users.
- **CI:** a basic GitHub Actions workflow on pull requests and pushes to main; a separate integration job using repo secrets and skipped for forks; a Docker job that builds and smoke-checks the image.
- **Delivery order:** the eight tickets under this spec, tracer-bullet slices in dependency order.

## Testing Decisions

- **What makes a good test:** it checks externally visible behaviour (what a User can and cannot see or do, what a form says), not how the code is organised. A test must fail if the behaviour breaks and keep passing if the internals are refactored.
- **Seam 1, data module against the real test project:** called as two real signed-in Users. Covers isolation (each sees only their own Tasks), cross-User complete and delete returning not found with the other User's Task unchanged, creating a Task for another User being rejected, empty and over-length titles being rejected, the Profile trigger creating the right Username, and a malformed Username being rejected. No mocking of the database.
- **Seam 2, shared validation rules:** pure unit tests for Username, password and title rules and their messages; they need no database.
- **Not tested directly:** route handlers and page components. They stay thin and are covered by the Docker smoke check and the manual "break it" checklist on the public URL.
- **Prior art:** none in the codebase yet; the integration harness (ticket 02) and the validation tests (ticket 03) set the pattern for the rest.
- **Fast versus slow:** the unit command is offline and fast; the integration command needs the test project and is a separate command and CI job.

## Out of Scope

- Password reset, email verification and any real-email flows
- Due dates, priorities, notes, tags, sharing, subtasks, reordering and search
- Social login and multi-factor authentication
- Admin tools, rate limiting beyond what the login service provides, and account deletion by the User
- Separate front-end and back-end containers, and hosting the containers anywhere (ADR 0003)
- Styling beyond plain Tailwind, dark mode and internationalisation
- Pushing Docker images to a registry, and any deploy step in CI

## Further Notes

- The brief asked for SQLite; Supabase replaces it because SQLite cannot persist on the chosen host. The README's old "production would need a hosted database" note no longer applies.
- Known risks: the test project may be paused by the free tier after about a week idle, which fails the integration CI job until it is resumed; the synthetic email domain may be rejected by the login service and would need replacing; forgetting to turn Confirm email off makes sign-up return no session.
- Related files: `GLOSSARY.md`, ADRs 0001–0003, and tickets 01–08 under `.scratch/todo-app/issues/`.
