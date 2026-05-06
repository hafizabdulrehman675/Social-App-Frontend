import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  MessageEntity,
  MessagesState,
  ThreadEntity,
  ThreadPeer,
} from "@/features/messages/types";

/*
  Mock persistence reference (disabled intentionally):
  ---------------------------------------------------
  const STORAGE_KEY = "ig_clone_messages_v2";

  function loadMessages(): MessagesState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as MessagesState;
    } catch {
      return null;
    }
  }

  function persistMessages(state: MessagesState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
*/

function upsertThread(state: MessagesState, thread: ThreadEntity) {
  const existing = state.threadsById[thread.id];
  state.threadsById[thread.id] = existing
    ? {
        ...existing,
        ...thread,
        peer: { ...existing.peer, ...thread.peer },
        participantIds: thread.participantIds.length
          ? thread.participantIds
          : existing.participantIds,
      }
    : thread;

  if (!state.threadIds.includes(thread.id)) {
    state.threadIds.unshift(thread.id);
  }
}

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

const initialState: MessagesState = {
  threadsById: {},
  threadIds: [],
  messagesById: {},
};

const messagesSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    startThread(
      state,
      action: PayloadAction<{ threadId?: string; peer: ThreadPeer; myUserId: string }>,
    ) {
      const id = action.payload.threadId ?? `t_${Date.now()}`;
      if (state.threadsById[id]) return;
      state.threadsById[id] = {
        id,
        peer: action.payload.peer,
        participantIds: [action.payload.myUserId, action.payload.peer.id],
        messageIds: [],
        unreadCountByUserId: { [action.payload.myUserId]: 0 },
        lastReadMessageIdByUserId: { [action.payload.myUserId]: null },
      };
      state.threadIds.unshift(id);
    },

    hydrateMessagesState(state, action: PayloadAction<MessagesState>) {
      state.threadsById = action.payload.threadsById;
      state.threadIds = action.payload.threadIds;
      state.messagesById = action.payload.messagesById;
    },

    upsertThreadFromServer(state, action: PayloadAction<ThreadEntity>) {
      upsertThread(state, action.payload);
    },

    upsertMessagesFromServer(state, action: PayloadAction<MessageEntity[]>) {
      for (const msg of action.payload) {
        state.messagesById[msg.id] = {
          ...state.messagesById[msg.id],
          ...msg,
        };

        const thread = state.threadsById[msg.threadId];
        if (!thread) continue;
        if (!thread.messageIds.includes(msg.id)) {
          thread.messageIds.push(msg.id);
        }
      }
    },

    messageAcked(
      state,
      action: PayloadAction<{
        threadId: string;
        clientTempId: string;
        serverMessage: MessageEntity;
      }>,
    ) {
      const { threadId, clientTempId, serverMessage } = action.payload;
      const thread = state.threadsById[threadId];
      if (!thread) return;

      const local = Object.values(state.messagesById).find(
        (m) => m.threadId === threadId && m.clientTempId === clientTempId,
      );

      if (local) {
        delete state.messagesById[local.id];
        state.messagesById[serverMessage.id] = {
          ...serverMessage,
          deliveryStatus: serverMessage.deliveryStatus ?? "sent",
        };
        thread.messageIds = thread.messageIds.map((id) =>
          id === local.id ? serverMessage.id : id,
        );
        thread.messageIds = dedupeIds(thread.messageIds);
      } else {
        state.messagesById[serverMessage.id] = {
          ...state.messagesById[serverMessage.id],
          ...serverMessage,
          deliveryStatus: serverMessage.deliveryStatus ?? "sent",
        };
        if (!thread.messageIds.includes(serverMessage.id)) {
          thread.messageIds.push(serverMessage.id);
        }
        thread.messageIds = dedupeIds(thread.messageIds);
      }

    },

    readCursorUpdated(
      state,
      action: PayloadAction<{
        threadId: string;
        userId: string;
        lastReadMessageId: string | null;
      }>,
    ) {
      const thread = state.threadsById[action.payload.threadId];
      if (!thread) return;
      if (!thread.lastReadMessageIdByUserId) {
        thread.lastReadMessageIdByUserId = {};
      }
      thread.lastReadMessageIdByUserId[action.payload.userId] =
        action.payload.lastReadMessageId;
      thread.unreadCountByUserId[action.payload.userId] = 0;
    },

    threadRead(state, action: PayloadAction<{ threadId: string; userId: string }>) {
      const t = state.threadsById[action.payload.threadId];
      if (!t) return;
      t.unreadCountByUserId[action.payload.userId] = 0;
      const lastMessageId = t.messageIds.at(-1) ?? null;
      if (!t.lastReadMessageIdByUserId) {
        t.lastReadMessageIdByUserId = {};
      }
      t.lastReadMessageIdByUserId[action.payload.userId] = lastMessageId;
    },

    messageSentOptimistic(
      state,
      action: PayloadAction<{
        threadId: string;
        senderId: string;
        text: string;
        clientTempId?: string;
      }>,
    ) {
      const t = state.threadsById[action.payload.threadId];
      if (!t) return;
      const clientTempId =
        action.payload.clientTempId ??
        `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      state.messagesById[id] = {
        id,
        threadId: t.id,
        senderId: action.payload.senderId,
        text: action.payload.text.trim(),
        createdAt: new Date().toISOString(),
        seen: false,
        clientTempId,
        deliveryStatus: "sending",
      };
      t.messageIds.push(id);
      // Sending in a thread implies the sender is actively viewing it.
      // Keep sender unread count reset to avoid stale badge carryover.
      t.unreadCountByUserId[action.payload.senderId] = 0;
      state.threadIds = [t.id, ...state.threadIds.filter((x) => x !== t.id)];
    },

    messageReceived(
      state,
      action: PayloadAction<{
        threadId: string;
        senderId: string;
        text: string;
        recipientUserId: string;
      }>,
    ) {
      const t = state.threadsById[action.payload.threadId];
      if (!t) return;
      const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      state.messagesById[id] = {
        id,
        threadId: t.id,
        senderId: action.payload.senderId,
        text: action.payload.text.trim(),
        createdAt: new Date().toISOString(),
        deliveryStatus: "delivered",
      };
      t.messageIds.push(id);
      const prev = t.unreadCountByUserId[action.payload.recipientUserId] ?? 0;
      t.unreadCountByUserId[action.payload.recipientUserId] = prev + 1;
      state.threadIds = [t.id, ...state.threadIds.filter((x) => x !== t.id)];
    },

    toggleMessageReaction(
      state,
      action: PayloadAction<{ messageId: string; emoji: string }>,
    ) {
      const msg = state.messagesById[action.payload.messageId];
      if (!msg) return;
      msg.reacted = msg.reacted === action.payload.emoji ? undefined : action.payload.emoji;
    },
  },
});

export const {
  startThread,
  hydrateMessagesState,
  upsertThreadFromServer,
  upsertMessagesFromServer,
  messageAcked,
  readCursorUpdated,
  threadRead,
  messageSentOptimistic,
  messageReceived,
  toggleMessageReaction,
} = messagesSlice.actions;

export default messagesSlice.reducer;
