/**
 * Event filtering + sorting shared by the discovery list AND the Calgary map (spec §9: "use shared
 * filtering logic rather than separate implementations"). Filters round-trip through the URL query
 * string, so switching between list and map keeps the exact same result set.
 */
import { ACCESS_FEATURE_IDS, accessFeature } from '../data/accessibility'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { QUADRANTS, referencePoint } from '../data/calgary'
import { addDays, endOfDay, parseDateInput, startOfDay, weekendRange, formatDateRange } from '../lib/dates'
import { formatPrice } from '../lib/format'
import { haversineKm, type LatLng } from '../lib/geo'
import type { AccessFeature, CalgaryEvent, CategoryId, Database, Quadrant, User } from '../types'
import { eventPhase, getGroup, getUser, registeredCount, spotsLeft, verificationStatus } from './db'
import { sizeBucket, type SizeBucket } from './events'
import { ratingSummary } from './reviews'

export type DatePreset = 'any' | 'today' | 'tomorrow' | 'weekend' | 'week' | 'custom'
export type SortKey = 'recommended' | 'soonest' | 'price' | 'rating' | 'closest' | 'popular' | 'newest'
export type AccessFilter = AccessFeature | 'beginner'
export type SettingFilter = 'any' | 'indoor' | 'outdoor'

/** Price slider upper bound; the max position means "no limit" ($150+). */
export const PRICE_MAX = 150

export interface EventFilters {
  q: string
  categories: CategoryId[]
  quadrants: Quadrant[]
  maxPrice: number
  freeOnly: boolean
  date: DatePreset
  from: string
  to: string
  sizes: SizeBucket[]
  access: AccessFilter[]
  availableOnly: boolean
  verifiedHost: boolean
  travellerFriendly: boolean
  setting: SettingFilter
  sort: SortKey
}

export const DEFAULT_FILTERS: EventFilters = {
  q: '',
  categories: [],
  quadrants: [],
  maxPrice: PRICE_MAX,
  freeOnly: false,
  date: 'any',
  from: '',
  to: '',
  sizes: [],
  access: [],
  availableOnly: false,
  verifiedHost: false,
  travellerFriendly: false,
  setting: 'any',
  sort: 'recommended',
}

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  any: 'Any time',
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'This weekend',
  week: 'Next 7 days',
  custom: 'Custom dates',
}

export const SORT_LABEL: Record<SortKey, string> = {
  recommended: 'Recommended',
  soonest: 'Soonest',
  price: 'Lowest price',
  rating: 'Highest event rating',
  closest: 'Closest to selected area',
  popular: 'Most popular',
  newest: 'Newest',
}

export const SIZES: SizeBucket[] = ['small', 'medium', 'large']
export const ACCESS_FILTERS: AccessFilter[] = [...ACCESS_FEATURE_IDS, 'beginner']

export function accessFilterLabel(f: AccessFilter): string {
  return f === 'beginner' ? 'Beginner-friendly' : accessFeature(f).label
}

/* ------------------------------------------------------------------ URL round-trip */

const DATE_PRESETS: DatePreset[] = ['any', 'today', 'tomorrow', 'weekend', 'week', 'custom']
const SORTS = Object.keys(SORT_LABEL) as SortKey[]

function list<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const set = new Set(allowed)
  return [...new Set(raw.split(',').map((s) => s.trim()))].filter((s): s is T => set.has(s as T))
}

export function filtersFromParams(params: URLSearchParams): EventFilters {
  const max = Number(params.get('max'))
  const date = params.get('date') as DatePreset
  const sort = params.get('sort') as SortKey
  const setting = params.get('setting')
  return {
    q: (params.get('q') ?? '').slice(0, 120),
    categories: list(params.get('cat'), CATEGORY_IDS),
    quadrants: list(params.get('quad'), QUADRANTS),
    maxPrice: Number.isFinite(max) && params.has('max') ? Math.min(PRICE_MAX, Math.max(0, Math.round(max))) : PRICE_MAX,
    freeOnly: params.get('free') === '1',
    date: DATE_PRESETS.includes(date) ? date : 'any',
    from: parseDateInput(params.get('from')) ? params.get('from')! : '',
    to: parseDateInput(params.get('to')) ? params.get('to')! : '',
    sizes: list(params.get('size'), SIZES),
    access: list(params.get('access'), ACCESS_FILTERS),
    availableOnly: params.get('open') === '1',
    verifiedHost: params.get('verified') === '1',
    travellerFriendly: params.get('travel') === '1',
    setting: setting === 'indoor' || setting === 'outdoor' ? setting : 'any',
    sort: SORTS.includes(sort) ? sort : 'recommended',
  }
}

