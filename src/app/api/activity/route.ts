import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUser } from "@/lib/auth-guard";
import { getTodayActivity, loginIdFor, recordActivity } from "@/lib/attendance";

/**
 * POST /api/activity
 * Heartbeat sent by an active tab (visible and recently used). Credits active
 * time to the caller's work session and returns their totals for today.
 */
export async function POST() {
  const [session, user] = await Promise.all([auth(), getCurrentUser()]);
  if (!session?.user || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await recordActivity(user.id, loginIdFor(session.user));
  const today = await getTodayActivity(user.id);
  return NextResponse.json(today, { headers: { "Cache-Control": "private, no-store" } });
}
