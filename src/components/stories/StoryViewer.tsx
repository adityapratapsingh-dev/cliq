"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Send, Trash2, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar } from "@/components/ui/Primitives";
import { api } from "@/lib/api-client";
import { storyGradient } from "@/lib/social-defaults";
import type { StoryGroup } from "@/types/cliq";
import { clockTime, cx } from "@/lib/utils";

const SLIDE_MS = 5000;

/**
 * Full-screen, tap-through Cliq Story viewer.
 *
 * Progress bars run across the top; tapping the right half advances, the left
 * half goes back. Your own story shows a delete + view count instead of a reply.
 */
export function StoryViewer({
  groups,
  startIndex,
  onClose,
  onOpenProfile,
  onReplied,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onOpenProfile: (id: string) => void;
  onReplied?: (userId: string) => void;
}) {
  const { user, toast, apiError } = useCliq();
  const [groupIndex, setGroupIndex] = useState(Math.max(0, startIndex));
  const [slideIndex, setSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const timer = useRef<number | null>(null);
  const viewed = useRef<Set<string>>(new Set());

  const group = groups[groupIndex];
  const story = group?.stories[slideIndex] ?? null;
  const mine = Boolean(user && group?.author.id === user.id);

  const goNext = useCallback(() => {
    setGroupIndex((gi) => {
      const current = groups[gi];
      if (current && slideIndex < current.stories.length - 1) {
        setSlideIndex((si) => si + 1);
        return gi;
      }
      if (gi < groups.length - 1) {
        setSlideIndex(0);
        return gi + 1;
      }
      onClose();
      return gi;
    });
  }, [groups, slideIndex, onClose]);

  const goPrev = useCallback(() => {
    if (slideIndex > 0) {
      setSlideIndex((si) => si - 1);
      return;
    }
    if (groupIndex > 0) {
      const prev = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setSlideIndex(Math.max(0, prev.stories.length - 1));
    }
  }, [groupIndex, slideIndex, groups]);

  // Record the view once per story (idempotent server-side too).
  useEffect(() => {
    if (!story) return;
    if (viewed.current.has(story.id)) return;
    viewed.current.add(story.id);
    void api.viewStory(story.id).catch(() => undefined);
  }, [story]);

  // Auto-advance progress.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    if (paused) return;
    const started = Date.now();
    timer.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(100, (elapsed / SLIDE_MS) * 100);
      setProgress(pct);
      if (pct >= 100) goNext();
    }, 50);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [story, paused, goNext]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const gradient = useMemo(() => (story ? storyGradient(story.bgStyle) : undefined), [story]);

  if (!group || !story) return null;

  async function sendReply() {
    if (!replyText.trim() || sending || !group) return;
    setSending(true);
    try {
      await api.sendMessage({
        receiverId: group.author.id,
        content: `↩︎ Story reply: ${replyText.trim()}`,
        mediaUrl: story?.mediaUrl ?? null,
      });
      setReplyText("");
   toast("Reply sent to their DMs","success");
      onReplied?.(group.author.id);
      onClose();
    } catch (error) {
      apiError(error);
    } finally {
      setSending(false);
    }
  }

  async function removeStory() {
    if (!story) return;
    try {
      await api.deleteStory(story.id);
   toast("Story deleted","default");
      onClose();
    } catch (error) {
      apiError(error);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95">
      <div
        className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-black sm:h-[92vh] sm:rounded-3xl"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {/* progress bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2.5">
          {group.stories.map((s, i) => (
            <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-100"
                style={{ width: i < slideIndex ? "100%" : i === slideIndex ? `${progress}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        {/* header */}
        <div className="absolute inset-x-0 top-3 z-20 flex items-center gap-2.5 px-3 pt-3">
          <button type="button" onClick={() => onOpenProfile(group.author.id)} className="shrink-0">
            <Avatar user={group.author} size={34} ring />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{group.author.displayName}</p>
            <p className="truncate text-[10px] text-white/60">
              @{group.author.username} · {clockTime(story.createdAt)}
            </p>
          </div>
          {mine ? (
            <button
              type="button"
              onClick={() => void removeStory()}
              aria-label="Delete story"
              className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/90 backdrop-blur transition hover:text-rose-300"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story"
            className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/90 backdrop-blur transition hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* media / text card */}
        <div className="relative flex-1">
          {story.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.mediaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center px-8 text-center" style={{ background: gradient }}>
              <p className="text-2xl font-black leading-snug text-white drop-shadow">{story.caption}</p>
            </div>
          )}

          {story.mediaUrl && story.caption ? (
            <p className="absolute inset-x-0 bottom-24 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-10 text-center text-sm font-semibold text-white">
              {story.caption}
            </p>
          ) : null}

          {/* tap zones */}
          <button
            type="button"
            aria-label="Previous"
            onClick={goPrev}
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={goNext}
            className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
          />
          <ChevronLeft size={26} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
          <ChevronRight size={26} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/25" />
        </div>

        {/* footer */}
        <div className="relative z-20 flex items-center gap-2 p-3">
          {mine ? (
            <div className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white/10 py-2.5 text-xs font-semibold text-white/80 backdrop-blur">
              <Eye size={14} /> {story.viewsCount} view{story.viewsCount === 1 ? "" : "s"}
            </div>
          ) : (
            <>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendReply();
                }}
                placeholder={`Reply to @${group.author.username}...`}
                className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs text-white outline-none placeholder:text-white/50 focus:border-white/40"
              />
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={!replyText.trim() || sending}
                aria-label="Send reply"
                className={cx(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40",
                )}
              >
                <Send size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
