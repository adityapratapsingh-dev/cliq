# Cliq — Find Your Cliq

> **Find your Cliq. Share your vibe.**

A social app where teens share videos, photos and thoughts, upgrade the best
takes, Cliq Up new friends, and chat in real time.

**Step 3 architecture:** Neon PostgreSQL for data, Cloudinary for media (uploaded
directly from the browser so Vercel's payload limit is never involved), SWR for
instant feeds, and optimistic UI so every interaction feels immediate.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript — zero-error `npm run build` |
| Styling | Tailwind CSS v4 with CSS-variable accent theming |
| Icons | lucide-react |
| Database | **Neon PostgreSQL** via `pg` (pooled, serverless-friendly) |
| Media | **Cloudinary** direct upload (unsigned preset) + canvas WebP compression |
| Data fetching | **SWR** (stale-while-revalidate) + optimistic mutations |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run test:d1  # D1 client regression test (legacy fallback)
```

Sign up on the Welcome & Auth screen, then post, react, comment and chat.

### Environment variables

Copy `.env.example` to `.env.local` and fill it in, or set these in
**Vercel → Settings → Environment Variables**.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...`). Required for persistence. |
| `CLIQ_SESSION_SECRET` | Signs the httpOnly session cookie. `openssl rand -base64 48` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (browser-side) |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary **unsigned** upload preset |

Optional: `PG_POOL_MAX` (default 5), `DATABASE_SSL=no-verify` (only if a TLS proxy
breaks certificate validation).

**Zero-config fallback:** with no `DATABASE_URL` the app transparently uses an
in-memory store, so local dev and a fresh deploy both work immediately. Settings
shows an amber notice with the exact missing variables rather than failing.

The schema is created automatically on the first request
(`ensureTablesExist()`), so there is no migration step. `schema.postgres.sql` is
the canonical schema; `src/lib/neon-schema.ts` is the runtime copy — keep them in
sync. To apply it by hand:

```bash
psql "$DATABASE_URL" -f schema.postgres.sql
```

## Architecture notes

### Database (`src/lib/neon.ts`)
A single `pg.Pool` is memoised on `globalThis` so serverless instances reuse
connections across invocations instead of opening one per request. Every query
uses parameter placeholders (`$1`, `$2`, …); multi-write operations
(reaction toggling) run inside a transaction.

`src/lib/store/` defines a `Store` interface with three implementations —
`neon.ts` (production), `d1.ts` (legacy Cloudflare D1) and `memory.ts`
(no-config fallback). `getStore()` picks one at startup.

### Media (`src/lib/cloudinary.ts`)
Uploads go **browser → Cloudinary** via `XMLHttpRequest` (the only API that
reports upload progress), so file bytes never pass through Vercel. Images are
downscaled and re-encoded to WebP at 0.8 quality on a `<canvas>` before upload;
if compression fails or does not help, the original file is sent. Only the
resulting `secure_url` is stored in Postgres.

### Performance
- **SWR** caches every feed; navigation renders cached posts instantly while
  revalidating in the background (`keepPreviousData`).
- **Optimistic UI** for likes, dislikes, upgrades, downgrades, poll votes,
  comments and DMs — state updates at 0ms, then reconciles with the server and
  rolls back on failure.

## API routes

| Route | Methods |
| --- | --- |
| `/api/auth` | `GET` session · `POST` sign up / log in · `DELETE` log out |
| `/api/users` | `GET` list/search · `PATCH` update profile & settings |
| `/api/users/[id]` | `GET` public profile + stats |
| `/api/stats` | `GET` real friends / following / posts counters |
| `/api/posts` | `GET` by type · `POST` create · `DELETE` own post |
| `/api/posts/react` | `POST` like/dislike/upgrade/downgrade + poll votes |
| `/api/comments` | `GET` · `POST` |
| `/api/friends` | `GET` graph · `POST` request/accept/decline |
| `/api/messages` | `GET` conversations/thread · `POST` send · `PATCH` react · `DELETE` unsend |
| `/api/notifications` | `GET` · `PATCH` mark read |

## Project structure

```
schema.postgres.sql            canonical Neon schema
src/app/api/                   route handlers
src/components/
  CliqApp.tsx                  auth gate + tab router
  CliqProvider.tsx             session/state context
  Providers.tsx                SWR configuration
  AuthScreen.tsx               welcome & auth
  Shell.tsx                    header · sidebar · bottom nav
  CreateModal.tsx              create post + Cloudinary upload + preview
  ProfileModal.tsx             public profile for any user
  NotificationDrawer.tsx       real notifications + friend requests
  ShareSheet.tsx               share actions
  tabs/                        Videos · Photos · ChatPosts · Friends · Profile
                               (+ useFeed, usePostActions, PostCardMini)
  ui/                          Primitives · FeedBits · UserLink
src/lib/
  neon.ts · neon-schema*.ts    Neon pool + schema bootstrap
  cloudinary.ts                direct upload + canvas compression
  store/                       Store interface + neon / d1 / memory backends
  auth.ts · session.ts         PBKDF2 hashing · signed session tokens
  api-client.ts · api.ts       client fetchers + server helpers
src/types/cliq.ts              domain types
```

## Security

- Passwords hashed with PBKDF2-SHA256 (120k iterations) via Web Crypto.
- Sessions are stateless HMAC-signed tokens in an httpOnly, SameSite=Lax cookie
  (Secure in production).
- Ownership is re-checked server-side for deleting posts, unsending messages and
  answering friend requests.
- All SQL uses bound parameters — no string interpolation of user input.
