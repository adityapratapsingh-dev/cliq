"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Bookmark,
  Database,
  Film,
  Heart,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Palette,
  Pencil,
  Play,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { api } from "@/lib/api-client";
import {
  browserNotificationsEnabled,
  disableBrowserNotifications,
  enableBrowserNotifications,
} from "@/lib/browser-notify";
import { Avatar, EmptyState, Modal, SectionCard, Toggle } from "@/components/ui/Primitives";
import { ACCENT_LIST } from "@/lib/theme";
import { INTEREST_OPTIONS, MESSAGE_SCOPES } from "@/lib/constants";
import { PostCardMini } from "@/components/tabs/PostCardMini";
import { UserListModal } from "@/components/UserListModal";
import { useFeed, useStats } from "@/components/tabs/useFeed";
import type { AccentKey, Post, SessionUser, UserBadges } from "@/types/cliq";
import { cx, formatCount, meshGradient } from "@/lib/utils";

export function ProfileTab() {
  const { user, apiError, fallbackMode, dbError, savedIds, settingsOpen, closeSettings, openSettings } = useCliq();
  const [editOpen, setEditOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<"posts" | "videos" | "photos" | "saved">("posts");
  const [listModal, setListModal] = useState<"friends" | "following" | null>(null);
  const [connections, setConnections] = useState<{ friends: string[]; following: string[] }>({
    friends: [],
    following: [],
  });
  const [badges, setBadges] = useState<UserBadges | null>(null);

  const { posts: videoPosts } = useFeed("video");
  const { posts: photoPosts } = useFeed("photo");
  const { posts: chatPosts } = useFeed("chat");
  // Real counters from the friendships / posts tables.
  const { data: stats } = useStats();

  // Achievement badges for the profile header.
  useEffect(() => {
    if (!user) return;
    void api
      .getBadges(user.id)
      .then(setBadges)
      .catch(() => undefined);
  }, [user]);

  // The id lists behind the Friends / Following counters, for the modal lists.
  useEffect(() => {
    if (!user) return;
    void api
      .getFriends()
      .then((graph) =>
        setConnections({
          friends: graph.friends.map((f) => f.id),
          following: [...graph.friends.map((f) => f.id), ...graph.outgoing.map((o) => o.user.id)],
        }),
      )
      .catch(() => undefined);
  }, [user]);

  if (!user) return null;

  if (settingsOpen) {
    return (
      <SettingsPanel
        user={user}
        onBack={closeSettings}
        fallbackMode={fallbackMode}
        dbError={dbError}
      />
    );
  }

  const mineVideos = videoPosts.filter((p) => p.userId === user.id);
  const minePhotos = photoPosts.filter((p) => p.userId === user.id);
  const mineChats = chatPosts.filter((p) => p.userId === user.id);
  const allPosts = [...mineVideos, ...minePhotos, ...mineChats];
  const saved = [...videoPosts, ...photoPosts, ...chatPosts].filter((p) => savedIds.includes(p.id));

  const cliqScore = allPosts.reduce(
    (sum, p) => sum + p.likesCount + p.upgradesCount - p.dislikesCount - p.downgradesCount,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4 px-3 py-4 sm:px-4">
      <ProfileHeader
        user={user}
        postCount={stats?.posts ?? allPosts.length}
        cliqScore={cliqScore}
        friends={stats?.friends ?? connections.friends.length}
        following={stats?.following ?? 0}
        badges={badges}
        onEdit={() => setEditOpen(true)}
        onSettings={openSettings}
        onOpenFriends={() => setListModal("friends")}
        onOpenFollowing={() => setListModal("following")}
      />

      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-zinc-800/80 bg-[#121317] p-1">
        {(
          [
            { key: "videos", label: "Videos", icon: Film },
            { key: "photos", label: "Photos", icon: ImageIcon },
            { key: "posts", label: "Posts", icon: MessageSquare },
            { key: "saved", label: "Saved", icon: Bookmark },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setProfileTab(key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition",
              profileTab === key ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {profileTab === "videos" || profileTab === "photos" ? (
        <MediaGrid
          posts={profileTab === "videos" ? mineVideos : minePhotos}
          emptyLabel={profileTab === "videos" ? "videos" : "photos"}
        />
      ) : (
        <PostList
          posts={profileTab === "posts" ? mineChats : saved}
          viewerId={user.id}
          emptyKind={profileTab}
        />
      )}

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} user={user} onError={apiError} />

      <UserListModal
        open={listModal !== null}
        title={listModal === "friends" ? "Cliq Friends" : "Following"}
        userIds={listModal === "following" ? connections.following : connections.friends}
        onClose={() => setListModal(null)}
        onOpenProfile={() => setListModal(null)}
      />
    </div>
  );
}

/** A clean 3-column media grid used for the Videos and Photos sub-tabs. */
function MediaGrid({ posts, emptyLabel }: { posts: Post[]; emptyLabel: string }) {
  const [preview, setPreview] = useState<Post | null>(null);

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon size={24} />}
        title={`No ${emptyLabel} yet`}
        hint="Anything you post on Cliq shows up here."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setPreview(post)}
            className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-950"
          >
            {post.mediaUrl ? (
              post.type === "video" ? (
                <video
                  src={post.mediaUrl}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.mediaUrl} alt={post.content || "media"} className="h-full w-full object-cover" />
              )
            ) : (
              <span className="grid h-full w-full place-items-center bg-zinc-900 text-zinc-600">
                {post.type === "video" ? <Film size={20} /> : <ImageIcon size={20} />}
              </span>
            )}

            {/* hover / always-on overlay with counts */}
            <span className="absolute inset-0 flex items-center justify-center gap-3 bg-black/45 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100">
              <span className="inline-flex items-center gap-1">
                <Heart size={13} className="fill-current" /> {formatCount(post.likesCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare size={13} /> {formatCount(post.commentCount)}
              </span>
            </span>
            {post.type === "video" ? (
              <span className="pointer-events-none absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                <Play size={12} className="ml-0.5" />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {preview ? <PostPreviewModal post={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}

/** Full-post modal opened from a media thumbnail. */
function PostPreviewModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { user } = useCliq();
  return (
    <Modal
      open
      onClose={onClose}
      title={post.type === "video" ? "Video" : "Photo"}
      subtitle={post.content ? post.content.slice(0, 60) : undefined}
      maxWidth="max-w-lg"
    >
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          {post.mediaUrl ? (
            post.type === "video" ? (
              <video src={post.mediaUrl} className="max-h-[60vh] w-full object-contain" controls playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaUrl} alt={post.content || "media"} className="max-h-[60vh] w-full object-contain" />
            )
          ) : (
            <div className="grid h-48 place-items-center text-zinc-600">No media attached</div>
          )}
        </div>
        {post.content ? <p className="text-sm leading-relaxed text-zinc-200">{post.content}</p> : null}
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Heart size={13} className="fill-rose-500 text-rose-500" /> {formatCount(post.likesCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={13} /> {formatCount(post.commentCount)}
          </span>
          <span className="ml-auto text-zinc-600">@{post.author?.username ?? user?.username}</span>
        </div>
      </div>
    </Modal>
  );
}

/** Thread list for Chat Posts and Saved. */
function PostList({
  posts,
  viewerId,
  emptyKind,
}: {
  posts: Post[];
  viewerId: string;
  emptyKind: "posts" | "saved";
}) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles size={24} />}
        title={emptyKind === "saved" ? "Nothing saved yet" : "No chat posts yet"}
        hint={
          emptyKind === "saved"
            ? "Tap the bookmark icon on any post to save it here."
            : "Anything you post on Cliq shows up here."
        }
      />
    );
  }
  return (
    <div className="grid gap-3">
      {posts.map((post) => (
        <PostCardMini key={post.id} post={post} viewerId={viewerId} />
      ))}
    </div>
  );
}

function ProfileHeader({
  user,
  postCount,
  cliqScore,
  friends,
  following,
  badges,
  onEdit,
  onSettings,
  onOpenFriends,
  onOpenFollowing,
}: {
  user: SessionUser;
  postCount: number;
  cliqScore: number;
  friends: number;
  following: number;
  badges: UserBadges | null;
  onEdit: () => void;
  onSettings: () => void;
  onOpenFriends: () => void;
  onOpenFollowing: () => void;
}) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const banner = user.bannerUrl && !bannerBroken ? user.bannerUrl : null;
  const mesh = useMemo(() => meshGradient(user.username || user.id), [user.username, user.id]);

  const stats = [
    { label: "Posts", value: `${postCount}`, onClick: undefined as undefined | (() => void) },
    { label: "Cliq Score", value: `${cliqScore}`, onClick: undefined as undefined | (() => void) },
    { label: "Friends", value: `${friends}`, onClick: onOpenFriends },
    { label: "Following", value: `${following}`, onClick: onOpenFollowing },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-[#121317]">
      {/* Cover banner — custom image, or a per-user mesh gradient. */}
      <div className="relative h-32 w-full sm:h-40">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="h-full w-full object-cover" onError={() => setBannerBroken(true)} />
        ) : (
          <div className="h-full w-full" style={{ backgroundImage: mesh, backgroundColor: "#121317" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121317] via-transparent to-transparent" />
      </div>

      <div className="relative px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between gap-3">
          <div className="rounded-full ring-2 ring-[#121317]">
            <Avatar user={user} size={78} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500 active:scale-95"
            >
              <Pencil size={13} /> Edit Profile
            </button>
            <button
              type="button"
              onClick={onSettings}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-300 transition hover:border-indigo-500 hover:text-zinc-100"
            >
              <SettingsIcon size={13} /> Settings
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-black text-zinc-50">{user.displayName}</h1>
            <BadgeCheck size={17} className="text-indigo-400" />
          </div>
          <p className="text-xs text-zinc-500">
            @{user.username}
            {user.age ? ` · ${user.age}` : ""}
          </p>
          {user.bio ? <p className="mt-2 text-sm leading-relaxed text-zinc-300">{user.bio}</p> : null}
          {(user.interests ?? []).length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(user.interests ?? []).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300"
                >
                  #{interest}
                </span>
              ))}
            </div>
          ) : null}

          {/* Achievement badges */}
          {badges && badges.badges.some((b) => b.earned) ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {badges.badges
                .filter((b) => b.earned)
                .map((badge) => (
                  <span
                    key={badge.id}
                    title={badge.description}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200"
                  >
                    <span>{badge.emoji}</span> {badge.label}
                  </span>
                ))}
            </div>
          ) : null}
        </div>

        {/* Compact inline stats bar */}
        <div className="mt-4 flex items-center divide-x divide-zinc-800/80 rounded-2xl border border-zinc-800/70 bg-[#0c0d10] py-2.5">
          {stats.map(({ label, value, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={!onClick}
              className={cx(
                "flex flex-1 flex-col items-center gap-0.5 px-1 transition",
                onClick ? "hover:opacity-80" : "cursor-default",
              )}
            >
              <span className="text-base font-black tabular-nums text-zinc-50">{value}</span>
              <span className="text-[10px] font-medium text-zinc-500">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditProfileModal({
  open,
  onClose,
  user,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  onError: (error: unknown) => void;
}) {
  const { refreshUser, toast } = useCliq();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [age, setAge] = useState(user.age ? `${user.age}` : "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl ?? "");
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user.displayName);
    setBio(user.bio);
    setAge(user.age ? `${user.age}` : "");
    setAvatarUrl(user.avatarUrl ?? "");
    setBannerUrl(user.bannerUrl ?? "");
    setInterests(user.interests);
  }, [open, user]);

  async function save() {
    setBusy(true);
    try {
      await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        age: age.trim() ? Number(age) : null,
        avatarUrl: avatarUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        interests,
      });
      await refreshUser();
      toast("Profile updated ✨", "success");
      onClose();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  function readImage(file: File, apply: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => apply(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile" subtitle="Keep it real — your vibe, your rules.">
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-[#0c0d10] p-3">
          <Avatar
            user={{ id: user.id, username: user.username, displayName: displayName || user.displayName, avatarUrl: avatarUrl || null }}
            size={52}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-100">{displayName || user.displayName}</p>
            <p className="truncate text-[11px] text-zinc-500">@{user.username}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-indigo-500 hover:text-zinc-100">
            <ImageIcon size={13} /> Avatar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readImage(file, setAvatarUrl);
              }}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-400">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-400">Age</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-400">Avatar image URL</span>
            <input
              value={avatarUrl.startsWith("data:") ? "" : avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-[#0c0d10] p-3">
          <span className="h-12 w-20 shrink-0 overflow-hidden rounded-lg" style={{ backgroundImage: bannerUrl ? undefined : meshGradient(user.username) }}>
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1 text-[11px] text-zinc-500">
            Cover banner — leave empty for an auto mesh gradient
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-indigo-500 hover:text-zinc-100">
            <UploadCloud size={13} /> Banner
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readImage(file, setBannerUrl);
              }}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-400">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={300}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-zinc-400">Interests</span>
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map((interest) => {
              const active = interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => setInterests((prev) => (active ? prev.filter((i) => i !== interest) : [...prev, interest]))}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    active ? "border-transparent bg-indigo-600 text-white" : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {active ? "✓ " : ""}
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

function SettingsPanel({
  user,
  onBack,
  fallbackMode,
  dbError,
}: {
  user: SessionUser;
  onBack: () => void;
  fallbackMode: boolean;
  dbError: string | null;
}) {
  const { settings, updateSettings, logOut, toast, mediaUnconfigured } = useCliq();
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    setPushEnabled(browserNotificationsEnabled());
  }, []);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4 px-3 py-4 sm:px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-indigo-500 hover:text-zinc-100"
        >
          <X size={13} /> Back to profile
        </button>
        <h2 className="text-sm font-bold text-zinc-100">Settings</h2>
      </div>

      {fallbackMode ? (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-xs leading-relaxed text-amber-100">
            <p className="font-bold">Storage is running in fallback mode</p>
            <p className="mt-1 text-amber-200/80">
              Cliq is using a temporary in-memory store, so data may disappear when the server
              restarts. Set <code className="rounded bg-zinc-950/60 px-1">DATABASE_URL</code> and{" "}
              <code className="rounded bg-zinc-950/60 px-1">CLIQ_SESSION_SECRET</code>, then redeploy.
              Tables are created automatically on the next request.
            </p>
            {dbError ? (
              <p className="mt-2 break-words rounded-xl bg-zinc-950/50 px-2.5 py-2 font-mono text-[11px] text-amber-200/90">
                {dbError}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-200">
          <Database size={14} /> Connected to your database — your data is persisted.
        </div>
      )}

      {mediaUnconfigured ? (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-xs leading-relaxed text-amber-100">
            <p className="font-bold">Direct media uploads are off</p>
            <p className="mt-1 text-amber-200/80">
              Set <code className="rounded bg-zinc-950/60 px-1">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{" "}
              <code className="rounded bg-zinc-950/60 px-1">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> (an
              unsigned preset) in Vercel, then redeploy. Until then you can still paste image and video URLs.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-200">
          <UploadCloud size={14} /> Cloudinary direct uploads are enabled — media never touches Vercel.
        </div>
      )}

      <SectionCard>
        <SectionTitle icon={<User size={15} />} title="Account & Profile" />
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Username" value={`@${user.username}`} />
          <Row label="Email" value={user.email || "Not set"} />
          <Row label="Age tier" value="Teen Verified 13–19" badge />
          <Row label="Account status" value="Active · In good standing" />
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle icon={<Shield size={15} />} title="Teen Safety & Privacy" />
        <div className="mt-3 space-y-2">
          <Toggle
            checked={settings.privateProfile}
            onChange={(v) => {
              void updateSettings({ privateProfile: v });
              toast(v ? "Profile is now private 🔒" : "Profile is public again", v ? "success" : "default");
            }}
            label="Private Cliq Profile"
            hint="Only approved Cliq friends can see your posts"
          />
          <div className="rounded-2xl border border-zinc-800/80 bg-[#121317] px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Who Can Message Me</p>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500">Control who can start a direct chat with you</p>
            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_SCOPES.map((scope) => (
                <button
                  key={scope.key}
                  type="button"
                  onClick={() => {
                    void updateSettings({ whoCanMessage: scope.key });
                    toast(`Messages: ${scope.label}`, "success");
                  }}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    settings.whoCanMessage === scope.key
                      ? "border-transparent bg-indigo-600 text-white"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={settings.showOnline}
            onChange={(v) => void updateSettings({ showOnline: v })}
            label="Show Online Activity Status"
            hint="Let friends see when you're active"
          />
          <Toggle
            checked={settings.hideDislikes}
            onChange={(v) => {
              void updateSettings({ hideDislikes: v });
              toast(v ? "Dislike counts hidden on your posts" : "Dislike counts visible", "success");
            }}
            label="Hide Dislike & Downgrade Counts on My Posts"
            hint="Feed rendering updates instantly"
          />
          <Toggle
            checked={settings.toxicFilter}
            onChange={(v) => void updateSettings({ toxicFilter: v })}
            label="Safe-Chat Toxic Word Filter"
            hint="Softens unkind words in content you view"
          />
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle icon={<Palette size={15} />} title="Appearance & Theme Vibe" />
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-zinc-800/80 bg-[#121317] px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Accent color</p>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500">Changes highlights across the whole app</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENT_LIST.map((accent) => (
                <button
                  key={accent.key}
                  type="button"
                  onClick={() => {
                    void updateSettings({ accent: accent.key as AccentKey });
                    toast(`${accent.label} applied 🎨`, "success");
                  }}
                  className={cx(
                    "relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition",
                    settings.accent === accent.key ? "border-zinc-100" : "border-zinc-800 hover:border-zinc-600",
                  )}
                  style={{ background: accent.soft }}
                >
                  <span className="block h-2 w-full rounded-full" style={{ background: accent.gradient }} />
                  <span className="mt-1.5 block text-[11px] font-bold text-zinc-100">{accent.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={settings.autoplay}
            onChange={(v) => void updateSettings({ autoplay: v })}
            label="Auto-Play Videos"
            hint="Videos start playing as you scroll the feed"
          />
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle icon={<Bell size={15} />} title="Notifications" />
        <div className="mt-3 space-y-2">
          <Toggle checked={settings.notifCliqUp} onChange={(v) => void updateSettings({ notifCliqUp: v })} label='"Cliq Up" Friend Requests' />
          <Toggle checked={settings.notifMessages} onChange={(v) => void updateSettings({ notifMessages: v })} label="Direct Messages" />
          <Toggle checked={settings.notifVotes} onChange={(v) => void updateSettings({ notifVotes: v })} label="Post Upgrades & Likes" />
          <Toggle checked={settings.notifComments} onChange={(v) => void updateSettings({ notifComments: v })} label="Comments" />
          <Toggle
            checked={pushEnabled}
            onChange={(v) => {
              if (!v) {
                disableBrowserNotifications();
                setPushEnabled(false);
                toast("Browser notifications turned off", "default");
                return;
              }
              void enableBrowserNotifications().then((granted) => {
                setPushEnabled(granted);
                toast(
                  granted ? "Browser notifications enabled 🔔" : "Your browser blocked notifications",
                  granted ? "success" : "danger",
                );
              });
            }}
            label="Browser Notifications"
            hint="Get native device alerts for new messages and activity"
          />
        </div>
      </SectionCard>

      <SectionCard className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Shield size={13} /> Passwords are hashed. Session cookies are httpOnly.
        </div>
        <button
          type="button"
          onClick={() => void logOut()}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/50 px-3.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
        >
          <LogOut size={13} /> Log Out
        </button>
      </SectionCard>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300">
        {icon}
      </span>
      <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/50 px-3 py-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span
        className={cx(
          "truncate text-xs font-semibold",
          badge ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-300" : "text-zinc-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}
