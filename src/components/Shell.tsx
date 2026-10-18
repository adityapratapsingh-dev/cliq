"use client";

import {
  Bell,
  Film,
  Image as ImageIcon,
  Home,
  LogOut,
  MessageSquare,
  PlusSquare,
  Search,
  Settings,
  User,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useCliq } from "@/components/CliqProvider";
import { useNotificationCenter } from "@/components/notifications/useNotificationCenter";
import { Avatar } from "@/components/ui/Primitives";
import type { TabKey } from "@/types/cliq";
import { cx } from "@/lib/utils";

export const NAV_ITEMS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "chatposts", label: "Chat Posts", icon: Home },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "videos", label: "Videos", icon: Film },
  { key: "friends", label: "Chats", icon: MessageSquare },
  { key: "profile", label: "Profile", icon: User },
];

/** The Cliq wordmark. Plain geometric type — no icon box, no tagline. */
export function CliqLogo() {
  return <span className="text-2xl font-bold tracking-tight text-white">Cliq</span>;
}

interface ShellHandlers {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}

/**
 * Fixed left navigation rail (tablet & desktop).
 *
 * Collapses to an icon rail at `lg` and expands to show labels at `xl`. Search,
 * Notifications and Create are actions; the rest switch tabs.
 */
export function LeftRail({ onOpenSearch, onOpenNotifications }: ShellHandlers) {
  const { tab, setTab, user, logOut, setCreateOpen } = useCliq();
  const badges = useNavBadges();
  const { unreadCount } = useNotificationCenter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-[72px] flex-col border-r border-zinc-800/80 bg-black px-3 py-5 lg:flex xl:w-[244px]">
      <div className="mb-6 flex h-8 items-center justify-center px-2 xl:justify-start">
        <span className="xl:hidden text-xl font-bold tracking-tight text-white">C</span>
        <span className="hidden xl:inline">
          <CliqLogo />
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const badge = badges[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cx(
                "group relative flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] transition",
                active ? "font-semibold text-white" : "font-normal text-zinc-200 hover:bg-zinc-900",
              )}
            >
              {active ? (
                <span className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-indigo-500" />
              ) : null}
              <span className="relative shrink-0">
                {key === "profile" && user ? (
                  <span className={cx("block rounded-full", active && "ring-1 ring-white")}>
                    <Avatar user={user} size={24} />
                  </span>
                ) : (
                  <Icon size={24} strokeWidth={active ? 2.4 : 1.75} />
                )}
                {badge?.count ? (
                  <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3040] px-1 text-[10px] font-bold text-white">
                    {badge.count > 9 ? "9+" : badge.count}
                  </span>
                ) : badge?.dot ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#ff3040]" />
                ) : null}
              </span>
              <span className="hidden xl:inline">{label}</span>
            </button>
          );
        })}

        <RailAction icon={<Search size={24} strokeWidth={1.75} />} label="Search" onClick={onOpenSearch} />
        <RailAction
          icon={<Bell size={24} strokeWidth={1.75} />}
          label="Notifications"
          onClick={onOpenNotifications}
          badge={unreadCount}
        />
        <RailAction
          icon={<PlusSquare size={24} strokeWidth={1.75} />}
          label="Create"
          onClick={() => setCreateOpen(true)}
        />
      </nav>

      <div className="relative mt-auto">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Account menu"
          className="flex w-full items-center gap-3 rounded-full p-1.5 transition hover:bg-zinc-900 xl:pr-3"
        >
          {user ? <Avatar user={user} size={32} /> : <span className="h-8 w-8 rounded-full bg-zinc-800" />}
          <span className="hidden min-w-0 flex-1 text-left xl:block">
            <span className="block truncate text-sm font-semibold text-zinc-100">{user?.username}</span>
            <span className="block truncate text-[11px] text-zinc-500">View profile</span>
          </span>
          <Settings size={16} strokeWidth={1.75} className="hidden text-zinc-500 xl:block" />
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="cliq-pop absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-xl border border-zinc-800/80 bg-[#121317] py-1 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setTab("profile");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                <Settings size={16} strokeWidth={1.75} /> Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  void logOut();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#ff3040] transition hover:bg-zinc-800"
              >
                <LogOut size={16} strokeWidth={1.75} /> Log out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function RailAction({
  icon,
  label,
  onClick,
  badge,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center gap-4 rounded-lg px-3 py-3 text-[15px] text-zinc-200 transition hover:bg-zinc-900"
    >
      <span className="relative shrink-0">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3040] px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

/**
 * Fixed bottom navigation (mobile only).
 *
 * Posts · Photos · Videos · Messages · Profile, plus a Create entry point.
 */
export function BottomNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { tab, setTab, setCreateOpen } = useCliq();
  const badges = useNavBadges();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-around border-t border-zinc-800/80 bg-black lg:hidden">
      <MobileTab
        active={tab === "chatposts"}
        label="Posts"
        Icon={Home}
        onClick={() => setTab("chatposts")}
        badge={badges.chatposts}
      />
      <MobileTab
        active={tab === "photos"}
        label="Photos"
        Icon={ImageIcon}
        onClick={() => setTab("photos")}
        badge={badges.photos}
      />
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="Create"
        className="grid h-9 w-9 place-items-center text-white"
      >
        <PlusSquare size={24} strokeWidth={1.75} />
      </button>
      <MobileTab
        active={tab === "friends"}
        label="Messages"
        Icon={MessageSquare}
        onClick={() => setTab("friends")}
        badge={badges.friends}
      />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        className="grid h-9 w-9 place-items-center text-zinc-200"
      >
        <Search size={24} strokeWidth={1.75} />
      </button>
    </nav>
  );
}

function MobileTab({
  active,
  label,
  Icon,
  onClick,
  badge,
  avatar,
}: {
  active: boolean;
  label: string;
  Icon: typeof Home;
  onClick: () => void;
  badge?: { count: number; dot: boolean };
  avatar?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx("relative grid h-9 w-9 place-items-center", active ? "text-white" : "text-zinc-400")}
    >
      {avatar ??
        (active ? <Icon size={24} strokeWidth={2.4} /> : <Icon size={24} strokeWidth={1.75} />)}
      {badge?.count ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff3040] px-1 text-[9px] font-bold text-white">
          {badge.count > 9 ? "9+" : badge.count}
        </span>
      ) : badge?.dot ? (
        <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-[#ff3040]" />
      ) : null}
    </button>
  );
}

/**
 * Red-dot state for every nav item.
 *
 * Messages shows a numeric badge (unread DMs + pending Cliq requests). The feed
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
