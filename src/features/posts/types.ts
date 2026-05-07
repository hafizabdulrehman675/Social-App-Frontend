export type Story = {
  id: string;
  username: string;
  avatarUrl: string;
};

export type PostComment = {
  id: string;
  parentId: string | null;
  authorId?: string;
  username: string;
  avatarUrl: string;
  text: string;
  postedAtLabel: string;
};

export type FeedPost = {
  id: string;
  /** Author user id (matches `users.usersById`) */
  authorId: string;
  username: string;
  location: string;
  avatarUrl: string;
  imageUrl: string;
  likesCount: number;
  caption: string;
  commentsCount: number;
  comments: PostComment[];
  postedAtLabel: string;
  isLiked: boolean;
  isSaved: boolean;
};
