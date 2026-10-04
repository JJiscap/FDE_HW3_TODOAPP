# Running the app as a Docker container

Docker is only for running and checking the app locally and in CI. The public site on Vercel does not use it (see `docs/adr/0003-single-nextjs-app-docker-for-local-and-ci.md`). Every line of `Dockerfile`, `compose.yaml` and `.dockerignore` is commented; read those files for the details.

Three words you need:

- **Image**: a sealed snapshot of the app plus everything it needs (Node, the built code). Built from the `Dockerfile`.
- **Container**: one running copy of an image.
- **Compose**: a small file (`compose.yaml`) that records how to build and run the container, so one command does it.

## One-time setup

Install Docker Desktop and make sure it is running (the whale icon in the menu bar). Then create your env file:

```bash
cp .env.example .env
```

Edit `.env` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the demo Supabase project's values. This file is git-ignored; never commit it. (The anon key is public by design, but the file is also where secrets would go, so it stays out of git.)

## Everyday commands

Build the image and start the app (open http://localhost:3000):

```bash
docker compose up --build -d --wait
```

See whether it is running and healthy:

```bash
docker compose ps
```

Read the app's log (press Ctrl+C to stop reading):

```bash
docker compose logs -f app
```

Stop it and remove the container:

```bash
docker compose down
```

## When to rebuild

The two `NEXT_PUBLIC_*` values and your code are baked into the image when it is built. After you change the code or `.env`, run `docker compose up --build -d --wait` again; without `--build` Docker reuses the old image.

## Troubleshooting

- **"Set NEXT_PUBLIC_SUPABASE_URL in .env"**: your `.env` file is missing or empty. Create it as shown above.
- **"port is already allocated"**: something else uses port 3000, such as `npm run dev`. Stop it, or change `"3000:3000"` in `compose.yaml` to `"3001:3000"` and open http://localhost:3001.
- **"Cannot connect to the Docker daemon"**: Docker Desktop is not running. Start it.
- **The page opens but login fails**: the values in `.env` were wrong at build time. Fix `.env`, then rebuild with `--build`.
