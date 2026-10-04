# Usernames map to synthetic emails on Supabase Auth

Supabase Auth identifies people by email, but the app's login is a username and password with no email verification. We log in with `<username>@todoapp.invalid` derived in code, and store the canonical Username in a `profiles` table (created by a database trigger, with a CHECK constraint on the format). Real emails were rejected because the demo has no mail flow; the cost is that password reset is impossible.
