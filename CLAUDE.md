# CLAUDE.md: Tandem

Working notes for Claude Code in this repo. The public overview, setup and screenshots live in [README.md](README.md).
Keep this file short and current: update it when commands, architecture, rules or the design system change. Change
history belongs in git.

## The product

**Tandem** is a Calgary-first web app that helps residents, newcomers and visitors find people to *do things with*
(run clubs, book clubs, hikes, jam sessions, volunteering). It is **group-first, not profile-first**: no followers,
likes, feeds or ratings of people. Events are rated, never people; *Tandem Miles* reward showing up. Accessibility
(Comfort & Access, Ease Into It, display and reading modes, read aloud) and visitor discovery (Explore Like a Local)
are core, not add-ons.

- Built for **Code the Change 2026** (Calgary) by LeGroup: Falah Sheikh and Hunter Halvorson. Prompt 1: health, social
  connection and well-being. Side pots targeted: Best Local Impact (Benevity) and Best in Accessibility (Clio).
- Demo video: https://youtu.be/-TkNc9h2p-Q. The original brief and build spec: `docs/code-the-change-brief.pdf`.
- Brand lines: tagline *Better Together. Calgary Connected.* · hero *Find your people. Find your Calgary.* · closing
  *Tandem doesn't measure how many people follow you. It helps you find people to go somewhere with.*
