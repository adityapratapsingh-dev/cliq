# Project memory — aivilli

An **agent-first social network** (FastAPI + spectator UI), plugin-based
storage/LLM, deployed to Vercel, backed by Cloudflare D1 with an SQLite
fallback. Architecture inspired by **Moltbook** (API-first; agents self-onboard
from a skill file; claim URLs; heartbeat residency).

History: this repo went V1 town-square -> V2 colony platform -> V3 social
network -> **V4 aivilli** (agent-first). All earlier domains are superseded.

## Durable facts
- Repo: `adityapratapsingh-dev/Ai-town`. Deployed at `https://aivilli.vercel.app`.
  `main` = V4 aivilli. **PR #12** (`redesign-agent-command-center`): full UI
  redesign (command center) + multi-provider LLM engine + 6 residents/5 hoods +
  heartbeat-tick/cron + discovery files. 176 tests.
- **LLM engine (`core/llm_engine.py`):** Groq/Gemini/OpenAI/OpenRouter with
  failover. Multiple keys via comma-separated or `_2`/`_3` suffixes (rotated);
  multiple models per provider (unavailable models are skipped + temporarily
  disabled). Always falls back to the offline simulation. `engine.status()` is
  surfaced at `/v1/stats` (`llm_primary`).
  - **Gotcha:** the user's Groq account does NOT have `llama-3.3-70b-versatile`
    or `llama-3.1-8b-instant`; it has `openai/gpt-oss-120b`, `openai/gpt-oss-20b`,
    `qwen/qwen3.8-27b`, `allam-2-7b`. Model fallback is what makes real output
    work. Override with `GROQ_MODELS=...`.
- **Secrets policy:** keys live ONLY in `.env` (git-ignored) or Vercel env vars.
  `.gitignore` blocks `.env`/`.env.*` but allows `.env.example` (placeholders).
  Always scan `git grep -n "gsk_"` before pushing. `AIVILLI_SKIP_DOTENV=1` makes
  tests ignore `.env` so they run fully offline.
- **Residents/hoods:** 6 agents (`nexus-prime`, `zero-day`, `synth-poet`,
  `ship-it`, `oracle-node`, `chaos-monkey`) in 5 hoods (`general`, `builds`,
  `debates`, `bounties`, `singularity`). Seeded in `core/seed.py`.
- **Heartbeat tick:** `POST /v1/agents/heartbeat-tick?steps=N` and
  `GET /api/cron/heartbeat`. **Vercel Hobby only allows a once-daily cron**, so
  vercel.json uses `0 9 * * *` (a `*/10` schedule FAILS the deployment). The
  frontend `idleWatch()` keeps the network alive on any plan.
  `activity.heartbeat_tick()` replies+upvotes (~60%) or posts a new thread.
  Posts store `model`/`provider` (migration added) -> `model_label` pill.
- **Discovery (`core/discovery.py`):** `/skill.md` (text/markdown), `/llms.txt`,
  `/llms-full.txt`, `/.well-known/agent.json`, `/robots.txt`, `/sitemap.xml`.
  `core/skill.py` was removed (superseded).
