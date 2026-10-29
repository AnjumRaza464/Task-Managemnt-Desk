import "server-only";
import { headers } from "next/headers";

/**
 * Absolute origin of the app (no trailing slash) for links in emails.
 * Prefers APP_URL, then the current request's host, then Vercel's production
 * domain, then localhost.
 */
export async function getAppUrl(): Promise<string> {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const local = host.startsWith("localhost") || host.startsWith("127.");
      const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not in a request scope (scripts) - use the env fallbacks below.
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
