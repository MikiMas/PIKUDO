import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Needed for large multipart uploads when middleware is enabled.
    middlewareClientMaxBodySize: "1100mb"
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  }
};

export default nextConfig;
