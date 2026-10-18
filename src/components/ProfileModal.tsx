"use client";

import { useState } from "react";
import useSWR from "swr";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { api, swrFetcher } from "@/lib/api-client";
import { Avatar, Modal, Spinner } from "@/components/ui/Primitives";
import type { Post, ProfileStats, PublicUser } from "@/types/cliq";
import { cx, formatCount, meshGradient } from "@/lib/utils";

/**
 * Read-only public profile for any user, opened by tapping an avatar or
 * @username anywhere in the app.
 */
export function ProfileModal({
  userId,
  onClose,
  onMessage,
}: {
  userId: string | null;
  onClose: () => void;
  onMessage?: (user: PublicUser) => void;
}) {
  const { user: me, toast, apiError, followingIds, toggleFollow } = useCliq();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useSWR<{ user: PublicUser; stats: ProfileStats }>(
    userId ? [`/api/users/${encodeURIComponent(userId)}`, undefined] : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const { data: videoFeed } = useSWR<{ posts: Post[] }>(userId ? [`/api/posts?type=video`, undefined] : null, swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: photoFeed } = useSWR<{ posts: Post[] }>(userId ? [`/api/posts?type=photo`, undefined] : null, swrFetcher, {
    revalidateOnFocus: false,
  });

  const profile = data?.user;
  const stats = data?.stats;
  const isMe = profile?.id === me?.id;
  const following = profile ? followingIds.includes(profile.id) : false;

  const theirMedia = [...(videoFeed?.posts ?? []), ...(photoFeed?.posts ?? [])]
    .filter((p) => p.userId === userId)
    .slice(0, 9);

  async function follow() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await api.requestFriend(profile.id);
      toast(`Follow request sent to @${profile.username}`, "success");
      void toggleFollow(profile.id);
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(userId)} onClose={onClose} title={profile ? profile.username : "Profile"} maxWidth="max-w-lg">
      {isLoading && !profile ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <Spinner /> <span className="ml-2 text-xs">Loading profile...</span>
        </div>
      ) : !profile ? (
        <p className="py-10 text-center text-sm text-zinc-500">That profile is unavailable.</p>
      ) : (
        <div className="space-y-4">
          <div className="h-24 w-full overflow-hidden rounded-lg">
            {profile.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ backgroundImage: meshGradient(profile.username || profile.id) }} />
            )}
          </div>

          <div className="-mt-12 flex items-end gap-4 px-1">
            <span className="rounded-full ring-4 ring-[#121317]">
              <Avatar user={profile} size={80} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-base font-semibold text-white">{profile.username}</p>
              <p className="truncate text-xs text-zinc-500">{profile.displayName}</p>
            </div>
          </div>

          {profile.bio ? <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{profile.bio}</p> : null}

          {profile.interests.length > 0 ? (
            <p className="text-xs text-zinc-400">{profile.interests.map((i) => `#${i}`).join("  ")}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            {[
              { label: "posts", value: stats ? `${stats.posts}` : "0" },
              { label: "followers", value: stats ? `${stats.friends}` : "0" },
              { label: "following", value: stats ? `${stats.following}` : "0" },
            ].map(({ label, value }) => (
              <span key={label} className="inline-flex items-center gap-1">
                <span className="font-semibold text-white">{value}</span>
                <span className="text-zinc-400">{label}</span>
              </span>
            ))}
          </div>

          {!isMe ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void follow()}
                disabled={busy || following}
                className={cx(
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-70",
                  following ? "bg-white/10 text-zinc-400" : "bg-[#4f46e5] text-white hover:bg-[#6366f1]",
                )}
              >
                {busy ? <Spinner className="h-4 w-4" /> : following ? "Following" : "Follow"}
              </button>
              {onMessage ? (
                <button
                  type="button"
                  onClick={() => {
                    onMessage(profile);
                    onClose();
                  }}
                  className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Message
                </button>
              ) : null}
            </div>
          ) : null}

          {theirMedia.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {theirMedia.map((post) => (
                <div key={post.id} className="relative aspect-square overflow-hidden bg-[#121216]">
                  {post.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-zinc-700">
                      <Send size={18} strokeWidth={1.5} />
                    </span>
                  )}
                  <span className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] font-semibold text-white">
                    <Heart size={11} className="fill-current" /> {formatCount(post.likesCount)}
                  </span>
                  <span className="absolute bottom-1 right-1 flex items-center gap-1 text-[10px] font-semibold text-white">
                    <MessageCircle size={11} strokeWidth={1.75} /> {formatCount(post.commentCount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-zinc-500">No posts yet.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
