"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Check,
  Film,
  Home,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar } from "@/components/ui/Primitives";
import type { TabKey } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

export const NAV_ITEMS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "videos", label: "Videos", icon: Film },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "chatposts", label: "Chat Posts", icon: MessageSquare },
  { key: "friends", label: "Chats", icon: Users },
  { key: "profile", label: "Profile", icon: Home },
];

export function CliqLogo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-grad)] shadow-[0_0_22px_-4px_var(--accent)]">
        <Zap size={20} className="text-white" fill="currentColor" />
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-zinc-950 bg-zinc-900 text-[var(--accent-2)]">
          <Sparkles size={11} />
        </span>
      </span>
      {!compact ? (
        <span className="leading-none">
          <span className="block text-xl font-black tracking-tight text-zinc-50">Cliq</span>
          <span className="block text-[11px] font-medium text-zinc-500">Find your Cliq</span>
        </span>
      ) : null}
    </div>
  );
}

export function Header() {
  const { me, searchQuery, setSearch, setCreateOpen, markNotificationsRead, notifications } = useCliq();
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-5">
        <div className="lg:hidden">
          <CliqLogo compact />
        </div>
        <div className="hidden lg:block">
          <CliqLogo />
        </div>

        <div className="relative ml-auto flex min-w-0 flex-1 items-center lg:mx-6 lg:max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3 text-zinc-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends, #hashtags, vibes..."
            className="h-10 w-full rounded-full border border-zinc-800/80 bg-zinc-900/70 pl-9 pr-9 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-[var(--accent)] focus:bg-zinc-900"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-3 text-zinc-500 transition hover:text-zinc-200"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="hidden h-10 items-center gap-1.5 rounded-full bg-[var(--accent-grad)] px-4 text-sm font-bold text-white shadow-[0_0_20px_-6px_var(--accent)] transition hover:brightness-110 active:scale-95 sm:inline-flex"
        >
          <Plus size={16} strokeWidth={3} /> Create
        </button>

        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setNotifOpen((v) => !v);
              if (!notifOpen) markNotificationsRead();
            }}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-zinc-800/80 bg-zinc-900/70 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            <Bell size={18} />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent-grad)] px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </button>
          {notifOpen ? <NotificationDrawer onClose={() => setNotifOpen(false)} /> : null}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-grad)] text-white transition active:scale-95 sm:hidden"
          aria-label="Create post"
        >
          <Plus size={20} strokeWidth={3} />
        </button>

        <div className="hidden sm:block">
          <Avatar user={me} size={38} />
        </div>
      </div>
    </header>
  );
}

