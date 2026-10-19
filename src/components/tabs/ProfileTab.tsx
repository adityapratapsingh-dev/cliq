"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bookmark,
  Check,
  Database,
  Film,
  Heart,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  MessageSquare,
  Palette,
  Play,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  UploadCloud,
  User,
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
import { UserListModal } from "@/components/UserListModal";
import { ScoreBreakdownModal } from "@/components/ScoreBreakdownModal";
import { computeScore } from "@/lib/cliq-score";
import { useFeed, useStats } from "@/components/tabs/useFeed";
import { usePostActions } from "@/components/tabs/usePostActions";
import type { AccentKey, Post, SessionUser } from "@/types/cliq";
import { cx, formatCount, meshGradient } from "@/lib/utils";

export function ProfileTab() {
  const { user, apiError, fallbackMode, dbError, savedIds, settingsOpen, closeSettings, openSettings } = useCliq();
  const [editOpen, setEditOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<"posts" | "photos" | "videos" | "saved">("posts");
  const [listModal, setListModal] = useState<"followers" | "following" | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [connections, setConnections] = useState<{ followers: string[]; following: string[] }>({
    followers: [],
    following: [],
  });

  const { posts: videoPosts } = useFeed("video");
  const { posts: photoPosts } = useFeed("photo");
  const { posts: chatPosts } = useFeed("chat");
  const { data: stats } = useStats();

  useEffect(() => {
    if (!user) return;
    void api
      .getFriends()
      .then((graph) =>
        setConnections({
          followers: graph.friends.map((f) => f.id),
          following: [...graph.friends.map((f) => f.id), ...graph.outgoing.map((o) => o.user.id)],
        }),
      )
      .catch(() => undefined);
  }, [user]);

  if (!user) return null;

  if (settingsOpen) {
    return <SettingsPanel user={user} onBack={closeSettings} fallbackMode={fallbackMode} dbError={dbError} />;
  }

  const mineVideos = videoPosts.filter((p) => p.userId === user.id);
  const minePhotos = photoPosts.filter((p) => p.userId === user.id);
  const mineChats = chatPosts.filter((p) => p.userId === user.id);
  const allPosts = [...mineVideos, ...minePhotos, ...mineChats];
  const saved = [...videoPosts, ...photoPosts, ...chatPosts].filter((p) => savedIds.includes(p.id));

  // Real, explainable score derived from posts + friends + engagement + note.
  const scoreBreakdown = computeScore({
    posts: allPosts,
    friends: stats?.friends ?? 0,
    hasNote: Boolean(user.settings.note?.text),
  });
  const cliqScore = scoreBreakdown.total;

  const followers = stats?.friends ?? connections.followers.length;
  const following = stats?.following ?? connections.following.length;

  return (
    <div className="mx-auto w-full max-w-[935px] px-0 py-4 md:px-8 md:py-8">
      <ProfileHeader
        user={user}
        postCount={stats?.posts ?? allPosts.length}
        followers={followers}
        following={following}
        cliqScore={cliqScore}
        onEdit={() => setEditOpen(true)}
        onSettings={openSettings}
        onOpenFollowers={() => setListModal("followers")}
        onOpenFollowing={() => setListModal("following")}
        onOpenScore={() => setScoreOpen(true)}
      />

      <ScoreBreakdownModal open={scoreOpen} onClose={() => setScoreOpen(false)} breakdown={scoreBreakdown} />

      <ProfileTabs active={profileTab} onChange={setProfileTab} />

      <div className="px-4 pt-4 md:px-0">
        {profileTab === "videos" || profileTab === "photos" ? (
          <MediaGrid posts={profileTab === "videos" ? mineVideos : minePhotos} />
        ) : (
          <PostList posts={profileTab === "posts" ? mineChats : saved} emptyKind={profileTab} />
        )}
      </div>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} user={user} onError={apiError} />

      <UserListModal
        open={listModal !== null}
        title={listModal === "followers" ? "Followers" : "Following"}
        userIds={listModal === "following" ? connections.following : connections.followers}
        onClose={() => setListModal(null)}
        onOpenProfile={() => setListModal(null)}
      />
    </div>
  );
}

