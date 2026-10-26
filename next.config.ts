import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // File uploads (task attachments, shared files) go through server actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
