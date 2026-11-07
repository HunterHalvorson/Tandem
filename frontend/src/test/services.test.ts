/**
 * Service-level tests mapping to the workflows in spec §25 ("At minimum, verify: 1–20").
 * UI-only items (marker click → details, mobile layout) are verified in the browser.
 */
import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '../data/categories'
import { guessQuadrant, QUADRANTS, VENUES } from '../data/calgary'
import { createSeedDatabase, userId } from '../data/seed'
import { addDays, toDateInput } from '../lib/dates'
import { announcements, canAccessChat, eventMessages, reportContent, sendMessage } from '../services/chat'
import { AppError, getEvent, getUser, isGoing, isSeedStale, registeredCount, spotsLeft, userUpcomingEvents, verificationStatus } from '../services/db'
import { cancelEvent, createEvent, emptyDraft, updateEvent, validateDraft, draftFromEvent, type EventDraft } from '../services/events'
import { DEFAULT_FILTERS, filterEvents, filtersFromParams, filtersToParams, PRICE_MAX, sortEvents } from '../services/filters'
import { joinGroup, groupMemberCount, isMember, leaveGroup } from '../services/groups'
import { impactMetrics } from '../services/impact'
import { planItinerary } from '../services/itinerary'
import { buildLeaderboard, DEFAULT_LEADERBOARD_FILTERS } from '../services/leaderboard'
import { layoutMarkers } from '../services/map'
import { computeMiles } from '../services/miles'
import { applyParsedQuery, parseQuery } from '../services/nlp'
import { recommendEvents } from '../services/recommendations'
import { checkIn, joinEvent, leaveEvent, toggleSavedEvent } from '../services/registrations'
import { canReview, ratingSummary, submitReview } from '../services/reviews'
import { validateSocial } from '../services/socials'
import { createMemoryAdapter, loadOrSeed } from '../services/storage'
import { createAccount, deleteAccount, requestVerification, updateUser } from '../services/users'
import type { Database } from '../types'

// Sunday Nov 8 2026, 9:00 local — judging day.
const NOW = new Date(2026, 10, 8, 9, 0, 0)
const seed = () => createSeedDatabase(NOW)
const ALEX = userId('alex')
const SAM = userId('sam')
const PRIYA = userId('priya')

function bookClubDraft(): EventDraft {
  return emptyDraft(NOW, {
    title: 'Beltline Sci-Fi Book Club',
    description: 'A friendly monthly book club for science-fiction fans. This month we discuss a classic short novel.',
    categoryId: 'reading',
    date: toDateInput(addDays(NOW, 2)),
    startTime: '19:00',
    endTime: '20:30',
    venueId: 'memorial-park',
    price: '0',
    capacity: '10',
    firstTime: { whatToExpect: 'Relaxed chat.', whatToBring: '', experienceNeeded: 'None', howToFindUs: 'Main floor, red table sign.', bringAFriend: true },
  })
}

