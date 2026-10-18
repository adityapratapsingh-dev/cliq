"use client";

import {
  Bell,
  Film,
  Image as ImageIcon,
  Home,
  LogOut,
  MessageSquare,
  Plus,
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
 * Fixed left navigation rail.
 *
 * Icon-only (68px) from `md` up so it never eats horizontal space on tablets and
 * landscape phones; expands to a labelled 240px rail once there is room
 * (`1150px+`). Each collapsed item carries a native tooltip for hover/tap
 * discovery.
 */
export function LeftRail({ onOpenSearch, onOpenNotifications }: ShellHandlers) {
  const { tab, setTab, user, logOut, setCreateOpen } = useCliq();
  const badges = useNavBadges();
  const { unreadCount } = useNotificationCenter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-[68px] flex-col border-r border-white/10 bg-[#09090b] px-3 py-5 md:flex min-[1150px]:w-[240px]">
      <div className="mb-6 flex h-8 items-center justify-center px-2 min-[1150px]:justify-start">
        <span className="text-xl font-bold tracking-tight text-white min-[1150px]:hidden">C</span>
        <span className="hidden min-[1150px]:inline">
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
              title={label}
              onClick={() => setTab(key)}
              className={cx(
                "group relative flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] transition",
                active ? "font-semibold text-white" : "font-normal text-zinc-300 hover:bg-white/5",
              )}
            >
              {active ? (
                <span className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
              ) : null}
              <span className="relative mx-auto shrink-0 min-[1150px]:mx-0">
                {key === "profile" && user ? (
                  <span className={cx("block rounded-full", active && "ring-1 ring-white")}>
                    <Avatar user={user} size={26} />
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
              <span className="hidden min-[1150px]:inline">{label}</span>
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
          title={user?.username}
          className="flex w-full items-center gap-3 rounded-full p-1.5 transition hover:bg-white/5 min-[1150px]:pr-3"
        >
          <span className="mx-auto min-[1150px]:mx-0">
            {user ? <Avatar user={user} size={32} /> : <span className="block h-8 w-8 rounded-full bg-zinc-800" />}
          </span>
          <span className="hidden min-w-0 flex-1 text-left min-[1150px]:block">
            <span className="block truncate text-sm font-semibold text-zinc-100">{user?.username}</span>
            <span className="block truncate text-[11px] text-zinc-500">View profile</span>
          </span>
          <Settings size={16} strokeWidth={1.75} className="hidden text-zinc-500 min-[1150px]:block" />
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="cliq-pop absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#121216] py-1 shadow-2xl">
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
      title={label}
      className="group relative flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] text-zinc-300 transition hover:bg-white/5"
    >
      <span className="relative mx-auto shrink-0 min-[1150px]:mx-0">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3040] px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="hidden min-[1150px]:inline">{label}</span>
    </button>
  );
}

/**
 * Sticky mobile top app bar (< md).
 *
 * Brand on the left; quick actions on the right: search, Reels, the
 * notification bell (with unread dot) and the user's avatar (→ Profile).
 */
export function MobileTopBar({ onOpenSearch, onOpenNotifications }: ShellHandlers) {
  const { user, setTab, tab } = useCliq();
  const { unreadCount } = useNotificationCenter();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-black/80 px-4 backdrop-blur-md md:hidden">
      <button type="button" onClick={() => setTab("chatposts")} aria-label="Cliq home" className="flex items-center">
        <CliqLogo />
      </button>

      <div className="flex items-center gap-1">
        <TopIcon label="Search" onClick={onOpenSearch}>
          <Search size={21} strokeWidth={1.75} />
        </TopIcon>
        <TopIcon label="Reels" onClick={() => setTab("videos")} active={tab === "videos"}>
          <Film size={21} strokeWidth={1.75} />
        </TopIcon>
        <TopIcon label="Notifications" onClick={onOpenNotifications}>
          <span className="relative">
            <Bell size={21} strokeWidth={1.75} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff3040] ring-2 ring-black" />
            ) : null}
          </span>
        </TopIcon>
        <button
          type="button"
          onClick={() => setTab("profile")}
          aria-label="Profile"
          className="ml-1 shrink-0 rounded-full transition active:scale-95"
        >
          {user ? <Avatar user={user} size={30} /> : <span className="block h-[30px] w-[30px] rounded-full bg-zinc-800" />}
        </button>
      </div>
    </header>
  );
}

function TopIcon({
  children,
  label,
  onClick,
  active,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        "grid h-9 w-9 place-items-center rounded-full transition active:scale-90",
        active ? "text-white" : "text-zinc-300",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Fixed bottom navigation (mobile only).
 *
 * Five destinations: Home · Explore · Create · Chats · Profile. The Create
 * button is a glowing gradient orb so it reads as the primary action.
 */
export function BottomNav() {
  const { tab, setTab, setCreateOpen } = useCliq();
  const badges = useNavBadges();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur-lg md:hidden">
      <div className="flex h-[60px] items-center justify-around">
        <MobileTab
          active={tab === "chatposts"}
          label="Home"
          Icon={Home}
          onClick={() => setTab("chatposts")}
          badge={badges.chatposts}
        />
        <MobileTab
          active={tab === "photos" || tab === "videos"}
          label="Explore"
          Icon={ImageIcon}
          onClick={() => setTab("photos")}
          badge={badges.photos}
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Create"
          className="grid h-11 w-11 -translate-y-1 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/40 transition active:scale-95"
        >
          <Plus size={24} strokeWidth={2.4} />
        </button>
        <MobileTab
          active={tab === "friends"}
          label="Chats"
          Icon={MessageSquare}
          onClick={() => setTab("friends")}
          badge={badges.friends}
        />
        <MobileTab active={tab === "profile"} label="Profile" Icon={User} onClick={() => setTab("profile")} />
      </div>
    </nav>
  );
}

function MobileTab({
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
  badge?: { count: number; dot: boolean };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        "relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition",
        active ? "text-white" : "text-zinc-500",
      )}
    >
      <span className="relative">
        <Icon size={23} strokeWidth={active ? 2.4 : 1.75} />
        {badge?.count ? (
          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff3040] px-1 text-[9px] font-bold text-white">
            {badge.count > 9 ? "9+" : badge.count}
          </span>
        ) : badge?.dot ? (
          <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-[#ff3040]" />
        ) : null}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
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
