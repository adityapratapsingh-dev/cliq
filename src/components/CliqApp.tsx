"use client";

import { useEffect, useState } from "react";
import { useCliq } from "@/components/CliqProvider";
import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, Header, Sidebar } from "@/components/Shell";
import { CreateModal } from "@/components/CreateModal";
import { ToastHost } from "@/components/ToastHost";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { ContextRail } from "@/components/ContextRail";
import { SearchDropdown } from "@/components/SearchDropdown";
import { ProfileModal } from "@/components/ProfileModal";
import { VideosTab } from "@/components/tabs/VideosTab";
import { PhotosTab } from "@/components/tabs/PhotosTab";
import { ChatPostsTab } from "@/components/tabs/ChatPostsTab";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { accentVars } from "@/lib/theme";
import { Spinner } from "@/components/ui/Primitives";

export function CliqApp() {
  const { user, loading, settings, tab, setTab, refreshUser, bump, markTabSeen } = useCliq();
  const [search, setSearch] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  // Which user's public profile is open, if any.
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const openProfile = (id: string) => setProfileUserId(id);

  useEffect(() => {
    if (tab !== "friends") setBellOpen(false);
    // Opening a tab clears its "new posts" red dot.
    markTabSeen(tab);
  }, [tab, markTabSeen]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6" />
          <p className="text-xs text-zinc-500">Warming up Cliq...</p>
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
            setTab("videos");
          }}
        />
        <ToastHost />
      </div>
    );
  }

  return (
    <div style={accentVars(settings.accent)} className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="relative">
        <Header
          search={search}
          onSearch={setSearch}
          onBell={() => setBellOpen((v) => !v)}
          onProfile={() => setTab("profile")}
          searchSlot={
            search.trim() ? (
              <SearchDropdown
                query={search}
                onClose={() => setSearch("")}
                onOpenProfile={openProfile}
                onSearch={setSearch}
              />
            ) : null
          }
        />
        {bellOpen ? (
          <NotificationCenter onClose={() => setBellOpen(false)} onNavigate={(next) => setTab(next)} />
        ) : null}
        <div className="mx-auto flex w-full max-w-[1400px] justify-center gap-6 px-0 lg:px-4">
          <Sidebar />
          <main className="cliq-scroll min-w-0 w-full max-w-[620px] pb-24 lg:pb-8">
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
          <ContextRail
            onOpenProfile={openProfile}
            onOpenChats={() => setTab("friends")}
            onFilterFlair={(flair) => {
              setSearch(flair);
              setTab("chatposts");
            }}
          />
        </div>
      </div>

      <BottomNav />
      <NotificationBanner onOpenCenter={() => setBellOpen(true)} />
      <CreateModal />
      <ProfileModal
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        onMessage={() => setTab("friends")}
      />
      <ToastHost />
    </div>
  );
}
