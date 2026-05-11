import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

import { apiRequest } from "@/lib/api";
import { avatarFallbackText } from "@/lib/avatarText";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useAppSelector } from "@/app/hooks";
import type { FeedPost } from "@/features/posts/types";
import type { UserRecord } from "@/features/users/types";

function ExplorePage() {
  const [query, setQuery] = useState<string>("");
  const [searchUsers, setSearchUsers] = useState<UserRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const authToken = useAppSelector((s) => s.auth.token);

  const posts = useAppSelector((state) =>
    state.posts.feedPostIds
      .map((id) => state.posts.postsById[id])
      .filter((post): post is FeedPost => Boolean(post)),
  );

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;

    return posts.filter(
      (post) =>
        post.username.toLowerCase().includes(q) ||
        post.caption.toLowerCase().includes(q) ||
        post.location.toLowerCase().includes(q),
    );
  }, [posts, query]);

  useEffect(() => {
    const q = query.trim();
    if (!q || !authToken) {
      setSearchUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await apiRequest<{
          data: {
            users: Array<{
              id: string | number;
              username: string;
              fullName: string;
              avatarUrl: string | null;
              bio?: string | null;
            }>;
          };
        }>(`/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        setSearchUsers(
          response.data.users.map((u) => ({
            id: String(u.id),
            username: u.username,
            fullName: u.fullName,
            email: "",
            avatarUrl: u.avatarUrl ?? null,
          })),
        );
      } catch {
        setSearchUsers([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, authToken]);

  return (
    <div className="mx-auto w-full max-w-[630px] space-y-4 px-1 py-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts, users, places"
          className="pl-9"
        />
      </div>

      {query.trim() ? (
        <div className="space-y-2">
          {isSearching ? (
            <div className="rounded-md border border-zinc-200 bg-white p-6 text-center">
              <p className="text-sm text-zinc-500">Searching users...</p>
            </div>
          ) : searchUsers.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-white p-6 text-center">
              <p className="text-sm font-semibold text-zinc-900">
                No users found
              </p>
            </div>
          ) : (
            searchUsers.map((user) => (
              <Link
                key={user.id}
                to={`/profile/${encodeURIComponent(user.username)}`}
                className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-3 hover:bg-zinc-50"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage
                    src={user.avatarUrl ?? undefined}
                    alt={user.username}
                  />
                  <AvatarFallback className="text-xs">
                    {avatarFallbackText(user.fullName || user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-semibold text-zinc-900">
                    {user.username}
                  </p>
                  <p className="text-xs text-zinc-500">{user.fullName}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-md border border-zinc-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-zinc-900">
            No results found
          </p>
          <p className="mt-1 text-sm text-zinc-500">Try a different keyword.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="aspect-square overflow-hidden bg-zinc-100"
            >
              <img
                src={post.imageUrl}
                alt={post.caption}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExplorePage;
