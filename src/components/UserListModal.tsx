"use client";

import { useEffect, useState } from "react";
import { MessageSquare, UserPlus } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, Modal, Spinner } from "@/components/ui/Primitives";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/types/cliq";

/**
 * A clean modal list of users — used by the profile's Friends / Following stats.
 * Each row can open the profile or jump straight into a DM.
 */
export function UserListModal({
  open,
  title,
  userIds,
  onClose,
  onOpenProfile,
}: {
  open: boolean;
  title: string;
  userIds: string[];
  onClose: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { openChat } = useCliq();
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void api
      .listUsers()
      .then((all) => {
        if (cancelled) return;
        const wanted = new Set(userIds);
        setPeople(all.filter((p) => wanted.has(p.id)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userIds]);

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      {loading ? (
        <div className="flex items-center justify-center py-10 text-zinc-500">
          <Spinner /> <span className="ml-2 text-xs">Loading...</span>
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <UserPlus size={22} className="text-zinc-600" />
          <p className="text-xs text-zinc-500">No one here yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {people.map((person) => (
            <div key={person.id} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-zinc-800/50">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfile(person.id);
                }}
                className="shrink-0 rounded-full transition hover:brightness-110"
                aria-label={`Open ${person.displayName}'s profile`}
              >
                <Avatar user={person} size={40} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfile(person.id);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-xs font-bold text-zinc-100">{person.displayName}</span>
                <span className="block truncate text-[11px] text-zinc-500">@{person.username}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openChat(person);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800/80 px-3 py-1.5 text-[11px] font-bold text-zinc-300 transition hover:border-indigo-500 hover:text-zinc-100"
              >
                <MessageSquare size={12} /> Message
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
