/**
 * Calgary Weekend Planner — builds a day-by-day itinerary for a visitor from events that actually
 * exist in the dataset. Rule-based and transparent: highest-scoring events first, at most N per day,
 * no overlaps (45-minute buffer), no repeated category on the same day, and only events that pass
 * the recommendation hard constraints (dates, budget, capacity, essential accessibility).
 */
import { addDays, endOfDay, formatLongDay, parseDateInput, startOfDay, toDateInput, MINUTE } from '../lib/dates'
import type { CategoryId, Database, Quadrant, User } from '../types'
import { eventPhase, getRegistration, getEvent } from './db'
import { recommendEvents, scoreEvent, type Recommendation } from './recommendations'

export interface PlannerPrefs {
  arrival: string
  departure: string
  interests: CategoryId[]
  budgetPerEvent: number | null
  quadrants: Quadrant[]
  beginner: boolean
  travellerOnly: boolean
  perDay: number
  easeIntoIt: boolean
}

export interface ItineraryItem {
  rec: Recommendation
  alreadyGoing: boolean
}

export interface ItineraryDay {
  date: string
  label: string
  items: ItineraryItem[]
}

export interface Itinerary {
  days: ItineraryDay[]
  /** All events that matched (for "more options" lists). */
  matches: Recommendation[]
  totalCost: number
  error?: string
}

const BUFFER = 45 * MINUTE

export function planItinerary(db: Database, user: User, prefs: PlannerPrefs, now: Date): Itinerary {
  const arrival = parseDateInput(prefs.arrival)
  const departure = parseDateInput(prefs.departure)
  if (!arrival || !departure) return { days: [], matches: [], totalCost: 0, error: 'Add your arrival and departure dates.' }
  if (departure < arrival) return { days: [], matches: [], totalCost: 0, error: 'Departure must be on or after arrival.' }
  if (endOfDay(departure) < now) return { days: [], matches: [], totalCost: 0, error: 'Those dates are in the past.' }
  const spanDays = Math.round((startOfDay(departure).getTime() - startOfDay(arrival).getTime()) / 86_400_000) + 1
  if (spanDays > 14) return { days: [], matches: [], totalCost: 0, error: 'Plan up to 14 days at a time.' }

  const traveller = {
    start: new Date(Math.max(startOfDay(arrival).getTime(), now.getTime())),
    end: endOfDay(departure),
    interests: prefs.interests,
    budget: prefs.budgetPerEvent,
    quadrants: prefs.quadrants,
    beginner: prefs.beginner,
    travellerOnly: prefs.travellerOnly,
  }
  const opts = { traveller, easeIntoIt: prefs.easeIntoIt }
  // Respect stated interests: only events that match (directly, loosely, or traveller meetups) are planned.
  const interestOf = (r: Recommendation) => r.factors.find((f) => f.id === 'interest')?.value ?? 0
  const matches = recommendEvents(db, user, now, opts).filter((r) => !prefs.interests.length || interestOf(r) > 0)

  // Events the user already joined during the trip are fixed points in the plan.
  const joined: Recommendation[] = db.registrations
    .filter((r) => r.userId === user.id && r.status === 'going')
    .map((r) => getEvent(db, r.eventId))
    .filter((e): e is NonNullable<typeof e> => !!e && e.status === 'scheduled' && eventPhase(e, now) === 'upcoming')
    .filter((e) => new Date(e.startsAt) >= traveller.start && new Date(e.startsAt) <= traveller.end)
    .map((e) => scoreEvent(db, e, user, now, opts))

  const byDay = new Map<string, ItineraryItem[]>()
  const fits = (rec: Recommendation, items: ItineraryItem[]) => {
    const s = new Date(rec.event.startsAt).getTime()
    const e = new Date(rec.event.endsAt).getTime()
    return items.every((it) => {
      const s2 = new Date(it.rec.event.startsAt).getTime()
      const e2 = new Date(it.rec.event.endsAt).getTime()
      return e + BUFFER <= s2 || e2 + BUFFER <= s
    })
  }

  for (const rec of joined) {
    const key = toDateInput(new Date(rec.event.startsAt))
    byDay.set(key, [...(byDay.get(key) ?? []), { rec, alreadyGoing: true }])
  }
  for (const rec of matches) {
    if (rec.score < 0.45) continue
    const key = toDateInput(new Date(rec.event.startsAt))
    const items = byDay.get(key) ?? []
    if (items.length >= prefs.perDay) continue
    if (items.some((it) => it.rec.event.categoryId === rec.event.categoryId)) continue
    if (!fits(rec, items)) continue
    byDay.set(key, [...items, { rec, alreadyGoing: !!getRegistration(db, rec.event.id, user.id) }])
  }

  const days: ItineraryDay[] = []
  for (let i = 0; i < spanDays; i++) {
    const d = addDays(startOfDay(arrival), i)
    const key = toDateInput(d)
    const items = (byDay.get(key) ?? []).sort((a, b) => a.rec.event.startsAt.localeCompare(b.rec.event.startsAt))
    days.push({ date: key, label: formatLongDay(d), items })
  }
  const totalCost = days.flatMap((d) => d.items).reduce((s, it) => s + it.rec.event.price, 0)
  return { days, matches, totalCost }
}
