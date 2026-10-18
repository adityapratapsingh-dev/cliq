"use client";

import { useState } from "react";
import {
  BarChart2,
  Bookmark,
  Check,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Quote,
  Repeat2,
  Send,
  Share,
  Trash2,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, IconButton, Modal, SkeletonCard } from "@/components/ui/Primitives";
import { CommentThread, HashtagText, VoteBar } from "@/components/ui/FeedBits";
import { CliqNotes } from "@/components/CliqNotes";
import { QuotedPostEmbed } from "@/components/tabs/QuotedPostEmbed";
import { ShareSheet } from "@/components/ShareSheet";
import { matchesSearch, prependPost, useComments, useFeed } from "@/components/tabs/useFeed";
import { usePostActions } from "@/components/tabs/usePostActions";
import { api } from "@/lib/api-client";
import { FLAIRS } from "@/lib/constants";
import type { Post } from "@/types/cliq";
import { censor, cx, timeAgo } from "@/lib/utils";

type FeedMode = "for-you" | "following";

export function ChatPostsTab({ search, onOpenProfile }: { search: string; onOpenProfile: (id: string) => void }) {
  const { posts, loading } = useFeed("chat");
  const { setCreateOpen, followingIds } = useCliq();
  const [mode, setMode] = useState<FeedMode>("for-you");

  const matched = posts.filter((p) => matchesSearch(p, search));
  const visible =
    mode === "following" ? matched.filter((p) => p.author && followingIds.includes(p.author.id)) : matched;

  return (
    <div className="min-h-[60dvh]">
      {/* Sticky header: For you / Following */}
      <div className="sticky top-14 z-30 flex h-[53px] border-b border-white/10 bg-black/80 backdrop-blur-md md:top-0">
        {(
          [
            { key: "for-you", label: "For you" },
            { key: "following", label: "Following" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className="relative flex flex-1 items-center justify-center transition hover:bg-zinc-900/60"
          >
            <span className={cx("text-sm", mode === key ? "font-semibold text-white" : "font-normal text-zinc-500")}>
              {label}
            </span>
            {mode === key ? (
              <span className="absolute bottom-0 h-[3px] w-14 rounded-full bg-white" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Cliq Notes — Instagram-style 24h status bubbles */}
      <div className="border-b border-white/10 px-3 py-3">
        <CliqNotes bare onOpenProfile={onOpenProfile} />
      </div>

      <Composer />

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={26} strokeWidth={1.75} />}
          title={search ? "No posts match that search" : mode === "following" ? "No posts from people you follow" : "No posts yet"}
          hint={
            search
              ? "Try a different search."
              : mode === "following"
                ? "Follow people to see their posts here."
                : "Be the first to post — ask a question or share a hot take."
          }
          actionLabel={mode === "for-you" && !search ? "Create a post" : undefined}
          onAction={mode === "for-you" && !search ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        visible.map((post) => <PostRow key={post.id} post={post} onOpenProfile={onOpenProfile} />)
      )}
    </div>
  );
}

function Composer() {
  const { user, toast, apiError, bump } = useCliq();
  const [text, setText] = useState("");
  const [flair, setFlair] = useState(FLAIRS[0]);
  const [pollMode, setPollMode] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const { post } = await api.createPost({
        type: "chat",
        content: text.trim(),
        flair: flair.label,
        pollOptions: pollMode ? options.filter((o) => o.trim()) : [],
      });
      setText("");
      setPollMode(false);
      setOptions(["", ""]);
      await prependPost("chat", post);
      bump();
      toast("Post published", "success");
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3 border-b border-white/10 p-4">
      {user ? <Avatar user={user} size={40} /> : null}
      <div className="min-w-0 flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          maxLength={500}
          placeholder="What's happening?"
          className="w-full resize-none bg-transparent py-1.5 text-[15px] text-white outline-none placeholder:text-zinc-500"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {FLAIRS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFlair(f)}
              className={cx(
                "rounded-full px-2.5 py-0.5 text-xs transition",
                flair.label === f.label
                  ? "bg-zinc-100 font-semibold text-black"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {pollMode ? (
          <div className="mt-3 space-y-2">
            {options.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
                placeholder={`Option ${i + 1}`}
                className="w-full rounded-lg border border-white/10 bg-[#121216] px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
              />
            ))}
            {options.length < 4 ? (
              <button
                type="button"
                onClick={() => setOptions((prev) => [...prev, ""])}
                className="text-xs font-semibold text-[#4f46e5] hover:underline"
              >
                Add option
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex items-center gap-1 text-zinc-500">
            <IconButton icon={<ImageIcon size={18} strokeWidth={1.75} />} title="Media" />
            <button
              type="button"
              onClick={() => setPollMode((v) => !v)}
              title="Poll"
              className={cx(
                "grid h-8 w-8 place-items-center rounded-full transition",
                pollMode ? "text-[#4f46e5]" : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              <BarChart2 size={18} strokeWidth={1.75} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || busy}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            {busy ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostRow({ post, onOpenProfile }: { post: Post; onOpenProfile: (id: string) => void }) {
  const { user, toast, savedIds, toggleSaved, settings, bump, apiError } = useCliq();
  const { react, votePoll, remove, replacePost } = usePostActions();

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const { comments, loading, add } = useComments(post.id, commentsOpen);

  const saved = savedIds.includes(post.id);
  const mine = post.userId === user?.id;
  const hideCounts = settings.hideDislikes && mine;
  const vote = post.myReaction === "upgrade" ? "up" : post.myReaction === "downgrade" ? "down" : null;
  const score = post.upgradesCount - post.downgradesCount;
  const pollTotal = post.poll ? post.poll.options.reduce((sum, o) => sum + o.votes, 0) : 0;

  async function pinPost(id: string, pinned: boolean) {
    try {
      const { post: updated } = await api.pinPost(id, pinned);
      replacePost(updated);
      toast(pinned ? "Pinned to your profile" : "Unpinned", "success");
    } catch (error) {
      apiError(error);
    }
  }

  return (
    <article className="flex gap-3 border-b border-white/10 px-4 py-3.5 transition-colors hover:bg-[#080808]">
      <button
        type="button"
        onClick={() => post.author && onOpenProfile(post.author.id)}
        className="shrink-0 self-start rounded-full transition hover:opacity-90"
        aria-label="Open profile"
      >
        {post.author ? <Avatar user={post.author} size={40} /> : <span className="h-10 w-10 rounded-full bg-zinc-800" />}
      </button>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => post.author && onOpenProfile(post.author.id)}
            className="truncate text-[15px] font-semibold text-white hover:underline"
          >
            {post.author?.displayName ?? "Cliq User"}
          </button>
          <span className="truncate text-sm text-[#71717a]">@{post.author?.username ?? "unknown"}</span>
          <span className="text-sm text-[#71717a]">· {timeAgo(post.createdAt)}</span>
          {post.pinned ? (
            <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-zinc-500">
              <Pin size={11} strokeWidth={1.75} /> Pinned
            </span>
          ) : null}

          <div className="relative ml-auto shrink-0">
            <button
              type="button"
              aria-label="Post options"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              <MoreHorizontal size={18} strokeWidth={1.75} />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div className="cliq-pop absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#121216] py-1 shadow-2xl">
                  <MenuItem
                    icon={<Quote size={15} strokeWidth={1.75} />}
                    label="Quote repost"
                    onClick={() => {
                      setQuoteOpen(true);
                      setMenuOpen(false);
                    }}
                  />
                  {mine ? (
                    <>
                      <MenuItem
                        icon={<Pencil size={15} strokeWidth={1.75} />}
                        label="Edit post"
                        onClick={() => {
                          setEditOpen(true);
                          setMenuOpen(false);
                        }}
                      />
                      <MenuItem
                        icon={<Pin size={15} strokeWidth={1.75} />}
                        label={post.pinned ? "Unpin" : "Pin to profile"}
                        onClick={() => {
                          void pinPost(post.id, !post.pinned);
                          setMenuOpen(false);
                        }}
                      />
                      <MenuItem
                        icon={<Trash2 size={15} strokeWidth={1.75} />}
                        label="Delete"
                        danger
                        onClick={() => {
                          void remove(post.id);
                          setMenuOpen(false);
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </header>

        {post.content ? (
          <p className="mt-1 text-[15px] leading-snug text-[#f5f5f5]">
            <HashtagText text={censor(post.content, settings.toxicFilter)} />
          </p>
        ) : null}

        {post.quotedPost ? <QuotedPostEmbed post={post.quotedPost} /> : null}

        {post.poll ? (
          <div className="mt-3 space-y-2">
            {post.poll.options.map((opt) => {
              const pct = pollTotal > 0 ? Math.round((opt.votes / pollTotal) * 100) : 0;
              const voted = post.poll?.votedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => void votePoll(post.id, opt.id, post)}
                  className={cx(
                    "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition",
                    voted ? "border-[#4f46e5]" : "border-white/10 hover:border-zinc-700",
                  )}
                >
                  <span className="absolute inset-y-0 left-0 bg-white/10 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  <span className="relative flex items-center justify-between text-sm text-white">
                    <span className="truncate">{opt.text}</span>
                    <span className="tabular-nums text-zinc-300">{pct}%</span>
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-zinc-500">
              {pollTotal} vote{pollTotal === 1 ? "" : "s"} · {post.poll.votedOptionId ? "You voted" : "Tap to vote"}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex max-w-[420px] items-center justify-between text-[#71717a]">
          <VoteBar
            score={hideCounts ? 0 : score}
            vote={vote}
            onUp={() => void react(post.id, "upgrade", post)}
            onDown={() => void react(post.id, "downgrade", post)}
            size="sm"
          />
          <IconButton
            icon={<MessageCircle size={18} strokeWidth={1.75} />}
            count={commentsOpen ? comments.length : post.commentCount}
            onClick={() => setCommentsOpen((v) => !v)}
            title="Comments"
          />
          <IconButton
            icon={<Repeat2 size={18} strokeWidth={1.75} />}
            count={0}
            onClick={() => {
              setQuoteOpen(true);
            }}
            title="Repost"
          />
          <IconButton
            icon={<Bookmark size={18} strokeWidth={1.75} className={cx(saved && "fill-current")} />}
            active={saved}
            onClick={() => {
              toggleSaved(post.id);
              toast(saved ? "Removed from Saved" : "Saved", saved ? "default" : "success");
            }}
            title="Save"
          />
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="rounded-full p-1.5 transition hover:text-zinc-200"
            aria-label="Share post"
          >
            <Share size={18} strokeWidth={1.75} />
          </button>
        </div>

        {commentsOpen ? (
          <div className="mt-3 border-t border-white/10 pt-3">
            <CommentThread
              comments={comments}
              loading={loading}
              onReply={(parentId, text) => add(text, parentId)}
              canInteract={Boolean(user)}
              toxicFilter={settings.toxicFilter}
            />
            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    void add(draft);
                    setDraft("");
                  }
                }}
                placeholder="Post your reply"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121216] px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (draft.trim()) {
                    void add(draft);
                    setDraft("");
                  }
                }}
                disabled={!draft.trim()}
                className="grid h-8 w-8 place-items-center rounded-full bg-[#4f46e5] text-white disabled:opacity-40"
                aria-label="Send reply"
              >
                <Send size={15} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} post={post} />

      <EditPostModal
        open={editOpen}
        initial={post.content}
        onClose={() => setEditOpen(false)}
        onSave={async (text) => {
          try {
            const { post: updated } = await api.editPost(post.id, text);
            replacePost(updated);
            toast("Post updated", "success");
            setEditOpen(false);
          } catch (error) {
            apiError(error);
          }
        }}
      />

      <QuoteRepostModal
        open={quoteOpen}
        original={post}
        onClose={() => setQuoteOpen(false)}
        onDone={() => {
          setQuoteOpen(false);
          bump();
        }}
      />
    </article>
  );
}

/** One row inside a post's 3-dot menu. */
function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-zinc-800",
        danger ? "text-[#ff3040]" : "text-zinc-200",
      )}
    >
      {icon} {label}
    </button>
  );
}

function EditPostModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Edit post" maxWidth="max-w-md">
      <textarea
        value={text}
        autoFocus
        rows={3}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-none rounded-lg border border-white/10 bg-black p-3 text-sm text-white outline-none focus:border-zinc-600"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{text.length}/500</span>
        <button
          type="button"
          onClick={async () => {
            if (!text.trim() || busy) return;
            setBusy(true);
            await onSave(text.trim());
            setBusy(false);
          }}
          disabled={!text.trim() || busy}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function QuoteRepostModal({
  open,
  original,
  onClose,
  onDone,
}: {
  open: boolean;
  original: Post;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast, apiError } = useCliq();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Quote repost" maxWidth="max-w-md">
      <textarea
        value={text}
        autoFocus
        rows={3}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment"
        className="w-full resize-none rounded-lg border border-white/10 bg-black p-3 text-sm text-white outline-none focus:border-zinc-600"
      />
      <div className="mt-3">
        <QuotedPostEmbed
          post={{
            id: original.id,
            type: original.type,
            content: original.content,
            mediaUrl: original.mediaUrl,
            author: original.author,
            createdAt: original.createdAt,
          }}
        />
      </div>
      <button
        type="button"
        onClick={async () => {
          if (!text.trim() || busy) return;
          setBusy(true);
          try {
            const { post } = await api.createPost({ type: "chat", content: text.trim(), quotedPostId: original.id });
            await prependPost("chat", post);
            toast("Reposted", "success");
            onDone();
          } catch (error) {
            apiError(error);
          } finally {
            setBusy(false);
          }
        }}
        disabled={!text.trim() || busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
      >
        {busy ? "Posting..." : (
          <>
            <Check size={16} strokeWidth={2} /> Repost
          </>
        )}
      </button>
    </Modal>
  );
}
