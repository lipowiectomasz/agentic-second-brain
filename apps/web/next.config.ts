import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["web"],
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@cortex/access", "@cortex/audit", "@cortex/config", "@cortex/core", "@cortex/knowledge", "@cortex/server-kit"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
