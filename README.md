# To-do app

A web app where each user signs up with a username and password and keeps a private task list.

Stack: Next.js, Supabase (database and login), Vercel (hosting), Docker (local and CI parity).

> Work in progress. Full setup, test and deployment instructions land with the final docs slice.

## Quick start

```bash
nvm use            # Node 22 (see .nvmrc)
npm ci
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against the real Supabase test project (needs `.env.test`, see below) |
| `npm run build` | Production build |

### Integration tests

These use a separate Supabase project made only for testing. Copy `.env.test.example` to `.env.test` (git-ignored) and fill in `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` and `SUPABASE_TEST_SERVICE_ROLE_KEY`. The service-role key is used only by the test code to create and delete throwaway Users; never put it in app code or on Vercel. In CI the same three names are GitHub repository secrets.
