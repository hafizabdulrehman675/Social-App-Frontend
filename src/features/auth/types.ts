export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  bio?: string | null;
};

export type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
};
