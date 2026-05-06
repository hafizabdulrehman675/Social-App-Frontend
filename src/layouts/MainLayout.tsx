import { useEffect, useMemo } from "react";
import {
  Compass,
  Heart,
  House,
  MessageCircle,
  PlusSquare,
  Search,
  User,
  Film,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
} from "react-router-dom";
import { useAppSelector, useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/redux/authSlice";
import { clearSession } from "@/lib/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setActiveModal } from "@/features/ui/redux/uiSlice";
import { apiRequest } from "@/lib/api";
import type { SocialState } from "@/features/social/types";
import type { UserRecord } from "@/features/users/types";
import { replaceUsers } from "@/features/users/redux/usersSlice";
import {
  acceptFollowRequest,
  cancelFollowRequest,
  clearSocialState,
  removeFriendship,
  rejectFollowRequest,
  replaceSocialState,
  sendFollowRequest,
  unfollow,
} from "@/features/social/redux/socialSlice";
import CreatePostForm from "@/features/posts/components/CreatePostForm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { connectSocket, disconnectSocket } from "@/lib/socket";
const NAV_ITEMS = [
  { label: "Home", icon: House, to: "/" },
  { label: "Search", icon: Search, to: "/search" },
  { label: "Explore", icon: Compass, to: "/explore" },
  { label: "Reels", icon: Film, to: "/reels" },
  { label: "Messages", icon: MessageCircle, to: "/messages" },
  { label: "Notifications", icon: Heart, to: "/notifications" },
  { label: "Create", icon: PlusSquare, to: "/create" },
];

type SuggestedRelation =
  | { kind: "incoming"; requestId: string }
  | { kind: "outgoing" }
  | { kind: "following"; mutual: boolean }
  | { kind: "none" };

function getSuggestedRelation(
  authId: string,
  targetId: string,
  social: SocialState,
): SuggestedRelation {
  for (const req of Object.values(social.requestsById)) {
    if (
      req.status === "pending" &&
      req.fromUserId === targetId &&
      req.toUserId === authId
    ) {
      return { kind: "incoming", requestId: req.id };
    }
  }

  for (const req of Object.values(social.requestsById)) {
    if (
      req.status === "pending" &&
      req.fromUserId === authId &&
      req.toUserId === targetId
    ) {
      return { kind: "outgoing" };
    }
  }

  const myFollowing = social.followingByUserId[authId] ?? [];
  if (myFollowing.includes(targetId)) {
    const theirFollowing = social.followingByUserId[targetId] ?? [];
    return { kind: "following", mutual: theirFollowing.includes(authId) };
  }

  return { kind: "none" };
}

function NotificationBadge({ count }: { count: number }) {
  if (count < 1) return null;
  const label = count > 9 ? "9+" : String(count);
  return (
    <span
      className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
      aria-hidden
    >
      {label}
    </span>
  );
}

const followActionBlueClass =
  "h-auto min-h-0 shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-[#0095f6] hover:bg-zinc-100 hover:text-[#0095f6] dark:hover:bg-zinc-800/80";
const followActionMutedClass =
  "h-auto min-h-0 shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 dark:text-zinc-200";

function SuggestedUserRow({
  user: u,
  authUser,
  authToken,
  social,
}: {
  user: UserRecord;
  authUser: { id: string; username: string };
  authToken: string | null;
  social: SocialState;
}) {
  const dispatch = useAppDispatch();
  const rel = getSuggestedRelation(authUser.id, u.id, social);

  const subtitle =
    rel.kind === "incoming" ? "Wants to follow you" : "Suggested for you";

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        to={`/profile/${encodeURIComponent(u.username)}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-0.5 pr-1 transition-colors hover:bg-zinc-50"
      >
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={u.avatarUrl} alt={u.username} />
          <AvatarFallback className="text-xs">
            {u.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex flex-col items-start gap-0.5">
          <p className="truncate text-[13px] font-semibold leading-snug text-zinc-900">
            {u.username}
          </p>
          <p className="truncate text-[12px] leading-snug text-zinc-400">
            {subtitle}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        {rel.kind === "incoming" ? (
          <>
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-md bg-[#0095f6] px-2.5 text-[11px] font-semibold text-white hover:bg-[#1877f2]"
              onClick={async () => {
                if (!authToken) return;
                try {
                  await apiRequest(`/api/social/follow-requests/${rel.requestId}`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ action: "accept" }),
                  });
                  dispatch(acceptFollowRequest({ requestId: rel.requestId }));
                } catch {
                  // keep current state on error
                }
              }}
            >
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 rounded-md px-2.5 text-[11px] font-semibold"
              onClick={async () => {
                if (!authToken) return;
                try {
                  await apiRequest(`/api/social/follow-requests/${rel.requestId}`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ action: "reject" }),
                  });
                  dispatch(rejectFollowRequest({ requestId: rel.requestId }));
                } catch {
                  // keep current state on error
                }
              }}
            >
              Delete
            </Button>
          </>
        ) : rel.kind === "outgoing" ? (
          <Button
            type="button"
            variant="ghost"
            className={followActionMutedClass}
            onClick={async () => {
              if (!authToken) return;
              try {
                await apiRequest(`/api/social/follow/${u.id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                dispatch(
                  cancelFollowRequest({
                    fromUserId: authUser.id,
                    toUserId: u.id,
                  }),
                );
              } catch {
                try {
                  const sync = await apiRequest<{ data: SocialState }>("/api/social/me", {
                    headers: { Authorization: `Bearer ${authToken}` },
                  });
                  dispatch(replaceSocialState(sync.data));
                } catch {
                  // keep current state on error
                }
              }
            }}
          >
            Requested
          </Button>
        ) : rel.kind === "following" ? (
          <Button
            type="button"
            variant="ghost"
            className={followActionMutedClass}
            onClick={async () => {
              if (!authToken) return;
              try {
                await apiRequest(`/api/social/follow/${u.id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                dispatch(
                  rel.mutual
                    ? removeFriendship({
                        userAId: authUser.id,
                        userBId: u.id,
                      })
                    : unfollow({
                        followerId: authUser.id,
                        followingId: u.id,
                      }),
                );
              } catch {
                // keep current state on error
              }
            }}
          >
            {rel.mutual ? "Friends" : "Following"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className={followActionBlueClass}
            onClick={async () => {
              if (!authToken) return;
              try {
                const response = await apiRequest<{
                  data: { requestId: string | number; status: string };
                }>(`/api/social/follow/${u.id}`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                dispatch(
                  sendFollowRequest({
                    fromUserId: authUser.id,
                    toUserId: u.id,
                    requestId: String(response.data.requestId),
                  }),
                );
                dispatch(setActiveModal("followRequestSent"));
              } catch {
                // keep current state on error
              }
            }}
          >
            Follow
          </Button>
        )}
      </div>
    </div>
  );
}

const FOOTER_LINK_LABELS = [
  "About",
  "Help",
  "Press",
  "API",
  "Jobs",
  "Privacy",
  "Terms",
  "Locations",
  "Language",
  "Meta Verified",
] as const;

const footerLinkButtonClass =
  "h-auto min-h-0 cursor-pointer rounded px-1 py-0.5 text-[11px] font-normal leading-relaxed text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-300";

function SidebarNavItem({
  label,
  icon: Icon,
  to,
}: {
  label: string;
  icon: React.ElementType;
  to: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-normal transition-all duration-100
		  ${
        isActive
          ? "font-semibold text-zinc-900"
          : "text-zinc-800 hover:bg-zinc-100"
      }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={24}
            strokeWidth={isActive ? 2.5 : 2}
            className="shrink-0 transition-transform duration-100 group-hover:scale-110"
          />
          <span className="hidden xl:inline">{label}</span>
        </>
      )}
    </NavLink>
  );
}
function MainLayout() {
  //   const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  //   const user = useAppSelector((s) => s.auth.user);
  //   if (!isAuthenticated) {
  //     return <Navigate to="/login" />;
  //   }
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);
  const usersById = useAppSelector((s) => s.users.usersById);
  const allUserIds = useAppSelector((s) => s.users.allUserIds);
  const activeModal = useAppSelector((s) => s.ui.activeModal);
  const social = useAppSelector((s) => s.social);
  const location = useLocation();
  const matches = useMatches();
  const isCreatePage = location.pathname === "/create";
  const isCreateActive = activeModal === "createPost" || isCreatePage;
  const hideRightSidebar = matches.some((m) =>
    Boolean((m.handle as { hideRightSidebar?: boolean })?.hideRightSidebar),
  );

  const incomingFollowRequests = useMemo(() => {
    if (!authUser) return [];
    return Object.values(social.requestsById).filter(
      (r) => r.toUserId === authUser.id && r.status === "pending",
    );
  }, [authUser, social.requestsById]);

  // Badge count mirrors the Follow Requests modal (incoming requests only).
  const followActivityBadgeCount = incomingFollowRequests.length;

  const suggestedUsers = useMemo((): UserRecord[] => {
    if (!authUser) return [];
    return allUserIds
      .filter((id) => id !== authUser.id)
      .map((id) => usersById[id])
      .filter((u): u is UserRecord => Boolean(u));
  }, [authUser, allUserIds, usersById]);

  useEffect(() => {
    if (!authToken || !authUser) {
      disconnectSocket();
      return;
    }

    connectSocket(authToken);

    return () => {
      disconnectSocket();
    };
  }, [authToken, authUser]);

  useEffect(() => {
    async function loadUsersFromBackend() {
      if (!authUser || !authToken) return;

      try {
        const response = await apiRequest<{
          data: {
            users: Array<{
              id: number | string;
              username: string;
              fullName: string;
              email?: string;
              avatarUrl: string | null;
            }>;
          };
        }>("/api/users", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        const backendUsers: UserRecord[] = response.data.users.map((u) => ({
          id: String(u.id),
          username: u.username,
          fullName: u.fullName,
          email: u.email || "",
          avatarUrl: u.avatarUrl ?? null,
        }));

        // /api/users excludes logged user; include auth user explicitly.
        const merged = [authUser, ...backendUsers];
        dispatch(replaceUsers(merged));
      } catch {
        // Keep existing in-memory users state if backend fetch fails.
      }
    }

    loadUsersFromBackend();
  }, [authUser, authToken, dispatch]);

  useEffect(() => {
    async function loadSocialStateFromBackend() {
      if (!authUser || !authToken) {
        dispatch(clearSocialState());
        return;
      }
      try {
        let response;
        try {
          response = await apiRequest<{ data: SocialState }>("/api/social/me", {
            headers: { Authorization: `Bearer ${authToken}` },
          });
        } catch {
          response = await apiRequest<{ data: SocialState }>("/api/social/state", {
            headers: { Authorization: `Bearer ${authToken}` },
          });
        }
        dispatch(replaceSocialState(response.data));
      } catch {
        // Keep existing social state when sync request fails transiently.
      }
    }

    loadSocialStateFromBackend();
  }, [authUser, authToken, dispatch]);

  /*
    LocalStorage debug reference (disabled intentionally after backend connectivity):
    ------------------------------------------------------------------------------
    useEffect(() => {
      const usersRaw = localStorage.getItem("ig_clone_users_v1");
      const sessionRaw = localStorage.getItem("ig_clone_session_v1");

      let parsedUsers: unknown = null;
      let parsedSession: unknown = null;

      try {
        parsedUsers = usersRaw ? JSON.parse(usersRaw) : null;
      } catch {
        parsedUsers = "Failed to parse users localStorage JSON";
      }

      try {
        parsedSession = sessionRaw ? JSON.parse(sessionRaw) : null;
      } catch {
        parsedSession = "Failed to parse session localStorage JSON";
      }

      console.group("MainLayout localStorage debug");
      console.log("authUser (redux):", authUser);
      console.log("usersById (redux):", usersById);
      console.log("allUserIds (redux):", allUserIds);
      console.log("ig_clone_users_v1 (raw):", usersRaw);
      console.log("ig_clone_users_v1 (parsed):", parsedUsers);
      console.log("ig_clone_session_v1 (raw):", sessionRaw);
      console.log("ig_clone_session_v1 (parsed):", parsedSession);
      console.log("Social_state", social);
      console.groupEnd();
    }, [authUser, usersById, allUserIds]);
  */

  function handleLogout() {
    dispatch(logout());
    dispatch(clearSocialState());
    clearSession();
    navigate("/login");
  }
  function openCreateModal() {
    dispatch(setActiveModal("createPost"));
  }
  function closeModal() {
    dispatch(setActiveModal("none"));
  }
  return (
    <div className="bg-white text-zinc-900">
      {/* ─── Mobile top bar ─── */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-4 py-2.5 md:hidden">
        <div className="mx-auto flex max-w-[500px] items-center justify-between">
          <span
            style={{ fontFamily: "'Billabong', cursive" }}
            className="text-[28px] leading-none pt-1 select-none"
          >
            Instagram
          </span>
          <div className="flex items-center gap-3">
            <NavLink
              to="/notifications"
              aria-label={
                followActivityBadgeCount > 0
                  ? `Notifications, ${followActivityBadgeCount} pending follow updates`
                  : "Notifications"
              }
              className="relative rounded-full p-1.5 transition-colors hover:bg-zinc-100 active:scale-95"
            >
              <Heart size={23} strokeWidth={2} />
              <NotificationBadge count={followActivityBadgeCount} />
            </NavLink>
            <NavLink
              to="/messages"
              aria-label="Messages"
              className="rounded-full p-1.5 transition-colors hover:bg-zinc-100 active:scale-95"
            >
              <MessageCircle size={23} strokeWidth={2} />
            </NavLink>
          </div>
        </div>
      </header>

      {/* ─── Outer 12-col grid ─── */}
      <div className="grid w-full grid-cols-12">
        {/* ─── Left Sidebar (md: icon-only, xl: full) ─── */}
        <aside className="hidden md:flex md:col-span-1 xl:col-span-3 flex-col border-r border-zinc-200 bg-white">
          <div className="sticky top-0 flex h-screen flex-col px-2 xl:px-3 py-6">
            {/* Logo */}
            <div className="mb-5 xl:mb-8 px-3 h-[36px] flex items-center">
              <span
                style={{ fontFamily: "'Billabong', cursive" }}
                className="hidden xl:block text-[30px] leading-none pt-1 select-none"
              >
                Instagram
              </span>
              {/* Compact icon for md-lg */}
              <div className="flex xl:hidden items-center justify-center w-9 h-9">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle
                    cx="17.5"
                    cy="6.5"
                    r="1"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                if (item.to === "/create") {
                  return (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={openCreateModal}
                      className={`group flex w-full items-center justify-start gap-4 rounded-xl px-3 py-3 text-[15px] font-normal transition-all duration-100 h-auto cursor-pointer
                      ${
                        isCreateActive
                          ? "font-semibold text-zinc-900"
                          : "text-zinc-800 hover:bg-zinc-100"
                      }`}
                    >
                      <item.icon
                        size={24}
                        strokeWidth={isCreateActive ? 2.5 : 2}
                        className="shrink-0 transition-transform duration-100 group-hover:scale-110"
                      />
                      <span className="hidden xl:inline">{item.label}</span>
                    </Button>
                  );
                }

                if (item.to === "/notifications") {
                  return (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      aria-label={
                        followActivityBadgeCount > 0
                          ? `${item.label}, ${followActivityBadgeCount} pending follow updates`
                          : item.label
                      }
                      className={({ isActive }) =>
                        `group flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-normal transition-all duration-100
		  ${
        isActive
          ? "font-semibold text-zinc-900"
          : "text-zinc-800 hover:bg-zinc-100"
      }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative inline-flex shrink-0">
                            <item.icon
                              size={24}
                              strokeWidth={isActive ? 2.5 : 2}
                              className="transition-transform duration-100 group-hover:scale-110"
                            />
                            <NotificationBadge
                              count={followActivityBadgeCount}
                            />
                          </span>
                          <span className="hidden xl:inline">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                }

                return <SidebarNavItem key={item.label} {...item} />;
              })}

              {/* Profile */}
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `group flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-normal transition-all duration-100
                  ${
                    isActive
                      ? "font-semibold text-zinc-900"
                      : "text-zinc-800 hover:bg-zinc-100"
                  }`
                }
              >
                {({ isActive }) =>
                  authUser ? (
                    <>
                      <Avatar
                        className={`size-6 shrink-0 transition-transform duration-100 group-hover:scale-110 ${
                          isActive ? "ring-2 ring-zinc-900 ring-offset-1" : ""
                        }`}
                      >
                        <AvatarImage
                          src={authUser.avatarUrl}
                          alt={authUser.username}
                        />
                        <AvatarFallback className="text-xs">
                          {authUser.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`hidden xl:inline ${
                          isActive ? "font-semibold" : ""
                        }`}
                      >
                        Profile
                      </span>
                    </>
                  ) : (
                    <>
                      <User
                        size={24}
                        strokeWidth={isActive ? 2.5 : 2}
                        className="shrink-0 transition-transform duration-100 group-hover:scale-110"
                      />
                      <span className="hidden xl:inline">Profile</span>
                    </>
                  )
                }
              </NavLink>
            </nav>
          </div>
        </aside>

        {/* ─── Center feed ─── */}
        <main
          className={cn(
            "col-span-12 min-h-screen border-r border-zinc-100 md:col-span-11",
            hideRightSidebar ? "xl:col-span-9" : "xl:col-span-6",
          )}
        >
          <div
            className={cn(
              "w-full pb-20 md:pb-6",
              // hideRightSidebar ? "mx-0" : "mx-0 md:mx-[10px]",
            )}
          >
            <Outlet />
          </div>
        </main>

        {/* ─── Right sidebar ─── */}
        {!hideRightSidebar && (
          <aside className="hidden xl:col-span-3 xl:flex flex-col px-7 py-8">
            <div className="sticky top-8 space-y-12">
              {/* Logged-in user widget */}
              {authUser && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <Avatar className="size-11">
                      <AvatarImage
                        src={authUser.avatarUrl}
                        alt={authUser.username}
                      />
                      <AvatarFallback>
                        {authUser.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col justify-start items-start">
                      <p className="text-sm font-semibold leading-snug">
                        {authUser.username}
                      </p>
                      <p className="text-xs text-zinc-500 leading-snug">
                        {authUser.fullName}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleLogout}
                    aria-label="Log out or switch account"
                    className="h-auto min-h-0 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-[#0095f6] hover:bg-zinc-100 hover:text-[#0095f6] dark:hover:bg-zinc-800/80"
                  >
                    Log Out
                  </Button>
                </div>
              )}

              {/* Suggestions */}
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">
                    Suggested For You
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="See all suggested accounts"
                    className="h-auto min-h-0 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
                  >
                    See all
                  </Button>
                </div>
                <div className="space-y-3.5">
                  {authUser && suggestedUsers.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      No other accounts yet. Sign up another user to see
                      suggestions here.
                    </p>
                  ) : authUser ? (
                    suggestedUsers.map((u) => (
                      <SuggestedUserRow
                        key={u.id}
                        user={u}
                        authUser={authUser}
                        authToken={authToken}
                        social={social}
                      />
                    ))
                  ) : null}
                </div>
              </div>

              {/* Footer */}
              <div className="text-center">
                <nav
                  aria-label="Site links"
                  className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1 leading-relaxed"
                >
                  {FOOTER_LINK_LABELS.map((label, index) => (
                    <span key={label} className="inline-flex items-center">
                      {index > 0 ? (
                        <span
                          className="mx-0.5 text-[11px] text-zinc-400 select-none"
                          aria-hidden
                        >
                          ·
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={label}
                        className={footerLinkButtonClass}
                      >
                        {label}
                      </Button>
                    </span>
                  ))}
                </nav>
                <p className="mt-2 text-center text-[11px] text-zinc-400">
                  © 2026 Instagram from Meta
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>
      <Dialog
        open={activeModal === "createPost"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: "black" }}>
              Create New Post
            </DialogTitle>
          </DialogHeader>
          <CreatePostForm
            onSuccess={() => {
              closeModal();
              navigate("/");
            }}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeModal === "followRequests"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "black" }}>
              Follow requests
            </DialogTitle>
          </DialogHeader>
          {incomingFollowRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No pending requests.
            </p>
          ) : (
            <ul className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto py-1">
              {incomingFollowRequests.map((req) => {
                const from = usersById[req.fromUserId];
                const label = from?.username ?? "Unknown user";
                const avatar = from?.avatarUrl;
                return (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-10 shrink-0">
                        <AvatarImage src={avatar} alt="" />
                        <AvatarFallback className="text-xs">
                          {label.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {label}
                        </p>
                        <p className="text-xs text-zinc-500">
                          wants to follow you
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-lg bg-[#0095f6] px-3 text-xs font-semibold text-white hover:bg-[#1877f2]"
                        onClick={async () => {
                          if (!authToken) return;
                          try {
                            await apiRequest(`/api/social/follow-requests/${req.id}`, {
                              method: "PATCH",
                              headers: { Authorization: `Bearer ${authToken}` },
                              body: JSON.stringify({ action: "accept" }),
                            });
                            dispatch(acceptFollowRequest({ requestId: req.id }));
                          } catch {
                            // keep current state on error
                          }
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 rounded-lg px-3 text-xs font-semibold"
                        onClick={async () => {
                          if (!authToken) return;
                          try {
                            await apiRequest(`/api/social/follow-requests/${req.id}`, {
                              method: "PATCH",
                              headers: { Authorization: `Bearer ${authToken}` },
                              body: JSON.stringify({ action: "reject" }),
                            });
                            dispatch(rejectFollowRequest({ requestId: req.id }));
                          } catch {
                            // keep current state on error
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeModal === "followRequestSent"}
        onOpenChange={(open) => !open && closeModal()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ color: "black" }}>Request sent</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            When they approve your request, you&apos;ll start seeing their posts
            in your feed.
          </p>
          <Button type="button" className="mt-4 w-full" onClick={closeModal}>
            OK
          </Button>
        </DialogContent>
      </Dialog>
      {/* ─── Mobile bottom nav ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white px-2 py-2.5 md:hidden">
        <div className="mx-auto flex max-w-[500px] items-center justify-around">
          {[
            { icon: House, to: "/" },
            { icon: Search, to: "/search" },
            { icon: PlusSquare, to: "/create" },
            { icon: Film, to: "/reels" },
          ].map(({ icon: Icon, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-center rounded-full p-2 transition-all active:scale-90 ${
                  isActive ? "text-zinc-900" : "text-zinc-500"
                }`
              }
            >
              {({ isActive }) => (
                <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
              )}
            </NavLink>
          ))}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center justify-center rounded-full p-1 transition-all active:scale-90 ${
                isActive
                  ? "ring-[2px] ring-zinc-900 ring-offset-1 rounded-full"
                  : ""
              }`
            }
          >
            {authUser ? (
              <Avatar className="size-7">
                <AvatarImage src={authUser.avatarUrl} alt={authUser.username} />
                <AvatarFallback className="text-xs">
                  {authUser.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User size={26} strokeWidth={2} />
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

export default MainLayout;

{
  /* <aside className="hidden border-l bg-white px-6 py-6 lg:col-span-3 lg:block">
  <button
    type="button"
    onClick={handleLogout}
    className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-100"
  >
    Logout {authUser ? `(${authUser.username})` : ""}
  </button>
  <div className="sticky top-6">
    <p className="text-sm font-semibold">Suggestions for you</p>
    <div className="mt-4 space-y-3">
      {["emma_dev", "ali.codes", "ui_lover", "reacthub"].map((u) => (
        <div
          key={u}
          className="flex items-center justify-between rounded-md bg-zinc-50 p-3"
        >
          <p className="text-sm">{u}</p>
          <button className="text-xs font-medium text-blue-600">Follow</button>
        </div>
      ))}
    </div>
  </div>
  <div className="mt-4 rounded-md border bg-zinc-100 p-3 text-xs">
    <p>
      <strong>Logged user:</strong> {authUser?.username ?? "none"}
    </p>
    <p>
      <strong>Total users:</strong> {allUserIds.length}
    </p>
    <p>
      <strong>User ids:</strong> {allUserIds.join(", ") || "none"}
    </p>
  </div>
</aside>; */
}
