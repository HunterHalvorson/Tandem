/**
 * Transparent, rule-based recommendation engine (no AI API).
 *
 * 1. Hard constraints remove events first: not upcoming, full, cancelled, private, already joined/hosting,
 *    over a strict budget, missing an *essential* accessibility feature, or outside traveller dates.
 * 2. Remaining events are scored with the weights from the spec:
 *      interest 35% · date & availability 20% · location 15% · accessibility 15% · budget 10% · beginner 5%
 * 3. "Ease Into It" blends in a comfort score (small group, beginner-friendly, arrival details, calm setting,
 *    clear description): final = 0.6·base + 0.4·ease.
 * 4. Each recommendation carries a plain-language explanation and a per-factor breakdown.
 */
import { accessFeature } from '../data/accessibility'
import { CATEGORIES, RELATED } from '../data/categories'
import { CITY_CENTRE, neighbourhood, quadrantAffinity } from '../data/calgary'
import { DAY, timeSlot } from '../lib/dates'
import { formatPrice } from '../lib/format'
import { haversineKm } from '../lib/geo'
import type { AccessFeature, CalgaryEvent, CategoryId, Database, Quadrant, User } from '../types'
import { eventPhase, isGoing, registeredCount, spotsLeft } from './db'

export const REC_WEIGHTS = {
  interest: 0.35,
  date: 0.2,
  location: 0.15,
  accessibility: 0.15,
  budget: 0.1,
  beginner: 0.05,
} as const

export type FactorId = keyof typeof REC_WEIGHTS

export const FACTOR_LABEL: Record<FactorId, string> = {
  interest: 'Interest match',
  date: 'Date & availability',
  location: 'Location',
  accessibility: 'Accessibility & comfort',
  budget: 'Budget',
  beginner: 'Beginner-friendly',
}

export interface TravellerContext {
  start: Date
  end: Date
  interests: CategoryId[]
  budget: number | null
  quadrants: Quadrant[]
  beginner: boolean
  travellerOnly: boolean
}

export interface RecOptions {
  /** Overrides the user's saved Ease Into It setting. */
  easeIntoIt?: boolean
  traveller?: TravellerContext
}

export interface Recommendation {
  event: CalgaryEvent
  /** 0–1 */
  score: number
  factors: Array<{ id: FactorId; weight: number; value: number }>
  ease: number | null
  reasons: string[]
  explanation: string
}

const FEATURE_ADJ: Record<AccessFeature, string> = {
  wheelchair: 'wheelchair-accessible',
  stepFree: 'step-free',
  accessibleWashroom: 'accessible-washroom',
  quiet: 'quiet',
  sensoryFriendly: 'sensory-friendly',
  virtual: 'virtual-friendly',
}

/** Returns a reason when the event must not be recommended as joinable, otherwise null. */
export function hardConstraint(db: Database, e: CalgaryEvent, user: User, now: Date, opts: RecOptions = {}): string | null {
  if (e.status !== 'scheduled') return 'cancelled'
  if (e.visibility !== 'public') return 'private'
  if (eventPhase(e, now) !== 'upcoming') return 'started or ended'
  if (spotsLeft(db, e) <= 0) return 'full'
  if (e.hostId === user.id) return 'you are hosting'
  if (isGoing(db, e.id, user.id)) return 'already going'
  const t = opts.traveller
  const budget = t ? t.budget : user.budget.strict ? user.budget.max : null
  if (budget !== null && e.price > budget) return 'over budget'
  if (user.comfort.essential.some((f) => e.accessibility[f] !== 'confirmed')) return 'missing an essential accessibility feature'
  if (t) {
    const start = new Date(e.startsAt)
    if (start < t.start || start > t.end) return 'outside your travel dates'
    if (t.travellerOnly && !e.travellerFriendly) return 'not marked traveller-friendly'
  }
  return null
}