export function filtersToParams(f: EventFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.categories.length) p.set('cat', f.categories.join(','))
  if (f.quadrants.length) p.set('quad', f.quadrants.join(','))
  if (f.maxPrice < PRICE_MAX) p.set('max', String(f.maxPrice))
  if (f.freeOnly) p.set('free', '1')
  if (f.date !== 'any') p.set('date', f.date)
  if (f.date === 'custom' && f.from) p.set('from', f.from)
  if (f.date === 'custom' && f.to) p.set('to', f.to)
  if (f.sizes.length) p.set('size', f.sizes.join(','))
  if (f.access.length) p.set('access', f.access.join(','))
  if (f.availableOnly) p.set('open', '1')
  if (f.verifiedHost) p.set('verified', '1')
  if (f.travellerFriendly) p.set('travel', '1')
  if (f.setting !== 'any') p.set('setting', f.setting)
  if (f.sort !== 'recommended') p.set('sort', f.sort)
  return p
}

/** Number of active filters (search text and sort order don't count). */
export function activeFilterCount(f: EventFilters): number {
  return (
    f.categories.length +
    f.quadrants.length +
    (f.maxPrice < PRICE_MAX ? 1 : 0) +
    (f.freeOnly ? 1 : 0) +
    (f.date !== 'any' ? 1 : 0) +
    f.sizes.length +
    f.access.length +
    (f.availableOnly ? 1 : 0) +
    (f.verifiedHost ? 1 : 0) +
    (f.travellerFriendly ? 1 : 0) +
    (f.setting !== 'any' ? 1 : 0)
  )
}

export interface FilterChip {
  key: string
  label: string
  remove: (f: EventFilters) => EventFilters
}

/** Human-readable chips for the active filters (each knows how to remove itself). */
export function activeFilterChips(f: EventFilters): FilterChip[] {
  const chips: FilterChip[] = []
  if (f.q.trim()) chips.push({ key: 'q', label: `“${f.q.trim()}”`, remove: (x) => ({ ...x, q: '' }) })
  f.categories.forEach((c) =>
    chips.push({ key: `cat-${c}`, label: CATEGORIES[c].label, remove: (x) => ({ ...x, categories: x.categories.filter((y) => y !== c) }) }),
  )
  f.quadrants.forEach((q) =>
    chips.push({ key: `quad-${q}`, label: `${q} Calgary`, remove: (x) => ({ ...x, quadrants: x.quadrants.filter((y) => y !== q) }) }),
  )
  if (f.freeOnly) chips.push({ key: 'free', label: 'Free only', remove: (x) => ({ ...x, freeOnly: false }) })
  else if (f.maxPrice < PRICE_MAX)
    chips.push({ key: 'max', label: `Up to ${formatPrice(f.maxPrice)}`, remove: (x) => ({ ...x, maxPrice: PRICE_MAX }) })
  if (f.date !== 'any')
    chips.push({
      key: 'date',
      label: f.date === 'custom' ? formatDateRange(f.from || null, f.to || null) : DATE_PRESET_LABEL[f.date],
      remove: (x) => ({ ...x, date: 'any', from: '', to: '' }),
    })
  f.sizes.forEach((s) =>
    chips.push({ key: `size-${s}`, label: `${s[0].toUpperCase()}${s.slice(1)} groups`, remove: (x) => ({ ...x, sizes: x.sizes.filter((y) => y !== s) }) }),
  )
  f.access.forEach((a) =>
    chips.push({ key: `access-${a}`, label: accessFilterLabel(a), remove: (x) => ({ ...x, access: x.access.filter((y) => y !== a) }) }),
  )
  if (f.availableOnly) chips.push({ key: 'open', label: 'Spaces available', remove: (x) => ({ ...x, availableOnly: false }) })
  if (f.verifiedHost) chips.push({ key: 'verified', label: 'Demo-verified host', remove: (x) => ({ ...x, verifiedHost: false }) })
  if (f.travellerFriendly) chips.push({ key: 'travel', label: 'Traveller-friendly', remove: (x) => ({ ...x, travellerFriendly: false }) })
  if (f.setting !== 'any')
    chips.push({ key: 'setting', label: f.setting === 'indoor' ? 'Indoor' : 'Outdoor', remove: (x) => ({ ...x, setting: 'any' }) })
  return chips
}

/* ------------------------------------------------------------------ matching */

/** Public, scheduled events that haven't ended — what discovery and the map can show. */
export function discoverableEvents(db: Database, now: Date): CalgaryEvent[] {
  return db.events.filter((e) => e.visibility === 'public' && e.status === 'scheduled' && eventPhase(e, now) !== 'ended')
}

export function dateWindow(f: EventFilters, now: Date): { start: Date; end: Date } | null {
  switch (f.date) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'tomorrow': {
      const t = addDays(now, 1)
      return { start: startOfDay(t), end: endOfDay(t) }
    }
    case 'weekend':
      return weekendRange(now)
    case 'week':
      return { start: startOfDay(now), end: endOfDay(addDays(now, 7)) }
    case 'custom': {
      const from = parseDateInput(f.from)
      const to = parseDateInput(f.to)
      if (!from && !to) return null
      return { start: from ? startOfDay(from) : startOfDay(now), end: to ? endOfDay(to) : endOfDay(addDays(now, 365)) }
    }
    default:
      return null
  }
}

