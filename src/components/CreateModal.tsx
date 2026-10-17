"use client";

import { useRef, useState } from "react";
import {
  Check,
  Film,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Modal } from "@/components/ui/Primitives";
import { FLAIRS } from "@/lib/constants";
import { api } from "@/lib/api-client";
import {
  CloudinaryNotConfiguredError,
  FileTooLargeError,
  uploadMedia,
} from "@/lib/cloudinary";
import {
  DEFAULT_VIDEO_PRESET,
  VIDEO_PRESETS,
  formatBytes,
  suggestPreset,
  type VideoPresetName,
} from "@/lib/video-compress";
import { prependPost } from "@/components/tabs/useFeed";
import type { PostType } from "@/types/cliq";
import { cx } from "@/lib/utils";

interface UploadState {
  /** 0-100, or null when no upload is running */
  progress: number | null;
  name: string;
  kind: "image" | "video";
  localUrl: string;
  /** Compression happens before the upload; the label reflects that. */
  phase: "compressing" | "uploading" | "done";
  /** Original size, and the size after compression (once known). */
  originalBytes: number;
  compressedBytes: number | null;
}

export function CreateModal() {
  const { createOpen, setCreateOpen, tab, toast, apiError, user, mediaUnconfigured, bump } = useCliq();
  const [type, setType] = useState<PostType>("video");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [flair, setFlair] = useState(FLAIRS[0].label);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<VideoPresetName>(DEFAULT_VIDEO_PRESET);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    setContent("");
    setMediaUrl("");
    setPollMode(false);
    setPollOptions(["", ""]);
    setUpload((prev) => {
      if (prev) URL.revokeObjectURL(prev.localUrl);
      return null;
    });
  }

  function close() {
    abortRef.current?.abort();
    reset();
    setCreateOpen(false);
  }

  /** Upload straight to Cloudinary so Vercel never sees the bytes. */
  async function handleFile(file: File) {
    if (mediaUnconfigured) {
      toast("Media uploads need Cloudinary env vars set. You can paste a URL instead.", "danger");
      return;
    }

    const isVideo = file.type.startsWith("video/");
    // Recommend a preset from the file size; the user can override below.
    if (isVideo) setPreset(suggestPreset(file.size, 0));
    const localUrl = URL.createObjectURL(file);
    setUpload({
      progress: 0,
      name: file.name,
      kind: isVideo ? "video" : "image",
      localUrl,
      phase: isVideo ? "compressing" : "uploading",
      originalBytes: file.size,
      compressedBytes: null,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await uploadMedia(file, {
        preset,
        signal: controller.signal,
        onPrepare: ({ percent, detail }) =>
          setUpload((prev) =>
            prev ? { ...prev, phase: "compressing", progress: percent, name: `${prev.name} · ${detail}` } : prev,
          ),
        onProgress: (percent) =>
          setUpload((prev) => (prev ? { ...prev, phase: "uploading", progress: percent } : prev)),
      });
      setMediaUrl(result.secureUrl);
      setUpload((prev) =>
        prev
          ? { ...prev, progress: 100, phase: "done", compressedBytes: result.bytes ?? null }
          : prev,
      );
      toast("Upload complete ✅", "success");
    } catch (error) {
      setUpload((prev) => {
        if (prev) URL.revokeObjectURL(prev.localUrl);
        return null;
      });
      if (error instanceof CloudinaryNotConfiguredError) {
        toast("Media uploads are not configured — paste a URL instead.", "danger");
      } else if (error instanceof FileTooLargeError) {
        toast(error.message, "danger");
      } else if (error instanceof Error && /cancel/i.test(error.message)) {
        toast("Upload cancelled", "default");
      } else {
        apiError(error);
      }
    } finally {
      abortRef.current = null;
    }
  }

  const typeForTab: PostType | null =
    tab === "videos" ? "video" : tab === "photos" ? "photo" : tab === "chatposts" ? "chat" : null;

  const uploading = upload?.progress !== null && upload?.progress !== undefined && upload.progress < 100;
  const canPublish =
    (type === "chat" ? content.trim().length > 0 : content.trim().length > 0 || mediaUrl.trim().length > 0) &&
    !uploading;

  async function publish() {
    if (!canPublish || busy) return;
    setBusy(true);
    try {
      const { post } = await api.createPost({
        type,
        content: content.trim(),
        mediaUrl: mediaUrl.trim() || null,
        flair: type === "chat" ? flair : null,
        pollOptions: type === "chat" && pollMode ? pollOptions.filter((o) => o.trim()) : [],
      });
      // Show it in the feed immediately, then let SWR reconcile.
      await prependPost(type, post);
      bump();
      toast("Published to Cliq ⚡", "success");
      close();
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: PostType; label: string; icon: typeof Film }[] = [
    { key: "video", label: "Video", icon: Film },
    { key: "photo", label: "Photo", icon: ImageIcon },
    { key: "chat", label: "Chat Post", icon: MessageSquare },
  ];

  return (
    <Modal
      open={createOpen}
      onClose={close}
      title="Create on Cliq"
      subtitle="Uploads go straight to Cloudinary — fast, even on mobile data ✨"
      maxWidth="max-w-xl"
    >
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setType(key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
              type === key ? "bg-[var(--accent-grad)] text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {typeForTab && typeForTab !== type ? (
        <p className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px] text-zinc-400">
          You&apos;re on the {tab === "videos" ? "Videos" : tab === "photos" ? "Photos" : "Chat Posts"} tab — this
          will post there.
        </p>
      ) : null}

      <div className="space-y-4">
        {type !== "chat" ? (
          <div>
            {/* live preview */}
            {upload || mediaUrl ? (
              <div className="relative mb-2 overflow-hidden rounded-2xl border border-zinc-800 bg-black">
                {upload?.kind === "video" && upload.localUrl ? (
                  <video src={upload.localUrl} className="max-h-64 w-full object-contain" controls muted playsInline />
                ) : mediaUrl || upload?.localUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={upload?.localUrl ?? mediaUrl}
                    alt="Upload preview"
                    className="max-h-64 w-full object-contain"
                  />
                ) : null}

                {uploading ? (
                  <div className="absolute inset-x-0 bottom-0 bg-zinc-950/80 px-3 py-2 backdrop-blur">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-zinc-300">
                      <span className="truncate">
                        {upload?.phase === "compressing" ? "Optimising" : "Uploading"} · {upload?.name}
                      </span>
                      <span className="tabular-nums">{upload?.progress ?? 0}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-[var(--accent-grad)] transition-[width] duration-200"
                        style={{ width: `${upload?.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    setMediaUrl("");
                    setUpload((prev) => {
                      if (prev) URL.revokeObjectURL(prev.localUrl);
                      return null;
                    });
                  }}
                  aria-label="Remove media"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-zinc-950/70 text-zinc-200 backdrop-blur transition hover:text-white"
                >
                  <X size={14} />
                </button>

                {upload?.phase === "done" && upload.compressedBytes && upload.compressedBytes < upload.originalBytes ? (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                    {formatBytes(upload.originalBytes)} → {formatBytes(upload.compressedBytes)}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
              >
                <UploadCloud size={13} /> {type === "video" ? "Upload video" : "Upload photo"}
              </button>
              <span className="text-[11px] text-zinc-600">or paste a link</span>
              <input
                ref={fileRef}
                type="file"
                accept={type === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="relative mt-2">
              <Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={mediaUrl.startsWith("blob:") ? "" : mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={type === "video" ? "https://.../clip.mp4" : "https://.../photo.jpg"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
              />
            </div>

            {upload?.kind === "video" && !uploading ? (
              <div className="mt-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Quality · smaller file vs. sharper video
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(VIDEO_PRESETS) as VideoPresetName[]).map((key) => {
                    const option = VIDEO_PRESETS[key];
                    const active = preset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPreset(key)}
                        className={cx(
                          "rounded-xl border px-2 py-1.5 text-left transition",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-zinc-800 hover:border-zinc-700",
                        )}
                      >
                        <span className="block text-[11px] font-bold text-zinc-100">{option.label}</span>
                        <span className="block text-[10px] text-zinc-500">
                          {option.maxEdge}p · {(option.videoBitsPerSecond / 1_000_000).toFixed(1)} Mbps
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {mediaUnconfigured ? (
              <p className="mt-2 text-[10px] leading-relaxed text-amber-300/80">
                Direct uploads are off until NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
                NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET are set. Pasting a URL still works.
              </p>
            ) : null}
          </div>
        ) : null}

        {type === "chat" ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Topic flair</p>
            <div className="flex flex-wrap gap-2">
              {FLAIRS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setFlair(f.label)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={
                    flair === f.label
                      ? { background: f.color, borderColor: f.color, color: "#fff" }
                      : { borderColor: `${f.color}66`, color: f.color, backgroundColor: `${f.color}18` }
                  }
                >
                  {f.label}
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
                    onChange={(e) => setPollOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
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
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={
            type === "chat"
              ? "Drop a thought on Cliq..."
              : type === "video"
                ? "Write a caption for your video... #hashtags welcome"
                : "Write a caption for your photo... #hashtags welcome"
          }
          className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
        />
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>{content.length}/500 characters</span>
          <span>{user ? `Posting as @${user.username}` : "Safe-chat filter keeps Cliq kind 🛡️"}</span>
        </div>

        <button
          type="button"
          onClick={() => void publish()}
          disabled={!canPublish || busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-grad)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? (
            <span>
              {upload?.phase === "compressing" ? "Optimising" : "Uploading"} {upload?.progress ?? 0}%
            </span>
          ) : busy ? (
            <span>Publishing...</span>
          ) : (
            <>
              <Check size={16} /> Publish to Cliq
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

export { ShareSheet } from "@/components/ShareSheet";
