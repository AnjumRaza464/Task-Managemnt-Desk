import type { MetadataRoute } from "next";

/**
 * Web app manifest: lets phones install the site as "UniKyn" with its own
 * icon and open it full screen (no browser chrome).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UniKyn · Project & team management",
    short_name: "UniKyn",
    description: "Workspaces, projects, tasks and team discussions for Black & Brown Bakers.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#080609",
    theme_color: "#130a12",
    lang: "en",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My tasks", url: "/my-tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Projects", url: "/workspaces", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
