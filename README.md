# Tandem — Find your people. Find your Calgary.

**Tandem** — named after the tandem bicycle: people moving together toward a shared destination — is a Calgary-first web app that
helps residents, newcomers and visitors find people to **do things with** — running clubs, book clubs, hikes, jam
sessions, volunteering and more. It is **group-first, not profile-first**: no followers, no likes, no feeds, no personal
ratings. Events are reviewed — never people — and *Tandem Miles* celebrate showing up.

> *“Tandem doesn't measure how many people follow you. It helps you find people to go somewhere with.”*

Built for the **Code the Change** hackathon (Calgary, Nov 2026) — Prompt 1: *How can we leverage technology to promote
health, social connection, and well-being in our communities?* Also targeting **Best Local Impact** and **Best in
Accessibility**.

---

## Quick start

Requirements: Node 20+ (tested on Node 22) and npm.

```bash
npm install      # from the repo root (installs frontend/ too) — or: cd frontend && npm install
npm run dev      # http://localhost:5173
```

Other scripts (root or `frontend/`): `npm test` (Vitest), `npm run build` (type-check + production build),
`npm run lint` (oxlint), `npm run preview`, `npm run e2e` and `npm run a11y` (see Testing).

No API keys, accounts or paid services are needed. Map tiles come from OpenStreetMap, so the map needs internet.

### Shared workspace with Supabase

1. Create a Supabase project and apply the [collaboration](supabase/migrations/20261107000000_collaboration.sql) and [activity ratings](supabase/migrations/20261107000100_activity_ratings.sql) migrations in order
   using its SQL Editor or your migration runner. It creates the private collaboration tables, Data API functions
   and the Realtime publication entry.
