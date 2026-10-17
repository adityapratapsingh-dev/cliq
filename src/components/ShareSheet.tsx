"use client";

import { useState } from "react";
import { Link2, Sparkles, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Modal } from "@/components/ui/Primitives";

/** Quick share sheet used by the photo, video and chat-post cards. */
export function ShareSheet({
  open,
  onClose,
  title,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onShare?: (action: "copy" | "repost") => void;
}) {
  const { toast } = useCliq();
  const [copied, setCopied] = useState(false);

  const actions = [
    {
      key: "copy" as const,
      label: copied ? "Link copied ✓" : "Copy Link",
      icon: Link2,
      run: () => {
        const url = typeof window !== "undefined" ? window.location.href : "https://oncliq.vercel.app";
        navigator.clipboard?.writeText(url).catch(() => undefined);
        setCopied(true);
        onShare?.("copy");
        toast("Link copied to clipboard 🔗", "success");
      },
    },
    {
      key: "repost" as const,
      label: "Repost to my Cliq",
      icon: Sparkles,
      run: () => {
        onShare?.("repost");
        toast("Reposted 🔁", "success");
      },
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Share" subtitle={title} maxWidth="max-w-md">
      <div className="space-y-1.5">
        {actions.map(({ key, label, icon: Icon, run }) => (
          <button
            key={key}
            type="button"
            onClick={run}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[var(--accent)] hover:bg-zinc-900"
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold text-zinc-500 transition hover:text-zinc-200"
      >
        <X size={14} /> Cancel
      </button>
    </Modal>
  );
}
