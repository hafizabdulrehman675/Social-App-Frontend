import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { FeedPost, PostComment } from "@/features/posts/types";

type PostsState = {
  postsById: Record<string, FeedPost>;
  feedPostIds: string[];
};

function normalizePosts(posts: FeedPost[]): PostsState {
  const postsById: Record<string, FeedPost> = {};
  const feedPostIds: string[] = [];

  for (const post of posts) {
    postsById[post.id] = post;
    feedPostIds.push(post.id);
  }

  return { postsById, feedPostIds };
}

const p1Comments: PostComment[] = [
  {
    id: "p1c1",
    parentId: null,
    username: "emma_w",
    avatarUrl: "https://i.pravatar.cc/100?u=emma",
    text: "This is unreal — where was this taken?",
    postedAtLabel: "2h",
  },
  {
    id: "p1c2",
    parentId: "p1c1",
    username: "john_doe",
    avatarUrl: "https://i.pravatar.cc/100?img=5",
    text: "Clifton beach, right before sunset.",
    postedAtLabel: "1h",
  },
];

const initialPosts: FeedPost[] = [
  {
    id: "p1",
    authorId: "u2",
    username: "second_user",
    location: "Karachi, PK",
    avatarUrl: "https://i.pravatar.cc/100?u=second",
    imageUrl: "https://picsum.photos/700?random=1",
    likesCount: 1284,
    caption: "Golden hour never misses.",
    commentsCount: p1Comments.length,
    comments: p1Comments,
    postedAtLabel: "2 HOURS AGO",
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p2",
    authorId: "u1",
    username: "demo_user",
    location: "Studio",
    avatarUrl: "https://i.pravatar.cc/100?u=demo",
    imageUrl: "https://picsum.photos/700?random=2",
    likesCount: 42,
    caption: "Shipping features on a Sunday.",
    commentsCount: 0,
    comments: [],
    postedAtLabel: "1 DAY AGO",
    isLiked: false,
    isSaved: false,
  },
];

const initialState: PostsState = normalizePosts(initialPosts);

const postsSlice = createSlice({
  name: "posts",
  initialState,
  reducers: {
    replaceFeedPosts(state, action: PayloadAction<FeedPost[]>) {
      const normalized = normalizePosts(action.payload);
      state.postsById = normalized.postsById;
      state.feedPostIds = normalized.feedPostIds;
    },
    addPost(state, action: PayloadAction<FeedPost>) {
      const post = action.payload;
      state.postsById[post.id] = post;
      state.feedPostIds.unshift(post.id);
    },
    removePost(state, action: PayloadAction<{ postId: string }>) {
      const { postId } = action.payload;
      delete state.postsById[postId];
      state.feedPostIds = state.feedPostIds.filter((id) => id !== postId);
    },
    updatePostInteraction(
      state,
      action: PayloadAction<{
        postId: string;
        likesCount?: number;
        isLiked?: boolean;
        isSaved?: boolean;
      }>,
    ) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;
      if (typeof action.payload.likesCount === "number") {
        post.likesCount = action.payload.likesCount;
      }
      if (typeof action.payload.isLiked === "boolean") {
        post.isLiked = action.payload.isLiked;
      }
      if (typeof action.payload.isSaved === "boolean") {
        post.isSaved = action.payload.isSaved;
      }
    },
    toggleLike(state, action: PayloadAction<{ postId: string }>) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;
      post.isLiked = !post.isLiked;
      post.likesCount += post.isLiked ? 1 : -1;
    },
    toggleSave(state, action: PayloadAction<{ postId: string }>) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;
      post.isSaved = !post.isSaved;
    },
    addComment(
      state,
      action: PayloadAction<{
        postId: string;
        text: string;
        parentId: string | null;
        authorId?: string;
        username: string;
        avatarUrl: string;
      }>,
    ) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;
      const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      post.comments.push({
        id,
        parentId: action.payload.parentId,
        authorId: action.payload.authorId,
        username: action.payload.username,
        avatarUrl: action.payload.avatarUrl,
        text: action.payload.text.trim(),
        postedAtLabel: "JUST NOW",
      });
      post.commentsCount = post.comments.length;
    },
    addCommentFromServer(
      state,
      action: PayloadAction<{
        postId: string;
        id: string;
        text: string;
        parentId: string | null;
        authorId?: string;
        username: string;
        avatarUrl: string | null;
        postedAtLabel?: string;
      }>,
    ) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;
      post.comments.push({
        id: action.payload.id,
        text: action.payload.text,
        parentId: action.payload.parentId,
        authorId: action.payload.authorId,
        username: action.payload.username,
        avatarUrl:
          action.payload.avatarUrl ?? "https://i.pravatar.cc/100?u=fallback",
        postedAtLabel: action.payload.postedAtLabel ?? "JUST NOW",
      });
      post.commentsCount = post.comments.length;
    },
    setPostComments(
      state,
      action: PayloadAction<{ postId: string; comments: PostComment[] }>,
    ) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;
      post.comments = action.payload.comments;
      post.commentsCount = action.payload.comments.length;
    },
    removeComment(
      state,
      action: PayloadAction<{ postId: string; commentId: string }>,
    ) {
      const post = state.postsById[action.payload.postId];
      if (!post) return;

      const toDelete = new Set<string>([action.payload.commentId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const comment of post.comments) {
          if (comment.parentId && toDelete.has(comment.parentId) && !toDelete.has(comment.id)) {
            toDelete.add(comment.id);
            changed = true;
          }
        }
      }

      post.comments = post.comments.filter((comment) => !toDelete.has(comment.id));
      post.commentsCount = post.comments.length;
    },
    syncPostAuthorUsername(
      state,
      action: PayloadAction<{
        userId?: string;
        fromUsername?: string;
        toUsername: string;
        avatarUrl?: string;
      }>,
    ) {
      const { userId, fromUsername, toUsername, avatarUrl } = action.payload;
      for (const id of state.feedPostIds) {
        const p = state.postsById[id];
        if (!p) continue;
        const byUserId = userId !== undefined && p.authorId === userId;
        const byUsername =
          !userId &&
          fromUsername !== undefined &&
          p.username === fromUsername;
        if (!byUserId && !byUsername) continue;
        p.username = toUsername;
        if (avatarUrl !== undefined) p.avatarUrl = avatarUrl;
      }
    },
  },
});

export const {
  replaceFeedPosts,
  addPost,
  removePost,
  updatePostInteraction,
  toggleLike,
  toggleSave,
  addComment,
  addCommentFromServer,
  setPostComments,
  removeComment,
  syncPostAuthorUsername,
} = postsSlice.actions;
export default postsSlice.reducer;