2. Enable the Google provider in Supabase Auth and configure the Google OAuth client with the callback URL shown
   by Supabase. In Supabase Auth URL Configuration, set your app's Site URL and allow its `/login` callback
   including the optional `next` query string. [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
3. Set these values in `frontend/.env.local` and restart Vite. Use the project's publishable key.
   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```
4. Sign in with Google, finish onboarding, then start a group or publish an event. Use a second Google account
   in a separate browser profile to join and verify that RSVPs, event chat and group discussion update across clients.

The shared catalog starts empty. With the Supabase variables unset, Tandem runs its seeded single-browser demo.
In shared mode, Google sign-in, events, RSVPs, self-reported attendance, group membership and chat use Supabase.
Each chat shows its latest 100 messages. New activity ratings sync across the shared workspace. Reports, earlier browser-only reviews and most profile preferences stay in the browser.

Run the database regression tests on a fresh test project after applying the migration:

```bash
psql "$TANDEM_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/collaboration.sql
```

### Google sign-in for the browser-only demo (optional)

Real Google sign-in uses Google Identity Services — no backend and no passwords. New Google users get a Tandem
profile created from their Google name, email and photo, then finish the usual profile setup; returning users go
straight in. Without a client id the app still works with demo accounts and email sign-up.

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create (or pick) a project.
2. Go to **Google Auth Platform** (older UI: *APIs & Services → OAuth consent screen*). Set the app name (Tandem), a
   support email and audience **External**. While the app is in *Testing*, only the **test users** you add can sign in —
   add your team's Google accounts, or publish the app (name/email/photo scopes don't need Google verification).
3. **Clients → Create client → Web application.** Under *Authorised JavaScript origins* add `http://localhost:5173` and
   `http://localhost` (plus your deployed URL later). No redirect URI is needed.
4. Copy the client id into `frontend/.env.local` (template: `frontend/.env.example`):
   ```bash
   VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
5. Restart `npm run dev`. *Continue with Google* now appears on the sign-in and sign-up pages.

If Vite starts on another port (e.g. 5174 because 5173 is busy), add that origin too or stop the other server.
A web client id is public by design (it isn't a secret). This prototype checks the ID token's audience, issuer and
expiry in the browser and never stores the token; a production deployment must verify it on a server.

### Demo accounts (simulated sign-in — no passwords)

| Account | Persona | Good for showing |
|---|---|---|
| **Alex Rivera** | New to Calgary, UCalgary student (NW) | Recommendations, joining, chat, confirming attendance → Miles, reviewing → leaderboard, hosting/editing an event |
| **Sam Okafor** | Visiting from Toronto (travel mode on) | *Explore Like a Local* and the Weekend Planner |
| **Priya Sharma** | Local organizer of Calgary Sunrise Runners | Host tools: edit/cancel events, announcements in chat |

Use **Settings → Your data → Reset demo data** on the morning of a demo: seeded event dates are generated relative to
the day you reset. Open a second tab signed in as another demo account to see the group chat update live.

To try ratings immediately, continue as **Alex Rivera** and open **My events → Calgary Tech Coffee Meetup → Rate activity**.
The meetup is already complete and Alex's attendance is confirmed.

### 3–5 minute demo script (spec §27)

1. **Problem** — a student just moved to Calgary and doesn't know where to start.
2. **Profile setup** — create an account, select NW and a few interests, then choose *Find events* to see personalized suggestions.
3. **Smart discovery** — *Discover*: drag the price slider, tick *Wheelchair accessible*; try the search box
   “free hiking this weekend in NW” (or the mic).
4. **Calgary map** — *Explore Calgary Map* → quadrant chip **NW** → click a marker → preview → Join.
5. **Participation** — join *Bow River Sunrise Run* (count goes 12 → 13), open the group chat, see it on the dashboard.
6. **Community creation** — *Create event* → *Use a template* → *Book club* → Publish → it's in Discover and on the map.
7. **Accessibility** — toggle **Ease Into It** on Discover and watch smaller, beginner-friendly events rise; open the
   ♿ menu (text size, contrast, readable font); press *Read aloud* on an event.
8. **Traveller** — switch to **Sam** → *Explore Like a Local* → dates are prefilled → Weekend Planner → *Join all*.
9. **Impact** — Alex's dashboard: *Confirm I attended* the past run (+15 Miles, milestones), leave a review, then the
   **Leaderboard** and **Community impact** pages update live. Close with the line above.

---

## What's inside

| Area | Highlights |
|---|---|
| **Discovery** | Event cards with date, quadrant, price, capacity, host demo-verification, ratings and confirmed accessibility. Filters for price slider (0–$150+), free only, multi-category, quadrant, date presets + custom range, group size, 7 accessibility features, spaces available, verified host, traveller-friendly, indoor/outdoor. Seven sort orders. Plain-language + **voice** search ("quiet book club this weekend"). |
| **Calgary map** | Leaflet + OpenStreetMap, quadrant overlay (NW/NE/SW/SE), category-icon markers (never colour-only), zoom-aware clustering, popups with Join, fit-to-events, list/map toggle. **Same filter state and logic as the list** (filters live in the URL). Private locations show an area circle, never a pin. |
| **Events** | Single-page create/edit form with templates, optional details and an accessible error summary; public place picker or drop-a-pin; private/residential mode; First-Time Friendly details; tri-state accessibility (confirmed / not yet confirmed / not available); cancel with reason; .ics calendar export; share; read aloud. |
| **Group chat** | Per-event, attendees + host only; host announcements; participants; leave event; report message; persisted; live across tabs in the same browser. Seeded messages are labelled *Demo message*. |
| **Explore Like a Local** | Travel mode, travel dates, budget, quadrants → rule-based **Weekend Planner** (real events only, capacity/date/budget-aware, no overlaps), *Join all*, save to dashboard. |
| **Groups** | 12 persistent community groups with organizers, guidelines, upcoming/past events, join/leave. |
| **Reviews & leaderboard** | Only checked-in attendees can review, once; events never people. Fair Bayesian leaderboard; low-review events are labelled **New**. |
| **Tandem Miles** | Participation score derived from attendance/hosting, six milestones, never ranked publicly. |
| **Accessibility** | Comfort & Access preferences with must-haves, **Ease Into It**, text size, high contrast, reduced motion, Atkinson Hyperlegible font, underline links, read aloud, voice search, skip link, focus management, keyboard-operable map. |
| **Privacy & trust** | No addresses, passwords, IDs or medical data stored; private-by-default preferences; live “as others see it” profile preview; simulated ID verification badge reads *Demo verified*; export / delete my data; confidential reporting. |
| **Impact** | Community impact dashboard computed live (demo-labelled), with counters that move as you use the app. |

Event and group cards and detail pages use Calgary photography from Wikimedia Commons. Detail pages show the location
pictured, photographer, source and license. A labelled Calgary skyline photo appears where there is no matching
venue or neighbourhood photo. WebP copies are bundled with the app.

---

## Architecture

```
frontend/src
├── types/        Domain model (User, CalgaryEvent, CommunityGroup, EventRegistration, EventReview, ChatMessage…)
├── data/         Categories, accessibility features, Calgary geography (venues, neighbourhoods, quadrant lines), seed
├── services/     PURE functions (db, now) → result: filters, recommendations, itinerary, leaderboard, reviews,
│                 miles, events, registrations, chat, groups, users, impact, nlp (smart search), socials, storage
├── state/        AppStore (React context: db + simulated session + actions), display prefs, toasts
├── components/   ui kit, brand (logo), layout (shell/nav), events, filters, map (lazy-loaded Leaflet), profile…
├── pages/        One file per route
└── test/         Vitest specs for the services (spec §25 workflows)
```

- **Demo mode** uses pure services and a versioned localStorage document. The simulated session can differ by tab.
- **Shared mode** uses Supabase Auth and Postgres RPCs for collaboration. Realtime sends a revision update with no
  message contents. Each client refreshes a snapshot scoped to its identity, event access and group memberships.
  Postgres locks the event row when processing RSVPs or capacity changes.
- **Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Leaflet + React-Leaflet 5, lucide-react,
  Inter + Atkinson Hyperlegible (bundled), Vitest.

## Algorithms

### Recommendations (`services/recommendations.ts`)
1. **Hard constraints first** — never recommend events that are cancelled, private, started, full, already joined or
   hosted by you, over a budget you marked as strict, outside traveller dates, or missing an accessibility feature you
   marked as a **must-have** (confirmed by the organizer).
2. **Weighted score** — interest 35% · date & availability 20% · location 15% · accessibility & comfort 15% ·
   budget 10% · beginner-friendly 5%. Related interests count partially (e.g. hiking ↔ photography).
3. **Ease Into It** — blends in a comfort score (small group, beginner-friendly, arrival instructions, calm setting,
   clear description): `final = 0.6 × base + 0.4 × ease`.
4. **Explanation** — every recommendation says why: *“Recommended because you enjoy running and prefer free,
   beginner-friendly activities.”* — and the event page shows the per-factor breakdown.

### Fair leaderboard (`services/leaderboard.ts`)
Activities (recurring series or one-off events) with completed sessions are scored out of 100:
`0.55 × Bayesian rating + 0.20 × participation-vs-capacity + 0.15 × completion + 0.10 × review confidence`, where
`Bayesian = (C·m + Σratings)/(C + n)` with the city-wide mean `m` and `C = 5`, and `confidence = n/(n + C)`.
Fewer than 3 reviews → listed as **New**, not ranked. Filters: category, quadrant, date range, free/paid, accessibility.

### Tandem Miles (`services/miles.ts`)
Attend a confirmed event +10 · host an event that takes place +15 · first event in a new interest +5 · volunteer +10.
Derived from data (each registration can be checked in once), so repeated check-ins can't farm points.

### Weekend Planner (`services/itinerary.ts`)
Greedy, transparent: highest-scoring interest-matching events first, ≤ N per day, 45-minute buffer between
activities, no repeated category on the same day, only events that pass the hard constraints above.

---

## Testing

- `npm test` — 33 Vitest specs covering the spec §25 workflows at the service level (onboarding, recommendations,
  filters, price, map markers, create/join/leave, capacity, dashboard, chat persistence, milestones, reviews,
  leaderboard, accessibility filters, traveller dates), seed-data integrity and calendar export.
- `npm run e2e` — with the dev server running, drives your installed Google Chrome (headless, via the DevTools
  Protocol — no Playwright download) through all 20 workflows end to end, including a 390 px mobile viewport.
- `npm run a11y` — runs axe-core (WCAG 2.0/2.1/2.2 A + AA and best practices) on 18 pages; currently 0 violations.

Set `CHROME_PATH` / `BASE_URL` to point the browser checks elsewhere.

## Demo limitations & production improvements

| Prototype | Production |
|---|---|
| Browser-only demo stores collaboration in one browser profile | Enable the Supabase shared workspace above |
| Google sign-in checked in the browser; demo/email sign-in simulated (no passwords stored) | Server-side ID-token verification (or a managed auth provider) and MFA |
| *Demo verified* badge, no documents collected | Certified third-party ID verification returning only pass/fail |
| Self-reported attendance confirmation | Host-confirmed QR check-in |
| Reports stored locally | Moderation queue, response SLAs, rate limiting |
| Seeded fictional events at real public venues; approximate coordinates and quadrant lines | Partnerships with community associations, libraries and newcomer organisations; live event imports |

## Credits

Map data © OpenStreetMap contributors · Leaflet · lucide icons · Inter (Rasmus Andersson) · Atkinson Hyperlegible
(Braille Institute). Built in Mohkinstsis (Calgary), on Treaty 7 territory.