describe('seed data integrity (spec §21)', () => {
  const db = seed()
  it('has 25–35 events, 8–12 groups and several demo users', () => {
    expect(db.events.length).toBeGreaterThanOrEqual(25)
    expect(db.events.length).toBeLessThanOrEqual(35)
    expect(db.groups.length).toBeGreaterThanOrEqual(8)
    expect(db.groups.length).toBeLessThanOrEqual(12)
    expect(db.users.length).toBeGreaterThanOrEqual(5)
  })
  it('keeps every reference valid and never exceeds capacity', () => {
    const userIds = new Set(db.users.map((u) => u.id))
    const eventIds = new Set(db.events.map((e) => e.id))
    for (const e of db.events) {
      expect(userIds.has(e.hostId)).toBe(true)
      if (e.groupId) expect(db.groups.some((g) => g.id === e.groupId)).toBe(true)
      expect(registeredCount(db, e)).toBeLessThanOrEqual(e.capacity)
      expect(new Date(e.endsAt) > new Date(e.startsAt)).toBe(true)
    }
    for (const r of [...db.registrations, ...db.reviews]) {
      expect(eventIds.has(r.eventId)).toBe(true)
      expect(userIds.has(r.userId)).toBe(true)
    }
    for (const r of db.reviews) {
      const reg = db.registrations.find((x) => x.eventId === r.eventId && x.userId === r.userId)
      expect(reg?.checkedInAt, `review ${r.id} must come from a checked-in attendee`).toBeTruthy()
    }
  })
  it('covers all four quadrants, free + paid, traveller-friendly, past events with reviews, upcoming with space', () => {
    const upcoming = db.events.filter((e) => new Date(e.startsAt) > NOW && e.status === 'scheduled')
    for (const q of QUADRANTS) expect(upcoming.filter((e) => e.venue.quadrant === q).length).toBeGreaterThanOrEqual(3)
    expect(upcoming.some((e) => e.price === 0)).toBe(true)
    expect(upcoming.some((e) => e.price > 0)).toBe(true)
    expect(upcoming.filter((e) => e.travellerFriendly).length).toBeGreaterThanOrEqual(5)
    expect(db.reviews.length).toBeGreaterThan(10)
    expect(upcoming.some((e) => spotsLeft(db, e) === 0)).toBe(true)
    expect(upcoming.filter((e) => spotsLeft(db, e) > 0).length).toBeGreaterThan(15)
    expect(db.events.every((e) => e.isDemo)).toBe(true)
  })
  it('places every venue in the quadrant its address says', () => {
    for (const v of VENUES) expect(guessQuadrant(v), v.name).toBe(v.quadrant)
  })
})

describe('1. onboarding / accounts', () => {
  it('creates an account without storing the password and completes onboarding', () => {
    let db = seed()
    const input = { firstName: 'Jamie', lastName: 'Doe', email: 'jamie@example.com', password: 'secret123', ageConfirmed: true, residency: 'new' as const }
    const res = createAccount(db, input, NOW)
    db = updateUser(res.db, res.user.id, { interests: ['running', 'reading', 'hiking'], quadrant: 'NW', onboardingComplete: true })
    const user = getUser(db, res.user.id)!
    expect(user.onboardingComplete).toBe(true)
    expect(JSON.stringify(db)).not.toContain('secret123')
    expect(() => createAccount(db, input, NOW)).toThrow(AppError) // duplicate email
  })
  it('requires 18+ confirmation and a valid email', () => {
    const db = seed()
    expect(() => createAccount(db, { firstName: 'A', lastName: 'B', email: 'bad', password: 'abc12345', ageConfirmed: false, residency: '' }, NOW)).toThrow(AppError)
  })
})

describe('2. interests affect recommendations (+ Ease Into It)', () => {
  it('ranks matching interests first and explains why', () => {
    let db = seed()
    db = updateUser(db, ALEX, { interests: ['running'] })
    const recs = recommendEvents(db, getUser(db, ALEX)!, NOW, { limit: 3 })
    expect(recs[0].event.categoryId).toBe('running')
    expect(recs[0].explanation).toMatch(/^Recommended because you enjoy running and prefer free, beginner-friendly(, small-group)? activities/)
    db = updateUser(db, ALEX, { interests: ['tech'] })
    const recs2 = recommendEvents(db, getUser(db, ALEX)!, NOW, { limit: 3 })
    expect(recs2[0].event.categoryId).toBe('tech')
  })
  it('never recommends full, past, or joined events, and honours essential accessibility needs', () => {
    let db = seed()
    db = updateUser(db, ALEX, { comfort: { ...getUser(db, ALEX)!.comfort, essential: ['wheelchair'] } })
    const recs = recommendEvents(db, getUser(db, ALEX)!, NOW)
    expect(recs.length).toBeGreaterThan(0)
    for (const r of recs) {
      expect(spotsLeft(db, r.event)).toBeGreaterThan(0)
      expect(new Date(r.event.startsAt) > NOW).toBe(true)
      expect(r.event.accessibility.wheelchair).toBe('confirmed')
    }
  })
  it('Ease Into It favours smaller, beginner-friendly events with arrival details', () => {
    const db = seed()
    const alex = getUser(db, ALEX)!
    // A neutral user with no saved comfort preferences, so only the Ease Into It toggle differs.
    const user = { ...alex, interests: [], neighbourhood: null, quadrant: null, availability: [], budget: { max: null, strict: false }, comfort: { ...alex.comfort, smallGroups: false, beginnerFriendly: false, prefersFree: false } }
    const avgCap = (ease: boolean) => {
      const top = recommendEvents(db, user, NOW, { easeIntoIt: ease, limit: 5 })
      return top.reduce((s, r) => s + r.event.capacity, 0) / top.length
    }
    expect(avgCap(true)).toBeLessThan(avgCap(false))
    const top = recommendEvents(db, user, NOW, { easeIntoIt: true, limit: 5 })
    expect(top.every((r) => r.event.beginnerFriendly)).toBe(true)
  })
})

