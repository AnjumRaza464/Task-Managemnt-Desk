import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HEARTBEAT_INTERVAL_MS, type ActivityToday } from "@/lib/attendance-types";
import { dayKey, dayKeyRange } from "@/lib/time-zone";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

/** An open session with no activity for this long is closed at its last activity. */
export const IDLE_TIMEOUT_MS = 30 * 60_000;
/** A user counts as online if a heartbeat arrived within this window. */
export const ONLINE_WINDOW_MS = HEARTBEAT_INTERVAL_MS * 3;
/** Gaps between heartbeats longer than this were idle (tab hidden / away) and are not credited. */
const MAX_CREDITED_GAP_MS = HEARTBEAT_INTERVAL_MS * 2.5;

/** Closes open sessions that have been idle past the timeout, ending them at their last activity. */
async function closeIdleSessions(where: Prisma.WorkSessionWhereInput = {}, now = new Date()) {
  const idle = await prisma.workSession.findMany({
    where: { ...where, endedAt: null, lastActiveAt: { lt: new Date(now.getTime() - IDLE_TIMEOUT_MS) } },
    select: { id: true, lastActiveAt: true },
  });
  await Promise.all(
    idle.map((s) =>
      prisma.workSession.update({
        where: { id: s.id },
        data: { endedAt: s.lastActiveAt, endReason: "TIMEOUT" },
      }),
    ),
  );
}

/** Same idea as syncOverdueTasks: run before reading attendance so stale sessions show as checked out. */
export function syncIdleSessions() {
  return closeIdleSessions();
}

/** Sessions issued before tracking existed have no login id; fall back to one per user. */
export function loginIdFor(user: { id: string; loginId?: string }) {
  return user.loginId ?? `legacy:${user.id}`;
}

/** Checks the user in. Returns the login id that is stored in their JWT. */
export async function startWorkSession(userId: string): Promise<string> {
  const now = new Date();
  await closeIdleSessions({ userId }, now);
  const loginId = randomUUID();
  await prisma.workSession.create({ data: { userId, loginId, startedAt: now, lastActiveAt: now } });
  return loginId;
}

/** Checks the user out of the sessions opened by this sign-in. */
export async function endWorkSession(userId: string, loginId: string) {
  const now = new Date();
  await closeIdleSessions({ userId, loginId }, now);
  await prisma.workSession.updateMany({
    where: { userId, loginId, endedAt: null },
    data: { endedAt: now, lastActiveAt: now, endReason: "LOGOUT" },
  });
}

/**
 * Heartbeat from an active tab. Credits the time since the previous heartbeat
 * to the current session, or opens a new one when the previous session went
 * idle or belongs to an earlier day.
 */
export async function recordActivity(userId: string, loginId: string) {
  const now = new Date();
  const current = await prisma.workSession.findFirst({
    where: { userId, loginId },
    orderBy: { startedAt: "desc" },
  });
  // Signed out from this login already; a late heartbeat must not check them back in.
  if (current?.endReason === "LOGOUT") return;

  const gap = current ? now.getTime() - current.lastActiveAt.getTime() : Infinity;
  const isLive = current && !current.endedAt && gap < IDLE_TIMEOUT_MS && dayKey(current.lastActiveAt) === dayKey(now);

  if (isLive) {
    const credit = gap <= MAX_CREDITED_GAP_MS ? Math.max(0, Math.round(gap / 1000)) : 0;
    // Conditional on lastActiveAt so two tabs beating at once do not both credit the same gap.
    await prisma.workSession.updateMany({
      where: { id: current.id, lastActiveAt: current.lastActiveAt },
      data: { lastActiveAt: now, activeSeconds: { increment: credit } },
    });
    return;
  }

  if (current && !current.endedAt) {
    await prisma.workSession.update({
      where: { id: current.id },
      data: { endedAt: current.lastActiveAt, endReason: "TIMEOUT" },
    });
  }
  await prisma.workSession.create({
    data: { userId, loginId, resumed: true, startedAt: now, lastActiveAt: now },
  });
}

