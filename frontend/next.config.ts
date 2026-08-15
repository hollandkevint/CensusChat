import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce .next/standalone for the Docker runtime image
  // (frontend/Dockerfile copies .next/standalone and runs server.js)
  output: "standalone",
};

export default nextConfig;
