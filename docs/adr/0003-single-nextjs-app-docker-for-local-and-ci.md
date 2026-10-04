# One Next.js app; Docker is for local and CI, not hosting

The app is a single Next.js project (pages and route handlers together) deployed to Vercel. A separate front-end/back-end container split was considered and dropped: Vercel cannot run Docker images, so the split would have needed a second host or two Vercel projects for no benefit. The Dockerfile and `compose.yaml` exist so the app can be run and checked as a container locally and in CI; Vercel builds from source and ignores them.
