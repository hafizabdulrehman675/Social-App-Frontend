import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Smile,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  addCommentFromServer,
  removePost,
  removeComment,
  replaceFeedPosts,
  setPostComments,
  updatePostInteraction,
} from "@/features/posts/redux/postsSlice";
import type { FeedPost, PostComment, Story } from "@/features/posts/types";

// Keeps `Send` referenced while Share `<Button>...</Send>` block stays commented below (TS noUnusedLocals).
function __preserveFeedLucideIconsForLater(): void {
  void Send;
}
void __preserveFeedLucideIconsForLater;

const STORIES: ReadonlyArray<Story> = [
  { id: "s1", username: "you", avatarUrl: "https://i.pravatar.cc/100?u=you" },
  { id: "s2", username: "john", avatarUrl: "https://i.pravatar.cc/100?u=john" },
  { id: "s3", username: "emma", avatarUrl: "https://i.pravatar.cc/100?u=emma" },
  { id: "s4", username: "zain", avatarUrl: "https://i.pravatar.cc/100?u=zain" },
  { id: "s5", username: "alex", avatarUrl: "https://i.pravatar.cc/100?u=alex" },
  { id: "s6", username: "sara", avatarUrl: "https://i.pravatar.cc/100?u=sara" },
  { id: "s7", username: "mike", avatarUrl: "https://i.pravatar.cc/100?u=mike" },
];

// ── Instagram gradient ─────────────────────────────────────────────────────
const IG_GRADIENT =
  "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";

type BackendPost = {
  id: string | number;
  authorId: string | number;
  username: string;
  avatarUrl: string | null;
  location: string | null;
  imageUrl: string;
  likesCount: number;
  caption: string;
  commentsCount: number;
  createdAt?: string;
  comments: Array<{
    id: string | number;
    parentId: string | number | null;
    createdAt?: string;
    username: string;
    avatarUrl: string | null;
    text: string;
  }>;
  isLiked: boolean;
  isSaved: boolean;
};

