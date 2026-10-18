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
 * Full mode stacks the tap-through Cliq Stories ring bar above the 24h Notes
 * row. `compact` merges both into a single ~96px horizontal carousel for the top
 * of the Chats inbox.
 */
export function StoryNotesBar({
  onOpenProfile,
  compact = false,
}: {
  onOpenProfile: (id: string) => void;
  compact?: boolean;
}) {
  const { user } = useCliq();
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; startIndex: number } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [bump, setBump] = useState(0);

  if (!user) return null;

  const storyBar = (
    <StoryBar
      key={bump}
      inline={compact}
      onOpenViewer={(groups, startIndex) => setViewer({ groups, startIndex })}
      onCompose={() => setComposeOpen(true)}
    />
  );

  return (
    <div className={compact ? "" : "rounded-2xl border border-white/10 bg-[#121216]/90 px-2 py-1"}>
      {compact ? (
        <div className="no-scrollbar flex h-24 items-center gap-3 overflow-x-auto">
          {storyBar}
          <span className="h-10 w-px shrink-0 self-center bg-white/10" />
          <CliqNotes inline onOpenProfile={onOpenProfile} />
        </div>
      ) : (
        <>
          {storyBar}
          <div className="border-t border-white/10" />
          <div className="pt-3">
            <CliqNotes onOpenProfile={onOpenProfile} />
          </div>
        </>
      )}

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
