# CLAUDE.md — Tandem (Code the Change hackathon)

> **Session hand-off file.** Claude Code loads this automatically. It is the single place that records
> what we're building, what the user asked for, what has been done, and what to do next.
> **Every session must end by updating §7 Prompt log, §8 Change log and §9 Next steps.**
> If you are a fresh session: read this file top to bottom, then `git status`, then continue at §9.

---

## 1. Project in one paragraph

**Tandem** is a Calgary-first web app that helps residents and visitors find people to *do things with*
(running clubs, book clubs, hikes, jam sessions, volunteering…). It is **group-first, not profile-first**:
no followers, no personal ratings, no feeds. Events are rated (never people), users earn **Tandem Miles**
for participation, and accessibility ("Comfort & Access", "Ease Into It") plus traveller-to-local discovery
("Explore Like a Local") are core differentiators. Built for the **Code the Change** hackathon (Calgary).

- Tagline: *"Better Together. Calgary Connected."* · Hero: *"Find your people. Find your Calgary."*
- Principle: *"Less scrolling. More doing."*
- Closing line for the demo: *"Tandem doesn't measure how many people follow you. It helps you find people to go somewhere with."*
- Name: **Tandem** (confirmed by the user on 2026-11-07). The spec PDF spells it "TNadem" — that was a typo; don't
  reintroduce it. The name lives in `frontend/src/lib/brand.ts` (UI) and is spelled out in seed text and docs.

## 2. Hackathon context

- Event: Code the Change. Hacking Nov 7 2026 (lunch 12pm, dinner 6pm). **Judging Nov 8 2026.**
- Sponsors: Clio, AWS, Voltex, Pason, Benevity. Sponsored resources: Arduino, AWS, n8n.io credits,
  Keenable.ai credits, Open Data Canada, Google Healthcare API.
- Prompt chosen: **Prompt 1** — "How can we leverage technology to promote health, social connection,
  and well-being in our communities?" (also touches Prompt 2: skills & networks).
- Main judging: Innovation & creativity · Impact & relevance · Feasibility · Technical execution · UX & design.
- Side pots we target: **Best Local Impact (Benevity)** — real Calgary challenges; **Best in Accessibility (Clio)** —
  accessibility, inclusivity, privacy, transparency. (Voltex energy-data pot is NOT targeted.)
- Team notes from the PDF: Accessibility → *speech*; Safety → *face/ID verification* (simulated only);
  Ideas → Flames events, shelter/volunteer events, running events; "travel mode" on profiles.

## 3. Source of truth

- Full spec: `Code the Change - Prompts and Juding criteria.pdf` (repo root, 40 pages). Pages 4–40 are the
  detailed build prompt (sections 1–30). Page 3 has the team's original prompt + notes.