export function searchText(db: Database, e: CalgaryEvent): string {
  const host = getUser(db, e.hostId)
  const group = getGroup(db, e.groupId)
  return [e.title, e.description, e.venue.name, e.venue.area, e.venue.quadrant, CATEGORIES[e.categoryId].label, host?.firstName, group?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function matchesFilters(db: Database, e: CalgaryEvent, f: EventFilters, now: Date): boolean {
  if (f.q.trim()) {
    const hay = searchText(db, e)
    const tokens = f.q.toLowerCase().split(/[^a-z0-9'’$]+/i).filter((t) => t.length > 1)
    if (!tokens.every((t) => hay.includes(t))) return false
  }
  if (f.categories.length && !f.categories.includes(e.categoryId)) return false
  if (f.quadrants.length && !f.quadrants.includes(e.venue.quadrant)) return false
  if (f.freeOnly && e.price > 0) return false
  if (!f.freeOnly && f.maxPrice < PRICE_MAX && e.price > f.maxPrice) return false
  const window = dateWindow(f, now)
  if (window) {
    const start = new Date(e.startsAt)
    const end = new Date(e.endsAt)
    // Overlap with the window (so "Today" includes something happening right now).
    if (start > window.end || end < window.start) return false
  }
  if (f.sizes.length && !f.sizes.includes(sizeBucket(e.capacity))) return false
  for (const a of f.access) {
    if (a === 'beginner' ? !e.beginnerFriendly : e.accessibility[a] !== 'confirmed') return false
  }
  if (f.availableOnly && spotsLeft(db, e) <= 0) return false
  if (f.verifiedHost && verificationStatus(getUser(db, e.hostId), now) !== 'demo_verified') return false
  if (f.travellerFriendly && !e.travellerFriendly) return false
  if (f.setting === 'indoor' && e.setting === 'outdoor') return false
  if (f.setting === 'outdoor' && e.setting === 'indoor') return false
  return true
}

export function filterEvents(db: Database, f: EventFilters, now: Date): CalgaryEvent[] {
  return discoverableEvents(db, now).filter((e) => matchesFilters(db, e, f, now))
}

/* ------------------------------------------------------------------ sorting */

export interface SortContext {
  now: Date
  user?: User
  /** Recommendation scores by event id (0–1), used by the "recommended" sort. */
  scores?: Map<string, number>
}

export function sortReference(f: EventFilters, user?: User): { point: LatLng; label: string } {
  return referencePoint({ quadrants: f.quadrants, neighbourhood: user?.neighbourhood, quadrant: user?.quadrant })
}

export function sortEvents(db: Database, events: CalgaryEvent[], f: EventFilters, ctx: SortContext): CalgaryEvent[] {
  const soonest = (a: CalgaryEvent, b: CalgaryEvent) => a.startsAt.localeCompare(b.startsAt)
  const list = [...events]
  switch (f.sort) {
    case 'soonest':
      return list.sort(soonest)
    case 'price':
      return list.sort((a, b) => a.price - b.price || soonest(a, b))
    case 'rating': {
      const r = new Map(list.map((e) => [e.id, ratingSummary(db, e)]))
      return list.sort((a, b) => {
        const ra = r.get(a.id)!
        const rb = r.get(b.id)!
        if (ra.sufficient !== rb.sufficient) return ra.sufficient ? -1 : 1
        return (rb.average ?? 0) - (ra.average ?? 0) || rb.count - ra.count || soonest(a, b)
      })
    }
    case 'closest': {
      const { point } = sortReference(f, ctx.user)
      const d = new Map(list.map((e) => [e.id, haversineKm(point, e.venue)]))
      return list.sort((a, b) => d.get(a.id)! - d.get(b.id)! || soonest(a, b))
    }
    case 'popular':
      return list.sort((a, b) => registeredCount(db, b) - registeredCount(db, a) || soonest(a, b))
    case 'newest':
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'recommended':
    default: {
      if (ctx.scores && ctx.scores.size) {
        return list.sort((a, b) => (ctx.scores!.get(b.id) ?? 0) - (ctx.scores!.get(a.id) ?? 0) || soonest(a, b))
      }
      // Signed out: a gentle blend of soon + has space + well reviewed.
      const blend = (e: CalgaryEvent) => {
        const days = (new Date(e.startsAt).getTime() - ctx.now.getTime()) / 86_400_000
        const soon = Math.max(0, 1 - days / 14)
        const open = spotsLeft(db, e) > 0 ? 1 : 0
        const rating = ratingSummary(db, e)
        return 0.5 * soon + 0.3 * open + 0.2 * (rating.sufficient ? (rating.average ?? 0) / 5 : 0.6)
      }
      return list.sort((a, b) => blend(b) - blend(a) || soonest(a, b))
    }
  }
}
