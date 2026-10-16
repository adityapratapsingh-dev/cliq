"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  Bell,
  Check,
  Eye,
  Film,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Palette,
  Pencil,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, GradientArt, Modal, SectionCard, Toggle } from "@/components/ui/Primitives";
import { ACCENT_LIST } from "@/lib/theme";
import type { AccentKey, MessageScope, PhotoPost, VideoPost, ChatPost } from "@/types/cliq";
import { cx, formatCount, timeAgo } from "@/lib/utils";

export function ProfileTab() {
  const { me, profileTab, setProfileTab } = useCliq();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (settingsOpen) return <SettingsPanel onBack={() => setSettingsOpen(false)} />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4">
      <ProfileHeader onEdit={() => setEditOpen(true)} onSettings={() => setSettingsOpen(true)} />

      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-1 backdrop-blur-md">
        {(
          [
            { key: "videos", label: "Videos", icon: Film },
            { key: "photos", label: "Photos", icon: ImageIcon },
            { key: "chatposts", label: "Posts", icon: MessageSquare },
            { key: "saved", label: "Saved", icon: Bookmark },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setProfileTab(key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition",
              profileTab === key ? "bg-[var(--accent-grad)] text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <ProfileContent />

      <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3">
        <span className="text-[11px] text-zinc-500">Logged in as @{me.handle} · teen verified 13–19</span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-2)] hover:underline"
        >
          <SettingsIcon size={13} /> Settings
        </button>
      </div>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

function ProfileHeader({ onEdit, onSettings }: { onEdit: () => void; onSettings: () => void }) {
  const { me, friendIds, followingIds } = useCliq();
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md">
      <GradientArt art={me.coverArt} className="h-32 w-full sm:h-40" showEmoji={false}>
        <div className="cliq-drift absolute inset-0" />
        <span className="absolute right-4 top-4 text-3xl">{me.coverArt.emoji}</span>
        <span className="absolute bottom-3 left-4 rounded-full bg-zinc-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          {me.coverArt.label}
        </span>
      </GradientArt>

      <div className="relative px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between">
          <div className="cliq-pulse-ring rounded-full">
            <Avatar user={me} size={78} ring />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-grad)] px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
            >
              <Pencil size={13} /> Edit Profile
            </button>
            <button
              type="button"
              onClick={onSettings}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
            >
              <SettingsIcon size={13} /> Settings
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-black text-zinc-50">{me.name}</h1>
            <BadgeCheck size={17} className="text-[var(--accent-2)]" />
          </div>
          <p className="text-xs text-zinc-500">
            @{me.handle} · {me.age} · {me.vibe}
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-zinc-700/70 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-300">
            <Sparkles size={11} className="text-[var(--accent-2)]" /> {me.pronouns} · Find your Cliq
          </span>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{me.bio}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {me.interests.map((i) => (
              <span
                key={i}
                className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-2)]"
              >
                #{i}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Posts", value: "126" },
            { label: "Cliq Friends", value: `${me.friends + (friendIds.length - 6)}` },
            { label: "Following", value: `${me.following + followingIds.length}` },
            { label: "Cliq Score", value: formatCount(me.cliqScore) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-zinc-800/70 bg-zinc-950/50 px-2 py-2.5 text-center">
              <p className="text-base font-black text-zinc-50">{value}</p>
              <p className="text-[10px] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileContent() {
  const { videos, photos, chatPosts, userMap, me, profileTab, setTab } = useCliq();

  if (profileTab === "saved") {
    const savedVideos = videos.filter((v) => v.saved);
    const savedPhotos = photos.filter((p) => p.saved);
    const savedPosts = chatPosts.filter((p) => p.saved);
    if (savedVideos.length + savedPhotos.length + savedPosts.length === 0) {
      return <EmptyState emoji="🔖" title="Nothing saved yet" hint="Tap the bookmark icon on any post to save it here." />;
    }
    return (
      <div className="space-y-3">
        {savedVideos.map((v) => (
          <MiniVideo key={v.id} video={v} authorName={userMap[v.authorId]?.handle ?? "cliq"} />
        ))}
        {savedPhotos.map((p) => (
          <MiniPhoto key={p.id} photo={p} authorName={userMap[p.authorId]?.handle ?? "cliq"} />
        ))}
        {savedPosts.map((p) => (
          <MiniPost key={p.id} post={p} authorName={userMap[p.authorId]?.handle ?? "cliq"} />
        ))}
      </div>
    );
  }

  const mine = (id: string, authorId: string) => authorId === id;

  if (profileTab === "videos") {
    const list = videos.filter((v) => mine(me.id, v.authorId));
    if (list.length === 0)
      return (
        <EmptyState emoji="🎬" title="No videos yet" hint="Tap Create and publish your first Cliq video." />
      );
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((v) => (
          <MiniVideo key={v.id} video={v} authorName={me.handle} />
        ))}
      </div>
    );
  }

  if (profileTab === "photos") {
    const list = photos.filter((p) => mine(me.id, p.authorId));
    if (list.length === 0) return <EmptyState emoji="📸" title="No photos yet" hint="Share a photo to see it here." />;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => (
          <MiniPhoto key={p.id} photo={p} authorName={me.handle} />
        ))}
      </div>
    );
  }

  const list = chatPosts.filter((p) => mine(me.id, p.authorId));
  if (list.length === 0)
    return <EmptyState emoji="💬" title="No chat posts yet" hint="Drop a thought on Cliq to fill this tab." />;
  return (
    <div className="space-y-3">
      {list.map((p) => (
        <MiniPost key={p.id} post={p} authorName={me.handle} />
      ))}
      <button
        type="button"
        onClick={() => setTab("chatposts")}
        className="w-full rounded-2xl border border-dashed border-zinc-700 py-2.5 text-xs font-semibold text-zinc-400 transition hover:border-[var(--accent)] hover:text-zinc-100"
      >
        Write a new chat post
      </button>
    </div>
  );
}

