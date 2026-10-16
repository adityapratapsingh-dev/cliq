"use client";

import { useState } from "react";
import {
  Bookmark,
  MessageCircle,
  Repeat,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  Vote,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { ShareSheet } from "@/components/CreateModal";
import { Avatar } from "@/components/ui/Primitives";
import { CommentThread, HashtagText, VoteBar } from "@/components/ui/FeedBits";
import { FLAIRS } from "@/data/mockCliqData";
import { cx, formatCount, timeAgo } from "@/lib/utils";

export function ChatPostsTab() {
  const { chatPosts, userMap, searchQuery, voteChatPost, me } = useCliq();

  const visible = chatPosts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace("#", "");
    const a = userMap[p.authorId];
    return (
      p.text.toLowerCase().includes(q) ||
      p.flair.toLowerCase().includes(q) ||
      (a && (a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-4">
      <Composer />

      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5">
        <TrendingUp size={15} className="text-[var(--accent-2)]" />
        <p className="text-xs font-semibold text-zinc-300">Trending on Cliq</p>
        <div className="flex flex-1 gap-2 overflow-x-auto cliq-no-bar">
          {["#AskCliq", "#Gaming", "#LateNightThoughts", "#Music", "#Memes"].map((tag) => (
            <span key={tag} className="shrink-0 text-[11px] font-semibold text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-center">
          <span className="text-4xl">💬</span>
          <p className="text-sm font-semibold text-zinc-200">No posts found</p>
          <p className="text-xs text-zinc-500">Be the first to drop a thought on Cliq.</p>
        </div>
      ) : (
        visible.map((post) => (
          <ChatPostCard
            key={post.id}
            postId={post.id}
            onVote={(dir) => voteChatPost(post.id, dir)}
            isMine={post.authorId === me.id}
          />
        ))
      )}
    </div>
  );
}

function Composer() {
  const { addChatPost, me } = useCliq();
  const [text, setText] = useState("");
  const [flair, setFlair] = useState(FLAIRS[0]);
  const [pollMode, setPollMode] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);

  function submit() {
    if (!text.trim()) return;
    addChatPost(text, flair.label, flair.color, pollMode ? options.filter((o) => o.trim()) : []);
    setText("");
    setPollMode(false);
    setOptions(["", ""]);
  }

  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/80 p-4 backdrop-blur-md">
      <div className="flex gap-3">
        <Avatar user={me} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={280}
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
              {text.length}/280 · <span className="font-semibold" style={{ color: flair.color }}>{flair.label}</span>
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-grad)] px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              <Sparkles size={13} /> Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatPostCard({
  postId,
  onVote,
  isMine,
}: {
  postId: string;
  onVote: (dir: "up" | "down") => void;
  isMine: boolean;
}) {
  const {
    chatPosts,
    userMap,
    me,
    votePoll,
    toggleChatRepost,
    toggleChatSave,
    addComment,
    toggleCommentLike,
    settings,
  } = useCliq();
  const post = chatPosts.find((p) => p.id === postId);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!post) return null;
  const author = userMap[post.authorId];
  if (!author) return null;
  const score = post.upgrades - post.downgrades;
  const hideCounts = settings.hideDislikes && isMine;

  const pollTotal = post.poll ? post.poll.options.reduce((sum, o) => sum + o.votes, 0) : 0;

  return (
    <article className="cliq-rise rounded-3xl border border-zinc-800/80 bg-zinc-900/80 p-4 backdrop-blur-md">
      <header className="flex items-center gap-3">
        <Avatar user={author} size={40} ring={author.online} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-zinc-100">{author.name}</span>
            {author.verified ? <span className="text-[var(--accent-2)]">✦</span> : null}
            <span className="truncate text-[11px] text-zinc-500">@{author.handle}</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            {author.age} · {timeAgo(post.createdAt)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
          style={{ borderColor: `${post.flairColor}66`, color: post.flairColor, backgroundColor: `${post.flairColor}18` }}
        >
          {post.flair}
        </span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-zinc-100">
        <HashtagText text={post.text} />
      </p>

      {post.poll ? (
        <div className="mt-3 space-y-2">
          {post.poll.options.map((opt) => {
            const pct = pollTotal > 0 ? Math.round((opt.votes / pollTotal) * 100) : 0;
            const voted = post.poll?.votedId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => votePoll(post.id, opt.id)}
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
                    {hideCounts ? "—" : `${pct}%`}
                    {voted ? " ✓" : ""}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="text-[11px] text-zinc-500">
            {pollTotal} votes · {post.poll.votedId ? "You voted" : "Tap to vote"}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VoteBar score={hideCounts ? 0 : score} vote={post.vote} onUp={() => onVote("up")} onDown={() => onVote("down")} />
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
        >
          <MessageCircle size={17} />
          <span className="tabular-nums">{post.comments.length}</span>
        </button>
        <button
          type="button"
          onClick={() => toggleChatRepost(post.id)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold transition hover:bg-zinc-800/70",
            post.reposted ? "text-emerald-400" : "text-zinc-400 hover:text-zinc-100",
          )}
        >
          <Repeat size={17} />
          <span className="tabular-nums">{formatCount(post.reposts)}</span>
        </button>
        <button
          type="button"
          onClick={() => toggleChatSave(post.id)}
          className={cx(
            "rounded-full p-2 transition hover:bg-zinc-800/70",
            post.saved ? "text-[var(--accent-2)]" : "text-zinc-400 hover:text-zinc-100",
          )}
          aria-label="Save post"
        >
          <Bookmark size={17} className={cx(post.saved && "fill-current")} />
        </button>
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
            comments={post.comments}
            userMap={userMap}
            onLike={(cid) => toggleCommentLike("chatpost", post.id, cid)}
            onReply={(cid, text) => addComment("chatpost", post.id, text, cid)}
            compact
          />
          <div className="mt-3 flex items-center gap-2">
            <Avatar user={me} size={30} showOnline={false} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addComment("chatpost", post.id, draft);
                  setDraft("");
                }
              }}
              placeholder="Join the thread..."
              className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => {
                addComment("chatpost", post.id, draft);
                setDraft("");
              }}
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-grad)] text-white"
              aria-label="Send comment"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} title={`@${author.handle}'s post`} />
    </article>
  );
}