function formatRelativeTime(input?: string): string {
  if (!input) return "just now";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return "just now";
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function mapBackendPostToFeedPost(post: BackendPost): FeedPost {
  return {
    id: String(post.id),
    authorId: String(post.authorId),
    username: post.username,
    avatarUrl: post.avatarUrl ?? "https://i.pravatar.cc/100?u=fallback",
    location: post.location ?? "",
    imageUrl: post.imageUrl,
    likesCount: post.likesCount,
    caption: post.caption,
    commentsCount: post.commentsCount,
    comments: (post.comments || []).map((c) => ({
      id: String(c.id),
      parentId: c.parentId ? String(c.parentId) : null,
      username: c.username,
      avatarUrl: c.avatarUrl ?? "https://i.pravatar.cc/100?u=fallback",
      text: c.text,
      postedAtLabel: formatRelativeTime(c.createdAt),
    })),
    postedAtLabel: formatRelativeTime(post.createdAt),
    isLiked: post.isLiked,
    isSaved: post.isSaved,
  };
}

type BackendComment = {
  id: string | number;
  text: string;
  parentId?: string | number | null;
  authorId?: string | number;
  createdAt?: string;
  username: string;
  avatarUrl: string | null;
};

// ── Story ring wrapper ─────────────────────────────────────────────────────
function StoryRing({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className="size-full rounded-full p-[2.5px]"
      style={{ background: active ? IG_GRADIENT : "#e5e7eb" }}
    >
      <div className="size-full rounded-full bg-white p-[2.5px]">
        {children}
      </div>
    </div>
  );
}

// ── Stories bar ────────────────────────────────────────────────────────────
function StoriesBar({ stories }: { stories: ReadonlyArray<Story> }) {
  return (
    <section className="border-b border-zinc-200 bg-white px-1 py-4 md:px-1">
      <div
        className="flex gap-4 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {stories.map((story, i) => (
          <Button
            key={story.id}
            type="button"
            variant="ghost"
            className="h-auto min-h-0 w-auto shrink-0 cursor-pointer flex-col gap-3 rounded-xl p-0 font-normal hover:bg-transparent flex-1"
          >
            <div className="relative size-16">
              {i === 0 ? (
                <>
                  <div className="size-full overflow-hidden rounded-full ring-1 ring-zinc-200 ring-inset">
                    <Avatar className="size-full">
                      <AvatarImage src={story.avatarUrl} alt={story.username} />
                      <AvatarFallback className="text-sm">
                        {story.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex size-5.5 items-center justify-center rounded-full bg-[#0095f6] text-white shadow-[0_1px_4px_rgba(0,0,0,0.25)] ring-[2.5px] ring-white"
                    aria-hidden
                  >
                    <Plus
                      className="size-3.5 stroke-[2.75]"
                      strokeLinecap="round"
                    />
                  </span>
                </>
              ) : (
                <StoryRing>
                  <Avatar className="size-full">
                    <AvatarImage src={story.avatarUrl} alt={story.username} />
                    <AvatarFallback className="text-sm">
                      {story.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </StoryRing>
              )}
            </div>
            <p className="max-w-16 truncate text-[14px] font-normal text-zinc-700">
              {i === 0 ? "Your story" : story.username}
            </p>
          </Button>
        ))}
      </div>
    </section>
  );
}

// ── Comment thread (nested replies; ShadCN has no List — use Card + roles) ─
function CommentTree({
  comments,
  parentId,
  depth,
  onReply,
  onDelete,
  canDelete,
  deletingCommentIds,
}: {
  comments: PostComment[];
  parentId: string | null;
  depth: number;
  onReply: (c: PostComment) => void;
  onDelete: (c: PostComment) => void;
  canDelete: (c: PostComment) => boolean;
  deletingCommentIds: Record<string, boolean>;
}) {
  const nodes = comments.filter((c) => c.parentId === parentId);
  if (nodes.length === 0) return null;

  return (
    <div
      role="list"
      className={
        depth === 0
          ? "flex w-full flex-col gap-0 text-left"
          : "mt-2 flex w-full flex-col gap-2 border-l border-zinc-200 pl-3 text-left dark:border-zinc-700"
      }
    >
      {nodes.map((c, index) => (
        <div key={c.id} role="listitem" className="w-full text-left">
          <div className="flex w-full items-start gap-3 text-left">
            <Avatar className="mt-0.5 size-8 shrink-0">
              <AvatarImage src={c.avatarUrl} alt="" />
              <AvatarFallback className="text-[10px]">
                {c.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-left text-[13.5px] leading-snug text-zinc-900">
                <span className="font-semibold">{c.username}</span>{" "}
                <span className="font-normal text-zinc-800">{c.text}</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-left text-[11px] text-zinc-400">
                <span>{c.postedAtLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-0 cursor-pointer p-0 font-normal text-[11px] text-zinc-500 hover:bg-transparent hover:text-zinc-500 dark:hover:bg-transparent"
                  onClick={() => onReply(c)}
                >
                  Reply
                </Button>
                {canDelete(c) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-0 cursor-pointer p-0 font-semibold text-[11px] text-red-600 hover:bg-transparent hover:text-red-700 dark:hover:bg-transparent"
                    disabled={Boolean(deletingCommentIds[c.id])}
                    onClick={() => onDelete(c)}
                  >
                    {deletingCommentIds[c.id] ? (
                      <>
                        <span className="mr-1 inline-block size-2.5 animate-spin rounded-full border border-red-300 border-t-red-600" />
                        <span className="text-red-700">Deleting...</span>
                      </>
                    ) : (
                      "Delete"
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <CommentTree
            comments={comments}
            parentId={c.id}
            depth={depth + 1}
            onReply={onReply}
            onDelete={onDelete}
            canDelete={canDelete}
            deletingCommentIds={deletingCommentIds}
          />
          {depth === 0 && index < nodes.length - 1 ? (
            <Separator className="my-4 bg-zinc-200 dark:bg-zinc-800" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────
type PostCardProps = {
  post: FeedPost;
  onToggleLike: (postId: string) => Promise<void>;
  onToggleSave: (postId: string) => Promise<void>;
  onLoadComments: (postId: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  isDeletingPost: boolean;
};

function PostCard({
  post,
  onToggleLike,
  onToggleSave,
  onLoadComments,
  onDeletePost,
  isDeletingPost,
}: PostCardProps) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);
  const [commentInput, setCommentInput] = useState<string>("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [deletingCommentIds, setDeletingCommentIds] = useState<
    Record<string, boolean>
  >({});
  const optionsRef = useRef<HTMLDivElement | null>(null);

  const comments = post.comments ?? [];
  const hasComments = comments.length > 0;
  const isPostOwner = Boolean(
    authUser &&
    (String(authUser.id) === String(post.authorId) ||
      authUser.username === post.username),
  );

  useEffect(() => {
    setIsImageLoaded(false);
    setHasImageError(false);
  }, [post.imageUrl]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!isOptionsOpen) return;
      const target = event.target as Node | null;
      if (
        optionsRef.current &&
        target &&
        !optionsRef.current.contains(target)
      ) {
        setIsOptionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOptionsOpen]);

  function handleDoubleTap() {
    if (!post.isLiked) {
      void onToggleLike(post.id);
    }
  }

  async function handlePostComment() {
    const text = commentInput.trim();
    if (!text || !authToken || isPostingComment) return;
    setIsPostingComment(true);

    try {
      const response = await apiRequest<{
        data: {
          comment: {
            id: string | number;
            text: string;
            parentId: string | number | null;
            authorId: string | number;
            createdAt?: string;
            username: string;
            avatarUrl: string | null;
          };
        };
      }>(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          text,
          parentId: replyTo?.id ?? null,
        }),
      });

      dispatch(
        addCommentFromServer({
          postId: post.id,
          id: String(response.data.comment.id),
          text: response.data.comment.text,
          parentId: response.data.comment.parentId
            ? String(response.data.comment.parentId)
            : null,
          authorId: String(response.data.comment.authorId),
          username: response.data.comment.username,
          avatarUrl: response.data.comment.avatarUrl ?? null,
        }),
      );
    } catch {
      return;
    } finally {
      setIsPostingComment(false);
    }

    setCommentInput("");
    setReplyTo(null);
    setCommentsVisible(true);
  }

  async function toggleCommentsPanel() {
    const nextVisible = !commentsVisible;
    setCommentsVisible(nextVisible);
    if (nextVisible) {
      await onLoadComments(post.id);
    }
  }

  async function handleDeleteComment(comment: PostComment) {
    if (!authToken) return;
    if (deletingCommentIds[comment.id]) return;
    setDeletingCommentIds((prev) => ({ ...prev, [comment.id]: true }));
    try {
      await apiRequest(`/api/posts/${post.id}/comments/${comment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      dispatch(removeComment({ postId: post.id, commentId: comment.id }));
    } catch {
      // Keep current comments if delete fails.
    } finally {
      setDeletingCommentIds((prev) => {
        const next = { ...prev };
        delete next[comment.id];
        return next;
      });
    }
  }

  return (
    <article className="border-b border-zinc-200 bg-white text-left">
      {/* ── Post header ── */}
      <div className="flex items-center justify-between px-4 py-3 md:px-3">
        <div className="flex items-center gap-2.5">
          {/* Story-ring avatar */}
          <div className="relative">
            <StoryRing>
              <Avatar className="size-9">
                <AvatarImage src={post.avatarUrl} alt={post.username} />
                <AvatarFallback className="text-[10px]">
                  {post.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </StoryRing>
          </div>

          <div className="flex flex-col justify-start">
            <Link
              to={`/profile/${encodeURIComponent(post.username)}`}
              className="text-[17px] font-semibold leading-tight cursor-pointer pb-[6px] hover:underline"
            >
              {post.username}
            </Link>
            {post.location && (
              <p
                className="text-[12px] leading-tight text-zinc-500 al"
                style={{ textAlign: "start" }}
              >
                {post.location}
              </p>
            )}
          </div>
        </div>

        {isPostOwner ? (
          <div ref={optionsRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Post options"
              className="cursor-pointer rounded-full text-zinc-700 hover:bg-transparent"
              onClick={() => setIsOptionsOpen((prev) => !prev)}
            >
              <MoreHorizontal className="size-5" strokeWidth={1.8} />
            </Button>
            {isOptionsOpen ? (
              <div className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-zinc-200/80 bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-full cursor-pointer justify-start rounded-lg px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                  onClick={() => void onDeletePost(post.id)}
                  disabled={isDeletingPost}
                >
                  {isDeletingPost ? (
                    <>
                      <span className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                      <span className="text-red-800">Deleting...</span>
                    </>
                  ) : (
                    "Delete Post"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Post image (responsive + double-tap) ── */}
      <div
        className="relative w-full overflow-hidden"
        onDoubleClick={handleDoubleTap}
      >
        {/* Caption */}
        <p className="text-left leading-snug p-2 pt-1">
          <span className="text-[18px] text-zinc-900">{post.caption}</span>
        </p>
        {!isImageLoaded && !hasImageError ? (
          <div
            className="h-[400px] w-full"
            style={{
              background:
                "linear-gradient(110deg, #e5e7eb 8%, #f3f4f6 18%, #e5e7eb 33%)",
              backgroundSize: "200% 100%",
              animation: "feedShimmer 1.2s linear infinite",
            }}
          />
        ) : null}
        {hasImageError ? (
          <div className="flex h-[400px] w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            Failed to load image
          </div>
        ) : null}
        <img
          src={post.imageUrl}
          alt={post.caption}
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          onError={() => setHasImageError(true)}
          className={`max-h-[400px] w-full object-fill select-none transition-opacity duration-300 ${
            isImageLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
          }`}
          draggable={false}
        />
      </div>

      {/* ── Actions ── */}
      <div className="px-4 pb-1 pt-3 md:px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Like */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void onToggleLike(post.id)}
              aria-label={post.isLiked ? "Unlike" : "Like"}
              className="h-auto min-h-0 w-auto cursor-pointer rounded-full bg-transparent p-0.5 text-inherit hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent dark:hover:bg-transparent active:translate-y-0"
            >
              <Heart
                className={
                  post.isLiked
                    ? "size-7 fill-red-500 stroke-red-500"
                    : "size-7 stroke-zinc-900"
                }
                strokeWidth={1.8}
              />
            </Button>

            {/* Comment — toggles comments list */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void toggleCommentsPanel()}
              aria-expanded={hasComments ? commentsVisible : undefined}
              aria-label={
                hasComments
                  ? commentsVisible
                    ? "Hide comments"
                    : `Show comments, ${comments.length} total`
                  : "Comment"
              }
              className="h-auto min-h-0 w-auto cursor-pointer rounded-full bg-transparent p-0.5 text-inherit hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent dark:hover:bg-transparent active:translate-y-0"
            >
              <MessageCircle className={"size-7"} strokeWidth={1.8} />
            </Button>

            {/* Share */}
            {/* <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Share"
              className="h-auto min-h-0 w-auto cursor-pointer rounded-full bg-transparent p-0.5 text-inherit hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent dark:hover:bg-transparent active:translate-y-0"
            >
              <Send
                className="size-6.5 -rotate-12 stroke-zinc-900 mt-1"
                strokeWidth={1.8}
              />
            </Button> */}
          </div>

          {/* Save */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void onToggleSave(post.id)}
            aria-label={post.isSaved ? "Unsave" : "Save"}
            className="h-auto min-h-0 w-auto cursor-pointer rounded-full bg-transparent p-0.5 text-inherit hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent dark:hover:bg-transparent active:translate-y-0"
          >
            <Bookmark
              className={
                post.isSaved
                  ? "size-6.5 fill-zinc-900 stroke-zinc-900"
                  : "size-6.5 stroke-zinc-900"
              }
              strokeWidth={1.8}
            />
          </Button>
        </div>

        {/* Likes count */}
        <p className="mt-2 text-left text-[13.5px] font-semibold">
          {post.likesCount.toLocaleString()} likes
        </p>

        {/* Comments — ShadCN Card (no List primitive in shadcn/ui) */}
        {hasComments && commentsVisible ? (
          <Card
            size="sm"
            className="mt-3 w-full max-w-full text-left shadow-none ring-1 ring-zinc-200/90 bg-zinc-50/40 py-3 dark:bg-zinc-950/30 dark:ring-zinc-800"
          >
            <CardHeader className="px-4 pb-2 pt-0">
              <CardTitle className="text-left text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pt-0">
              <CommentTree
                comments={comments}
                parentId={null}
                depth={0}
                onReply={setReplyTo}
                onDelete={(comment) => void handleDeleteComment(comment)}
                canDelete={(comment) =>
                  Boolean(
                    authUser &&
                    (comment.authorId
                      ? comment.authorId === authUser.id
                      : comment.username === authUser.username),
                  )
                }
                deletingCommentIds={deletingCommentIds}
              />
            </CardContent>
          </Card>
        ) : null}

        {/* Add comment */}
        <div className="mt-2 border-t border-zinc-100 pt-2.5 text-left">
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between gap-2 text-left text-[12px] text-zinc-500">
              <span>
                Replying to{" "}
                <span className="font-semibold text-zinc-700">
                  {replyTo.username}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-0 cursor-pointer p-0 text-[12px] font-normal text-zinc-500 hover:bg-transparent hover:text-zinc-500 dark:hover:bg-transparent"
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </Button>
            </div>
          ) : null}
          <div className="flex min-h-10 items-center gap-1 rounded-full border border-zinc-200/90 bg-white px-1 pl-3 dark:border-zinc-800 dark:bg-zinc-950">
            <Input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePostComment();
              }}
              placeholder={
                replyTo ? `Reply to ${replyTo.username}…` : "Add a comment…"
              }
              aria-label="Write a comment"
              className="h-9 min-h-0 flex-1 border-0 bg-transparent px-0 py-2 text-[13.5px] text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 md:text-[13.5px] dark:bg-transparent"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Emoji"
              className="size-8 shrink-0 cursor-pointer rounded-full text-zinc-400 hover:bg-transparent hover:text-zinc-400 dark:hover:bg-transparent"
            >
              <Smile className="size-4.5" strokeWidth={1.8} />
            </Button>
            {commentInput.trim() ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handlePostComment}
                disabled={isPostingComment}
                className="h-8 shrink-0 cursor-pointer rounded-full px-3 text-[13px] font-semibold text-sky-600 hover:bg-transparent hover:text-sky-700 disabled:opacity-100 dark:hover:bg-transparent"
              >
                {isPostingComment ? (
                  <>
                    <span className="mr-1 inline-block size-3 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                    <span className="text-sky-700">Posting...</span>
                  </>
                ) : (
                  "Post"
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Timestamp */}
        <p className="mt-1 pb-3 text-left text-[11px] uppercase tracking-wide text-zinc-400">
          {post.postedAtLabel}
        </p>
      </div>
    </article>
  );
}

// ── Feed page ──────────────────────────────────────────────────────────────
function FeedPage() {
  const dispatch = useAppDispatch();
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const allPosts = useAppSelector((state) =>
    state.posts.feedPostIds
      .map((id) => state.posts.postsById[id])
      .filter((post): post is FeedPost => Boolean(post)),
  );

  const authToken = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    async function loadFeed() {
      if (!authToken) return;
      setIsLoadingFeed(true);
      try {
        const response = await apiRequest<{ data: { posts: BackendPost[] } }>(
          "/api/posts/feed",
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );
        dispatch(
          replaceFeedPosts(
            (response.data.posts || []).map(mapBackendPostToFeedPost),
          ),
        );
      } catch {
        // Keep current state if feed request fails.
      } finally {
        setIsLoadingFeed(false);
      }
    }

    loadFeed();
  }, [authToken, dispatch]);

  const posts = useMemo(() => {
    return allPosts;
  }, [allPosts]);

  async function handleToggleLike(postId: string) {
    if (!authToken) return;
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.isLiked) {
        const response = await apiRequest<{
          data: { likesCount: number; isLiked: boolean };
        }>(`/api/posts/${postId}/like`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          updatePostInteraction({
            postId,
            likesCount: response.data.likesCount,
            isLiked: response.data.isLiked,
          }),
        );
      } else {
        const response = await apiRequest<{
          data: { likesCount: number; isLiked: boolean };
        }>(`/api/posts/${postId}/like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          updatePostInteraction({
            postId,
            likesCount: response.data.likesCount,
            isLiked: response.data.isLiked,
          }),
        );
      }
    } catch {
      // Ignore transient failure; UI stays consistent with store.
    }
  }

  async function handleToggleSave(postId: string) {
    if (!authToken) return;
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.isSaved) {
        const response = await apiRequest<{
          data: { isSaved: boolean };
        }>(`/api/posts/${postId}/save`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          updatePostInteraction({ postId, isSaved: response.data.isSaved }),
        );
      } else {
        const response = await apiRequest<{
          data: { isSaved: boolean };
        }>(`/api/posts/${postId}/save`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        dispatch(
          updatePostInteraction({ postId, isSaved: response.data.isSaved }),
        );
      }
    } catch {
      // Ignore transient failure; UI stays consistent with store.
    }
  }

  async function handleLoadComments(postId: string) {
    try {
      const commentsResponse = await apiRequest<{
        data: { comments: BackendComment[] };
      }>(`/api/posts/${postId}/comments`);

      const topLevel = commentsResponse.data.comments || [];
      const repliesResults = await Promise.all(
        topLevel.map(async (comment) => {
          try {
            const repliesResponse = await apiRequest<{
              data: { replies: BackendComment[] };
            }>(`/api/posts/${postId}/comments/${comment.id}/replies`);
            return repliesResponse.data.replies || [];
          } catch {
            return [];
          }
        }),
      );

      const merged = [...topLevel, ...repliesResults.flat()].map((c) => ({
        id: String(c.id),
        parentId: c.parentId ? String(c.parentId) : null,
        username: c.username,
        avatarUrl: c.avatarUrl ?? "https://i.pravatar.cc/100?u=fallback",
        text: c.text,
        postedAtLabel: formatRelativeTime(c.createdAt),
        authorId: c.authorId ? String(c.authorId) : undefined,
      }));

      dispatch(setPostComments({ postId, comments: merged }));
    } catch {
      // Keep existing comments state if loading fails.
    }
  }

  async function handleDeletePost(postId: string) {
    if (!authToken || deletingPostId) return;
    setDeletingPostId(postId);
    try {
      await apiRequest(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      dispatch(removePost({ postId }));
    } catch {
      // Keep current posts state if delete fails.
    } finally {
      setDeletingPostId((current) => (current === postId ? null : current));
    }
  }

  return (
    <>
      <style>{`
        @keyframes feedShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      {/* Heart burst animation */}
      {/* <style>{`
        @keyframes heartPop {
          0%   { opacity: 0;   transform: scale(0.4); }
          30%  { opacity: 1;   transform: scale(1.15); }
          60%  { opacity: 1;   transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.05); }
        }
      `}</style> */}

      <div
        // className="w-full max-w-[470px] mx-auto"
        className="mx-auto w-full text-left"
      >
        {/* Stories */}
        <StoriesBar stories={STORIES} />

        {/* Posts */}
        <div>
          {posts.length === 0 ? (
            isLoadingFeed ? null : (
              <div className="flex flex-col items-center justify-center py-24 text-center px-6">
                <div
                  className="mb-5 flex size-20 items-center justify-center rounded-full"
                  style={{ background: IG_GRADIENT }}
                >
                  <Heart size={36} className="fill-white stroke-none" />
                </div>
                <p className="text-xl font-semibold text-zinc-900">
                  No posts yet
                </p>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Follow people to see their photos and videos here.
                </p>
              </div>
            )
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onToggleLike={handleToggleLike}
                onToggleSave={handleToggleSave}
                onLoadComments={handleLoadComments}
                onDeletePost={handleDeletePost}
                isDeletingPost={deletingPostId === post.id}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default FeedPage;