/** Content tabs with a smooth sliding active underline. */
function ProfileTabs({
  active,
  onChange,
}: {
  active: "posts" | "photos" | "videos" | "saved";
  onChange: (next: "posts" | "photos" | "videos" | "saved") => void;
}) {
  const tabs = [
    { key: "posts", label: "POSTS", icon: MessageSquare },
    { key: "photos", label: "PHOTOS", icon: ImageIcon },
    { key: "videos", label: "VIDEOS", icon: Film },
    { key: "saved", label: "SAVED", icon: Bookmark },
  ] as const;
  const activeIndex = tabs.findIndex((t) => t.key === active);

  return (
    <div className="relative flex border-b border-[#262626]">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cx(
            "inline-flex flex-1 items-center justify-center gap-1.5 py-3.5 text-xs font-semibold uppercase tracking-widest transition",
            active === key ? "text-white" : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Icon size={13} strokeWidth={1.75} /> <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
      <span
        aria-hidden
        className="cliq-tab-underline absolute bottom-0 left-0 h-0.5 bg-white"
        style={{ width: `${100 / tabs.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
      />
    </div>
  );
}

/** A clean 3-column media grid for the Videos and Photos sub-tabs. */
function MediaGrid({ posts }: { posts: Post[] }) {
  const [preview, setPreview] = useState<Post | null>(null);

  if (posts.length === 0) {
    return <EmptyState icon={<ImageIcon size={26} strokeWidth={1.75} />} title="Nothing here yet" hint="Your posts show up here." />;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setPreview(post)}
            className="group relative aspect-square overflow-hidden bg-[#121216]"
          >
            {post.mediaUrl ? (
              post.type === "video" ? (
                <video src={post.mediaUrl} className="h-full w-full object-cover" muted loop playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.mediaUrl} alt={post.content || "media"} className="h-full w-full object-cover"  loading="lazy" decoding="async" />
              )
            ) : (
              <span className="grid h-full w-full place-items-center text-zinc-700">
                {post.type === "video" ? <Film size={22} strokeWidth={1.5} /> : <ImageIcon size={22} strokeWidth={1.5} />}
              </span>
            )}

            <span className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <span className="inline-flex items-center gap-1">
                <Heart size={14} className="fill-current" /> {formatCount(post.likesCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={14} strokeWidth={1.75} /> {formatCount(post.commentCount)}
              </span>
            </span>
            {post.type === "video" ? (
              <span className="pointer-events-none absolute right-1.5 top-1.5 text-white">
                <Play size={14} className="fill-current" />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {preview ? <MediaModal post={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}

function MediaModal({ post, onClose }: { post: Post; onClose: () => void }) {
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
        <div className="overflow-hidden rounded-lg border border-[#262626] bg-black">
          {post.mediaUrl ? (
            post.type === "video" ? (
              <video src={post.mediaUrl} className="max-h-[60vh] w-full object-contain" controls playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaUrl} alt={post.content || "media"} className="max-h-[60vh] w-full object-contain"  loading="lazy" decoding="async" />
            )
          ) : (
            <div className="grid h-48 place-items-center text-zinc-600">No media attached</div>
          )}
        </div>
        {post.content ? <p className="text-sm leading-relaxed text-zinc-200">{post.content}</p> : null}
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Heart size={14} className="fill-[#ff3040] text-[#ff3040]" /> {formatCount(post.likesCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={14} strokeWidth={1.75} /> {formatCount(post.commentCount)}
          </span>
          <span className="ml-auto text-zinc-600">@{post.author?.username ?? user?.username}</span>
        </div>
      </div>
    </Modal>
  );
}

/** Thread list for Chat Posts and Saved. */
function PostList({ posts, emptyKind }: { posts: Post[]; emptyKind: "posts" | "saved" }) {
  const { user } = useCliq();
  const { remove } = usePostActions();
  const [gone, setGone] = useState<string[]>([]);

  const visible = posts.filter((p) => !gone.includes(p.id));

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={26} strokeWidth={1.75} />}
        title={emptyKind === "saved" ? "Nothing saved yet" : "No posts yet"}
        hint={emptyKind === "saved" ? "Tap the bookmark icon on any post to save it." : "Your posts show up here."}
      />
    );
  }
  return (
    <div className="border-t border-[#262626]">
      {visible.map((post) => (
        <article key={post.id} className="flex gap-3 border-b border-[#262626] px-1 py-4">
          {user ? <Avatar user={user} size={40} /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold text-white">{user?.displayName ?? "You"}</span>
              <span className="text-sm text-zinc-500">@{user?.username ?? "you"}</span>
            </div>
            {post.content ? <p className="mt-1 text-[15px] leading-snug text-[#f5f5f5]">{post.content}</p> : null}
            <div className="mt-3 flex max-w-[420px] items-center gap-5 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Heart size={15} strokeWidth={1.75} /> {formatCount(post.likesCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={15} strokeWidth={1.75} /> {formatCount(post.commentCount)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setGone((prev) => [...prev, post.id]);
                  void remove(post.id);
                }}
                className="ml-auto text-[#ff3040] transition hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfileHeader({
  user,
  postCount,
  followers,
  following,
  cliqScore,
  onEdit,
  onSettings,
  onOpenFollowers,
  onOpenFollowing,
  onOpenScore,
}: {
  user: SessionUser;
  postCount: number;
  followers: number;
  following: number;
  cliqScore: number;
  onEdit: () => void;
  onSettings: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onOpenScore: () => void;
}) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const banner = user.bannerUrl && !bannerBroken ? user.bannerUrl : null;

  const stats = [
    { label: "Posts", value: postCount, onClick: undefined as undefined | (() => void), glow: false },
    { label: "Friends", value: followers, onClick: onOpenFollowers, glow: false },
    { label: "Following", value: following, onClick: onOpenFollowing, glow: false },
  ];

  return (
    <div className="pb-6 md:pb-8">
      {/* Cover banner — rich animated mesh gradient until a custom one is set. */}
      <div className="relative h-32 w-full overflow-hidden rounded-b-2xl sm:h-44 lg:rounded-2xl">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="h-full w-full object-cover" loading="eager" decoding="async" onError={() => setBannerBroken(true)} />
        ) : (
          <div
            className="cliq-mesh h-full w-full"
            style={{ backgroundImage: meshGradient(user.username || user.id), backgroundColor: "#121317" }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="px-4 md:px-0">
        {/* Overlapping avatar */}
        <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
          <span className="relative shrink-0 rounded-full ring-4 ring-[#09090b]">
            <Avatar user={user} size={96} />
            <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[#09090b] bg-[#10b981]" />
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:gap-10">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-white">{user.username}</h1>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={onSettings}
                aria-label="Settings"
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/15"
              >
                <SettingsIcon size={18} strokeWidth={1.75} />
              </button>
            </div>

            {/* Cliq Score — one small chip, not a fourth bulky stat block. */}
            <button
              type="button"
              onClick={onOpenScore}
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
            >
              <Sparkles size={12} /> Cliq Score {formatCount(cliqScore)}
            </button>

            {/* Compact inline stats row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {stats.map(({ label, value, onClick, glow }) => {
                const body = (
                  <>
                    <span className={cx("text-base font-bold", glow ? "text-indigo-300" : "text-white")}>
                      {formatCount(value)}
                    </span>
                    <span className={cx("text-xs", glow ? "text-indigo-300/80" : "text-zinc-400")}>{label}</span>
                  </>
                );
                const shared = cx(
                  "inline-flex items-baseline gap-1.5",
                  glow &&
                    "rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 shadow-sm shadow-indigo-500/20",
                );
                return onClick ? (
                  <button key={label} type="button" onClick={onClick} className={cx(shared, "transition hover:opacity-80")}>
                    {body}
                  </button>
                ) : (
                  <span key={label} className={shared}>
                    {body}
                  </span>
                );
              })}
            </div>

            <div>
              <p className="text-sm font-semibold text-white">{user.displayName}</p>
              {user.bio ? <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-200">{user.bio}</p> : null}
              {(user.interests ?? []).length > 0 ? (
                /* At most three tags unless the user asks for the rest. */
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(showAllTags ? (user.interests ?? []) : (user.interests ?? []).slice(0, 3)).map((i) => (
                    <span
                      key={i}
                      className="rounded-full border border-[#262626] px-3 py-1 text-xs text-zinc-300"
                    >
                      #{i}
                    </span>
                  ))}
                  {(user.interests ?? []).length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllTags((v) => !v)}
                      className="rounded-full px-2 py-1 text-xs font-semibold text-zinc-400 transition hover:text-zinc-100"
                    >
                      {showAllTags ? "less" : `+${(user.interests ?? []).length - 3} more`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
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
  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl ?? "");
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setBio(user.bio);
    setAge(user.age ? String(user.age) : "");
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
      toast("Profile updated", "success");
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

  const inputClass =
    "w-full rounded-lg border border-[#262626] bg-[#121216] px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-600";

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-[#262626] bg-[#121216] p-3">
          <Avatar
            user={{ id: user.id, username: user.username, displayName: displayName || user.displayName, avatarUrl: avatarUrl || null }}
            size={52}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{displayName || user.displayName}</p>
            <p className="truncate text-xs text-zinc-500">@{user.username}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15">
            <ImageIcon size={13} strokeWidth={1.75} /> Avatar
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
          <span className="mb-1 block text-xs font-medium text-zinc-400">Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={inputClass} />
        </label>

        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">Age</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">Avatar image URL</span>
            <input
              value={avatarUrl.startsWith("data:") ? "" : avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-[#262626] bg-[#121216] p-3">
          <span className="h-12 w-20 shrink-0 overflow-hidden rounded-md" style={{ backgroundImage: bannerUrl ? undefined : meshGradient(user.username) }}>
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerUrl} alt="" className="h-full w-full object-cover"  loading="lazy" decoding="async" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1 text-xs text-zinc-500">Cover banner — leave empty for an auto gradient</span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15">
            <UploadCloud size={13} strokeWidth={1.75} /> Banner
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
          <span className="mb-1 block text-xs font-medium text-zinc-400">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className={cx(inputClass, "resize-none")} />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Interests</span>
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map((interest) => {
              const active = interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => setInterests((prev) => (active ? prev.filter((i) => i !== interest) : [...prev, interest]))}
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition",
                    active ? "bg-white text-black" : "bg-[#121216] text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {active ? <Check size={12} strokeWidth={2.5} /> : null}
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
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
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
    <div className="mx-auto w-full max-w-[620px] px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> Back
        </button>
        <h2 className="text-base font-semibold text-white">Settings</h2>
      </div>

      {fallbackMode ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-xs leading-relaxed text-amber-100">
            <p className="font-semibold">Storage is running in fallback mode</p>
            <p className="mt-1 text-amber-200/80">
              Cliq is using a temporary in-memory store, so data may disappear when the server restarts. Set{" "}
              <code className="rounded bg-black/40 px-1">DATABASE_URL</code> and{" "}
              <code className="rounded bg-black/40 px-1">CLIQ_SESSION_SECRET</code>, then redeploy.
            </p>
            {dbError ? (
              <p className="mt-2 break-words rounded-lg bg-black/40 px-2.5 py-2 font-mono text-[11px] text-amber-200/90">{dbError}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-4 py-3 text-xs font-medium text-[#10b981]">
          <Database size={14} strokeWidth={1.75} /> Connected to your database — your data is persisted.
        </div>
      )}

      {mediaUnconfigured ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="text-xs leading-relaxed text-amber-100">
            <p className="font-semibold">Direct media uploads are off</p>
            <p className="mt-1 text-amber-200/80">
              Set <code className="rounded bg-black/40 px-1">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{" "}
              <code className="rounded bg-black/40 px-1">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in Vercel, then
              redeploy. Until then you can still paste image and video URLs.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-4 py-3 text-xs font-medium text-[#10b981]">
          <UploadCloud size={14} strokeWidth={1.75} /> Media uploads are enabled.
        </div>
      )}

      <SectionCard className="mb-4">
        <SectionTitle icon={<User size={15} strokeWidth={1.75} />} title="Account" />
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Username" value={`@${user.username}`} />
          <Row label="Email" value={user.email || "Not set"} />
        </div>
      </SectionCard>

      <SectionCard className="mb-4">
        <SectionTitle icon={<Shield size={15} strokeWidth={1.75} />} title="Privacy" />
        <div className="mt-3">
          <Toggle
            checked={settings.privateProfile}
            onChange={(v) => {
              void updateSettings({ privateProfile: v });
              toast(v ? "Profile is now private" : "Profile is public", v ? "success" : "default");
            }}
            label="Private profile"
            hint="Only approved followers can see your posts"
          />
          <div className="border-b border-[#262626] py-3.5">
            <p className="text-sm font-medium text-zinc-100">Who can message me</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MESSAGE_SCOPES.map((scope) => (
                <button
                  key={scope.key}
                  type="button"
                  onClick={() => {
                    void updateSettings({ whoCanMessage: scope.key });
                    toast(`Messages: ${scope.label}`, "success");
                  }}
                  className={cx(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    settings.whoCanMessage === scope.key ? "bg-white text-black" : "bg-[#121216] text-zinc-400 hover:text-zinc-200",
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
            label="Show activity status"
            hint="Let friends see when you're active"
          />
          <Toggle
            checked={settings.hideDislikes}
            onChange={(v) => {
              void updateSettings({ hideDislikes: v });
              toast(v ? "Dislike counts hidden" : "Dislike counts visible", "success");
            }}
            label="Hide dislike counts on my posts"
          />
          <Toggle
            checked={settings.toxicFilter}
            onChange={(v) => void updateSettings({ toxicFilter: v })}
            label="Word filter"
            hint="Softens unkind words in content you view"
          />
        </div>
      </SectionCard>

      <SectionCard className="mb-4">
        <SectionTitle icon={<Palette size={15} strokeWidth={1.75} />} title="Appearance" />
        <div className="mt-3">
          <p className="text-sm font-medium text-zinc-100">Accent color</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACCENT_LIST.map((accent) => (
              <button
                key={accent.key}
                type="button"
                onClick={() => {
                  void updateSettings({ accent: accent.key as AccentKey });
                  toast(`${accent.label} applied`, "success");
                }}
                className={cx(
                  "rounded-lg border px-3 py-2 text-left transition",
                  settings.accent === accent.key ? "border-white" : "border-[#262626] hover:border-zinc-600",
                )}
              >
                <span className="block h-2 w-full rounded-full" style={{ background: accent.gradient }} />
                <span className="mt-1.5 block text-xs font-medium text-zinc-100">{accent.label}</span>
              </button>
            ))}
          </div>
          <Toggle
            checked={settings.autoplay}
            onChange={(v) => void updateSettings({ autoplay: v })}
            label="Autoplay videos"
            hint="Videos start playing as you scroll the feed"
          />
        </div>
      </SectionCard>

      <SectionCard className="mb-4">
        <SectionTitle icon={<Bell size={15} strokeWidth={1.75} />} title="Notifications" />
        <div className="mt-3">
          <Toggle checked={settings.notifCliqUp} onChange={(v) => void updateSettings({ notifCliqUp: v })} label="Follow requests" />
          <Toggle checked={settings.notifMessages} onChange={(v) => void updateSettings({ notifMessages: v })} label="Direct messages" />
          <Toggle checked={settings.notifVotes} onChange={(v) => void updateSettings({ notifVotes: v })} label="Likes & upgrades" />
          <Toggle checked={settings.notifComments} onChange={(v) => void updateSettings({ notifComments: v })} label="Comments" />
          <Toggle
            checked={pushEnabled}
            onChange={(v) => {
              if (!v) {
                disableBrowserNotifications();
                setPushEnabled(false);
                toast("Notifications turned off", "default");
                return;
              }
              void enableBrowserNotifications().then((granted) => {
                setPushEnabled(granted);
                toast(granted ? "Notifications enabled" : "Your browser blocked notifications", granted ? "success" : "danger");
              });
            }}
            label="Browser notifications"
            hint="Get native device alerts for new activity"
          />
        </div>
      </SectionCard>

      <SectionCard className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Shield size={13} strokeWidth={1.75} /> Passwords are hashed. Sessions are httpOnly.
        </div>
        <button
          type="button"
          onClick={() => void logOut()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#ff3040] transition hover:bg-white/15"
        >
          <LogOut size={13} strokeWidth={1.75} /> Log out
        </button>
      </SectionCard>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-400">{icon}</span>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[#0d0d10] px-3 py-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="truncate text-xs font-medium text-zinc-200">{value}</span>
    </div>
  );
}
