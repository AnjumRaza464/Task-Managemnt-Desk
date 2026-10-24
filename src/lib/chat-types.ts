import type { Role } from "@/generated/prisma/enums";

/** A user is shown as online if they synced the chat within this window. */
export const ONLINE_WINDOW_MS = 60_000;
/** Presence is written at most this often per user to keep DB writes low. */
export const PRESENCE_WRITE_INTERVAL_MS = 20_000;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;
/** Messages loaded when a conversation is first opened. */
export const CONVERSATION_PAGE_SIZE = 100;
/** Pseudo-recipient id for the shared team channel that every active user can read. */
export const TEAM_CHANNEL_ID = "team";

export type ChatContact = {
  id: string;
  name: string;
  role: Role;
  designation: string | null;
  online: boolean;
  /** ISO timestamp or null if the user has never used the chat. */
  lastSeenAt: string | null;
  /** Messages from this contact that the current user has not read yet. */
  unread: number;
  /** ISO timestamp of the latest message in either direction, or null. */
  lastMessageAt: string | null;
};

export type ChatMessageDto = {
  id: string;
  senderId: string;
  senderName: string;
  /** Null for a message in the shared team channel. */
  recipientId: string | null;
  content: string;
  createdAt: string;
};

export type ChatSyncRequest = {
  /** A user id for a direct conversation, or TEAM_CHANNEL_ID for the team channel. */
  with?: string;
  /** Only return messages created at or after this ISO timestamp. */
  since?: string;
};

export type ChatSyncResponse = {
  now: string;
  contacts: ChatContact[];
  /** Team-channel messages posted by others since the user last opened it. */
  teamUnread: number;
  messages: ChatMessageDto[] | null;
};