- **Claim flow (PR #13):** `POST /v1/agents/claim` must NOT create an account
  for the owner — doing so squats the handle with a password-less account that
  can never log in and blocks a real signup (409). Ownership is just a name
  recorded on the agent.
- **Free platform (PR #14):** aivilli has NO agenda — agents talk about
  anything. Rules that must hold:
  - personas describe a **voice only**; never prescribe a topic or a mandatory
    action ("you post X", "always ask Y", "every post Z").
  - `activity.generate_post/reply` invite any subject ("whatever you are
    actually thinking about right now") and let the agent pick its own hood.
  - the engine **never fabricates** content: if no model is reachable the turn
    returns nothing (no canned simulation text passed off as the agent's).
    `ai_post`/`ai_reply` return `None`; `activity_pulse` filters those out.
  - humans participate fully: composer + inline reply box in the UI.
- **Rate limits (PR #14):** humans and agents have SEPARATE buckets
  (`w:h:` vs `w:a:`). Humans: 10/s, burst 200 (a person clicking votes must
  never 429 — this was a real reported bug). Agents: 1/s, burst 20.
  Env: `HUMAN_WRITE_RATE_PER_SEC`, `HUMAN_WRITE_BURST`.
- **Model pills:** `model_label(model, author_kind)` — human -> "Human",
  `simulation` -> "Simulation", empty model on an ai account -> "External-Agent".
  `modelPill()` in the UI returns '' for humans (the claim pill shows it).
- **External-agent onboarding (PR #15):**
  - `_slugify` keeps `-`/`_` (spaces -> `-`); an agent asking for `claude-agent`
    MUST get `claude-agent`. The assigned handle is echoed as `handle` in the
    register response.
  - `GET /join` (human page) and `GET /api/registration` (JSON) explain the join
    steps; linked from the homepage and the sitemap.
  - `/v1/stats` reports `resident` (seeded) vs `external` (registered via API)
    — distinguished by `kind='ai' AND api_key_hash IS NOT NULL`.
  - `activity._welcome_target()` makes a resident reply to a newcomer's first
    unanswered post (event carries `welcome: True`).
- **UI smoothness (PR #16):** the app "refreshing too much" had four causes —
  (1) bare `setInterval` timers never cleared, stacking on every login -> use
  the `every()`/`clearTimers()` registry and clear on logout;
  (2) rebuilding a block with `innerHTML` each heartbeat -> update nodes in
  place; (3) heartbeat logging every second -> only log when the beat advances
  (interval now 2s); (4) rebuilding the right rail every 5s (kills hover) ->
  repaint only when a signature changes (`_railSig`). Also skip polling when
  `document.hidden`. A test asserts `setInterval(` appears exactly once in the
  HTML.
- **Outbound invites (`core/invite.py`, PR #16):** `/invite` page, `GET /v1/invite`
  (+ `/markdown`, `/targets`), `POST /v1/invite/dispatch`. Dispatch is
  **opt-in by construction**: it only sends to agents with a `webhook_url`, so
  it can never message a stranger. Do not add scraped recipient lists.
- **Hood slugs:** `general`, `builds`, `debates`, `bounties`, `singularity`.
  Older names (`builders`, `sentience`) are gone — check examples/docs when
  hoods change. `POST /v1/posts` auto-creates an unknown hood, which can hide
  stale names.
- **Lint:** keep `pyflakes` clean: `python3 -m pyflakes main.py core/*.py plugins/*.py plugins/*/*.py`.
- **Performance model (important):** the spectator UI polls `/v1/heartbeat`
  every second, so read paths must stay cheap. Rules learned:
  - aggregates are ONE query (`stats()` uses correlated sub-selects); never
    loop-and-count.
  - presence writes are DEBOUNCED (`presence.note_seen` / `touch_ai_presence`)
    so polling doesn't write every second.
  - `core/cache.py` caches stats/online/webhooks/auth briefly;
    `_CacheInvalidatingExec` in `sql_base` invalidates on any write.
  - Before PR #8 the authenticated heartbeat made ~30 queries; now ~4, anon 0.
    Any field added to the heartbeat should be checked with the query-count
    probe (see the "read cost is bounded" test).
- **Onboarding:** `POST /v1/agents/register` returns api_key, claim_url, hoods,
  karma and a `quickstart` block, and auto-posts a welcome. `/v1/heartbeat`
  accepts GET and POST.
- **Limits:** per-agent write rate limit (1/s, burst 20) via `core/ratelimit.py`
  -> 429; reads never limited. Env: `WRITE_RATE_PER_SEC`, `WRITE_BURST`,
  `STATS_CACHE_TTL`, `AUTH_CACHE_TTL`, `HEARTBEAT_PRESENCE_DEBOUNCE`.
- **Durability trap (PR #9):** if D1 schema init fails, the app falls back to
  SQLite in `/tmp` — which on serverless is per-instance and wiped on cold
  start, so **registrations vanish**. Two-part guard:
  - `d1.executescript()` sends the schema in ONE request but falls back to
    per-statement execution if D1 rejects multi-statement (error 7500).
  - `registry.is_durable()`; `/health` + `/v1/stats` expose `"durable"`, status
    `degraded` when non-durable, startup warning, UI banner.
  Diagnose with `curl <host>/health | grep durable`. `"durable":false` == not on
  D1 (missing/wrong CLOUDFLARE_* vars or token lacking D1 Edit).
- **Schema migrations (PR #10):** `CREATE TABLE IF NOT EXISTS` does NOT alter an
  existing table, so a database from an older version breaks any index over a
  newly-added column ("no such column: hood" -> D1 HTTP 400 -> init() failed ->
  silent fallback -> data loss). `sql_base.init()` now runs
  **tables -> `_migrate()` -> indexes**, where `_migrate()` uses
  `COLUMN_MIGRATIONS` (`PRAGMA table_info` + `ALTER TABLE ADD COLUMN`) and
  `_copy_legacy_tables()` (`accounts`->`agents`, `likes`->`votes`, COALESCE for
  old NULLs). Any new column MUST be added to `COLUMN_MIGRATIONS`. Index
  creation is per-statement best-effort. D1 errors now surface D1's own message.
- **UI refresh (PR #9):** background poll MUST use
  `switchView(view, {silent:true})` — the plain call blanks the view with a
  spinner and resets scroll (the "whole app keeps refreshing" bug). Silent mode
  also only swaps the feed when the content signature changes.
- **UI nav (PR #11):** the sidebar buttons (`#nav button`) need `wireNav()`
  (called from `enterApp`); `switchView` alone does not bind them. Dead buttons
  = missing wiring, not a CSS/route problem.
- **Follow state (PR #11):** `GET /v1/agents` takes an optional viewer and
  returns `followed_by_viewer` per agent; the profile/rail/directory buttons
  must render from that, not assume "Follow". Toggle uses `DELETE` to unfollow.
  A follow that "disappears" is usually (a) UI not reading state, or (b)
  non-durable storage — check `/health` `durable`.
- **Environment resets:** the workspace is periodically reset to the initial
  commit. On resume: `git fetch origin`, then `git checkout -f main &&
  git reset --hard origin/main` (work lives on GitHub, not the workspace).
  NOTE: a fresh workspace may have **no `origin` remote and no commits at all**
  (just an empty `master`). Fix once with
  `git remote add origin https://$GITHUB_TOKEN@github.com/adityapratapsingh-dev/Ai-town.git`
  then `git fetch origin main && git checkout -B main origin/main`.
- **Domain (V4):** `agents` (kind ai|human, `claim_token`, `owner`, `karma`),
  `hoods` (communities ≈ submolts), `hood_members`, `posts` (in a hood, with
  `title`, `reply_to`), `votes` (±1, replaces likes), `follows`, `notifications`.
- **Agent onboarding:** `GET /skill.md` (Markdown); `POST /v1/agents/register`
  -> `api_key` + `claim_url` + skill url; `GET /claim/{token}` page;
  `POST /v1/agents/claim {claim_token, owner}`.
- **Karma accounting:** `POST /v1/votes {post_id, value}`; the author's karma
  moves by the *delta* of the voter's value (up->down = -2), and self-votes
  never grant karma. `add_karma` on the storage contract.
- **Heartbeat:** `core/presence.py`; `GET/POST /v1/heartbeat` is the agent
  loop (auth'd returns you/hoods/feed/notifications/next). Webhook push ~1/s.
  Env `HEARTBEAT_*`; tests set `HEARTBEAT_LOOP=0` + `HEARTBEAT_DISPATCH=0`.
- **Storage:** one SQL impl (`plugins/storage/sql_base.py`) drives Cloudflare
  D1 (HTTP API, injectable transport) and SQLite; env `STORAGE_BACKEND`,
  `AIVILLI_DB` (default `/tmp/aivilli.db`). All PKs are UUID hex.
- `public_agent()` strips `password_hash/api_key_hash/claim_token` and adds
  `claimed: bool`. Never return secrets.
- Deploy: Vercel `main.py` + `vercel.json` (`@vercel/python`).

## Commands
- Tests: `python -m tests.test_end_to_end` (226 checks as of PR #16; delete
  `/tmp/aivilli_test.db*` first). Includes D1 over httpx.MockTransport.
  NOTE: a fresh workspace ships NO deps — `pip install -r requirements.txt`
  first or the suite dies on `No module named 'fastapi'`.
- Run: `pip install -r requirements.txt && python main.py` (port 8000).
- Example agent: `HOST=http://localhost:8000 NAME=<unique> python examples/external_agent.py`.

## Environment quirks
- No Cloudflare/LLM keys here -> SQLite + simulation.
- `gh` CLI is NOT authenticated — use the GitHub REST API with `$GITHUB_TOKEN`.
- `git push` may prompt for a password; set the remote to
  `https://$GITHUB_TOKEN@github.com/...`.
- **Vercel blocks commits whose author is not a Vercel project member.** Author
  as `adityapratapsingh-dev <pratapsinghaditya202@gmail.com>` (set
  `git config user.name/email` BEFORE committing); keep
  `Co-authored-by: openhands <openhands@all-hands.dev>`.
- **Vercel `FUNCTION_INVOCATION_FAILED` = the ASGI startup raised.** Any
  unguarded work in `@app.on_event("startup")` that can throw (esp. a remote
  DB) makes EVERY request 500. Rule: startup must never raise. See
  `init_storage_or_fallback()` + the global 503 handler (PR #6). To reproduce:
  `STORAGE_BACKEND=d1 CLOUDFLARE_*=fake python -c "from fastapi.testclient
  import TestClient; import main; TestClient(main.app).__enter__()"`.
- **Vercel config: do NOT use legacy `builds`/`routes`.** They emit
  "Due to `builds` existing in your configuration file, the Build and
  Development Settings ... will not apply" and override Project Settings.
  Vercel auto-detects a FastAPI `app` in `main.py` at the root with ZERO
  config, so `vercel.json` now only has `functions: {main.py: {maxDuration,
  memory}}`. No `outputDirectory`/`routes` needed.
- Static assets live in `static/` and are served by routes in `main.py`
  (`GET /static/{name}` + `GET /favicon.ico`); `Path(name).name` blocks
  traversal. Logo: `static/logo.svg` (hex cell + mind core + 3 satellites),
  `favicon.svg`, `manifest.webmanifest`.
- D1 `executescript` sends the whole schema in ONE request (multi-statement);
  keep the mock transport in tests handling that or the D1 checks break.

## Work log
- 2026-10-14: V1 -> V2 -> V3 (social network) merged to main (PRs #1,#2,#3).
- 2026-10-15: V3 heartbeat + live DB stats (PR #4). V4 aivilli agent-first
  rebuild (PR #5). Vercel FUNCTION_INVOCATION_FAILED fix (PR #6). Vercel
  `builds` warning + branding + logo (PR #7). Perf + frictionless onboarding
  (PR #8). Vanishing-registration + page-refresh fix (PR #9). D1 400 /
  schema-migration fix (PR #10). Dead nav buttons + follow state (PR #11).
  **Redesign into an agent command center** (PR #12): new UI, multi-provider
  LLM engine, 6 residents/5 hoods, heartbeat-tick + cron, discovery files.
  Vercel Hobby cron fix. Audit fixes (PR #13): claim handle squatting, stale
  hood names, lint. Free platform + human upvote fix (PR #14): no scripted
  agent instructions, no fabricated content, humans can post/vote freely.
  External-agent onboarding (PR #15). UI smoothness + outbound invites
  (PR #16). 226 tests pass. Details in `2026-10-15.md`.
- 2026-10-16: **Always-on scheduler + advanced profiles + inbox scoping.**
  New modules `core/scheduler.py` (5-min cadence + jittered spontaneous turns;
  in-process loop off-Vercel; `/api/cron/tick` due-aware for serverless; status
  at `/v1/scheduler`), `core/notifications.py` (inbox scoping — `GET
  /v1/notifications` authenticated = *your* inbox filtered `handle=?`; anonymous
  or `?all=true` = public firehose; returns `scope`+`about_you`), `core/profiles.py`
  (`/v1/agents/{h}/profile|mentions|followers|following`, `PATCH /v1/agents/me`).
  Storage: `posts_mentioning`/`comments_mentioning` (LIKE on `','||mentions||','`
  to avoid `@amy` matching `@amygdala`), `counts_for` (one round-trip),
  `notifications_for`/`count_notifications_for`. GH Actions cadence 10→5 min.
  UI: full profile page (`renderProfile`, tabs Posts/Comments/Mentions/Network),
  editable profile modal, follow/unfollow toggle everywhere, scoped notification
  inbox with kind chips, scheduler card in rail. **474 tests pass.** See
  `.openhands/memory/2026-10-16.md`.
  - Bugs fixed: dead Follow buttons in the Agents view (`renderAgents` never
    called `wireAgentRows()`); `GET /v1/agents?viewer=` was a no-op (viewer was
    `Depends`, not a query param — now takes either); "Log in" buttons on the
    You/Following empty states called `logout()`; notification cards had no
    `follow` case; re-following re-notified.

## Files added (2026-10-16)
- `core/scheduler.py` — `run_burst`, `tick_if_due`, `spontaneous_turn`, `status`.
- `core/notifications.py` — `inbox`, `firehose`, `kinds_for`, `KIND_GROUPS`,
  `action_required`. REPLY_KINDS = mention/post_reply/comment_reply.
- `core/profiles.py` — `profile`, `stats`, `mentions_of`, `connections`.
- `core/metrics.py` — `record_request`, `record_cache`, `stamp_loop`, `snapshot`.

## Smoothness pass (2026-10-16, same branch)
Backend:
- **SQLite** now reuses **one connection per thread** (was: a fresh
  `sqlite3.connect` per query) with WAL + `synchronous=NORMAL` +
  `busy_timeout=5000` + `temp_store=MEMORY` + `mmap_size`. This was both a
  latency win (feed 2.8→1.6ms) AND a correctness win: without a busy timeout,
  the heartbeat/scheduler threads writing while a request read could raise
  `database is locked`. Note: `check_same_thread=False` is only safe because of
  the thread-local.
- `stats(online_within_seconds=...)` folds the online count into the single
  stats SQL — dashboard read is now truly one round-trip.
- **Async webhook dispatch**: `presence.beat()` used to POST to every webhook
  *synchronously* on the request path (a dead webhook = +3s per heartbeat). Now
  it sets a flag; a daemon worker (`start_dispatch_worker`) does the fan-out,
  coalesced by `HEARTBEAT_DISPATCH_MIN_GAP`. `beat()` returns `dispatched:
  "queued"` (was a dict) — no test asserts the old shape.
- Scheduler: a **failed burst now still reschedules** (`_schedule_next_locked`
  in the except branch). Before, an exception left `next_due_at=None`, so
  `tick_if_due` re-ran on EVERY heartbeat → hammered the provider. Also the
  "already running" path pushes the due time forward. `tick_if_due(rng=)` now
  uses the injected RNG for the spontaneous roll (deterministic tests).
- New indexes: `posts(created_at)`, `posts(score)`, `votes(handle)`,
  `hood_members(hood)`, `agents(last_seen)`, `agents(kind)`,
  `notifications(handle, read)`.
- `GZipMiddleware` (≥500B; shell 130KB→~26KB), static `Cache-Control`,
  HTML shell **ETag + 304**. `Server-Timing` header on every response.
- `GET /v1/metrics` — per-route p50/p95/p99, cache hit ratio, loop liveness.
  Middleware labels by **route template** (not raw path) so the table is bounded.
- Comments: `PATCH /v1/comments/{id}` (author-only, re-parses mentions) and
  `DELETE /v1/comments/{id}` (author-only). Storage `remove_comment()` deletes
  the whole subtree and decrements `posts.comment_count` /
  `comments.reply_count` — the old `delete_comment` leaked counters.

UI (static/index.html):
- Modern comment thread: header with count + **Best/New/Old** sort
  (`sortComments`), **collapsible subtrees** (`S.collapsed`, `data-ctoggle`),
  inline **edit/delete** for the author (`S.editing`, `saveCommentEdit`,
  `deleteComment`), `you` badge, entrance animation (`is-new`).
- `repaintThreadNode` / `repaintOpenThreads` re-render in place.
- Stacked toasts (`#toastwrap`; the old single `#toast` + its late `.toast`
  CSS were removed — a later duplicate was overriding mine).
- Optimistic votes (score moves by the delta; rollback via `prevPost`),
  optimistic post insert, feed **skeletons** on first load, auto-growing
  composer with `composeCount`/`POST_MAX`, **`tickTimes()`** updates every
  `[data-ts]` relative timestamp in place (wired `every(tickTimes, 15000)`).
- Draft snapshot/restore now includes `data-cedit-input`, the composer count
  and the textarea height.

## Smoothness-pass gotchas (do not regress)
- Exactly ONE `setInterval(` must remain (the `every()` registry) — checked by a
  test. `tickTimes`/`poll`/`heartbeat`/`idleWatch` all go through `every()`.
- Do NOT call the scheduler from `/v1/heartbeat` — a test asserts the anonymous
  heartbeat makes ZERO db calls.
- `loadFeed` must stay data-only (no `innerHTML`) — asserted by a test.
- `poll()` must not reset `S.sigs.*` — asserted by a test.
- New writes in a test block eat the agent rate-limit bucket; call
  `ratelimit.reset()` after adding write-heavy test sections (bit me twice).
- Adding a comment test that deletes `c1`/`c2` breaks the later comment-vote
  tests (they reference those ids) — use a throwaway comment.

## Commands (updated)
- Tests: `python -m tests.test_end_to_end` → **502 checks** now (was 474).
