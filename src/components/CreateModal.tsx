"use client";

import { useState } from "react";
import { Check, Film, Image as ImageIcon, Link2, MessageSquare, Repeat, Send, Sparkles, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { GradientArt, Modal } from "@/components/ui/Primitives";
import type { ArtSeed } from "@/types/cliq";
import { cx, SAMPLE_VIDEOS } from "@/lib/utils";

const ART_PRESETS: ArtSeed[] = [
  { from: "#7c3aed", to: "#22d3ee", tint: "#e879f9", emoji: "🌆", label: "Neon City" },
  { from: "#e11d48", to: "#f472b6", tint: "#fb7185", emoji: "🎵", label: "Sound Wave" },
  { from: "#059669", to: "#a3e635", tint: "#22c55e", emoji: "🏀", label: "Court" },
  { from: "#0891b2", to: "#a855f7", tint: "#38bdf8", emoji: "💻", label: "Neon Desk" },
  { from: "#f59e0b", to: "#fb7185", tint: "#f97316", emoji: "🎨", label: "Art Splash" },
  { from: "#6366f1", to: "#22d3ee", tint: "#a5b4fc", emoji: "🎬", label: "Cinema" },
];

export function CreateModal() {
  const { createOpen, setCreateOpen, createMode, setCreateMode, addVideoPost, addPhotoPost, addChatPost } =
    useCliq();
  const [caption, setCaption] = useState("");
  const [art, setArt] = useState(0);
  const [videoSrc, setVideoSrc] = useState(0);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [flair, setFlair] = useState("#AskCliq");
  const [flairColor, setFlairColor] = useState("#8b5cf6");

  const FLAIR_CHOICES: [string, string][] = [
    ["#AskCliq", "#8b5cf6"],
    ["#SchoolLife", "#38bdf8"],
    ["#Gaming", "#22c55e"],
    ["#Music", "#f472b6"],
    ["#LateNightThoughts", "#6366f1"],
    ["#Memes", "#f59e0b"],
  ];

  function close() {
    setCreateOpen(false);
    setCaption("");
    setPollOptions(["", ""]);
    setPollMode(false);
  }

  function publish() {
    const chosenArt = ART_PRESETS[art];
    if (createMode === "video") {
      addVideoPost(chosenArt, caption, SAMPLE_VIDEOS[videoSrc % SAMPLE_VIDEOS.length]);
    } else if (createMode === "photo") {
      addPhotoPost(chosenArt, caption);
    } else {
      addChatPost(
        caption,
        flair,
        flairColor,
        pollMode ? pollOptions.filter((o) => o.trim()) : [],
      );
    }
    close();
  }

  const tabs: { key: "video" | "photo" | "chat"; label: string; icon: typeof Film }[] = [
    { key: "video", label: "Video", icon: Film },
    { key: "photo", label: "Photo", icon: ImageIcon },
    { key: "chat", label: "Chat Post", icon: MessageSquare },
  ];

  return (
    <Modal
      open={createOpen}
      onClose={close}
      title="Create on Cliq"
      subtitle="Choose a format, add your vibe, publish instantly ✨"
      maxWidth="max-w-xl"
    >
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCreateMode(key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
              createMode === key ? "bg-[var(--accent-grad)] text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {createMode === "chat" ? "Choose a tint" : "Preview artwork"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ART_PRESETS.map((preset, i) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setArt(i)}
                className={cx(
                  "relative overflow-hidden rounded-2xl border-2 transition",
                  art === i ? "border-[var(--accent)]" : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                <GradientArt art={preset} className="h-20 w-full" />
                <span className="absolute bottom-1 left-1.5 text-[10px] font-bold text-white drop-shadow">
                  {preset.label}
                </span>
                {art === i ? (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-white">
                    <Check size={12} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {createMode === "video" ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Sample clip</p>
            <div className="flex gap-2 overflow-x-auto cliq-no-bar pb-1">
              {SAMPLE_VIDEOS.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setVideoSrc(i)}
                  className={cx(
                    "shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                    videoSrc === i
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  Clip {i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {createMode === "chat" ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Topic flair</p>
            <div className="flex flex-wrap gap-2">
              {FLAIR_CHOICES.map(([label, color]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setFlair(label);
                    setFlairColor(color);
                  }}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={
                    flair === label
                      ? { background: color, borderColor: color, color: "#fff" }
                      : { borderColor: `${color}66`, color, backgroundColor: `${color}18` }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPollMode((v) => !v)}
              className={cx(
                "mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                pollMode
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100"
                  : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
              )}
            >
              <Sparkles size={12} /> {pollMode ? "Poll added" : "Add a quick poll"}
            </button>
            {pollMode ? (
              <div className="mt-3 space-y-2">
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                    }
                    placeholder={`Option ${i + 1}`}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
                  />
                ))}
                {pollOptions.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ""])}
                    className="text-xs font-semibold text-[var(--accent-2)] hover:underline"
                  >
                    + Add option
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder={
            createMode === "chat"
              ? "Drop a thought on Cliq..."
              : createMode === "video"
                ? "Write a caption for your video... #hashtags welcome"
                : "Write a caption for your photo... #hashtags welcome"
          }
          className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
        />
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>{caption.length}/280 characters</span>
          <span>Safe-chat filter keeps Cliq kind 🛡️</span>
        </div>

        <button
          type="button"
          onClick={publish}
          disabled={!caption.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-grad)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={16} /> Publish to Cliq
        </button>
      </div>
    </Modal>
  );
}

export function ShareSheet({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  const { users, me, toast } = useCliq();
  const friends = users.filter((u) => u.id !== me.id).slice(0, 6);

  const actions = [
    { key: "send", label: "Send to a Cliq Friend", icon: Send },
    { key: "copy", label: "Copy Link", icon: Link2 },
    { key: "repost", label: "Repost", icon: Repeat },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Share" subtitle={title} maxWidth="max-w-md">
      <div className="flex gap-3 overflow-x-auto cliq-no-bar pb-3">
        {friends.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              toast(`Sent to ${f.name} ⚡`, "success");
              onClose();
            }}
            className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-2.5 transition hover:border-[var(--accent)]"
          >
            <span
              className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${f.avatar[0]}, ${f.avatar[1]})` }}
            >
              {f.name.charAt(0)}
            </span>
            <span className="truncate text-[10px] font-semibold text-zinc-300">{f.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {actions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              toast(key === "copy" ? "Link copied to clipboard 🔗" : "Reposted to your Cliq 🔁", "success");
              onClose();
            }}
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

export function CommentDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center">
      <button type="button" aria-label="Close comments" onClick={onClose} className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" />
      <div className="cliq-slide-up relative z-10 flex h-[75vh] w-full max-w-2xl flex-col rounded-t-3xl border border-zinc-800/80 bg-zinc-900/95 backdrop-blur-xl sm:h-[70vh]">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3.5">
          <p className="text-sm font-bold text-zinc-100">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-zinc-100"
          >
            <X size={15} />
          </button>
        </div>
        <div className="cliq-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
