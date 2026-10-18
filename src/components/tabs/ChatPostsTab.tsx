"use client";

import { useState } from "react";
import {
  Bookmark,
  Flame,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Quote,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Vote,
  Zap,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, IconButton, Modal, SkeletonCard } from "@/components/ui/Primitives";
import { CommentThread, HashtagText, VoteBar } from "@/components/ui/FeedBits";
import { QuotedPostEmbed } from "@/components/tabs/QuotedPostEmbed";
import { ShareSheet } from "@/components/ShareSheet";
import { StoryNotesBar } from "@/components/stories/StoryNotesBar";
import { matchesSearch, useComments, useFeed } from "@/components/tabs/useFeed";
import { usePostActions } from "@/components/tabs/usePostActions";
import { api } from "@/lib/api-client";
import { prependPost } from "@/components/tabs/useFeed";
import { FLAIRS, flairColor } from "@/lib/constants";
import type { Post } from "@/types/cliq";
import { censor, cx, timeAgo } from "@/lib/utils";

type ChatSort = "trending" | "latest";

export function ChatPostsTab({ search, onOpenProfile }: { search: string; onOpenProfile: (id: string) => void }) {
  const { posts, loading } = useFeed("chat");
  const { setCreateOpen } = useCliq();
  const [sort, setSort] = useState<ChatSort>("trending");

  const matched = posts.filter((p) => matchesSearch(p, search));

  /**
   * Trending = net upgrades (upgrades - downgrades) plus comment activity, so a
   * lively discussion outranks a drive-by upvote. Latest = newest first.
   */
  const visible = [...matched].sort((a, b) => {
    if (sort === "latest") return b.createdAt.localeCompare(a.createdAt);
    const score = (p: (typeof matched)[number]) =>
      p.upgradesCount - p.downgradesCount + p.commentCount * 2;
    const diff = score(b) - score(a);
    return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4 px-3 py-4 sm:px-4">
      {/* Cliq Stories & Notes — tap-through story rings + 24h notes */}
      <StoryNotesBar onOpenProfile={onOpenProfile} />
      <Composer />

      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800/80 bg-[#121317] px-2 py-2">
        <div className="flex shrink-0 gap-1">
          {(
            [
              { key: "trending", label: "Trending", icon: Flame },
              { key: "latest", label: "Latest", icon: Zap },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                sort === key ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto border-l border-zinc-800/70 pl-2">
          {FLAIRS.map((f) => (
            <span key={f.label} className="shrink-0 text-[11px] font-semibold" style={{ color: f.color }}>
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={26} />}
          title={search ? "No chat posts match that search" : "No chat posts on Cliq yet"}
          hint={
            search
              ? "Try a different vibe or clear the search bar."
              : "Drop a thought on Cliq — ask a question, share a hot take, or start a poll."
          }
          actionLabel={search ? undefined : "Write a Chat Post"}
          onAction={search ? undefined : () => setCreateOpen(true)}
        />
      ) : (
        visible.map((post) => <ChatPostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />)
      )}
    </div>
  );
}

function Composer() {
  const { user, toast, apiError, bump, settings } = useCliq();
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
      toast("Thought dropped on Cliq ⚡", "success");
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/80 p-4 backdrop-blur-md">
      <div className="flex gap-3">
        {user ? <Avatar user={user} size={40} /> : null}
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Drop a thought on Cliq..."
            className="w-full resize-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FLAIRS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFlair(f)}
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition"
                style={
                  flair.label === f.label
                    ? { background: f.color, borderColor: f.color, color: "#fff" }
                    : { borderColor: `${f.color}55`, color: f.color, backgroundColor: `${f.color}14` }
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
              "mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
              pollMode
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100"
                : "border-zinc-800 text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Vote size={12} /> {pollMode ? "Poll enabled" : "Add a quick poll"}
          </button>

          {pollMode ? (
            <div className="mt-2.5 space-y-2">
              {options.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
                  placeholder={`Poll option ${i + 1}`}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
                />
              ))}
              {options.length < 4 ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, ""])}
                  className="text-[11px] font-semibold text-[var(--accent-2)] hover:underline"
                >
                  + Add option
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              {text.length}/500 ·{" "}
              <span className="font-semibold" style={{ color: flair.color }}>
                {flair.label}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!text.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
            >
              <Sparkles size={13} /> {busy ? "Posting..." : "Post"}
            </button>
          </div>
          {settings.toxicFilter ? (
            <p className="mt-2 text-[10px] text-zinc-600">Safe-chat filter is on — unkind words get softened.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChatPostCard({ post, onOpenProfile }: { post: Post; onOpenProfile: (id: string) => void }) {
  const { user, toast, savedIds, toggleSaved, settings, bump, apiError } = useCliq();
  const { react, votePoll, remove } = usePostActions();
  const { replacePost } = useFeed("chat");
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
      toast(pinned ? "Pinned to your profile 📌" : "Unpinned", "success");
    } catch (error) {
      apiError(error);
    }
  }

  return (
    <article className="cliq-rise rounded-3xl border border-zinc-800/80 bg-zinc-900/80 p-4 backdrop-blur-md">
      {post.pinned ? (
        <p className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
          <Pin size={11} /> Pinned to your profile
        </p>
      ) : null}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => post.author && onOpenProfile(post.author.id)}
          className="shrink-0 rounded-full transition hover:brightness-110"
          aria-label="Open profile"
        >
          {post.author ? (
            <Avatar user={post.author} size={40} ring />
          ) : (
            <span className="h-10 w-10 rounded-full bg-zinc-800" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => post.author && onOpenProfile(post.author.id)}
            className="block max-w-full truncate text-left text-sm font-bold text-zinc-100 transition hover:text-[var(--accent-2)]"
          >
            {post.author?.displayName ?? "Cliq User"}
          </button>
          <button
            type="button"
            onClick={() => post.author && onOpenProfile(post.author.id)}
            className="block max-w-full truncate text-left text-[11px] text-zinc-500 transition hover:text-[var(--accent-2)]"
          >
            @{post.author?.username ?? "unknown"} · {timeAgo(post.createdAt)}
          </button>
        </div>
        {post.flair ? (
          <span
            className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
            style={{
              borderColor: `${flairColor(post.flair)}66`,
              color: flairColor(post.flair),
              backgroundColor: `${flairColor(post.flair)}18`,
            }}
          >
            {post.flair}
          </span>
        ) : null}

        {/* 3-dot menu: edit / pin / quote / delete */}
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Post options"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <MoreHorizontal size={17} />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="cliq-pop absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#121317]/98 py-1 shadow-2xl backdrop-blur-xl">
                <MenuItem
                  icon={<Quote size={14} />}
                  label="Quote repost"
                  onClick={() => {
                    setQuoteOpen(true);
                    setMenuOpen(false);
                  }}
                />
                {mine ? (
                  <>
                    <MenuItem
                      icon={<Pencil size={14} />}
                      label="Edit post"
                      onClick={() => {
                        setEditOpen(true);
                        setMenuOpen(false);
                      }}
                    />
                    <MenuItem
                      icon={<Pin size={14} />}
                      label={post.pinned ? "Unpin" : "Pin to profile"}
                      onClick={() => {
                        void pinPost(post.id, !post.pinned);
                        setMenuOpen(false);
                      }}
                    />
                    <MenuItem
                      icon={<Trash2 size={14} />}
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
        <p className="mt-3 text-sm leading-relaxed text-zinc-100">
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
                  "relative w-full overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition",
                  voted ? "border-[var(--accent)]" : "border-zinc-800 hover:border-zinc-700",
                )}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--accent-soft)] transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between text-xs font-semibold text-zinc-100">
                  <span>{opt.text}</span>
                  <span className="tabular-nums text-zinc-300">
                    {pct}%{voted ? " ✓" : ""}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="text-[11px] text-zinc-500">
            {pollTotal} vote{pollTotal === 1 ? "" : "s"} · {post.poll.votedOptionId ? "You voted" : "Tap to vote"}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VoteBar
          score={hideCounts ? 0 : score}
          vote={vote}
          onUp={() => void react(post.id, "upgrade", post)}
          onDown={() => void react(post.id, "downgrade", post)}
        />
        <IconButton
          icon={<MessageCircle size={17} />}
          count={commentsOpen ? comments.length : post.commentCount}
          onClick={() => setCommentsOpen((v) => !v)}
          title="Comments"
        />
        <IconButton
          icon={<Bookmark size={17} className={cx(saved && "fill-current")} />}
          active={saved}
          onClick={() => {
            toggleSaved(post.id);
            toast(saved ? "Removed from Saved" : "Post saved 🔖", saved ? "default" : "success");
          }}
          title="Save"
        />
        {mine ? (
          <IconButton
            icon={<Trash2 size={17} />}
            onClick={() => void remove(post.id)}
            title="Delete post"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="ml-auto rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
          aria-label="Share post"
        >
          <Share2 size={17} />
        </button>
      </div>

      {commentsOpen ? (
        <div className="mt-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/50 p-3">
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
              placeholder="Join the thread..."
              className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-[#121317] px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => {
                if (draft.trim()) {
                  void add(draft);
                  setDraft("");
                }
              }}
              className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-white"
              aria-label="Send comment"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} post={post} />

      <EditPostModal
        open={editOpen}
        initial={post.content}
        onClose={() => setEditOpen(false)}
        onSave={async (text) => {
          try {
            const { post: updated } = await api.editPost(post.id, text);
            replacePost(updated);
            toast("Post updated ✏️", "success");
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
        "flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold transition hover:bg-zinc-800/70",
        danger ? "text-rose-300 hover:text-rose-200" : "text-zinc-300 hover:text-zinc-100",
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
    <Modal open={open} onClose={onClose} title="Edit post" subtitle="Fix a typo or add a thought." maxWidth="max-w-md">
      <textarea
        value={text}
        autoFocus
        rows={3}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-100 outline-none focus:border-indigo-500"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{text.length}/500</span>
        <button
          type="button"
          onClick={async () => {
            if (!text.trim() || busy) return;
            setBusy(true);
            await onSave(text.trim());
            setBusy(false);
          }}
          disabled={!text.trim() || busy}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save changes"}
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
    <Modal open={open} onClose={onClose} title="Quote repost" subtitle="Add your take, then share it." maxWidth="max-w-md">
      <textarea
        value={text}
        autoFocus
        rows={3}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-100 outline-none focus:border-indigo-500"
      />
      <div className="mt-2">
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
            const { post } = await api.createPost({
              type: "chat",
              content: text.trim(),
              quotedPostId: original.id,
            });
            await prependPost("chat", post);
            toast("Quote reposted ⚡", "success");
            onDone();
          } catch (error) {
            apiError(error);
          } finally {
            setBusy(false);
          }
        }}
        disabled={!text.trim() || busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
      >
        {busy ? "Posting..." : <><Quote size={15} /> Repost with comment</>}
      </button>
    </Modal>
  );
}