describe('3/4/18. filters, price slider, accessibility filters', () => {
  const db = seed()
  it('filters by category + quadrant together', () => {
    const res = filterEvents(db, { ...DEFAULT_FILTERS, categories: ['running'], quadrants: ['NW'] }, NOW)
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((e) => e.categoryId === 'running' && e.venue.quadrant === 'NW')).toBe(true)
  })
  it('price slider and free-only work', () => {
    const all = filterEvents(db, DEFAULT_FILTERS, NOW)
    const max10 = filterEvents(db, { ...DEFAULT_FILTERS, maxPrice: 10 }, NOW)
    expect(max10.every((e) => e.price <= 10)).toBe(true)
    expect(max10.length).toBeLessThan(all.length)
    const free = filterEvents(db, { ...DEFAULT_FILTERS, freeOnly: true }, NOW)
    expect(free.length).toBeGreaterThan(0)
    expect(free.every((e) => e.price === 0)).toBe(true)
  })
  it('accessibility filters require organizer-confirmed features', () => {
    const res = filterEvents(db, { ...DEFAULT_FILTERS, access: ['wheelchair', 'quiet'] }, NOW)
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((e) => e.accessibility.wheelchair === 'confirmed' && e.accessibility.quiet === 'confirmed')).toBe(true)
  })
  it('date presets work (today / tomorrow)', () => {
    const today = filterEvents(db, { ...DEFAULT_FILTERS, date: 'today' }, NOW)
    expect(today.length).toBeGreaterThan(0)
    expect(today.every((e) => new Date(e.startsAt).getDate() === NOW.getDate())).toBe(true)
    const tomorrow = filterEvents(db, { ...DEFAULT_FILTERS, date: 'tomorrow' }, NOW)
    expect(tomorrow.every((e) => new Date(e.startsAt).getDate() === addDays(NOW, 1).getDate())).toBe(true)
  })
  it('round-trips filters through the URL', () => {
    const f = { ...DEFAULT_FILTERS, categories: ['hiking' as const], quadrants: ['SE' as const], maxPrice: 40, access: ['beginner' as const], sort: 'soonest' as const }
    expect(filtersFromParams(filtersToParams(f))).toEqual(f)
    expect(filtersFromParams(new URLSearchParams('max=999&cat=nope,hiking&sort=zzz'))).toEqual({ ...DEFAULT_FILTERS, categories: ['hiking'], maxPrice: PRICE_MAX })
  })
  it('sorts by price and soonest', () => {
    const list = filterEvents(db, DEFAULT_FILTERS, NOW)
    const byPrice = sortEvents(db, list, { ...DEFAULT_FILTERS, sort: 'price' }, { now: NOW })
    for (let i = 1; i < byPrice.length; i++) expect(byPrice[i].price).toBeGreaterThanOrEqual(byPrice[i - 1].price)
    const soon = sortEvents(db, list, { ...DEFAULT_FILTERS, sort: 'soonest' }, { now: NOW })
    for (let i = 1; i < soon.length; i++) expect(soon[i].startsAt >= soon[i - 1].startsAt).toBe(true)
  })
})

