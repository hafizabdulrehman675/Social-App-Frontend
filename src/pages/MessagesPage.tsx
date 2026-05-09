import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Phone,
  Video,
  Info,
  Send,
  Image,
  Heart,
  Smile,
  ChevronLeft,
  Mic,
  Edit3,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  messageAcked,
  messageSentOptimistic,
  readCursorUpdated,
  threadRead,
  toggleMessageReaction,
  upsertMessagesFromServer,
  upsertThreadFromServer,
} from "@/features/messages/redux/messagesSlice";
import type {
  MessageEntity,
  ThreadEntity,
  ThreadPeer,
} from "@/features/messages/types";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";

type MessageView = MessageEntity & { timestamp: Date };
type ConversationView = {
  id: string;
  user: ThreadEntity["peer"];
  messages: MessageView[];
  unreadCount: number;
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

function formatMsgTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shouldShowTimestamp(messages: MessageView[], index: number): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  const curr = messages[index];
  return curr.timestamp.getTime() - prev.timestamp.getTime() > 1000 * 60 * 10;
}

/* ─── Emoji picker (simple) ─────────────────────────────────────── */
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

/* ─── Conversation list item ────────────────────────────────────── */
function ConvoItem({
  convo,
  active,
  myId,
  onClick,
}: {
  convo: ConversationView;
  active: boolean;
  myId: string;
  onClick: () => void;
}) {
  const last = convo.messages.at(-1);
  const isLastMine = last?.senderId === myId;
  const previewText = last
    ? `${isLastMine ? "You: " : ""}${last.text}`
    : convo.unreadCount > 0
      ? `${convo.unreadCount} new message${convo.unreadCount > 1 ? "s" : ""}`
      : "No messages yet";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors
        ${active ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
    >
      {/* Avatar + online dot */}
      <div className="relative shrink-0">
        <Avatar className="size-[56px]">
          <AvatarImage src={convo.user.avatarUrl} alt={convo.user.username} />
          <AvatarFallback>
            {convo.user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {convo.user.isOnline && (
          <span className="absolute bottom-0.5 right-0.5 size-3 rounded-full bg-green-500 ring-2 ring-white" />
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p
            className={`truncate text-[14px] ${convo.unreadCount > 0 ? "font-bold text-zinc-900" : "font-normal text-zinc-900"}`}
          >
            {convo.user.username}
          </p>
          <span className="ml-2 shrink-0 text-[12px] text-zinc-400">
            {last ? formatTime(last.timestamp) : ""}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-[13px] ${convo.unreadCount > 0 ? "font-semibold text-zinc-900" : "text-zinc-500"}`}
          >
            {previewText}
          </p>
          {convo.unreadCount > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">
              {convo.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Chat bubble ────────────────────────────────────────────────── */
function ChatBubble({
  msg,
  isMine,
  showAvatar,
  avatar,
  onReact,
}: {
  msg: MessageView;
  isMine: boolean;
  showAvatar: boolean;
  avatar: string;
  onReact: (msgId: string, emoji: string) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div
      className={`group flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar (only for other person's last bubble in a cluster) */}
      <div className="size-7 shrink-0">
        {!isMine && showAvatar && (
          <Avatar className="size-7">
            <AvatarImage src={avatar} />
            <AvatarFallback className="text-[10px]">U</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div
        className={`relative flex max-w-[65%] flex-col ${isMine ? "items-end" : "items-start"}`}
      >
        {/* Bubble */}
        <div
          className={`relative rounded-[22px] px-4 py-[9px] text-[14px] leading-snug
            ${
              isMine
                ? "rounded-br-[6px] bg-zinc-900 text-white"
                : "rounded-bl-[6px] bg-zinc-100 text-zinc-900"
            }`}
        >
          {msg.text}

          {/* Reaction badge */}
          {msg.reacted && (
            <span className="absolute -bottom-3 right-1 rounded-full bg-white px-1.5 py-0.5 text-[13px] shadow ring-1 ring-zinc-200">
              {msg.reacted}
            </span>
          )}
        </div>

        {/* Quick-react & time on hover */}
        <div
          className={`mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100
          ${isMine ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="text-[11px] text-zinc-400">
            {formatMsgTime(msg.timestamp)}
          </span>

          {/* Emoji quick-react */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactions((v) => !v)}
              className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Smile size={14} />
            </button>
            {showReactions && (
              <div
                className={`absolute bottom-7 flex gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1.5 shadow-xl z-10
                ${isMine ? "right-0" : "left-0"}`}
              >
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onReact(msg.id, e);
                      setShowReactions(false);
                    }}
                    className="text-[18px] transition hover:scale-125"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seen indicator */}
        {isMine && msg.seen && (
          <span className="mt-0.5 text-[11px] text-zinc-400">Seen</span>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────── */
function EmptyChat() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-24 items-center justify-center rounded-full border-2 border-zinc-300">
        <Send size={36} strokeWidth={1.25} className="text-zinc-400" />
      </div>
      <p className="text-[22px] font-bold text-zinc-900">Your messages</p>
      <p className="max-w-[240px] text-[14px] text-zinc-500">
        Send private photos and messages to a friend or group.
      </p>
      <button className="mt-2 rounded-lg bg-blue-500 px-5 py-2 text-[14px] font-semibold text-white hover:bg-blue-600 transition active:scale-95">
        Send message
      </button>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
function MessagesPage() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);
  const myId = authUser?.id ?? "";
  const threadsById = useAppSelector((s) => s.messages.threadsById);
  const threadIds = useAppSelector((s) => s.messages.threadIds);
  const messagesById = useAppSelector((s) => s.messages.messagesById);
  const usersById = useAppSelector((s) => s.users.usersById);
  const followingByUserId = useAppSelector((s) => s.social.followingByUserId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoScrolledRef = useRef(false);

  /** IDs of users this account follows OR who follow this account (friends/following). */
  const contactableUserIds = useMemo(() => {
    if (!myId) return [];
    const iFollow = followingByUserId[myId] ?? [];
    const followMe = Object.entries(followingByUserId)
      .filter(([uid, list]) => uid !== myId && list.includes(myId))
      .map(([uid]) => uid);
    return Array.from(new Set([...iFollow, ...followMe]));
  }, [myId, followingByUserId]);

  const convos = useMemo((): ConversationView[] => {
    return threadIds
      .map((id) => threadsById[id])
      .filter((t): t is ThreadEntity => {
        if (!t || !t.peer) return false;
        // Only show threads the current user is part of.
        if (!myId) return false;
        return t.participantIds?.includes(myId) ?? false;
      })
      .map((t) => {
        // Resolve the peer from usersById so both sides see the correct person.
        const otherId = t.participantIds.find((id) => id !== myId) ?? t.peer.id;
        const userRecord = usersById[otherId];
        const peer: ThreadPeer = userRecord
          ? {
              id: userRecord.id,
              username: userRecord.username,
              fullName: userRecord.fullName,
              avatarUrl: userRecord.avatarUrl ?? "",
              isOnline: t.peer.id === otherId ? t.peer.isOnline : false,
              lastSeen: t.peer.id === otherId ? t.peer.lastSeen : undefined,
            }
          : t.peer;
        return {
          id: t.id,
          user: peer,
          unreadCount: t.unreadCountByUserId[myId] ?? 0,
          messages: t.messageIds
            .map((messageId) => messagesById[messageId])
            .filter((m): m is MessageEntity => Boolean(m))
            .map((m) => ({ ...m, timestamp: new Date(m.createdAt) })),
        };
      });
  }, [threadIds, threadsById, messagesById, myId, usersById]);

  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) ?? null,
    [convos, activeId],
  );

  useEffect(() => {
    if (!activeId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit("thread:join", activeId);
    return () => {
      socket.emit("thread:leave", activeId);
    };
  }, [activeId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessageNew = (payload: { message?: MessageEntity }) => {
      if (!payload?.message) return;
      if (payload.message.senderId === myId) return;
      dispatch(upsertMessagesFromServer([payload.message]));
    };

    socket.off("message:new", onMessageNew);
    socket.on("message:new", onMessageNew);
    return () => {
      socket.off("message:new", onMessageNew);
    };
  }, [dispatch, myId]);

  const filteredConvos = useMemo(
    () =>
      convos.filter(
        (c) =>
          c.user.username.toLowerCase().includes(search.toLowerCase()) ||
          c.user.fullName.toLowerCase().includes(search.toLowerCase()),
      ),
    [convos, search],
  );

  /* Scroll to bottom on new message */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: hasAutoScrolledRef.current ? "smooth" : "auto",
    });
    hasAutoScrolledRef.current = true;
  }, [activeConvo?.messages.length]);

  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [activeId]);

  useEffect(() => {
    async function loadThreads() {
      if (!authToken || !myId) return;
      try {
        const response = await apiRequest<{
          data: {
            threads: ThreadEntity[];
          };
        }>("/api/messages/threads", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        for (const thread of response.data.threads || []) {
          dispatch(upsertThreadFromServer(thread));
        }

        const latestPerThread = await Promise.all(
          (response.data.threads || []).map(async (thread) => {
            try {
              const messagesResponse = await apiRequest<{
                data: { messages: MessageEntity[] };
              }>(`/api/messages/threads/${thread.id}`, {
                headers: { Authorization: `Bearer ${authToken}` },
              });
              const last = messagesResponse.data.messages?.at(-1);
              return last ? [last] : [];
            } catch {
              return [];
            }
          }),
        );
        const flattened = latestPerThread.flat();
        if (flattened.length > 0) {
          dispatch(upsertMessagesFromServer(flattened));
        }
      } catch {
        // Keep existing local messages state if backend fetch fails.
      }
    }

    loadThreads();
  }, [authToken, myId, dispatch]);

  async function markThreadReadOnServer(threadId: string) {
    if (!authToken || !myId) return;
    try {
      const readResponse = await apiRequest<{
        data: { threadId: string; lastReadMessageId: string | null };
      }>(`/api/messages/threads/${threadId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      dispatch(
        readCursorUpdated({
          threadId: readResponse.data.threadId,
          userId: myId,
          lastReadMessageId: readResponse.data.lastReadMessageId,
        }),
      );
    } catch {
      // Read cursor sync is best-effort.
    }
  }

  /* Mark as read on open */
  async function openConvo(id: string) {
    setActiveId(id);
    setMobileView("chat");
    dispatch(threadRead({ threadId: id, userId: myId }));
    setTimeout(() => inputRef.current?.focus(), 100);

    if (!authToken || !myId) return;

    try {
      const messagesResponse = await apiRequest<{
        data: { messages: MessageEntity[] };
      }>(`/api/messages/threads/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      dispatch(upsertMessagesFromServer(messagesResponse.data.messages || []));
    } catch {
      // Keep current thread messages if backend fetch fails.
    }
    await markThreadReadOnServer(id);
  }

  useEffect(() => {
    if (!activeId || !activeConvo) return;
    void markThreadReadOnServer(activeId);
  }, [activeId, activeConvo?.messages.length]);

  /* Send message */
  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !activeId) return;

    const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    dispatch(
      messageSentOptimistic({
        threadId: activeId,
        senderId: myId,
        text,
        clientTempId,
      }),
    );
    setInputText("");

    if (!authToken) return;

    try {
      const response = await apiRequest<{ data: { message: MessageEntity } }>(
        `/api/messages/threads/${activeId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ text, clientTempId }),
        },
      );

      dispatch(
        messageAcked({
          threadId: activeId,
          clientTempId,
          serverMessage: response.data.message,
        }),
      );
    } catch {
      // Keep optimistic message if backend send fails for now.
    }
  }

  /* React to a message */
  function reactToMessage(_convoId: string, msgId: string, emoji: string) {
    void _convoId;
    dispatch(toggleMessageReaction({ messageId: msgId, emoji }));
  }

  /** Start (or open) a conversation with a user from the social graph. */
  async function startConversationWith(userId: string) {
    const existing = convos.find((c) => c.user.id === userId);
    if (existing) {
      void openConvo(existing.id);
      return;
    }
    const userRecord = usersById[userId];
    if (!userRecord || !myId) return;

    if (authToken) {
      try {
        const response = await apiRequest<{ data: { thread: ThreadEntity } }>(
          "/api/messages/threads",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ userId }),
          },
        );
        dispatch(upsertThreadFromServer(response.data.thread));
        void openConvo(response.data.thread.id);
        return;
      } catch {
        // Keep backend as source of truth. Avoid creating local-only threads.
        return;
      }
    }
  }

  /** Contacts from social graph that don't yet have an active thread. */
  const newContacts = useMemo(() => {
    const existingPeerIds = new Set(convos.map((c) => c.user.id));
    return contactableUserIds
      .filter((uid) => !existingPeerIds.has(uid))
      .map((uid) => usersById[uid])
      .filter(Boolean);
  }, [contactableUserIds, convos, usersById]);

  return (
    <div className="flex h-screen bg-white">
      {/* ══ LEFT: Conversation list ══════════════════════════════════ */}
      <div
        className={`
        flex flex-col border-r border-zinc-200 bg-white
        w-full md:w-[350px] md:flex shrink-0
        ${mobileView === "chat" ? "hidden md:flex" : "flex"}
      `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2
            style={{ color: "black" }}
            className="text-[22px] font-bold text-zinc-900"
          >
            {"Messages"}
          </h2>
          <button
            type="button"
            title="New message"
            className="rounded-full p-1.5 text-zinc-900 hover:bg-zinc-100 transition"
          >
            <Edit3 size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
            <Search size={15} className="shrink-0 text-zinc-400" />
            <input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-1">
          {/* Active threads */}
          {filteredConvos.map((c) => (
            <ConvoItem
              key={c.id}
              convo={c}
              active={c.id === activeId}
              myId={myId}
              onClick={() => void openConvo(c.id)}
            />
          ))}

          {/* People from social graph with no thread yet */}
          {newContacts.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-[13px] font-semibold text-zinc-500">
                {filteredConvos.length > 0 ? "Also" : ""} People you follow
              </p>
              {newContacts
                .filter(
                  (u) =>
                    u.username.toLowerCase().includes(search.toLowerCase()) ||
                    u.fullName.toLowerCase().includes(search.toLowerCase()),
                )
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => void startConversationWith(u.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors"
                  >
                    <Avatar className="size-[56px] shrink-0">
                      <AvatarImage
                        src={u.avatarUrl ?? undefined}
                        alt={u.username}
                      />
                      <AvatarFallback>
                        {u.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-normal text-zinc-900">
                        {u.username}
                      </p>
                      <p className="truncate text-[13px] text-zinc-500">
                        {u.fullName}
                      </p>
                    </div>
                  </button>
                ))}
            </>
          )}

          {filteredConvos.length === 0 && newContacts.length === 0 && (
            <p className="py-8 text-center text-[13px] text-zinc-400">
              No conversations found
            </p>
          )}
        </div>
      </div>

      {/* ══ RIGHT: Chat window ══════════════════════════════════════ */}
      <div
        className={`
        flex flex-1 flex-col
        ${mobileView === "list" ? "hidden md:flex" : "flex"}
      `}
      >
        {activeConvo ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Mobile back */}
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="md:hidden rounded-full p-1.5 hover:bg-zinc-100 transition"
                >
                  <ChevronLeft size={22} />
                </button>

                <div className="relative">
                  <Avatar className="size-10">
                    <AvatarImage
                      src={activeConvo.user.avatarUrl}
                      alt={activeConvo.user.username}
                    />
                    <AvatarFallback>
                      {activeConvo.user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {activeConvo.user.isOnline && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                  )}
                </div>

                <div>
                  <p className="text-[15px] font-semibold leading-tight text-zinc-900">
                    {activeConvo.user.username}
                  </p>
                  <p className="text-[12px] leading-tight text-zinc-500">
                    {activeConvo.user.isOnline
                      ? "Active now"
                      : `Active ${activeConvo.user.lastSeen ?? "recently"}`}
                  </p>
                </div>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-1">
                <button className="rounded-full p-2 text-zinc-900 hover:bg-zinc-100 transition">
                  <Phone size={22} strokeWidth={1.75} />
                </button>
                <button className="rounded-full p-2 text-zinc-900 hover:bg-zinc-100 transition">
                  <Video size={22} strokeWidth={1.75} />
                </button>
                <button className="rounded-full p-2 text-zinc-900 hover:bg-zinc-100 transition">
                  <Info size={22} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-1">
              {activeConvo.messages.map((msg, i) => {
                const isMine = msg.senderId === myId;
                const nextMsg = activeConvo.messages[i + 1];
                const showAvatar =
                  !isMine &&
                  (!nextMsg ||
                    nextMsg.senderId === myId ||
                    nextMsg.senderId !== msg.senderId);
                const showTimestamp = shouldShowTimestamp(
                  activeConvo.messages,
                  i,
                );

                return (
                  <div key={msg.id}>
                    {showTimestamp && (
                      <div className="flex justify-center py-3">
                        <span className="text-[11px] text-zinc-400">
                          {formatMsgTime(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-0.5`}
                    >
                      <ChatBubble
                        msg={msg}
                        isMine={isMine}
                        showAvatar={showAvatar}
                        avatar={activeConvo.user.avatarUrl}
                        onReact={(msgId, emoji) =>
                          reactToMessage(activeConvo.id, msgId, emoji)
                        }
                      />
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-3 rounded-full border border-zinc-300 bg-white px-4 py-2 focus-within:border-zinc-400 transition-colors">
                {/* Emoji */}
                <button
                  type="button"
                  className="shrink-0 text-zinc-500 hover:text-zinc-900 transition"
                >
                  <Smile size={22} strokeWidth={1.75} />
                </button>

                {/* Text input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
                  placeholder="Message…"
                  className="flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
                />

                {inputText.trim() ? (
                  /* Send */
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    className="shrink-0 text-[14px] font-semibold text-blue-500 hover:text-blue-700 transition active:scale-95"
                  >
                    Send
                  </button>
                ) : (
                  /* Media / mic */
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="shrink-0 text-zinc-500 hover:text-zinc-900 transition"
                    >
                      <Mic size={22} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-zinc-500 hover:text-zinc-900 transition"
                    >
                      <Image size={22} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-zinc-500 hover:text-zinc-900 transition"
                    >
                      <Heart size={22} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyChat />
        )}
      </div>
    </div>
  );
}

export default MessagesPage;
