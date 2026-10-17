"use client";

import { useState } from "react";
import useSWR from "swr";
import { BadgeCheck, MessageSquare, UserPlus, Check } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { api, swrFetcher } from "@/lib/api-client";
import { Avatar, Modal, Spinner } from "@/components/ui/Primitives";
import { PostCardMini } from "@/components/tabs/PostCardMini";
import type { Post, ProfileStats, PublicUser } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

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
  const { user: me, toast, apiError } = useCliq();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useSWR<{ user: PublicUser; stats: ProfileStats }>(
    userId ? [`/api/users/${encodeURIComponent(userId)}`, undefined] : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const { data: feed } = useSWR<{ posts: Post[] }>(
    userId ? [`/api/posts?type=photo`, undefined] : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const profile = data?.user;
  const stats = data?.stats;
  const isMe = profile?.id === me?.id;

  const theirPosts = (feed?.posts ?? []).filter((p) => p.userId === userId).slice(0, 4);

  async function cliqUp() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await api.requestFriend(profile.id);
      setRequested(true);
      toast(`Cliq Up sent to @${profile.username} ⚡`, "success");
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(userId)}
      onClose={onClose}
      title={profile ? profile.displayName : "Profile"}
      subtitle={profile ? `@${profile.username}` : undefined}
      maxWidth="max-w-lg"
    >
      {isLoading && !profile ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <Spinner /> <span className="ml-2 text-xs">Loading profile...</span>
        </div>
      ) : !profile ? (
        <p className="py-10 text-center text-sm text-zinc-500">That profile is unavailable.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar user={profile} size={72} ring />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-base font-bold text-zinc-50">{profile.displayName}</p>
                <BadgeCheck size={16} className="text-[var(--accent-2)]" />
              </div>
              <p className="truncate text-xs text-zinc-500">
                @{profile.username}
                {profile.age ? ` · ${profile.age}` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">Joined {timeAgo(profile.createdAt)}</p>
            </div>
          </div>

          {profile.bio ? <p className="text-sm leading-relaxed text-zinc-300">{profile.bio}</p> : null}

          {profile.interests.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-2)]"
                >
                  #{interest}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Posts", value: stats ? `${stats.posts}` : "—" },
              { label: "Cliq Friends", value: stats ? `${stats.friends}` : "—" },
              { label: "Following", value: stats ? `${stats.following}` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-zinc-800/70 bg-zinc-950/50 px-2 py-2.5 text-center">
                <p className="text-base font-black text-zinc-50">{value}</p>
                <p className="text-[10px] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          {!isMe ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void cliqUp()}
                disabled={busy || requested}
                className={cx(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition disabled:opacity-70",
                  requested
                    ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "bg-[var(--accent-grad)] text-white hover:brightness-110",
                )}
              >
                {requested ? (
                  <>
                    <Check size={13} /> Cliq Up Sent
                  </>
                ) : busy ? (
                  <Spinner />
                ) : (
                  <>
                    <UserPlus size={13} /> Cliq Up ⚡
                  </>
                )}
              </button>
              {onMessage ? (
                <button
                  type="button"
                  onClick={() => {
                    onMessage(profile);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
                >
                  <MessageSquare size={13} /> Message
                </button>
              ) : null}
            </div>
          ) : null}

          {theirPosts.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Recent posts</p>
              <div className="grid grid-cols-2 gap-2">
                {theirPosts.map((post) => (
                  <PostCardMini key={post.id} post={post} viewerId={me?.id ?? ""} />
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
              No posts yet.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