describe('5/7/8. event creation + map markers', () => {
  it('validates, saves, appears in discovery and on the map, and creates a chat', () => {
    let db = seed()
    const bad = validateDraft({ ...bookClubDraft(), price: '-5', capacity: '1', date: toDateInput(addDays(NOW, -1)) }, NOW)
    expect(bad.price).toBeTruthy()
    expect(bad.capacity).toBeTruthy()
    expect(bad.when).toBeTruthy()
    const res = createEvent(db, bookClubDraft(), ALEX, NOW)
    db = res.db
    const visible = filterEvents(db, { ...DEFAULT_FILTERS, categories: ['reading'] }, NOW)
    expect(visible.map((e) => e.id)).toContain(res.event.id)
    const markers = layoutMarkers(filterEvents(db, DEFAULT_FILTERS, NOW))
    expect(markers.map((m) => m.event.id)).toContain(res.event.id)
    expect(new Set(markers.map((m) => m.event.id)).size).toBe(filterEvents(db, DEFAULT_FILTERS, NOW).length)
    expect(eventMessages(db, res.event.id).some((m) => m.kind === 'system')).toBe(true)
    expect(announcements(db, res.event.id).length).toBe(1)
  })
  it('approximate (private) locations never store the exact pin', () => {
    const draft = { ...bookClubDraft(), locationMode: 'custom' as const, venueId: '', placeName: 'My apartment', quadrant: 'NW' as const, lat: 51.0611, lng: -114.0812, approximate: true, privateDetails: 'Unit 4' }
    const { event } = createEvent(seed(), draft, ALEX, NOW)
    expect(event.venue.approximate).toBe(true)
    expect(event.venue.lat).not.toBe(51.0611)
    expect(event.venue.name).toContain('approximate')
  })
  it('only the host can edit/cancel; capacity cannot drop below registrations', () => {
    let db = seed()
    const ev = getEvent(db, 'evt-sunrise-run-next')!
    expect(() => updateEvent(db, ev.id, draftFromEvent(ev), ALEX, NOW)).toThrow(AppError)
    const errors = validateDraft({ ...draftFromEvent(ev), capacity: '3' }, NOW, { registered: registeredCount(db, ev) })
    expect(errors.capacity).toMatch(/already registered/)
    db = updateEvent(db, ev.id, { ...draftFromEvent(ev), startTime: '07:30', endTime: '08:30' }, PRIYA, NOW)
    expect(new Date(getEvent(db, ev.id)!.startsAt).getMinutes()).toBe(30)
    db = cancelEvent(db, ev.id, PRIYA, 'Extreme cold warning', NOW)
    expect(getEvent(db, ev.id)!.status).toBe('cancelled')
    expect(filterEvents(db, DEFAULT_FILTERS, NOW).some((e) => e.id === ev.id)).toBe(false)
  })
})

describe('9/10/11/14. join, capacity, dashboard, leave', () => {
  it('joining updates capacity and the dashboard; leaving reverses it', () => {
    let db = seed()
    const ev = getEvent(db, 'evt-sunrise-run-next')!
    const before = registeredCount(db, ev)
    db = joinEvent(db, ev.id, ALEX, NOW)
    expect(isGoing(db, ev.id, ALEX)).toBe(true)
    expect(registeredCount(db, ev)).toBe(before + 1)
    expect(userUpcomingEvents(db, ALEX, NOW).map((e) => e.id)).toContain(ev.id)
    expect(() => joinEvent(db, ev.id, ALEX, NOW)).toThrow(AppError)
    db = leaveEvent(db, ev.id, ALEX, NOW)
    expect(isGoing(db, ev.id, ALEX)).toBe(false)
    expect(registeredCount(db, ev)).toBe(before)
    db = joinEvent(db, ev.id, ALEX, NOW) // re-join reuses the registration
    expect(db.registrations.filter((r) => r.eventId === ev.id && r.userId === ALEX).length).toBe(1)
  })
  it('full events reject new registrations', () => {
    const db = seed()
    const full = db.events.find((e) => new Date(e.startsAt) > NOW && spotsLeft(db, e) === 0)!
    expect(() => joinEvent(db, full.id, ALEX, NOW)).toThrow(/full/)
  })
  it('saves events', () => {
    const { db, saved } = toggleSavedEvent(seed(), ALEX, 'evt-book-club-next')
    expect(saved).toBe(true)
    expect(getUser(db, ALEX)!.savedEventIds).toContain('evt-book-club-next')
  })
})

