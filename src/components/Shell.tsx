"use client";

import {
  Bell,
  Film,
  LogOut,
  Settings,
  Home,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useCliq } from "@/components/CliqProvider";
import { useNotificationCenter } from "@/components/notifications/useNotificationCenter";
import { ActivityPill } from "@/components/notifications/ActivityPill";
import { Avatar } from "@/components/ui/Primitives";
import type { TabKey } from "@/types/cliq";
import { cx } from "@/lib/utils";

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

export function Header({
  search,
  onSearch,
  onBell,
  onProfile,
  searchSlot,
}: {
  search: string;
  onSearch: (value: string) => void;
  onBell: () => void;
  onProfile: () => void;
  /** Rendered directly under the search input (the live results dropdown). */
  searchSlot?: ReactNode;
}) {
  const { user, setCreateOpen } = useCliq();
  const { unreadCount } = useNotificationCenter();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/95 backdrop-blur-xl">
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
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search posts, #hashtags, vibes..."
            className="h-10 w-full rounded-full border border-zinc-800/80 bg-[#121317] pl-9 pr-9 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearch("")}
              className="absolute right-3 text-zinc-500 transition hover:text-zinc-200"
            >
              <X size={15} />
            </button>
          ) : null}
          {searchSlot}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="hidden h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-500 active:scale-95 sm:inline-flex"
        >
          <Plus size={16} strokeWidth={3} /> Create
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            data-testid="notification-bell"
            onClick={onBell}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-zinc-800/80 bg-zinc-900/70 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span
                data-testid="bell-badge"
                className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] animate-pulse place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-lg shadow-rose-500/40"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
          {/* Floating Instagram-style activity bubble */}
          <ActivityPill onOpen={onBell} />
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 active:scale-95 sm:hidden"
          aria-label="Create post"
        >
          <Plus size={20} strokeWidth={3} />
        </button>

        {user ? (
          <button type="button" onClick={onProfile} className="hidden sm:block" aria-label="Your profile">
            <Avatar user={user} size={38} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function Sidebar({ children }: { children?: ReactNode }) {
  const { tab, setTab, user, logOut } = useCliq();
  const badges = useNavBadges();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-800/80 px-3 py-5 cliq-scroll lg:flex">
      <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Explore Cliq</p>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const badge = badges[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active ? "bg-zinc-800/70 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              {/* Active left pill indicator */}
              {active ? (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500" />
              ) : null}
              <span className="relative">
                <Icon size={18} className={cx(active && "text-indigo-400")} />
                {badge?.dot ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/40" />
                ) : null}
              </span>
              <span className="flex-1 text-left">{label}</span>
              {badge?.count ? (
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-lg shadow-rose-500/40">
                  {badge.count > 9 ? "9+" : badge.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {children}

      {/* Compact user pill with a quick menu (replaces the old footer text). */}
      <div className="relative mt-auto pt-4">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-800/80 bg-[#121317] px-3 py-2.5 text-left transition hover:border-zinc-700"
        >
          {user ? <Avatar user={user} size={32} /> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-zinc-100">{user?.displayName ?? "You"}</span>
            <span className="block truncate text-[11px] text-zinc-500">@{user?.username ?? "cliq"}</span>
          </span>
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="cliq-pop absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-[#121317] py-1 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setTab("profile");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/70"
              >
                <Settings size={13} /> Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  void logOut();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-rose-300 transition hover:bg-zinc-800/70"
              >
                <LogOut size={13} /> Log Out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

export function BottomNav() {
  const { tab, setTab, setCreateOpen, user } = useCliq();
  const badges = useNavBadges();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {NAV_ITEMS.slice(0, 2).map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            active={tab === key}
            label={label}
            Icon={Icon}
            onClick={() => setTab(key)}
            badge={badges[key]}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Create post"
          className="grid h-12 w-12 -translate-y-3 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500 active:scale-90"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
        {NAV_ITEMS.slice(2).map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            active={tab === key}
            label={label}
            Icon={Icon}
            onClick={() => setTab(key)}
            avatar={key === "profile" && user ? <Avatar user={user} size={22} /> : undefined}
            badge={badges[key]}
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
  avatar,
  badge,
}: {
  active: boolean;
  label: string;
  Icon: typeof Home;
  onClick: () => void;
  avatar?: ReactNode;
  badge?: { count: number; dot: boolean };
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
      <span className="relative">
        {avatar ? (
          <span className={cx("block rounded-full", active && "ring-2 ring-[var(--accent)]")}>{avatar}</span>
        ) : (
          <Icon size={20} className={cx(active && "drop-shadow-[0_0_6px_var(--accent)]")} />
        )}
        {badge?.dot ? (
          <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/40" />
        ) : null}
        {badge?.count ? (
          <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-lg shadow-rose-500/40">
            {badge.count > 9 ? "9+" : badge.count}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Red-dot state for every nav item.
 *
 * Chats shows a numeric badge (unread DMs + pending Cliq requests). The feed
 * tabs show a plain dot when a post newer than the last time you opened that tab
 * exists, and it clears as soon as you switch to the tab.
 */
export function useNavBadges(): Partial<Record<TabKey, { count: number; dot: boolean }>> {
  const { tab, counts, lastSeen, feedLatest } = useCliq();

  const chatCount = counts.messages + counts.pendingRequests;

  return {
    friends: { count: chatCount, dot: chatCount > 0 },
    videos: {
      count: 0,
      dot: (feedLatest.video ?? "") > (lastSeen.video ?? "") && tab !== "videos",
    },
    photos: {
      count: 0,
      dot: (feedLatest.photo ?? "") > (lastSeen.photo ?? "") && tab !== "photos",
    },
    chatposts: {
      count: 0,
      dot: (feedLatest.chat ?? "") > (lastSeen.chatposts ?? "") && tab !== "chatposts",
    },
  };
}