function NotificationDrawer({ onClose }: { onClose: () => void }) {
  const { notifications, userMap, acceptNotification, declineNotification, setTab } = useCliq();
  const iconFor = (kind: string) => {
    switch (kind) {
      case "like":
        return <Zap size={14} className="text-rose-400" />;
      case "upgrade":
        return <Zap size={14} className="text-emerald-400" />;
      case "comment":
        return <MessageCircle size={14} className="text-cyan-400" />;
      case "cliqup":
        return <UserPlus size={14} className="text-[var(--accent-2)]" />;
      default:
        return <MessageSquare size={14} className="text-violet-400" />;
    }
  };

  return (
    <div className="cliq-pop absolute right-0 top-12 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <p className="text-sm font-bold text-zinc-100">Notifications</p>
        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-2)]">
          {notifications.length} recent
        </span>
      </div>
      <div className="cliq-scroll max-h-[60vh] overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">You&apos;re all caught up ✨</p>
        ) : (
          notifications.map((n) => {
            const actor = userMap[n.actorId];
            return (
              <div
                key={n.id}
                className={cx(
                  "flex items-start gap-3 rounded-2xl p-3 transition",
                  n.read ? "hover:bg-zinc-800/50" : "bg-[var(--accent-soft)]",
                )}
              >
                {actor ? <Avatar user={actor} size={36} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    {iconFor(n.kind)}
                    <span className="truncate">{actor ? actor.name : "Someone"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">{n.text}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</p>
                  {n.kind === "cliqup" && n.requestState === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => acceptNotification(n.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-grad)] px-3 py-1 text-[11px] font-bold text-white"
                      >
                        <Check size={12} /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => declineNotification(n.id)}
                        className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800"
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}
                  {n.kind === "cliqup" && n.requestState === "accepted" ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <Check size={12} /> In your Cliq
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setTab("friends");
          onClose();
        }}
        className="w-full border-t border-zinc-800/80 px-4 py-3 text-xs font-semibold text-[var(--accent-2)] transition hover:bg-zinc-800/60"
      >
        Open Chats &amp; Friends
      </button>
    </div>
  );
}

export function Sidebar() {
  const { tab, setTab, me, notifications, resetData } = useCliq();
  const unreadFriends = notifications.filter((n) => n.kind === "cliqup" && n.requestState === "pending").length;

  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-zinc-800/80 px-3 py-5 lg:flex cliq-scroll">
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Explore Cliq</p>
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-[var(--accent-soft)] text-zinc-50"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
            )}
          >
            <span
              className={cx(
                "grid h-8 w-8 place-items-center rounded-xl transition",
                active ? "bg-[var(--accent-grad)] text-white" : "bg-zinc-900 text-zinc-400 group-hover:text-zinc-100",
              )}
            >
              <Icon size={16} />
            </span>
            <span className="flex-1 text-left">{label}</span>
            {key === "friends" && unreadFriends > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent-grad)] px-1 text-[10px] font-bold text-white">
                {unreadFriends}
              </span>
            ) : null}
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}
          </button>
        );
      })}

      <div className="mt-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur-md">
        <p className="text-xs font-bold text-zinc-200">Cliq Score</p>
        <p className="mt-1 text-2xl font-black cliq-gradient-text">{me.cliqScore.toLocaleString()}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Net upgrades + likes earned</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-zinc-950/60 px-2 py-1.5">
            <p className="text-sm font-bold text-zinc-100">{me.friends}</p>
            <p className="text-[10px] text-zinc-500">Friends</p>
          </div>
          <div className="rounded-xl bg-zinc-950/60 px-2 py-1.5">
            <p className="text-sm font-bold text-zinc-100">{me.following}</p>
            <p className="text-[10px] text-zinc-500">Following</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetData}
        className="mt-auto rounded-2xl border border-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
      >
        Reset demo data
      </button>
      <p className="mt-2 px-3 text-[10px] leading-relaxed text-zinc-600">
        Cliq · Find your Cliq. Share your vibe.
      </p>
    </aside>
  );
}

export function BottomNav() {
  const { tab, setTab, setCreateOpen, notifications } = useCliq();
  const unreadFriends = notifications.filter((n) => n.kind === "cliqup" && n.requestState === "pending").length;
  const items = useMemo(() => NAV_ITEMS, []);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {items.slice(0, 2).map(({ key, label, icon: Icon }) => (
          <NavButton key={key} active={tab === key} label={label} Icon={Icon} onClick={() => setTab(key)} />
        ))}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Create post"
          className="grid h-12 w-12 -translate-y-3 place-items-center rounded-2xl bg-[var(--accent-grad)] text-white shadow-[0_0_22px_-4px_var(--accent)] transition active:scale-90"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
        {items.slice(2).map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            active={tab === key}
            label={label}
            Icon={Icon}
            onClick={() => setTab(key)}
            badge={key === "friends" ? unreadFriends : 0}
          />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  active,
  label,
  Icon,
  onClick,
  badge,
}: {
  active: boolean;
  label: string;
  Icon: typeof Home;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative flex w-16 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition",
        active ? "text-[var(--accent-2)]" : "text-zinc-500",
      )}
    >
      <Icon size={20} className={cx(active && "drop-shadow-[0_0_6px_var(--accent)]")} />
      <span>{label}</span>
      {badge ? (
        <span className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent-grad)] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function SavedBadgeHint() {
  const { videos, photos, chatPosts } = useCliq();
  const count =
    videos.filter((v) => v.saved).length + photos.filter((p) => p.saved).length + chatPosts.filter((p) => p.saved).length;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
      <Bookmark size={12} /> {count} saved
    </span>
  );
}