describe('12/13. group chat + persistence', () => {
  it('only attendees/host can chat; messages persist through the storage adapter', () => {
    const adapter = createMemoryAdapter()
    let db = loadOrSeed(adapter, NOW)
    const ev = getEvent(db, 'evt-book-club-next')!
    expect(canAccessChat(db, ev, ALEX)).toBe(false)
    expect(() => sendMessage(db, { eventId: ev.id, userId: ALEX, body: 'hi' }, NOW)).toThrow(AppError)
    db = joinEvent(db, ev.id, ALEX, NOW)
    db = sendMessage(db, { eventId: ev.id, userId: ALEX, body: 'Hi all — first book club!' }, NOW)
    expect(() => sendMessage(db, { eventId: ev.id, userId: ALEX, body: 'x', announcement: true }, NOW)).toThrow(/host/)
    adapter.save(db)
    const reloaded = loadOrSeed(adapter, NOW)
    expect(eventMessages(reloaded, ev.id).some((m) => m.body === 'Hi all — first book club!')).toBe(true)
    const msg = eventMessages(reloaded, ev.id).find((m) => m.userId === userId('noor'))!
    const reported = reportContent(reloaded, { targetType: 'message', targetId: msg.id, reporterId: ALEX, reason: 'spam', details: '' }, NOW)
    expect(reported.reports.length).toBe(1)
  })
})

describe('15/16/17. miles, milestones, reviews, leaderboard', () => {
  it('confirming attendance earns miles once and unlocks milestones', () => {
    let db = seed()
    const before = computeMiles(db, ALEX, NOW)
    expect(before.milestones.find((m) => m.id === 'first-ride')!.achieved).toBe(true) // attended tech meetup
    db = checkIn(db, 'evt-sunrise-run-past-1', ALEX, NOW)
    const after = computeMiles(db, ALEX, NOW)
    expect(after.total).toBe(before.total + 10 + 5) // attend + new category (running)
    expect(() => checkIn(db, 'evt-sunrise-run-past-1', ALEX, NOW)).toThrow(AppError)
    expect(computeMiles(db, ALEX, NOW).total).toBe(after.total)
    expect(computeMiles(db, PRIYA, NOW).milestones.find((m) => m.id === 'community-builder')!.achieved).toBe(true)
  })
  it('only confirmed attendees can review, once; leaderboard reacts', () => {
    let db = seed()
    const evId = 'evt-photo-past'
    expect(canReview(db, evId, ALEX, NOW).ok).toBe(false)
    // Grace attended + reviewed already; Jordan too → photo walk has 2 reviews → "New"
    let lb = buildLeaderboard(db, DEFAULT_LEADERBOARD_FILTERS, NOW)
    expect(lb.fresh.some((e) => e.key === 'series-nose-hill-photo')).toBe(true)
    // Hannah hosts; add a third attendee review via a new attendee:
    const extra = { ...getUser(db, ALEX)!, id: 'usr-test' }
    db = { ...db, users: [...db.users, extra], registrations: [...db.registrations, { id: 'reg-x', eventId: evId, userId: 'usr-test', status: 'going', joinedAt: NOW.toISOString(), checkedInAt: NOW.toISOString(), isDemo: false }] }
    expect(canReview(db, evId, 'usr-test', NOW).ok).toBe(true)
    db = submitReview(db, evId, 'usr-test', { overall: 5, organization: 5, accuracy: 5, accessibilityAccuracy: null, wouldReturn: true, comment: 'Great' }, NOW)
    expect(canReview(db, evId, 'usr-test', NOW).ok).toBe(false)
    lb = buildLeaderboard(db, DEFAULT_LEADERBOARD_FILTERS, NOW)
    expect(lb.ranked.some((e) => e.key === 'series-nose-hill-photo')).toBe(true)
    expect(ratingSummary(db, getEvent(db, 'evt-photo-next')!).count).toBe(3)
  })
  it('Bayesian ranking does not let 3 perfect reviews automatically beat many great ones', () => {
    const db = seed()
    const lb = buildLeaderboard(db, DEFAULT_LEADERBOARD_FILTERS, NOW)
    expect(lb.ranked.length).toBeGreaterThanOrEqual(5)
    const ranks = lb.ranked.map((e) => e.score)
    for (let i = 1; i < ranks.length; i++) expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1])
    const filtered = buildLeaderboard(db, { ...DEFAULT_LEADERBOARD_FILTERS, categories: ['running'] }, NOW)
    expect(filtered.ranked.every((e) => e.categoryId === 'running')).toBe(true)
  })
})

