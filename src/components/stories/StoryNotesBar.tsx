"use client";

import { useState } from "react";
import { useCliq } from "@/components/CliqProvider";
import { StoryBar } from "@/components/stories/StoryBar";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { CreateStoryModal } from "@/components/stories/CreateStoryModal";
import { CliqNotes } from "@/components/CliqNotes";
import type { StoryGroup } from "@/types/cliq";

/**
 * The combined "Cliq Stories & Notes" bar.
 *
 * Top row: the tap-through Cliq Stories ring bar (your own ring first).
 * Bottom row: Instagram-style 24h Cliq Notes with floating speech bubbles.
 */
export function StoryNotesBar({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { user } = useCliq();
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; startIndex: number } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [bump, setBump] = useState(0);

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#121317] px-2 py-1">
      <StoryBar
        key={bump}
        onOpenViewer={(groups, startIndex) => setViewer({ groups, startIndex })}
        onCompose={() => setComposeOpen(true)}
      />

      <div className="border-t border-zinc-800/70" />

      <div className="pt-3">
        <CliqNotes onOpenProfile={onOpenProfile} />
      </div>

      {composeOpen ? (
        <CreateStoryModal open onClose={() => setComposeOpen(false)} onCreated={() => setBump((b) => b + 1)} />
      ) : null}

      {viewer ? (
        <StoryViewer
          groups={viewer.groups}
          startIndex={viewer.startIndex}
          onClose={() => {
            setViewer(null);
            setBump((b) => b + 1);
          }}
          onOpenProfile={(id) => {
            setViewer(null);
            onOpenProfile(id);
          }}
          onReplied={() => setBump((b) => b + 1)}
        />
      ) : null}
    </div>
  );
}