function MiniVideo({ video, authorName }: { video: VideoPost; authorName: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/70">
      <GradientArt art={video.art} className="h-36 w-full" />
      <div className="p-3">
        <p className="line-clamp-2 text-xs text-zinc-300">@{authorName} · {video.caption}</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          ❤️ {formatCount(video.likes)} · 💬 {video.comments.length} · {timeAgo(video.createdAt)}
        </p>
      </div>
    </div>
  );
}

function MiniPhoto({ photo, authorName }: { photo: PhotoPost; authorName: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/70">
      <GradientArt art={photo.images[0]} className="h-36 w-full" />
      <div className="p-3">
        <p className="line-clamp-2 text-xs text-zinc-300">@{authorName} · {photo.caption}</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          ❤️ {formatCount(photo.likes)} · 💬 {photo.comments.length} · {timeAgo(photo.createdAt)}
        </p>
      </div>
    </div>
  );
}

function MiniPost({ post, authorName }: { post: ChatPost; authorName: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-3">
      <span
        className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
        style={{ borderColor: `${post.flairColor}66`, color: post.flairColor, backgroundColor: `${post.flairColor}18` }}
      >
        {post.flair}
      </span>
      <p className="mt-2 line-clamp-3 text-xs text-zinc-300">@{authorName}: {post.text}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        ⚡ {formatCount(post.upgrades - post.downgrades)} · 💬 {post.comments.length} · {timeAgo(post.createdAt)}
      </p>
    </div>
  );
}

