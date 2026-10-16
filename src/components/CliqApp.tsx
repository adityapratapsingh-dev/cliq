"use client";

import { useEffect, useState } from "react";
import { useCliq } from "@/components/CliqProvider";
import { BottomNav, Header, Sidebar } from "@/components/Shell";
import { CreateModal } from "@/components/CreateModal";
import { ToastHost } from "@/components/ToastHost";
import { VideosTab } from "@/components/tabs/VideosTab";
import { PhotosTab } from "@/components/tabs/PhotosTab";
import { ChatPostsTab } from "@/components/tabs/ChatPostsTab";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { accentVars } from "@/lib/theme";

export function CliqApp() {
  const { tab, settings } = useCliq();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div style={accentVars(settings.accent)} className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="cliq-drift absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent-grad)" }}
        />
        <div
          className="cliq-drift absolute -right-20 top-1/3 h-80 w-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--accent-grad)", animationDelay: "3s" }}
        />
      </div>

      <div className="relative">
        <Header />
        <div className="mx-auto flex max-w-7xl">
          <Sidebar />
          <main className="cliq-scroll min-w-0 flex-1 pb-24 lg:pb-8">
            {!ready ? (
              <TabSkeleton />
            ) : tab === "videos" ? (
              <VideosTab />
            ) : tab === "photos" ? (
              <PhotosTab />
            ) : tab === "chatposts" ? (
              <ChatPostsTab />
            ) : tab === "friends" ? (
              <FriendsTab />
            ) : (
              <ProfileTab />
            )}
          </main>
        </div>
      </div>

      <BottomNav />
      <CreateModal />
      <ToastHost />
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="cliq-skeleton rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-zinc-800" />
              <div className="h-2.5 w-20 rounded bg-zinc-800" />
            </div>
          </div>
          <div className="mt-3 h-40 rounded-2xl bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
