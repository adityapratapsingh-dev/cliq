# Cliq — Find Your Cliq

> **Find your Cliq. Share your vibe.**

Cliq is a modern, mobile-first social app for teens to share videos, photos and
thoughts, upgrade the best posts, and make new friends who match their vibe. The
whole UI is a client-side React app with rich pre-loaded mock data — every
button, tab, vote, comment, friend request, chat message, post and setting works
right out of the box. No API keys, no paid services.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4** with CSS-variable accent theming
- **lucide-react** icons
- 100% client-side interactivity via React state (`useState` / `useRef` / `useEffect`)

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (zero TS / ESLint errors)
npm run start    # serve the production build
```

## The 5 core tabs

| Tab | What it does |
| --- | --- |
| **Videos** | Snap-scrolling Reels/TikTok feed: HTML5 `<video>` + animated gradient fallback, tap-to-play, mute, progress bar, like/comment/share/save, spinning audio disc, marquee audio ticker. |
| **Photos** | Instagram-style card feed: single + swipeable carousels, double-tap heart burst, **Like / Dislike** with mutual exclusivity, options menu, inline comments. |
| **Chat Posts** | X/Reddit-style microblog: quick composer with flair + poll builder, **Upgrade / Downgrade** voting with a live net-score badge, clickable polls, nested comment threads, repost/save/share. |
| **Chats & Friends** | **Find Your Cliq** discovery (interest filters, Cliq Up requests, Message) plus **Direct Chats** (online row, conversation list, chat window, emoji reactions, simulated 1.5s replies, safety menu). |
| **Profile** | Gradient cover + avatar, editable profile, live stats, content tabs (Videos / Photos / Posts / Saved) and the full **Settings** suite. |

## Settings suite (inside Profile)

1. **Account & Profile** — username, email, Teen Verified 13–19 badge, status
2. **Teen Safety & Privacy** — private profile, who-can-message selector, online status, hide dislike counts (updates the feed live), toxic-word filter
3. **Appearance & Theme Vibe** — 4 accent themes (Neon Violet / Cyber Cyan / Electric Rose / Matrix Emerald) that retheme the whole UI, autoplay videos
4. **Notifications** — Cliq Up requests, DMs, upgrades & likes, comments

## Project structure

```
src/
  app/                 layout.tsx (metadata) · page.tsx · globals.css
  components/
    CliqApp.tsx        app shell + tab router
    CliqProvider.tsx   global state store (all actions)
    Shell.tsx          header, sidebar, bottom nav, notifications
    CreateModal.tsx    create modal, share sheet, comment drawer
    ToastHost.tsx      stacked toasts
    ui/                Primitives.tsx · FeedBits.tsx
    tabs/              VideosTab · PhotosTab · ChatPostsTab · FriendsTab · ProfileTab
  data/mockCliqData.ts rich mock data
  lib/                 utils.ts · theme.ts
  types/cliq.ts        domain types
```

Built to deploy instantly on Vercel.