- Key hard rules from the spec (don't break these):
  - No follower counts, no individual rankings, no public person-to-person ratings. Rank **events**, not people.
  - Never store passwords, government IDs, passport images, or medical info. Verification is **simulated** and
    the badge must say "Demo verified" (never imply a real ID check happened).
  - Auth is simulated; label it. localStorage is single-browser — never pretend it is multi-user.
  - Seeded content (events, messages, reviews, metrics) must be labelled as demo data.
  - Never require a precise home address; private/residential event locations show an approximate area.
  - Accessibility info per event is tri-state: confirmed by organizer / not yet confirmed / not available.
  - No colour-only information (map markers use icons + labels too). Target WCAG 2.2 AA.
  - No placeholder buttons or dead-end screens.

## 4. Tech stack & commands

React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + React Router 7 + Leaflet/React-Leaflet 5 (OpenStreetMap tiles)
+ lucide-react icons + Vitest. Persistence: browser localStorage behind a data-access layer.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (service/unit tests)
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run e2e        # (dev server running) headless-Chrome check of the 20 spec §25 workflows
npm run a11y       # (dev server running) axe-core WCAG 2.2 AA audit of 18 pages
npm run e2e:live   # (dev server running) two Chromes synced through a test Tandem Live server, incl. fallback
```
Live multi-device sync (optional): `npm run live` (repo root, port 8787) next to `npm run dev`, or
`docker compose up --build` (serves the built app + sync on :8787). `npm run test:live` tests the server.
Demo video: `node demo-video/capture.mjs` (dev server running) then `node demo-video/render.mjs` → `demo-video/tandem-demo.mp4`.
E2E/a11y scripts live in `frontend/scripts/e2e/` (plain Chrome DevTools Protocol, no Playwright). Override the browser
with `CHROME_PATH=...` and the target with `BASE_URL=...`.
(Root `package.json` proxies `npm install` / `npm run dev` / `npm test` / `npm run build` into `frontend/`.)

## 5. Architecture (frontend/src)

```
lib/        brand constant, dates, geo (haversine, point-in-polygon), ids, speech (TTS + voice input), ics, cn
types/      domain types (User, CalgaryEvent, CommunityGroup, EventRegistration, EventReview, ChatMessage, …)
data/       categories, accessibility features, Calgary geography (venues, neighbourhoods, quadrant lines), seed generator
services/   PURE functions over a `Database` object — storage adapter, events, registrations, filters,
            recommendations, reviews, leaderboard, miles, chat, groups, users, itinerary, impact, nlp (smart search)
state/      AppStore (React context: db + session + actions; cross-tab sync), display prefs, toasts
components/ brand (Logo), layout (shell/nav), ui kit, events, filters, map (lazy-loaded Leaflet), etc.
pages/      one file per route (see §6)
test/       vitest specs for services
```
- **Data flow:** UI → `useApp()` actions → service function `(db, args) → newDb` → `storage.save()` → React state.
  Components never touch localStorage directly (only `services/storage.ts` does).
- **Tandem Live:** `services/liveSync.ts` wraps the localStorage adapter (default in non-Supabase mode). If
  `server/live-server.mjs` is reachable (URL: localStorage `tandem.sync` → `VITE_SYNC_URL` → same origin when served
  by the server → `http://<host>:8787`), each save is diffed into entity ops (put/del/set by id) and POSTed; other
  devices' ops arrive over SSE. Server down → browser-only mode; reconnect pushes unsynced changes. e2e/a11y scripts
  set `tandem.sync=off` so they always start from a fresh seed.
- **Storage keys:** `tandem.db.v1` (whole demo DB), `tandem.session` (+ per-tab sessionStorage override so two tabs
  can be two different demo users → live cross-tab chat), `tandem.display` (text size / motion / contrast / font).
- **Map ↔ list sync:** both views use the same `filterEvents()` + filters serialized in the URL query string.
- **Time:** services take `now: Date` for testability. Seed dates are generated relative to the day of seeding;
  a banner offers "Refresh demo data" when the seed is from an earlier day.

## 6. Routes / required pages (spec §18)

`/` landing · `/login` · `/signup` · `/onboarding` · `/discover` · `/map` · `/events/:id` · `/events/new` ·
`/events/:id/edit` · `/events/:id/chat` · `/groups` · `/groups/:id` · `/dashboard` · `/profile` · `/people/:id` ·
`/leaderboard` · `/explore-like-a-local` · `/settings` · `/impact` · `*` 404

## 7. Prompt log (what the user asked, newest last)

1. **2026-11-07** — "implement this: `Code the Change - Prompts and Juding criteria.pdf`. Create a CLAUDE.MD file to keep
   track of prompts and changes and updates and what to work on next so that if claude credits run out, can start in new
   context session easily."
2. **2026-11-07** — "how ot run it?" → answered: `npm install` + `npm run dev` from the repo root, open localhost:5173.
3. **2026-11-07** — "should be able to create profile, and login with google accounts"
4. **2026-11-07** — "the product is called "Tandem"" → renamed everywhere (was "TNadem" from the spec PDF).

5. **2026-11-07** — Implement real-time chat, event attendance and group collaboration with Supabase on a separate branch. Test and commit locally, then get approval before pushing.

6. **2026-11-07** — Simplify navigation and reduce the number of steps in the UI. Review Git branches for excess work.

7. **2026-11-07** — Add real Calgary photos to the events.

8. **2026-11-07** — Let attendees give an activity a rating of up to five stars.

9. **2026-11-07** — Add a completed demo activity that can be rated and merge the collaboration branch into main.

10. **2026-11-07** — "create a demo video … under 30 seconds": sign-up (Google, interests, accessibility needs) →
    filtering + map → joining + chat with event info/tags/accessibility → rating → the "bigger picture" (dynamic
    accessibility for all Calgarians). Persona: someone visiting Calgary with social anxiety. Animated in our design
    language with tech-stack info. (User also pasted the judging criteria for context.)

11. **2026-11-07** — Make chat/live updates real with a free local server that won't crash, with a default fallback
    when it doesn't work ("like with docker … so we can say it in the demo"). Video is silent (team talks over it),
    no speech/narration text; it's one part of the presentation, so no title/closing slides.

12. **2026-11-07** — "seems too quick, could we slow it down so that the info is easier to read … but not too much"
    → retimed the video from 29 s to 40 s (each callout ≥ ~1 s, short pauses between steps).

## 8. Change log

- **2026-11-07 (session 1)** — Built the whole app on top of the teammate's Vite/React scaffold in `frontend/`
  (converted to TypeScript + Tailwind v4; removed the Vite template files). Core: typed domain model, Calgary geography
  (venues, neighbourhoods, approximate quadrant polygons), deterministic seed (14 demo users, 12 groups, 35 events — 25
  upcoming / 10 past incl. 1 cancelled — reviews, chat), pure services (filters, recommendations, itinerary, leaderboard,
  miles, reviews, chat, groups, users, impact, smart-search NLP, socials), AppStore context with cross-tab sync.
  UI: all routes in §6, logo (SVG tandem + two smiling riders, favicon), landing page with Calgary illustration,
  map with zoom-aware clustering, multi-step onboarding + event form, chat, dashboard, profile (own/public preview),
  settings (privacy, Comfort & Access, display, travel mode, simulated verification, export/reset/delete), leaderboard,
  traveller planner, impact dashboard, about page.

- **2026-11-07 (session 1, verification pass)** — Ran every page in headless Chrome via a small CDP script:
  fixed blank covers (class conflict), select/button class conflicts, map overlap (added zoom-aware clustering),
  popup styling (lazy leaflet.css overrides need extra specificity), viewport-height var `--chrome-top`,
  mobile overflow (flex/grid `min-w-0` + explicit `grid-cols-1`), itinerary now requires an interest match,
  more realistic seeded "would return" answers, label-in-name a11y fixes (visible text + sr-only event name).
  axe-core (WCAG 2.0/2.1/2.2 A+AA + best practices) reports **0 violations on 18 pages**. Wrote README.md and
  a root package.json (`npm install` / `npm run dev` work from the repo root).

- **2026-11-07 (session 1, final polish)** — Moved the CDP harness into the repo (`frontend/scripts/e2e`, `npm run e2e`,
  `npm run a11y`; axe-core dev dependency). Route-level code splitting (main JS 661 KB → 317 KB) with a page skeleton.
  Fixed a real .ics escaping bug (semicolons) + added a test (33 specs total). More seeded events are paid
  (strength $15, jam $10, film $8, sketching $12) so the price slider demo is visible. "Who's going" avatars respect
  each attendee's "show events I've attended" setting. Unstaged the scaffold deletions (`git reset`) so nothing is
  half-staged — **nothing has been committed yet** (user/teammates decide when).

- **2026-11-07 (session 1, prompt 3)** — Added real **Sign in with Google** (Google Identity Services, popup flow):
  `lib/googleIdentity.ts` (script loader, `VITE_GOOGLE_CLIENT_ID`), `services/googleAuth.ts` (ID-token claims check:
  aud/iss/exp), `services/users.ts → signInWithGoogle` (find by Google `sub` → link verified email → else create
  profile from Google name/email/photo; never touches demo accounts; ID token never stored),
  `components/auth/GoogleSignInButton.tsx` on /login and /signup (dev-only setup hint when no client id; nothing in
  production builds). Google sign-ups confirm 18+ in onboarding step 2. Header now has "Join free"; Settings shows the
  sign-in method; last name optional on profile edit. 38 vitest specs; e2e 16/16 and axe 0 violations re-run with a
  placeholder client id (Google's real button renders). README has the 5-step client-id setup.

- **2026-11-07 (session 1, prompt 4)** — Renamed the product **TNadem → Tandem** everywhere: UI (brand constant →
  "Tandem Miles"), page title/splash, seed text (flags, banners, demo emails `@demo.tandem.ca`, social handles),
  storage keys (`tandem.*`; old `tnadem.*` keys are cleared once on load, so browsers start with fresh demo data),
  package names, e2e scripts, README. Reworded copy that explained the name.

- **2026-11-07** — Added optional Supabase mode with Google OAuth, a shared event catalog, RSVP and attendance,
  event chat, group creation, membership and private discussion. The Supabase migration and SQL regression tests
  live under `supabase/`. The seeded browser demo is still available with the Supabase variables unset.

- **2026-11-07** — Replaced onboarding and event publishing wizards with single-page forms. Simplified the homepage,
  event listings and main navigation. Advanced event fields and filters are available in expandable sections.

- **2026-11-07** — Added 12 Wikimedia Commons photos to event cards and details. Known public venues use a
  venue or neighbourhood photo. Other listings use a labelled Calgary skyline photo. Event details show credits and licenses.

- **2026-11-07** — Made the overall star rating the only required review input. Added a direct link from My events
  and a Supabase migration that shares new ratings while enforcing attendance and one rating per user per event.

- **2026-11-07** — Added Calgary Tech Coffee Meetup as a completed, unrated activity with Alex already checked in.
  Existing demo databases get the fixture without a reset.

- **2026-11-07 (session 2)** — Added **Tandem Live**: zero-dependency Node sync server (`server/live-server.mjs`:
  SSE + entity ops, atomic JSON persistence, validation, serves `frontend/dist`), client adapter
  (`services/liveSync.ts`) with automatic fallback/reconnect, status-aware UI copy (chat badge "Live · N devices",
  banner, settings, about), `Dockerfile` + `docker-compose.yml`, tests (5 new vitest specs → 44, `npm run test:live`,
  `npm run e2e:live` 6/6: RSVP syncs in ~5 ms, chat ~100 ms, offline message delivered ~1.5 s after restart).
  Closed connections on `pagehide` (bfcache) so device counts stay accurate. Built the **demo video**
  (`demo-video/`): capture script records real screens (two real browsers for the live chat), `demo.html` animates
  them (Tandem tokens, Inter, lucide icons), `render.mjs` renders a silent 1080p60 MP4 via ffmpeg (29 s first cut; retimed to 40 s on request so labels are readable).
  Note: `npm install` was needed after the merge (`@supabase/supabase-js` was missing, so the dev server showed only
  the splash screen) — restart `npm run dev` after pulling.

### Status vs spec (update as you go: ✅ done · 🟡 partial · ⬜ todo)

| Spec § | Feature | Status |
|---|---|---|
| 3 | Branding, logo (tandem + 2 smiley riders), palette, Inter | ✅ |
| 5 | Signup + single-page profile setup, demo accounts, simulated login | ✅ |
| 6 | Simulated ID verification (not verified / pending / demo verified) | ✅ |
| 7 | Tandem Miles + milestones (no public ranking of people) | ✅ |
| 8 | Discovery: cards, filters (price slider, free, category, quadrant, date, size, access, other), sorting | ✅ |
| 9 | Interactive Leaflet map, quadrant overlay, marker popups, shared filters, list/map toggle, clustering | ✅ |
| 10 | Create/edit/cancel event (multi-step, validation, templates), auto chat + map marker | ✅ |
| 11 | Event group chat (persisted, announcements, participants, leave, report, cross-tab live) | ✅ |
| 12 | Explore Like a Local + Weekend Planner (rule-based itinerary, join all, save) | ✅ |
| 13 | Community groups (list, detail, join/leave) | ✅ |
| 14 | Event reviews + fair Bayesian leaderboard ("New" for low-review events) | ✅ |
| 15 | Accessibility: WCAG basics, Comfort & Access, First-Time Friendly, Ease Into It, speech (read aloud + voice search) | ✅ |
| 16 | Dashboard + profile (own + public view, privacy-aware, photo upload) | ✅ |
| 17 | Landing page (7 sections + CTA) | ✅ |
| 22 | Recommendation engine with explanations + factor breakdown | ✅ |
| 23 | Community impact dashboard (demo-labelled, live counters) | ✅ |
| 24 | Privacy controls, data export/delete, reporting | ✅ |
| 25 | Tests for key workflows (44 vitest specs + `npm run e2e` (17 checks, all 20 workflows) + `npm run a11y` + `npm run e2e:live` + `npm run test:live`) | ✅ |
| 29 | README (setup, architecture, algorithms, limitations) + root package.json proxy scripts | ✅ |

## 9. Next steps (keep this list current — top item = what to do next)

1. **Create the Google OAuth client id** (README → "Sign in with Google"), put it in `frontend/.env.local`, restart
   `npm run dev`, and test with a real account (add teammates/judges as test users or publish the consent screen).
   For a deployed demo, add its URL to *Authorised JavaScript origins*.
2. Rehearse with the demo video (`demo-video/tandem-demo.mp4`, silent, 40 s). For a live multi-device demo: run
   `npm run live` + `npm run dev -- --host`, open the network URL on a phone, sign in as different demo accounts,
   chat. Reset demo data (resets everyone's shared world) right before judging.
   If anything changes in the UI, re-run `node demo-video/capture.mjs` then `node demo-video/render.mjs`.
3. Optional upgrades if time remains (in value order):
   - Configure the shared Supabase project and verify Google OAuth and Realtime with two browser profiles (README).
   - More seed groups and photos for venues that currently use the Calgary skyline.
   - French UI strings (Calgary/Canada bilingual audience), PWA install + offline shell.
   - Host-side tools: QR check-in, waitlist when an event is full, recurring-event creation.
4. Keep `npm test`, `npm run build`, `npm run e2e` and `npm run a11y` green after any change (dev server must be
   running for e2e/a11y: `npm run dev` in another terminal).

## 10. Demo prep checklist (spec §27 story)

1. `npm run dev`, open http://localhost:5173, Settings → Your data → **Reset demo data** (seed dates are relative to
   the reset day). Dismiss the black "Hackathon prototype" banner if you want more room.
2. Story: new student → *Create account* → choose NW and interests → *Find events* →
   Discover (price slider, Wheelchair accessible,
   try search "free hiking this weekend in NW") → *Explore Calgary Map* → NW chip → click a marker → Join →
   join *Bow River Sunrise Run* (12 → 13) → group chat → dashboard → *Create event* → *Use a template* → *Book club* →
   Publish (appears in Discover + map) → toggle **Ease Into It** → account menu → *Switch demo account* → **Sam** →
   *Explore Like a Local* → *Join all* → switch to **Alex** → dashboard *Confirm* past run (+15 Miles) → review it →
   Leaderboard + Community impact → closing line: "Tandem doesn't measure how many people follow you. It helps you
   find people to go somewhere with."
3. Live-chat trick: open the same event chat in a second tab, switch that tab to another demo account, type in one tab.

## 11. Known limitations (keep honest; mirror in README)

- Without Tandem Live, localStorage = single browser profile (cross-tab sync only). With Tandem Live, devices on the
  network share one demo world, but the server has no authentication (trusted network only) and conflicting edits to
  the same record are last-writer-wins.
- Demo-account/email sign-in and ID verification are simulated; no passwords or documents are stored. Google sign-in is
  real but the ID token is only checked in the browser (production: verify server-side).
- Seeded events are fictional listings placed at real public Calgary venues (approximate coordinates).
- Quadrant boundary lines on the map are approximate (Centre St/Macleod Tr and Bow River/Memorial Dr).
- Attendance confirmation is self-reported (production: host-confirmed QR check-in). Reports are stored locally only.
- Voice search uses the browser's SpeechRecognition (Chrome/Edge/Safari); hidden where unsupported.
- oxlint shows only `react/only-export-components` fast-refresh hints (harmless).
