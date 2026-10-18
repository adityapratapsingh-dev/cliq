"use client";

import { useEffect, useState } from "react";
import { useCliq } from "@/components/CliqProvider";
import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, LeftRail } from "@/components/Shell";
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

/** Center column width per tab, matching each section's natural content width. */
const CENTER_WIDTH: Record<string, string> = {
  chatposts: "max-w-[620px] border-x border-zinc-800/80",
  photos: "max-w-[620px]",
  videos: "max-w-[620px]",
  friends: "max-w-[900px]",
  profile: "max-w-[935px]",
};

export function CliqApp() {
  const { user, loading, settings, tab, setTab, refreshUser, bump, markTabSeen, search } = useCliq();
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
      <div className="flex min-h-dvh items-center justify-center bg-black">
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

  const centerWidth = CENTER_WIDTH[tab] ?? "max-w-[600px]";

  return (
    <div style={accentVars(settings.accent)} className="min-h-dvh bg-black text-zinc-100">
      <LeftRail onOpenSearch={() => setSearchOpen(true)} onOpenNotifications={() => setBellOpen(true)} />

      <div className="flex w-full justify-center lg:pl-[72px] xl:pl-[244px]">
        <main className={cx("cliq-scroll min-w-0 w-full pb-16 lg:pb-0", centerWidth)}>
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

        {tab !== "friends" ? <RightSidebar onOpenProfile={openProfile} onOpenSearch={() => setSearchOpen(true)} /> : null}
      </div>

      <BottomNav onOpenSearch={() => setSearchOpen(true)} />
      <NotificationBanner onOpenCenter={() => setBellOpen(true)} />
      <CreateModal />
      {searchOpen ? <SearchPanel onClose={() => setSearchOpen(false)} onOpenProfile={openProfile} /> : null}
      {bellOpen ? (
        <NotificationCenter onClose={() => setBellOpen(false)} onNavigate={(next) => setTab(next)} />
      ) : null}
      <ProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} onMessage={() => setTab("friends")} />
      <ToastHost />
    </div>
  );
}
