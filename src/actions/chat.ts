"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { messageInclude, toMessageDto, touchPresence } from "@/lib/chat";
import { CHAT_MESSAGE_MAX_LENGTH, TEAM_CHANNEL_ID } from "@/lib/chat-types";

const sendSchema = z.object({
  /** A user id, or TEAM_CHANNEL_ID to post in the shared team channel. */
  to: z.string().min(1),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(CHAT_MESSAGE_MAX_LENGTH, `Message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or fewer.`),
});

/** Sends a message from the signed-in user to another active user or to the team channel. */
export async function sendChatMessage(input: unknown) {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError("Please sign in again.");
    const { to, content } = sendSchema.parse(input);

    let recipientId: string | null = null;
    if (to !== TEAM_CHANNEL_ID) {
      if (to === user.id) throw new ActionError("You cannot message yourself.");
      const recipient = await prisma.user.findUnique({ where: { id: to }, select: { id: true, isActive: true } });
      if (!recipient || !recipient.isActive) throw new ActionError("That user is not available.");
      recipientId = recipient.id;
    }

    const message = await prisma.chatMessage.create({
      data: { senderId: user.id, recipientId, content },
      include: messageInclude,
    });
    await touchPresence(user.id);
    return toMessageDto(message);
  });
}
