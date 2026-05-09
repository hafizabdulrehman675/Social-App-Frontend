export type User = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  /** From API when present; edit via profile settings when UI exists */
  bio?: string | null;
};

export type UserRecord = User & {
  // FRONTEND-ONLY DEMO: storing passwords locally is insecure for real apps.
  // For learning + static demo it allows realistic login/signup flow.
  password?: string;
};

export type UsersState = {
  usersById: Record<string, UserRecord>;
  allUserIds: string[];
};
