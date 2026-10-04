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
| `npm run build` | Production build |
