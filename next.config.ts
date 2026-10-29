import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev server via 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // File uploads (task attachments, shared files) go through server actions.
    serverActions: { bodySizeLimit: "6mb" },
    // Keep visited dynamic pages in the client router cache briefly so switching
    // back to a tab is instant. Mutations call router.refresh() / revalidatePath,
    // which drop the cached entry, so fresh data still shows after a change.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
