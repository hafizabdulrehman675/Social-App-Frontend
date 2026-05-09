import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Grid3X3,
  Bookmark,
  Tag,
  Play,
  Settings,
  Plus,
  ChevronDown,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FeedPost } from "@/features/posts/types";
import { useAppSelector, useAppDispatch } from "@/app/hooks";
import { apiRequest } from "@/lib/api";
import { setActiveModal } from "@/features/ui/redux/uiSlice";
import { removePost } from "@/features/posts/redux/postsSlice";
import {
  replaceSocialState,
  sendFollowRequest,
  cancelFollowRequest,
  unfollow,
} from "@/features/social/redux/socialSlice";
import type { SocialState } from "@/features/social/types";

/* ─── Highlight bubble ──────────────────────────────────────────── */
const HIGHLIGHTS = [
  { id: "h1", label: "Travel", emoji: "✈️" },
  { id: "h2", label: "Food", emoji: "🍜" },
  { id: "h3", label: "Dev", emoji: "💻" },
  { id: "h4", label: "Vibes", emoji: "🎵" },
];

/* ─── IG gradient ───────────────────────────────────────────────── */
const IG_GRADIENT =
  "linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)";

/* ShadCN Button: no hover/active visual change (static chrome) */
const profileBtnSecondary =
  "h-8 rounded-lg border-0 bg-zinc-100 px-4 text-[14px] font-semibold text-zinc-900 shadow-none hover:bg-zinc-100 hover:text-zinc-900 active:translate-y-0 active:bg-zinc-100";
const profileBtnGhostIcon =
  "size-auto rounded-full p-1.5 text-zinc-700 shadow-none hover:bg-transparent hover:text-zinc-700 active:translate-y-0 active:bg-transparent";
const profileBtnGhostRow =
  "h-auto justify-start gap-0 p-0 text-left shadow-none hover:bg-transparent active:translate-y-0 active:bg-transparent";
const profileBtnGhostTab =
  "rounded-none border-t px-5 py-3 text-[12px] font-semibold tracking-widest shadow-none hover:bg-transparent active:translate-y-0 active:bg-transparent";
const profileBtnLinkBlue =
  "mt-5 h-auto p-0 text-[13px] font-semibold text-blue-500 shadow-none hover:bg-transparent hover:text-blue-500 hover:no-underline active:bg-transparent active:text-blue-500";
const profileBtnHighlight =
  "flex h-auto shrink-0 flex-col items-center gap-1.5 p-0 shadow-none hover:bg-transparent active:translate-y-0 active:bg-transparent";

/* ─── Post thumbnail ────────────────────────────────────────────── */
function PostThumb({ post, onClick }: { post: FeedPost; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="relative aspect-square h-auto w-full overflow-hidden rounded-none bg-zinc-100 p-0 shadow-none hover:bg-zinc-100 active:translate-y-0"
    >
      <img
        src={post.imageUrl}
        alt={post.caption}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </Button>
  );
}

/* ─── Post detail dialog ─────────────────────────────────────────── */
function PostDialog({
  post,
  canDelete,
  isDeleting,
  onDelete,
  onClose,
}: {
  post: FeedPost | null;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: (postId: string) => Promise<void>;
  onClose: () => void;
}) {
  if (!post) return null;
  return (
    <Dialog open={!!post} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-xl border-0 shadow-2xl">
        <div className="flex flex-col sm:flex-row">
          <div className="aspect-square w-full sm:w-1/2 bg-black shrink-0">
            <img
              src={post.imageUrl}
              alt={post.caption}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col p-5">
            <DialogHeader className="mb-3">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="text-[14px] font-semibold">
                  {post.username}
                </DialogTitle>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-red-600 hover:text-red-600"
                    disabled={isDeleting}
                    onClick={() => void onDelete(post.id)}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                ) : null}
              </div>
            </DialogHeader>
            <p className="text-[13.5px] leading-snug text-zinc-800 flex-1">
              <span className="font-semibold mr-1.5">{post.username}</span>
              {post.caption}
            </p>
            <div className="mt-4 flex items-center gap-4 border-t border-zinc-100 pt-4 text-[13px] text-zinc-500">
              <span>{post.likesCount.toLocaleString()} likes</span>
              <span>{post.commentsCount} comments</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ProfileTab = "posts" | "reels" | "saved" | "tagged";
