"use client";

import { useEffect, useState } from "react";
import { useCliq } from "@/components/CliqProvider";
import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, LeftRail, MobileTopBar } from "@/components/Shell";
import { CreateModal } from "@/components/CreateModal";
import { ToastHost } from "@/components/ToastHost";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { RightSidebar } from "@/components/ContextRail";
import { SearchPanel } from "@/components/SearchPanel";
import { ProfileModal } from "@/components/ProfileModal";
import { VideosTab } from "@/components/tabs/VideosTab";
import { PhotosTab } from "@/components/tabs/PhotosTab";
import { ChatPostsTab } from "@/components/tabs/ChatPostsTab";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { accentVars } from "@/lib/theme";
import { Spinner } from "@/components/ui/Primitives";
import { cx } from "@/lib/utils";

/**
 * Center column width per tab.
 *
 * On mobile every column is full-bleed (`max-w-none`) so the feed uses the whole
 * screen; the fixed caps only kick in once there is room for them.
 */
const CENTER_WIDTH: Record<string, string> = {
  chatposts: "md:max-w-[640px] md:border-x md:border-white/10",
  photos: "md:max-w-[640px]",
  videos: "md:max-w-[640px]",
  friends: "md:max-w-[1100px]",
  profile: "md:max-w-[935px]",
};

export function CliqApp() {
  const { user, loading, settings, tab, setTab, refreshUser, bump, markTabSeen, search, setSearch, setCreateOpen, createOpen } =
    useCliq();
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  // Which user's public profile is open, if any.
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const openProfile = (id: string) => setProfileUserId(id);

  useEffect(() => {
    markTabSeen(tab);
  }, [tab, markTabSeen]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6" />
          <p className="text-xs text-zinc-500">Loading Cliq...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={accentVars(settings.accent)}>
        <AuthScreen
          onAuthed={() => {
            void refreshUser();
            setTab("chatposts");
          }}
        />
        <ToastHost />
      </div>
    );
  }

  const centerWidth = CENTER_WIDTH[tab] ?? "md:max-w-[600px]";

  return (
    <div style={accentVars(settings.accent)} className="min-h-dvh bg-[#09090b] text-zinc-100">
      <LeftRail onOpenSearch={() => setSearchOpen(true)} onOpenNotifications={() => setBellOpen(true)} />
      <MobileTopBar onOpenSearch={() => setSearchOpen(true)} onOpenNotifications={() => setBellOpen(true)} />

      <div className="flex w-full justify-center md:pl-[68px] min-[1150px]:pl-[240px]">
        <main
          className={cx(
            "cliq-scroll min-w-0 w-full pb-[68px] md:pb-0",
            tab !== "friends" && "md:py-4",
            centerWidth,
          )}
        >
          {tab === "videos" ? (
            <VideosTab search={search} onOpenProfile={openProfile} />
          ) : tab === "photos" ? (
            <PhotosTab search={search} onOpenProfile={openProfile} />
          ) : tab === "chatposts" ? (
            <ChatPostsTab search={search} onOpenProfile={openProfile} />
          ) : tab === "friends" ? (
            <FriendsTab search={search} onDataChanged={bump} onOpenProfile={openProfile} />
          ) : (
            <ProfileTab />
          )}
        </main>

        {/*
          Right rail only on large desktop (>1100px). Hiding it in CSS rather than
          with a resize listener keeps this out of the render path entirely — the
          element is simply `display:none` on smaller screens.
        */}
        {tab !== "friends" ? <RightSidebar
          onOpenProfile={openProfile}
          onOpenSearch={() => setSearchOpen(true)}
          onCreateWithFlair={(flair) => {
            // Jump to Chat Posts with the hashtag applied, then open the composer.
            setSearch(flair);
            setTab("chatposts");
            setCreateOpen(true);
          }}
        /> : null}
      </div>

      <BottomNav />
      <NotificationBanner onOpenCenter={() => setBellOpen(true)} />
      {/* Mounted only while open — keeps the feed's DOM small and instant. */}
      {createOpen ? <CreateModal /> : null}
      {searchOpen ? <SearchPanel onClose={() => setSearchOpen(false)} onOpenProfile={openProfile} /> : null}
      {bellOpen ? (
        <NotificationCenter onClose={() => setBellOpen(false)} onNavigate={(next) => setTab(next)} />
      ) : null}
      {profileUserId ? (
        <ProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onMessage={() => setTab("friends")}
        />
      ) : null}
      <ToastHost />
    </div>
  );
}
