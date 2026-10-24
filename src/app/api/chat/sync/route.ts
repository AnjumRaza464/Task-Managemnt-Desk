import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-guard";
import {
  getChatContacts,
  getConversation,
  getTeamMessages,
  getTeamUnread,
  markConversationRead,
  markTeamRead,
  touchPresence,
} from "@/lib/chat";
import { TEAM_CHANNEL_ID, type ChatSyncResponse } from "@/lib/chat-types";

const bodySchema = z.object({
  with: z.string().min(1).optional(),
  since: z.iso.datetime().optional(),
});

/**
 * POST /api/chat/sync
 * Heartbeat and poll used by the chat widget: refreshes the caller's presence,
 * returns the contact list and team unread count and, when a conversation or
 * the team channel is open, its messages (marking them as read).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { with: target, since } = parsed.data;
  const sinceDate = since ? new Date(since) : undefined;

  await touchPresence(user.id);

  let messages: ChatSyncResponse["messages"] = null;
  if (target === TEAM_CHANNEL_ID) {
    messages = await getTeamMessages(sinceDate);
    await markTeamRead(user.id);
  } else if (target && target !== user.id) {
    await markConversationRead(user.id, target);
    messages = await getConversation(user.id, target, sinceDate);
  }
  const [contacts, teamUnread] = await Promise.all([getChatContacts(user.id), getTeamUnread(user.id)]);

  const body: ChatSyncResponse = { now: new Date().toISOString(), contacts, teamUnread, messages };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