- The name is **Tandem** (the spec PDF's "TNadem" is a typo). It lives in `frontend/src/lib/brand.ts`.

## Product rules (never break these)

- No follower counts, individual rankings or person-to-person ratings. Rank and rate **events**, never people.
- Never store passwords, government IDs, ID images, medical information or precise home addresses. Private or
  residential event locations show an approximate area only.
- Verification is simulated and its badge must say *Demo verified*. Demo sign-in is simulated and labelled as such.
- Seeded events, messages, reviews and metrics are labelled as demo data. localStorage mode is one browser profile;
  never present it as multi-user.
- Accessibility info per event is tri-state: confirmed by organizer, not yet confirmed, or not available. Filters and
  recommendations only trust *confirmed*.
- Comfort & Access preferences are practical and private by default, never medical labels.
- No colour-only information (map markers carry icons and labels). WCAG 2.2 AA is the floor. No dead-end screens or
  placeholder buttons.

## Design language

The design is settled; new work should look like it already belongs. Tokens live in `frontend/src/index.css` (`@theme`).

- **Colour.** Stampede Red `#C8102E` (`brand`) for primary actions, active states and focus; Deep Red `#9B1026`
  (`brand-deep`) for text on tints; `brand-tint` `#FBEAED` and `brand-soft` `#F3C7CF` for selected and highlighted
  surfaces. Charcoal `#202124` (`ink`), `#3C4043` (`ink-soft`) and `#5F6368` (`muted`) for text. Warm White `#FAFAF8`
  (`paper`) page background, `#F3F4F6` (`mist`) for quiet fills, `#E5E7EB` and `#D1D5DB` for lines. Semantic colours
  each come with a tint: success `#1E6B3A`, warning `#8A5300`, info `#1D4E89`. Red is the only accent.
- **Type.** Inter Variable for everything; Atkinson Hyperlegible Next replaces it when *Readable font* is on. Headings
  are heavy (700–800) with tight tracking; labels use sentence case; small uppercase eyebrows get letter-spacing.
- **Shape and surface.** White cards with a hairline border on warm-white paper. `rounded-card` (1rem) for cards,
  `rounded-control` (0.625rem) for inputs and buttons, full pills for chips, badges and filters. Shadows only on things
  that float (menus, popups, toasts).
- **Icons and imagery.** lucide-react icons, always paired with a text label. Calgary photography from Wikimedia
  Commons with visible credits; a labelled skyline photo where no venue photo exists. The logo is a tandem bicycle with
  two smiling red riders (`components/brand/Logo.tsx`); a simple Calgary skyline in `brand-soft` is the illustration.
- **Voice.** Plain, warm and specific. Say what a control does ("Join event", "Confirm"). Explain recommendations.
  Name demo data as demo data. Never shame, rank or score people.
- **Adaptive by default.** Every screen must survive text size A+++, high contrast, reduced motion and the readable font
  (the display menu in the header), and a 390 px phone width.
- **Outside the app** (README images, slides, videos) use the same tokens, Inter, the logo and the skyline:
  see `docs/images/` and `demo-video/`.

## Commands

```bash
npm install && npm run dev     # repo root proxies into frontend/; app on http://localhost:5173
npm test                       # Vitest service specs (44)
npm run build                  # tsc -b && vite build
npm run lint                   # oxlint (only fast-refresh hints remain)
npm run e2e                    # dev server running: headless-Chrome checks of the 20 workflows (17 checks)
npm run a11y                   # dev server running: axe-core WCAG 2.2 AA audit of 18 pages (0 violations expected)
npm run e2e:live               # dev server running: two Chromes synced through a test Tandem Live server
npm run live                   # Tandem Live sync server on :8787 (serves frontend/dist too); npm run test:live tests it
docker compose up --build      # built app + sync server in one container on :8787
```

E2E and a11y scripts live in `frontend/scripts/e2e/` (plain Chrome DevTools Protocol, no Playwright). Override the
browser with `CHROME_PATH` and the target with `BASE_URL`. They set `tandem.sync=off` so they start from a fresh seed.

## Architecture (`frontend/src`)

```
lib/         brand, dates, geo (haversine, point-in-polygon), ids, speech (TTS + voice input), ics, cn
types/       domain types (User, CalgaryEvent, CommunityGroup, EventRegistration, EventReview, ChatMessage, …)
data/        categories, accessibility features, Calgary geography (venues, neighbourhoods, quadrants), seed
services/    PURE functions over a Database object: storage, events, registrations, filters, recommendations,
             reviews, leaderboard, miles, chat, groups, users, itinerary, impact, nlp (smart search), liveSync
state/       AppStore (React context: db + session + actions; cross-tab sync), display prefs, toasts
components/  ui kit, brand, layout (shell/nav), events, filters, map (lazy-loaded Leaflet), …
pages/       one file per route
test/        Vitest specs
```

- **Data flow:** UI → `useApp()` action → service `(db, args, now) → newDb` → `storage.save()` → React state.
  Components never touch localStorage; only `services/storage.ts` does. Services take `now: Date` for testability.
- **Storage keys:** `tandem.db.v1` (demo world), `tandem.session` (+ per-tab sessionStorage override so two tabs can be
  two users), `tandem.display` (display prefs), `tandem.sync` (Tandem Live URL or `off`).
- **Tandem Live:** `services/liveSync.ts` wraps the localStorage adapter. If `server/live-server.mjs` is reachable
  (`tandem.sync` → `VITE_SYNC_URL` → same origin when served by the server → `http://<host>:8787`), each save is diffed
  into put/del/set ops and POSTed; other devices' ops arrive over SSE. Unreachable server → browser-only mode; on
  reconnect, offline changes are pushed. `pagehide`/`pageshow` keep device counts right.
- **Supabase mode** (when `VITE_SUPABASE_URL` + key are set): private `tandem` schema, security-definer RPCs using
  `auth.uid()`, row locks for capacity and ratings, a content-free Realtime revision ping. Migrations and SQL tests in
  `supabase/`.
- **Map ↔ list:** both use the same `filterEvents()` with filters serialized in the URL query string.
- **Seed dates** are relative to the day of seeding; a banner offers *Refresh demo data* on a later day.

Routes: `/` · `/login` · `/signup` · `/onboarding` · `/discover` · `/map` · `/events/:id` · `/events/new` ·
`/events/:id/edit` · `/events/:id/chat` · `/groups` · `/groups/:id` · `/dashboard` · `/profile` · `/people/:id` ·
`/leaderboard` · `/explore-like-a-local` · `/settings` · `/impact` · `/about` · `*` (404)

## Demo assets

- `demo-video/` renders videos from real app screens: `capture.mjs` and `capture-extra.mjs` (dev server running) record
  screenshots into `shots/` (git-ignored), the timeline pages animate them (`demo.html`: 60 s clip for the live pitch;
  `submission.html`: the 3:47 Devpost video, scene lengths and lines in `submission-script.js`), and
  `render.mjs [--page submission.html] [--workers 4]` renders with ffmpeg. `script-tools.mjs` writes the captions
  (`tandem-devpost.srt`) and `SCRIPT.md`.
- `docs/images/` holds the README images, rendered from `submission.html` stills. Re-render after UI changes.

## Next steps

1. Host the Supabase shared workspace and test Google OAuth and Realtime with two real accounts.
2. Host-side tools: QR check-in, waitlists for full events, recurring events.
3. Moderation queue for reports; server-side Google ID-token verification.
4. French UI strings; PWA install and offline shell.
5. More venue photos and seed groups; event imports from community associations and libraries.

Keep `npm test`, `npm run build`, `npm run lint`, `npm run e2e` and `npm run a11y` green after any change.

## Known limitations

- Without Tandem Live, data stays in one browser profile (live across tabs only). Tandem Live has no authentication
  (trusted networks only) and resolves conflicting edits to the same record last-writer-wins.
- Demo and email sign-in and ID verification are simulated. Google sign-in is real, but its token is checked in the
  browser only.
- Seeded events are fictional listings at real public Calgary venues with approximate coordinates; quadrant lines are
  approximate (Centre St / Macleod Tr and the Bow River / Memorial Dr).
- Attendance is self-reported. Reports are stored locally. Voice search needs a browser with SpeechRecognition.
