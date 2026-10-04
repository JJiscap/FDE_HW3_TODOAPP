# syntax=docker/dockerfile:1
#
# A Dockerfile is a recipe for building an IMAGE: a sealed snapshot of the app
# plus everything it needs to run (Node, the code, the dependencies). A
# CONTAINER is a running copy of an image. "docker compose up" (see
# compose.yaml) builds this image and starts one container from it.
#
# This file is for running the app locally and in CI. Vercel ignores it: it
# builds the app from source (docs/adr/0003).
#
# It is a "multi-stage" build: several FROM blocks, where each stage starts
# clean and only the files we explicitly COPY travel to the next stage. That
# keeps the final image small and free of build tools and source code.

# The Node version comes from one place so it can be changed in one line. It
# matches .nvmrc (22), so CI, Vercel and Docker all use the same major version.
# "alpine" is a tiny Linux, which keeps the image small.
ARG NODE_VERSION=22


# ---------------------------------------------------------------------------
# Stage 1 "deps": install the dependencies, and nothing else.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps

# All following commands run inside this folder of the image.
WORKDIR /app

# Copy ONLY the two files that describe the dependencies. Docker caches each
# step: as long as these two files do not change, a rebuild reuses the cached
# install below instead of downloading everything again. (If we copied the
# whole source first, every code edit would reinstall all dependencies.)
COPY package.json package-lock.json ./

# "npm ci" installs exactly what package-lock.json pins, and fails if the lock
# file and package.json disagree. Same command CI uses.
RUN npm ci


# ---------------------------------------------------------------------------
# Stage 2 "builder": compile the app for production.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Take the installed dependencies from stage 1, then add the source code.
# (.dockerignore keeps node_modules, .env files, .git and other clutter out.)
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# IMPORTANT: Next.js bakes every variable whose name starts with NEXT_PUBLIC_
# into the compiled code at BUILD time. Setting them only when the container
# starts would be too late: the app would build fine but could not reach
# Supabase. So they are passed in as build arguments (compose.yaml supplies
# them from your git-ignored .env file) and turned into environment variables
# for the build step only.
#
# Both values are PUBLIC by design (the anon key is safe in a browser because
# Row Level Security protects the data, docs/adr/0002). They are still never
# written into this file: no secret lives in the repo. The service-role key is
# not used by the app at all, so it is never given to Docker.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Turn off Next.js's anonymous usage reporting during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# "output: standalone" in next.config.ts makes this produce .next/standalone:
# a small self-contained server with only the dependencies it really needs.
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 3 "runner": the image that actually runs. Only the built output is
# copied in: no source code, no dev dependencies, no build tools.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Listen on every network interface inside the container. Without this the
# server only listens on the container's own "localhost" and your browser,
# which is outside the container, could not reach it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The standalone server (server.js plus the few dependencies it needs).
# --chown gives the files to the unprivileged "node" user created by the
# official Node image, so the app never needs to run as root.
COPY --from=builder --chown=node:node /app/.next/standalone ./
# The browser-side files (JavaScript, CSS). Standalone does not include them.
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# (This project has no public/ folder. If you add one for images or icons,
# also add: COPY --from=builder --chown=node:node /app/public ./public)

# Run as the non-root "node" user. If someone ever found a way to run code in
# the app, they would not be an administrator inside the container.
USER node

# Documentation only: the app listens on 3000. The port is actually published
# to your computer by "ports:" in compose.yaml.
EXPOSE 3000

# The command the container runs when it starts.
CMD ["node", "server.js"]