function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, updateProfile } = useCliq();
  const [name, setName] = useState(me.name);
  const [handle, setHandle] = useState(me.handle);
  const [bio, setBio] = useState(me.bio);
  const [pronouns, setPronouns] = useState(me.pronouns);
  const [interests, setInterests] = useState<string[]>(me.interests);

  const INTEREST_OPTIONS = ["Gaming", "Music", "Anime", "Coding", "Fitness", "Art", "Movies", "Memes"];

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile" subtitle="Keep it real. Your vibe, your rules.">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-400">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-400">@username</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-400">Pronouns</span>
          <input
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-400">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={160}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-zinc-400">Interests</span>
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map((i) => {
              const active = interests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setInterests((prev) => (active ? prev.filter((x) => x !== i) : [...prev, i]))
                  }
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    active
                      ? "border-transparent bg-[var(--accent-grad)] text-white"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {active ? "✓ " : ""}
                  {i}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            updateProfile({ name, handle, bio, pronouns, interests });
            onClose();
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[var(--accent-grad)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
        >
          <Check size={16} /> Save changes
        </button>
      </div>
    </Modal>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, me, toast, resetData } = useCliq();

  const scopes: { key: MessageScope; label: string }[] = [
    { key: "everyone", label: "Everyone" },
    { key: "shared", label: "Shared Interests Only" },
    { key: "friends", label: "Cliq Friends Only" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
        >
          <X size={13} /> Back to profile
        </button>
        <h2 className="text-sm font-bold text-zinc-100">Settings</h2>
      </div>

      <SectionCard>
        <SectionTitle icon={<User size={15} />} title="Account & Profile" />
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Username" value={`@${me.handle}`} />
          <Row label="Email" value={me.email} />
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
              updateSettings({ privateProfile: v });
              toast(v ? "Profile is now private 🔒" : "Profile is public again", v ? "success" : "default");
            }}
            label="Private Cliq Profile"
            hint="Only approved Cliq friends can see your posts"
          />
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Who Can Message Me</p>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500">Control who can start a direct chat with you</p>
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    updateSettings({ whoCanMessage: s.key });
                    toast(`Messages: ${s.label}`, "success");
                  }}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    settings.whoCanMessage === s.key
                      ? "border-transparent bg-[var(--accent-grad)] text-white"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={settings.showOnline}
            onChange={(v) => updateSettings({ showOnline: v })}
            label="Show Online Activity Status"
            hint="Let friends see when you're active"
          />
          <Toggle
            checked={settings.hideDislikes}
            onChange={(v) => {
              updateSettings({ hideDislikes: v });
              toast(v ? "Dislike counts hidden on your posts" : "Dislike counts visible", "success");
            }}
            label="Hide Dislike & Downgrade Counts on My Posts"
            hint="Feed rendering updates instantly"
          />
          <Toggle
            checked={settings.toxicFilter}
            onChange={(v) => updateSettings({ toxicFilter: v })}
            label="Safe-Chat Toxic Word Filter"
            hint="Blurs unkind words in your comments and messages"
          />
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle icon={<Palette size={15} />} title="Appearance & Theme Vibe" />
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Accent color</p>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500">Changes highlights across the whole app</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCENT_LIST.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    updateSettings({ accent: a.key as AccentKey });
                    toast(`${a.label} applied 🎨`, "success");
                  }}
                  className={cx(
                    "relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition",
                    settings.accent === a.key ? "border-zinc-100" : "border-zinc-800 hover:border-zinc-600",
                  )}
                  style={{ background: a.soft }}
                >
                  <span className="block h-2 w-full rounded-full" style={{ background: a.gradient }} />
                  <span className="mt-1.5 block text-[11px] font-bold text-zinc-100">{a.label}</span>
                  {settings.accent === a.key ? (
                    <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-zinc-900">
                      <Check size={11} />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={settings.autoplay}
            onChange={(v) => updateSettings({ autoplay: v })}
            label="Auto-Play Videos"
            hint="Videos start playing as you scroll the feed"
          />
        </div>
      </SectionCard>

      <SectionCard>
        <SectionTitle icon={<Bell size={15} />} title="Notifications" />
        <div className="mt-3 space-y-2">
          <Toggle
            checked={settings.notifCliqUp}
            onChange={(v) => updateSettings({ notifCliqUp: v })}
            label='"Cliq Up" Friend Requests'
          />
          <Toggle
            checked={settings.notifMessages}
            onChange={(v) => updateSettings({ notifMessages: v })}
            label="Direct Messages"
          />
          <Toggle
            checked={settings.notifVotes}
            onChange={(v) => updateSettings({ notifVotes: v })}
            label="Post Upgrades & Likes"
          />
          <Toggle
            checked={settings.notifComments}
            onChange={(v) => updateSettings({ notifComments: v })}
            label="Comments"
          />
        </div>
      </SectionCard>

      <SectionCard className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Lock size={13} /> Your data stays in this demo session.
          <Eye size={13} /> Nothing is uploaded.
        </div>
        <button
          type="button"
          onClick={resetData}
          className="rounded-full border border-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-rose-500/60 hover:text-rose-300"
        >
          Reset all demo data
        </button>
      </SectionCard>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-2)]">
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
