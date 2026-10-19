"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Sparkles, UploadCloud, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Modal, Spinner } from "@/components/ui/Primitives";
import { api } from "@/lib/api-client";
import { CloudinaryNotConfiguredError, FileTooLargeError, uploadMedia } from "@/lib/cloudinary";
import { STORY_BG_STYLES, storyGradient } from "@/lib/social-defaults";
import type { StoryBgStyle } from "@/types/cliq";
import { cx } from "@/lib/utils";

const CAPTION_MAX = 200;

/**
 * Compose a Cliq Story.
 *
 * Two modes: a photo (uploaded to Cloudinary) with an optional caption, or a
 * stylized text card on a gradient. Everything expires after 24 hours.
 */
export function CreateStoryModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast, apiError, mediaUnconfigured, user } = useCliq();
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [bgStyle, setBgStyle] = useState<StoryBgStyle>("indigo");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCaption("");
    setMediaUrl("");
    setUrlMode(false);
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    if (mediaUnconfigured) {
   toast("Media uploads need Cloudinary env vars. Paste a URL instead.","danger");
      return;
    }
    if (!file.type.startsWith("image/")) {
   toast("Stories take a photo or a text card.","danger");
      return;
    }
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      setMediaUrl(result.secureUrl);
   toast("Photo ready","success");
    } catch (error) {
      if (error instanceof CloudinaryNotConfiguredError) {
    toast("Media uploads are not configured — paste a URL instead.","danger");
      } else if (error instanceof FileTooLargeError) {
    toast(error.message,"danger");
      } else {
        apiError(error);
      }
      setLocalUrl(null);
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (busy) return;
    const hasMedia = mode === "photo" && (mediaUrl.trim() || localUrl);
    if (mode === "photo" && !hasMedia) {
   toast("Add a photo for your story.","danger");
      return;
    }
    if (mode === "text" && !caption.trim()) {
   toast("Write something for your story.","danger");
      return;
    }
    setBusy(true);
    try {
      await api.createStory({
        mediaUrl: mode === "photo" ? mediaUrl.trim() || null : null,
        caption: caption.trim(),
        bgStyle,
      });
   toast("Story shared — live for 24h","success");
      onCreated();
      close();
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
  <Modal open={open} onClose={close} title="New Cliq Story" subtitle="Live for 24 hours · then it's gone">
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#262626] bg-[#1a1a1a] p-1">
        {(
          [
            { key: "photo", label: "Photo", icon: ImagePlus },
            { key: "text", label: "Text card", icon: Sparkles },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
              mode === key ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* live preview */}
      <div className="relative mx-auto aspect-[9/14] w-full max-w-[240px] overflow-hidden rounded-3xl border border-[#262626]">
        {mode === "photo" && (mediaUrl || localUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl || localUrl || ""} alt="" className="h-full w-full object-cover"  loading="lazy" decoding="async" />
        ) : mode === "text" ? (
          <div className="grid h-full w-full place-items-center p-5 text-center" style={{ background: storyGradient(bgStyle) }}>
            <p className="text-lg font-black leading-snug text-white drop-shadow">
              {caption.trim() || "Your story text..."}
            </p>
          </div>
        ) : (
          <div className="grid h-full w-full place-items-center bg-zinc-950 text-center text-[11px] text-zinc-600">
            <span>
              <ImagePlus className="mx-auto mb-2" size={22} />
              Your photo preview
            </span>
          </div>
        )}

        {mode === "photo" && caption.trim() ? (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-center text-[11px] font-semibold text-white">
            {caption}
          </p>
        ) : null}

        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-white">
            <Spinner />
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {mode === "photo" ? (
          mediaUrl || localUrl ? (
            <button
              type="button"
              onClick={() => {
                setMediaUrl("");
                if (localUrl) URL.revokeObjectURL(localUrl);
                setLocalUrl(null);
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-300 transition hover:text-rose-200"
            >
              <X size={12} /> Remove photo
            </button>
          ) : (
            <>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className={cx(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition",
                  dragging ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-700 hover:border-indigo-500",
                )}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-300">
                  <UploadCloud size={20} />
                </span>
                <span className="text-sm font-bold text-zinc-100">Drop a photo here</span>
                <span className="text-[11px] text-zinc-500">Drag &amp; drop, or tap to select from your gallery</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {urlMode ? (
                <div className="relative">
                  <Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://.../photo.jpg"
                    className="w-full rounded-xl border border-[#262626] bg-[#1a1a1a] py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setUrlMode(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 transition hover:text-indigo-200"
                >
                  <Link2 size={12} /> Paste direct URL instead
                </button>
              )}
            </>
          )
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Background</p>
            <div className="flex flex-wrap gap-2">
              {STORY_BG_STYLES.map((style) => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setBgStyle(style.key)}
                  aria-label={style.label}
                  className={cx(
                    "h-9 w-9 rounded-full border-2 transition",
                    bgStyle === style.key ? "border-white scale-110" : "border-transparent",
                  )}
                  style={{ background: style.gradient }}
                />
              ))}
            </div>
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          maxLength={CAPTION_MAX}
          placeholder={mode === "text" ? "What's the story? #vibes" : "Add a caption... (optional)"}
          className="w-full resize-none rounded-2xl border border-[#262626] bg-[#1a1a1a] p-3 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            {caption.length}/{CAPTION_MAX}
          </span>
          <span>{user ? `Posting as @${user.username}` : ""}</span>
        </div>

        <button
          type="button"
          onClick={() => void publish()}
          disabled={busy || uploading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? "Sharing..." : <><Sparkles size={16} /> Share story</>}
        </button>
      </div>
    </Modal>
  );
}
