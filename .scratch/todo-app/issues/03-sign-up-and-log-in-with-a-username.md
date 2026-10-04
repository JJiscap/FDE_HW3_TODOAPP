# 03: Sign up and log in with a Username

**What to build:** A visitor can sign up with a Username and password, log out, and log back in. Logged-out visitors are redirected to the login page. Each User has a Profile holding their Username, created automatically at sign-up. The Username format is enforced by the database as well as the forms.

**Blocked by:** 02: Integration-test harness and CI job

**Status:** ready-for-agent

- [ ] A Username is 3–20 characters of letters, digits and underscore, lowercased on input, so `Alice` and `alice` are the same User; a password is at least 8 characters
- [ ] The sign-up and login forms show each unmet rule live in red once a field has been touched, and the submit button stays disabled until the form is valid
- [ ] The same validation rules are shared by the forms and the server, and are unit tested
- [ ] Signing up creates the User and their Profile; a taken Username shows "Username already taken"; a wrong password shows "Invalid username or password" without revealing which part was wrong
- [ ] The Profile table and its creation trigger are in a migration file; the database rejects a malformed Username even if the forms are bypassed; a User can read only their own Profile and cannot write it directly
- [ ] The logged-in home page shows the Username and a logout button; visiting it logged out redirects to the login page
- [ ] Integration tests cover: sign-up creates a Profile with the right Username, a malformed Username is rejected, and one User cannot read another's Profile
- [ ] The user applies the migration to both Supabase projects; if Supabase rejects the synthetic email domain, switch to another reserved domain and update ADR 0001
