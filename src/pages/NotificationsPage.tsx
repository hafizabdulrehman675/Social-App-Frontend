import { useEffect, useMemo, useState } from "react";
import { Heart, Send, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setActiveModal } from "@/features/ui/redux/uiSlice";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";

type NotificationItem = {
  id: string;
  username: string;
  userAvatarUrl: string;
  text: string;
  type: "incomingRequest" | "outgoingRequest" | "followingYou" | "message";
  isRead?: boolean;
  createdAt?: string;
};

type BackendNotification = {
  id: string | number;
  type: "like" | "comment" | "follow" | "follow_request" | "message";
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string | number;
    username: string;
    avatarUrl: string | null;
  };
};

function NotificationIcon({ type }: { type: NotificationItem["type"] }) {
  if (type === "incomingRequest")
    return <Heart className="h-4 w-4 text-pink-500" />;
  if (type === "message")
    return <Send className="h-4 w-4 text-blue-500" />;
  if (type === "outgoingRequest")
    return <Send className="h-4 w-4 text-blue-500" />;
  return <UserPlus className="h-4 w-4 text-green-600" />;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "now";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function NotificationsPage() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const social = useAppSelector((s) => s.social);
  const authToken = useAppSelector((s) => s.auth.token);
  const [backendNotifications, setBackendNotifications] = useState<
    NotificationItem[]
  >([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const followActivityCount = useMemo(() => {
    if (!authUser) return 0;
    return Object.values(social.requestsById).filter(
      (r) => r.toUserId === authUser.id && r.status === "pending",
    ).length;
  }, [authUser, social.requestsById]);

  const notifications = useMemo(
    () => backendNotifications,
    [backendNotifications],
  );

  useEffect(() => {
    async function loadNotifications() {
      if (!authToken) return;
      setIsLoadingBackend(true);
      setBackendError(null);

      try {
        const response = await apiRequest<{
          data: { notifications: BackendNotification[] };
        }>("/api/notifications", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        const mapped: NotificationItem[] = (response.data.notifications || []).map(
          (n) => {
            const typeMap: Record<BackendNotification["type"], NotificationItem["type"]> =
              {
                follow_request: "incomingRequest",
                follow: "followingYou",
                like: "followingYou",
                comment: "outgoingRequest",
                message: "message",
              };

            const textMap: Record<BackendNotification["type"], string> = {
              follow_request: "requested to follow you.",
              follow: "is following you.",
              like: "liked your post.",
              comment: "commented on your post.",
              message: "sent you a message.",
            };

            return {
              id: String(n.id),
              username: n.sender?.username ?? "unknown_user",
              userAvatarUrl:
                n.sender?.avatarUrl ?? "https://i.pravatar.cc/100?u=unknown",
              text: textMap[n.type],
              type: typeMap[n.type],
              isRead: n.isRead,
              createdAt: n.createdAt,
            };
          },
        );

        setBackendNotifications(mapped);
        const unreadIds = mapped.filter((n) => !n.isRead).map((n) => n.id);
        if (unreadIds.length > 0) {
          await apiRequest("/api/notifications/read-all", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          setBackendNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true })),
          );
        }
      } catch {
        // Keep previous backend notifications visible on transient failures.
        setBackendError("Could not refresh notifications right now.");
      } finally {
        setIsLoadingBackend(false);
      }
    }

    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 10000);

    const onFocus = () => {
      void loadNotifications();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [authToken, refreshTick]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNotificationNew = () => {
      setRefreshTick((prev) => prev + 1);
    };

    socket.on("notification:new", onNotificationNew);
    return () => {
      socket.off("notification:new", onNotificationNew);
    };
  }, []);

  async function handleNotificationClick(itemId: string, isRead?: boolean) {
    if (!authToken || isRead) return;

    try {
      await apiRequest(`/api/notifications/${itemId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setBackendNotifications((prev) =>
        prev.map((n) => (n.id === itemId ? { ...n, isRead: true } : n)),
      );
    } catch {
      // Ignore mark-read failure and keep UI state.
    }
  }

  async function handleMarkAllRead() {
    if (!authToken || backendNotifications.length === 0) return;
    try {
      await apiRequest("/api/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setBackendNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true })),
      );
    } catch {
      // Keep current state on error.
    }
  }

  async function handleDeleteAll() {
    if (!authToken || backendNotifications.length === 0) return;
    try {
      await apiRequest("/api/notifications/all", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setBackendNotifications([]);
    } catch {
      setBackendError("Could not delete notifications right now.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[630px] space-y-4 px-1 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "black" }}>
          Notifications
        </h1>
        <div className="flex items-center gap-2">
          {isLoadingBackend ? (
            <span className="text-xs text-zinc-500">Refreshing...</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleMarkAllRead()}
            disabled={backendNotifications.length === 0}
          >
            Mark all read
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleDeleteAll()}
            disabled={backendNotifications.length === 0}
          >
            Delete all
          </Button>
        </div>
      </div>

      {backendError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {backendError}
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Follow requests</p>
          <p className="text-xs text-zinc-500">
            Approve who can follow you back.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="relative shrink-0 rounded-lg text-xs font-semibold"
          onClick={() => dispatch(setActiveModal("followRequests"))}
        >
          Open
          {followActivityCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
              {followActivityCount > 9 ? "9+" : followActivityCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-900">
              No notifications yet
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Follow activity will appear here.
            </p>
          </div>
        ) : (
          notifications.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                index !== notifications.length - 1 ? "border-b border-zinc-100" : ""
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100">
                <NotificationIcon type={item.type} />
              </div>

              <Link
                to={`/profile/${encodeURIComponent(item.username)}`}
                className="flex min-w-0 flex-1 items-center gap-3"
                onClick={() => void handleNotificationClick(item.id, item.isRead)}
              >
                <img
                  src={item.userAvatarUrl}
                  alt={item.username}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <p className="truncate text-sm text-zinc-800">
                  <span className="font-semibold">{item.username}</span>{" "}
                  {item.text}
                </p>
              </Link>

              <span className="ml-auto text-xs text-zinc-500">
                {formatRelativeTime(item.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;