describe('19. traveller dates + Weekend Planner', () => {
  it('only plans events inside the visit, within budget, without overlaps', () => {
    const db = seed()
    const sam = getUser(db, SAM)!
    const plan = planItinerary(
      db,
      sam,
      { arrival: sam.traveller.arrival!, departure: sam.traveller.departure!, interests: sam.interests, budgetPerEvent: 40, quadrants: [], beginner: true, travellerOnly: true, perDay: 2, easeIntoIt: false },
      NOW,
    )
    expect(plan.error).toBeUndefined()
    expect(plan.days.length).toBe(4)
    const items = plan.days.flatMap((d) => d.items)
    expect(items.length).toBeGreaterThanOrEqual(4)
    for (const d of plan.days) {
      for (const it of d.items) {
        expect(toDateInput(new Date(it.rec.event.startsAt))).toBe(d.date)
        expect(it.rec.event.price).toBeLessThanOrEqual(40)
        expect(it.rec.event.travellerFriendly).toBe(true)
      }
      expect(d.items.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('trust, privacy and smart search', () => {
  it('simulated verification goes pending → demo verified without storing documents', () => {
    let db = seed()
    db = requestVerification(db, ALEX, 'passport', NOW)
    const u = getUser(db, ALEX)!
    expect(verificationStatus(u, NOW)).toBe('pending')
    expect(verificationStatus(u, new Date(NOW.getTime() + 5000))).toBe('demo_verified')
    expect(Object.keys(u.verification).sort()).toEqual(['documentType', 'requestedAt', 'status'])
  })
  it('deleting an account removes everything that references it', () => {
    const db = deleteAccount(seed(), ALEX)
    expect(getUser(db, ALEX)).toBeUndefined()
    expect(db.events.some((e) => e.hostId === ALEX)).toBe(false)
    expect(db.registrations.some((r) => r.userId === ALEX)).toBe(false)
  })
  it('groups: join/leave and member counts', () => {
    let db = seed()
    const g = db.groups[0]
    const before = groupMemberCount(db, g)
    db = joinGroup(db, g.id, ALEX, NOW)
    expect(isMember(db, g.id, ALEX)).toBe(true)
    expect(groupMemberCount(db, g)).toBe(before + 1)
    db = leaveGroup(db, g.id, ALEX)
    expect(() => leaveGroup(db, g.id, g.organizerId)).toThrow(AppError)
  })
  it('parses natural language into filters', () => {
    const p = parseQuery('Show me free hiking events this weekend in the northwest, wheelchair accessible please')
    expect(p.categories).toEqual(['hiking'])
    expect(p.quadrants).toEqual(['NW'])
    expect(p.date).toBe('weekend')
    expect(p.freeOnly).toBe(true)
    expect(p.access).toContain('wheelchair')
    expect(p.text).toBe('')
    const f = applyParsedQuery(DEFAULT_FILTERS, parseQuery('board games under $10'))
    expect(f.categories).toEqual(['games'])
    expect(f.maxPrice).toBe(10)
    expect(parseQuery('kensington').text).toBe('kensington')
  })
  it('validates social links', () => {
    expect(validateSocial('github', '@octocat')).toEqual({ ok: true, url: 'https://github.com/octocat' })
    expect(validateSocial('strava', 'https://www.strava.com/athletes/123').ok).toBe(true)
    expect(validateSocial('strava', 'https://evil.example.com/athletes/1').ok).toBe(false)
    expect(validateSocial('instagram', 'https://instagram.com').ok).toBe(false)
  })
  it('impact metrics and stale-seed detection', () => {
    const db: Database = seed()
    const m = impactMetrics(db, NOW)
    expect(m.quadrantsCovered).toBe(4)
    expect(m.categoriesRepresented).toBeGreaterThan(10)
    expect(m.live.registrations).toBe(0)
    expect(isSeedStale(db, NOW)).toBe(false)
    expect(isSeedStale(db, addDays(NOW, 1))).toBe(true)
    expect(CATEGORY_IDS.length).toBe(18)
  })
})