/** The user's own check-in time and active time for today. */
export async function getTodayActivity(userId: string): Promise<ActivityToday> {
  const sessions = await prisma.workSession.findMany({
    where: { userId, startedAt: dayKeyRange(dayKey()) },
    select: { startedAt: true, activeSeconds: true },
    orderBy: { startedAt: "asc" },
  });
  return {
    checkedInAt: sessions[0]?.startedAt.toISOString() ?? null,
    activeSeconds: sessions.reduce((sum, s) => sum + s.activeSeconds, 0),
  };
}

export type AttendanceStatus = "online" | "away" | "out" | "absent";

export type AttendanceRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  designation: string | null;
  isActive: boolean;
  status: AttendanceStatus;
  checkIn: Date | null;
  /** Null while the user is still checked in. */
  checkOut: Date | null;
  lastActiveAt: Date | null;
  activeSeconds: number;
  /** From first check-in to check-out (or now). */
  spanSeconds: number;
  sessionCount: number;
};

export type AttendanceSession = {
  id: string;
  userId: string;
  userName: string;
  resumed: boolean;
  startedAt: Date;
  endedAt: Date | null;
  endReason: "LOGOUT" | "TIMEOUT" | null;
  lastActiveAt: Date;
  activeSeconds: number;
  live: boolean;
};

const STATUS_ORDER: Record<AttendanceStatus, number> = { online: 0, away: 1, out: 2, absent: 3 };

/** Per-user check-in / check-out summary and the session log for one day. */
export async function getAttendanceDay(key: string) {
  await syncIdleSessions();
  const now = Date.now();

  const [users, sessions] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, designation: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.workSession.findMany({
      where: { startedAt: dayKeyRange(key) },
      include: { user: { select: { name: true } } },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  const log: AttendanceSession[] = sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.user.name,
    resumed: s.resumed,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    endReason: s.endReason,
    lastActiveAt: s.lastActiveAt,
    activeSeconds: s.activeSeconds,
    live: !s.endedAt,
  }));

  const byUser = new Map<string, AttendanceSession[]>();
  for (const s of log) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

  const rows: AttendanceRow[] = users
    .filter((u) => u.isActive || byUser.has(u.id))
    .map((u) => {
      const own = byUser.get(u.id) ?? [];
      const open = own.filter((s) => s.live);
      const lastActiveAt = own.length ? new Date(Math.max(...own.map((s) => s.lastActiveAt.getTime()))) : null;
      const status: AttendanceStatus = !own.length
        ? "absent"
        : open.some((s) => now - s.lastActiveAt.getTime() < ONLINE_WINDOW_MS)
          ? "online"
          : open.length
            ? "away"
            : "out";
      const checkIn = own[0]?.startedAt ?? null;
      const checkOut = open.length || !own.length ? null : new Date(Math.max(...own.map((s) => s.endedAt!.getTime())));
      const spanEnd = checkOut?.getTime() ?? (checkIn ? now : 0);
      return {
        ...u,
        status,
        checkIn,
        checkOut,
        lastActiveAt,
        activeSeconds: own.reduce((sum, s) => sum + s.activeSeconds, 0),
        spanSeconds: checkIn ? Math.max(0, Math.round((spanEnd - checkIn.getTime()) / 1000)) : 0,
        sessionCount: own.length,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.checkIn?.getTime() ?? 0) - (b.checkIn?.getTime() ?? 0) ||
        a.name.localeCompare(b.name),
    );

  const present = rows.filter((r) => r.status !== "absent");
  const totalActive = present.reduce((sum, r) => sum + r.activeSeconds, 0);
  const summary = {
    tracked: rows.length,
    present: present.length,
    online: rows.filter((r) => r.status === "online").length,
    totalActive,
    avgActive: present.length ? Math.round(totalActive / present.length) : 0,
  };

  return { rows, sessions: log, summary };
}