export function easeScore(e: CalgaryEvent): number {
  const size = e.capacity <= 12 ? 1 : e.capacity <= 20 ? 0.6 : e.capacity <= 40 ? 0.25 : 0
  const calm =
    e.accessibility.quiet === 'confirmed' || e.accessibility.sensoryFriendly === 'confirmed'
      ? 1
      : e.accessibility.quiet === 'unavailable' && e.accessibility.sensoryFriendly === 'unavailable'
        ? 0
        : 0.4
  const parts = [size, e.beginnerFriendly ? 1 : 0, e.firstTime?.howToFindUs ? 1 : 0, calm, e.description.length >= 120 ? 1 : 0.5]
  return parts.reduce((s, x) => s + x, 0) / parts.length
}

export function scoreEvent(db: Database, e: CalgaryEvent, user: User, now: Date, opts: RecOptions = {}): Recommendation {
  const t = opts.traveller
  const interests = t?.interests.length ? t.interests : user.interests
  const cat = e.categoryId

  // Interest (35%)
  const direct = interests.includes(cat)
  const relatedTo = direct ? undefined : interests.find((i) => RELATED[i]?.includes(cat))
  const newcomer = user.residency !== 'resident' || !!t
  const interest = !interests.length ? 0.5 : direct ? 1 : relatedTo ? 0.4 : cat === 'meetups' && newcomer ? 0.6 : 0

  // Date & availability (20%)
  const start = new Date(e.startsAt)
  const days = (start.getTime() - now.getTime()) / DAY
  let date = t ? 1 : days <= 2 ? 1 : days <= 7 ? 0.85 : days <= 14 ? 0.6 : days <= 30 ? 0.35 : 0.15
  const slotOk = !user.availability.length || user.availability.includes(timeSlot(start))
  if (!t && !slotOk) date *= 0.5
  if (spotsLeft(db, e) <= 2) date *= 0.9

  // Location (15%)
  let location = 0.6
  let nearLabel: string | null = null
  if (t) {
    if (t.quadrants.length) location = t.quadrants.includes(e.venue.quadrant) ? 1 : 0.4
    else {
      const km = haversineKm(CITY_CENTRE, e.venue)
      location = km <= 3 ? 1 : km <= 8 ? 0.75 : 0.45
    }
    if (location >= 0.75) nearLabel = t.quadrants.length ? `in ${e.venue.quadrant} Calgary` : 'close to downtown'
  } else {
    const hood = neighbourhood(user.neighbourhood)
    if (hood) {
      const km = haversineKm(hood, e.venue)
      location = km <= 3 ? 1 : km <= 7 ? 0.8 : km <= 12 ? 0.6 : km <= 20 ? 0.4 : 0.25
      if (km <= 7) nearLabel = `near you in ${e.venue.quadrant} Calgary`
    } else if (user.quadrant) {
      location = quadrantAffinity(user.quadrant, e.venue.quadrant)
      if (location === 1) nearLabel = `in ${e.venue.quadrant} Calgary, near you`
    }
  }
  if (e.accessibility.virtual === 'confirmed') location = Math.max(location, 0.8)

  // Accessibility & comfort (15%)
  const wanted = [...new Set([...user.comfort.features, ...user.comfort.essential])]
  const accItems: number[] = wanted.map((f) => (e.accessibility[f] === 'confirmed' ? 1 : e.accessibility[f] === 'unconfirmed' ? 0.3 : 0))
  if (user.comfort.smallGroups) accItems.push(e.capacity <= 12 ? 1 : e.capacity <= 25 ? 0.5 : 0)
  const accessibility = accItems.length ? accItems.reduce((s, x) => s + x, 0) / accItems.length : 1

  // Budget (10%)
  const max = t ? t.budget : user.budget.max
  let budget: number
  if (user.comfort.prefersFree) budget = e.price === 0 ? 1 : max !== null && e.price <= max ? 0.45 : 0.15
  else if (max !== null) budget = e.price <= max ? 1 - 0.4 * (e.price / Math.max(max, 1)) : 0
  else budget = e.price === 0 ? 1 : e.price <= 20 ? 0.85 : e.price <= 50 ? 0.6 : 0.4

  // Beginner-friendly (5%)
  const wantsBeginner = t ? t.beginner : user.comfort.beginnerFriendly
  const beginner = wantsBeginner ? (e.beginnerFriendly ? 1 : 0) : 1

  const factors: Recommendation['factors'] = [
    { id: 'interest', weight: REC_WEIGHTS.interest, value: interest },
    { id: 'date', weight: REC_WEIGHTS.date, value: date },
    { id: 'location', weight: REC_WEIGHTS.location, value: location },
    { id: 'accessibility', weight: REC_WEIGHTS.accessibility, value: accessibility },
    { id: 'budget', weight: REC_WEIGHTS.budget, value: budget },
    { id: 'beginner', weight: REC_WEIGHTS.beginner, value: beginner },
  ]
  const base = factors.reduce((s, f) => s + f.weight * f.value, 0)
  const useEase = opts.easeIntoIt ?? user.comfort.easeIntoIt
  const ease = useEase ? easeScore(e) : null
  const score = ease === null ? base : 0.6 * base + 0.4 * ease

  /* ---------------- explanation ---------------- */
  const reasons: string[] = []
  const prefs: string[] = []
  if (user.comfort.prefersFree && e.price === 0) prefs.push('free')
  if (wantsBeginner && e.beginnerFriendly) prefs.push('beginner-friendly')
  if (user.comfort.smallGroups && e.capacity <= 12) prefs.push('small-group')
  for (const f of wanted) if (e.accessibility[f] === 'confirmed') prefs.push(FEATURE_ADJ[f])

  let you = ''
  if (direct) {
    you = `you enjoy ${CATEGORIES[cat].phrase}`
    reasons.push(CATEGORIES[cat].label)
  } else if (relatedTo) {
    you = `it's close to your interest in ${CATEGORIES[relatedTo].phrase}`
    reasons.push(`Related to ${CATEGORIES[relatedTo].label}`)
  }
  // Coordinate adjectives read naturally with commas: "prefer free, beginner-friendly activities".
  const prefText = prefs.length ? `prefer ${prefs.slice(0, 3).join(', ')} activities` : ''
  const clauses: string[] = []
  if (you.startsWith('you') && prefText) clauses.push(`${you} and ${prefText}`)
  else {
    if (you) clauses.push(you)
    if (prefText) clauses.push(`you ${prefText}`)
  }
  if (ease !== null && ease >= 0.7) {
    clauses.push("it's a small, welcoming group with clear arrival details")
    reasons.push('Ease Into It match')
  } else if (t) clauses.push("it's during your visit")
  else if (nearLabel && !prefText) clauses.push(`it's ${nearLabel}`)
  if (!clauses.length) {
    if (max !== null && e.price > 0 && e.price <= max) clauses.push(`it fits your ${formatPrice(max)} budget`)
    else clauses.push(`it's coming up ${days <= 2 ? 'soon' : 'this month'} with spaces available`)
  }

  if (e.price === 0) reasons.push('Free')
  if (e.beginnerFriendly) reasons.push('Beginner-friendly')
  if (nearLabel) reasons.push(`Near you (${e.venue.quadrant})`)
  if (e.capacity <= 12) reasons.push('Small group')
  for (const f of wanted) if (e.accessibility[f] === 'confirmed') reasons.push(`${accessFeature(f).short} ✓`)

  return {
    event: e,
    score,
    factors,
    ease,
    reasons: [...new Set(reasons)].slice(0, 4),
    explanation: `Recommended because ${clauses.slice(0, 2).join(clauses[0]?.includes(' and ') ? ', and ' : ' and ')}.`,
  }
}

export function recommendEvents(db: Database, user: User, now: Date, opts: RecOptions & { limit?: number } = {}): Recommendation[] {
  const recs = db.events
    .filter((e) => hardConstraint(db, e, user, now, opts) === null)
    .map((e) => scoreEvent(db, e, user, now, opts))
    .sort((a, b) => b.score - a.score || a.event.startsAt.localeCompare(b.event.startsAt) || registeredCount(db, b.event) - registeredCount(db, a.event))
  return opts.limit ? recs.slice(0, opts.limit) : recs
}

/** Scores for sorting a filtered list: events failing hard constraints sink to the bottom (score 0). */
export function recommendationScores(db: Database, user: User, events: CalgaryEvent[], now: Date, opts: RecOptions = {}): Map<string, Recommendation | null> {
  const map = new Map<string, Recommendation | null>()
  for (const e of events) map.set(e.id, hardConstraint(db, e, user, now, opts) ? null : scoreEvent(db, e, user, now, opts))
  return map
}