type SocialListType = "followers" | "following";
type SocialListUser = {
  id: string | number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
};

function ProfileEmptyState({
  icon: Icon,
  title,
  sub,
  activeTab,
  onCreatePost,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
  activeTab: ProfileTab;
  onCreatePost: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-full border-2 border-zinc-300">
        <Icon size={36} strokeWidth={1.25} className="text-zinc-400" />
      </div>
      <p className="text-[22px] font-bold text-zinc-900">{title}</p>
      <p className="mt-2 max-w-[260px] text-[14px] text-zinc-500 leading-snug">
        {sub}
      </p>
      {activeTab === "posts" ? (
        <Button
          type="button"
          variant="link"
          className={profileBtnLinkBlue}
          onClick={onCreatePost}
        >
          Share your first photo
        </Button>
      ) : null}
    </div>
  );
}

function countFollowers(
  followingByUserId: Record<string, string[]>,
  userId: string,
): number {
  let n = 0;
  for (const ids of Object.values(followingByUserId)) {
    if (ids.includes(userId)) n += 1;
  }
  return n;
}

/* ─── Main component ─────────────────────────────────────────────── */
function ProfilePage() {
  const { username: routeUsername } = useParams<{ username?: string }>();
  const authUser = useAppSelector((s) => s.auth.user);
  const usersById = useAppSelector((s) => s.users.usersById);
  const social = useAppSelector((s) => s.social);
  const dispatch = useAppDispatch();
  const authToken = useAppSelector((s) => s.auth.token);

  const profileUser = useMemo(() => {
    if (!routeUsername) return authUser ?? null;
    if (authUser && routeUsername === authUser.username) return authUser;
    const match = Object.values(usersById).find(
      (u) => u.username === routeUsername,
    );
    return match ?? null;
  }, [routeUsername, authUser, usersById]);

  const isOwnProfile = Boolean(
    authUser && profileUser && profileUser.id === authUser.id,
  );

  const userPosts = useAppSelector((s) => {
    if (!profileUser) return [] as FeedPost[];
    return s.posts.feedPostIds
      .map((id) => s.posts.postsById[id])
      .filter(
        (p): p is FeedPost => Boolean(p) && p.authorId === profileUser.id,
      );
  });

  const savedPosts = useAppSelector((s) =>
    s.posts.feedPostIds
      .map((id) => s.posts.postsById[id])
      .filter((p): p is FeedPost => Boolean(p) && p.isSaved),
  );

  const [tab, setTab] = useState<ProfileTab>("posts");
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [activeSocialList, setActiveSocialList] = useState<SocialListType | null>(
    null,
  );
  const [socialListUsers, setSocialListUsers] = useState<SocialListUser[]>([]);
  const [isLoadingSocialList, setIsLoadingSocialList] = useState(false);

  useEffect(() => {
    setTab("posts");
  }, [routeUsername, profileUser?.id]);

  useEffect(() => {
    if (!isOwnProfile && tab === "saved") setTab("posts");
  }, [isOwnProfile, tab]);

  const followStatus = useMemo(() => {
    if (!authUser || !profileUser || isOwnProfile) return "self" as const;
    const following = social.followingByUserId[authUser.id] ?? [];
    if (following.includes(profileUser.id)) return "following" as const;
    const req = Object.values(social.requestsById).find(
      (r) =>
        r.status === "pending" &&
        r.fromUserId === authUser.id &&
        r.toUserId === profileUser.id,
    );
    if (req) return "requested" as const;
    return "none" as const;
  }, [authUser, profileUser, isOwnProfile, social]);

  const stats = useMemo(() => {
    if (!profileUser) {
      return { posts: 0, followers: 0, following: 0 };
    }
    return {
      posts: userPosts.length,
      followers: countFollowers(social.followingByUserId, profileUser.id),
      following: social.followingByUserId[profileUser.id]?.length ?? 0,
    };
  }, [profileUser, userPosts.length, social.followingByUserId]);

  const tabDefs = useMemo(() => {
    const all = [
      { key: "posts" as const, icon: Grid3X3, label: "POSTS" },
      { key: "reels" as const, icon: Play, label: "REELS" },
      { key: "saved" as const, icon: Bookmark, label: "SAVED" },
      { key: "tagged" as const, icon: Tag, label: "TAGGED" },
    ];
    return isOwnProfile ? all : all.filter((t) => t.key === "posts");
  }, [isOwnProfile]);

  if (!authUser && !routeUsername) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-500">
          Please log in to view your profile.
        </p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-[935px] flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold text-zinc-900">User not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          No account matches{" "}
          <span className="font-medium">@{routeUsername ?? ""}</span>.
        </p>
        <Button type="button" variant="link" className="mt-4" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  const gridPosts = tab === "saved" && isOwnProfile ? savedPosts : userPosts;

  function openCreatePostModal() {
    dispatch(setActiveModal("createPost"));
  }

  async function handleDeletePost(postId: string) {
    if (!authToken || isDeletingPost) return;
    setIsDeletingPost(true);
    try {
      await apiRequest(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      dispatch(removePost({ postId }));
      setSelectedPost(null);
    } catch {
      // Keep current UI state when delete fails.
    } finally {
      setIsDeletingPost(false);
    }
  }

  async function handleOpenPost(post: FeedPost) {
    try {
      const response = await apiRequest<{
        data: {
          post: {
            id: string | number;
            authorId: string | number;
            username: string;
            avatarUrl: string | null;
            location: string | null;
            imageUrl: string;
            likesCount: number;
            caption: string;
            commentsCount: number;
            comments: Array<{
              id: string | number;
              parentId: string | number | null;
              username: string;
              avatarUrl: string | null;
              text: string;
            }>;
            isLiked: boolean;
            isSaved: boolean;
          };
        };
      }>(`/api/posts/${post.id}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });

      const fullPost = response.data.post;
      setSelectedPost({
        id: String(fullPost.id),
        authorId: String(fullPost.authorId),
        username: fullPost.username,
        avatarUrl: fullPost.avatarUrl ?? "https://i.pravatar.cc/100?u=fallback",
        location: fullPost.location ?? "",
        imageUrl: fullPost.imageUrl,
        likesCount: fullPost.likesCount,
        caption: fullPost.caption ?? "",
        commentsCount: fullPost.commentsCount,
        comments: (fullPost.comments || []).map((c) => ({
          id: String(c.id),
          parentId: c.parentId ? String(c.parentId) : null,
          username: c.username,
          avatarUrl: c.avatarUrl ?? "https://i.pravatar.cc/100?u=fallback",
          text: c.text,
          postedAtLabel: "JUST NOW",
        })),
        postedAtLabel: "JUST NOW",
        isLiked: fullPost.isLiked,
        isSaved: fullPost.isSaved,
      });
    } catch {
      setSelectedPost(post);
    }
  }

  async function handlePrimaryFollowAction() {
    if (!authUser || !profileUser || isOwnProfile) return;
    if (followStatus === "none") {
      if (!authToken) return;
      try {
        const response = await apiRequest<{
          data: { requestId: string | number; status: string };
        }>(`/api/social/follow/${profileUser.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          sendFollowRequest({
            fromUserId: authUser.id,
            toUserId: profileUser.id,
            requestId: String(response.data.requestId),
          }),
        );
        dispatch(setActiveModal("followRequestSent"));
      } catch {
        if (authToken) {
          try {
            const sync = await apiRequest<{ data: SocialState }>("/api/social/me", {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            dispatch(replaceSocialState(sync.data));
          } catch {
            // keep current state on error
          }
        }
      }
    } else if (followStatus === "requested") {
      if (!authToken) return;
      try {
        await apiRequest(`/api/social/follow/${profileUser.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          cancelFollowRequest({
            fromUserId: authUser.id,
            toUserId: profileUser.id,
          }),
        );
      } catch {
        // keep current state on error
      }
    } else {
      if (!authToken) return;
      try {
        await apiRequest(`/api/social/follow/${profileUser.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          unfollow({ followerId: authUser.id, followingId: profileUser.id }),
        );
      } catch {
        // keep current state on error
      }
    }
  }

  const followButtonLabel =
    followStatus === "following"
      ? "Following"
      : followStatus === "requested"
        ? "Requested"
        : "Follow";

  async function openSocialList(type: SocialListType) {
    if (!profileUser) return;
    setActiveSocialList(type);
    setIsLoadingSocialList(true);
    try {
      const response = await apiRequest<{
        data: {
          followers?: SocialListUser[];
          following?: SocialListUser[];
        };
      }>(`/api/users/${encodeURIComponent(profileUser.username)}/${type}`);
      setSocialListUsers(response.data[type] || []);
    } catch {
      setSocialListUsers([]);
    } finally {
      setIsLoadingSocialList(false);
    }
  }

  return (
    <>
      <style>{`@import url('https://fonts.cdnfonts.com/css/billabong');`}</style>

      <div className="mx-auto w-full max-w-[935px] px-4 md:px-8">
        <div className="flex flex-col gap-6 pb-6 pt-8 sm:flex-row sm:items-start sm:gap-10 md:gap-16">
          <div className="flex justify-center sm:block sm:shrink-0">
            <div
              className="rounded-full p-[3px]"
              style={{ background: IG_GRADIENT }}
            >
              <div className="rounded-full bg-white p-[3px]">
                <Avatar className="size-[86px] sm:size-[150px]">
                  <AvatarImage
                    src={profileUser.avatarUrl ?? undefined}
                    alt={profileUser.username}
                  />
                  <AvatarFallback className="text-xl font-semibold">
                    {profileUser.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                className="text-[22px] font-normal leading-none"
                style={{ color: "black" }}
              >
                {profileUser.username}
              </h2>

              {isOwnProfile ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={profileBtnSecondary}
                    asChild
                  >
                    <Link to="/profile/edit">Edit profile</Link>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={profileBtnSecondary}
                    onClick={() => dispatch(setActiveModal("createPost"))}
                  >
                    <Plus size={15} className="mr-1" />
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Settings"
                    className={profileBtnGhostIcon}
                  >
                    <Settings size={22} strokeWidth={1.75} />
                  </Button>
                </>
              ) : authUser ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={profileBtnSecondary}
                    onClick={() => void handlePrimaryFollowAction()}
                  >
                    {followButtonLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={profileBtnSecondary}
                    asChild
                  >
                    <Link to="/messages">Message</Link>
                  </Button>
                </>
              ) : null}
            </div>

            <div className="hidden sm:flex items-center gap-10">
              {[
                { value: stats.posts, label: "posts" },
                {
                  value: stats.followers.toLocaleString(),
                  label: "followers",
                },
                { value: stats.following, label: "following" },
              ].map(({ value, label }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  className={`${profileBtnGhostRow} justify-center text-center text-zinc-900`}
                  onClick={() => {
                    if (label === "followers") void openSocialList("followers");
                    if (label === "following") void openSocialList("following");
                  }}
                >
                  <span className="text-[15px] font-bold">{value}</span>
                  <span className="ml-1 text-[15px] font-normal">{label}</span>
                </Button>
              ))}
            </div>

            <div className="flex flex-col" style={{ alignItems: "start" }}>
              <p className="text-[14px] font-semibold leading-snug pb-1">
                {profileUser.fullName}
              </p>
              <p className="mt-0.5 text-[14px] leading-snug text-zinc-700">
                ✦ Building cool things with React &amp; TypeScript
              </p>
              {isOwnProfile ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={`${profileBtnGhostRow} mt-0.5 flex items-center gap-0.5 text-[14px] font-semibold text-zinc-900`}
                >
                  more <ChevronDown size={14} />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-around border-y border-zinc-200 py-3 sm:hidden">
          {[
            { value: stats.posts, label: "Posts" },
            { value: stats.followers.toLocaleString(), label: "Followers" },
            { value: stats.following, label: "Following" },
          ].map(({ value, label }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              className="flex h-auto min-h-0 flex-col items-center p-0 hover:bg-transparent"
              onClick={() => {
                if (label === "Followers") void openSocialList("followers");
                if (label === "Following") void openSocialList("following");
              }}
            >
              <span className="text-[15px] font-bold leading-snug">
                {value}
              </span>
              <span className="text-[12px] text-zinc-500">{label}</span>
            </Button>
          ))}
        </div>

        {isOwnProfile ? (
          <div
            className="flex gap-5 overflow-x-auto py-5"
            style={{ scrollbarWidth: "none" }}
          >
            <Button
              type="button"
              variant="ghost"
              className={profileBtnHighlight}
            >
              <div className="flex size-[77px] items-center justify-center rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 text-2xl">
                <Plus size={24} strokeWidth={1.5} className="text-zinc-500" />
              </div>
              <span className="text-[12px] text-zinc-600">New</span>
            </Button>

            {HIGHLIGHTS.map((h) => (
              <Button
                key={h.id}
                type="button"
                variant="ghost"
                className={profileBtnHighlight}
              >
                <div className="flex size-[77px] items-center justify-center rounded-full bg-zinc-100 text-[28px] ring-1 ring-zinc-200">
                  {h.emoji}
                </div>
                <span className="text-[12px] text-zinc-700">{h.label}</span>
              </Button>
            ))}
          </div>
        ) : null}

        <div className="border-t border-zinc-200">
          <div className="flex justify-center gap-0">
            {tabDefs.map(({ key, icon: Icon, label }) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => setTab(key)}
                className={`${profileBtnGhostTab} -mt-px flex items-center gap-1.5 border-t ${
                  tab === key
                    ? "border-zinc-900 text-zinc-900 hover:text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-400"
                }`}
              >
                <Icon size={13} strokeWidth={2} />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          <div className="mt-0.5">
            {tab === "tagged" ? (
              <ProfileEmptyState
                icon={Tag}
                title="Photos of you"
                sub="When people tag you in photos, they'll appear here."
                activeTab={tab}
                onCreatePost={openCreatePostModal}
              />
            ) : tab === "reels" ? (
              <ProfileEmptyState
                icon={Play}
                title="No reels yet"
                sub="Reels you create will appear here."
                activeTab={tab}
                onCreatePost={openCreatePostModal}
              />
            ) : gridPosts.length === 0 ? (
              <ProfileEmptyState
                icon={Grid3X3}
                title={
                  tab === "saved" ? "Save photos and videos" : "Share photos"
                }
                sub={
                  tab === "saved"
                    ? "Save photos and videos that you want to see again."
                    : "When you share photos, they'll appear on your profile."
                }
                activeTab={tab}
                onCreatePost={openCreatePostModal}
              />
            ) : (
              <div className="grid grid-cols-3 gap-[3px]">
                {gridPosts.map((post) => (
                  <PostThumb
                    key={post.id}
                    post={post}
                    onClick={() => void handleOpenPost(post)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="h-16 md:h-6" />
      </div>

      <PostDialog
        post={selectedPost}
        canDelete={isOwnProfile}
        isDeleting={isDeletingPost}
        onDelete={handleDeletePost}
        onClose={() => setSelectedPost(null)}
      />

      <Dialog
        open={activeSocialList !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSocialList(null);
            setSocialListUsers([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "black" }}>
              {activeSocialList === "followers" ? "Followers" : "Following"}
            </DialogTitle>
          </DialogHeader>

          {isLoadingSocialList ? (
            <p className="py-6 text-center text-sm text-zinc-500">Loading...</p>
          ) : socialListUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No users found.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {socialListUsers.map((u) => (
                <Link
                  key={String(u.id)}
                  to={`/profile/${encodeURIComponent(u.username)}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-zinc-50"
                  onClick={() => setActiveSocialList(null)}
                >
                  <Avatar className="size-9">
                    <AvatarImage src={u.avatarUrl ?? undefined} alt={u.username} />
                    <AvatarFallback className="text-xs">
                      {u.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {u.username}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{u.fullName}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProfilePage;
