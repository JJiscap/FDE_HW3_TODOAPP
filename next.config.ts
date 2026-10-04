import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server in .next/standalone, which the Docker
  // image copies instead of the whole node_modules folder. Vercel ignores it.
  output: "standalone",
};

export default nextConfig;
