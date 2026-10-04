# Task isolation is enforced by Row Level Security, not app code

Each User must see only their own Tasks. We enforce this in Postgres with Row Level Security policies (`user_id = auth.uid()`), and the app only ever uses the anon key plus the User's session. Filtering in route handlers with a service-role key was rejected because one forgotten filter would leak data and the powerful key would need to live in the deployment. A consequence: touching another User's Task affects 0 rows, which the API reports as 404.
