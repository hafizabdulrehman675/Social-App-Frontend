export type Story = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type PostComment = {
  id: string;
  parentId: string | null;
  authorId?: string;
  username: string;
  avatarUrl: string | null;
  text: string;
  postedAtLabel: string;
};

export type FeedPost = {
  id: string;
  /** Author user id (matches `users.usersById`) */
  authorId: string;
  username: string;
  location: string;
  avatarUrl: string | null;
  imageUrl: string;
  likesCount: number;
  caption: string;
  commentsCount: number;
  comments: PostComment[];
  postedAtLabel: string;
  isLiked: boolean;
  isSaved: boolean;
};
