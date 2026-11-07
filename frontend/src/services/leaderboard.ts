/**
 * Calgary Event Leaderboard — ranks EVENTS (recurring series or one-off events), never people.
 *
 * Fair ranking (transparent formula shown in the UI):
 *   bayesian   = (C·m + Σratings) / (C + n)        m = city-wide mean rating, C = 5 "virtual" reviews
 *   fill       = mean over completed sessions of min(attended / capacity, 1)
 *   completion = completed sessions / (completed + cancelled)
 *   confidence = n / (n + C)
 *   score      = 100 × (0.55·(bayesian−1)/4 + 0.20·fill + 0.15·completion + 0.10·confidence)
 * Entries with fewer than MIN_REVIEWS_FOR_RATING reviews are listed as "New" and not ranked.
 */
import type { AccessFeature, CalgaryEvent, CategoryId, Database, Quadrant } from '../types'
import { addDays } from '../lib/dates'
import { attendedCount, eventPhase } from './db'
import { globalMeanRating, MIN_REVIEWS_FOR_RATING, seriesKey, summarize } from './reviews'

export const BAYES_C = 5
export const WEIGHTS = { rating: 0.55, fill: 0.2, completion: 0.15, confidence: 0.1 }

export interface LeaderboardFilters {
  categories: CategoryId[]
  quadrants: Quadrant[]
  range: '30d' | '90d' | 'all'
  price: 'any' | 'free' | 'paid'
  access: AccessFeature[]
}

export const DEFAULT_LEADERBOARD_FILTERS: LeaderboardFilters = { categories: [], quadrants: [], range: 'all', price: 'any', access: [] }

export interface LeaderboardEntry {
  key: string
  title: string
  latest: CalgaryEvent
  next: CalgaryEvent | undefined
  categoryId: CategoryId
  quadrant: Quadrant
  completedSessions: number
  cancelledSessions: number
  reviewCount: number
  average: number | null
  bayesian: number
  fill: number
  completion: number
  confidence: number
  wouldReturnRate: number | null
  attendance: number
  score: number
  rank: number | null
}

export function buildLeaderboard(db: Database, filters: LeaderboardFilters, now: Date) {
  const m = globalMeanRating(db)
  const since = filters.range === 'all' ? null : addDays(now, filters.range === '30d' ? -30 : -90)

  const bySeries = new Map<string, CalgaryEvent[]>()
  for (const e of db.events) {
    if (e.visibility !== 'public') continue
    const k = seriesKey(e)
    bySeries.set(k, [...(bySeries.get(k) ?? []), e])
  }

  const entries: LeaderboardEntry[] = []
  for (const [key, events] of bySeries) {
    const inRange = (e: CalgaryEvent) => !since || new Date(e.startsAt) >= since
    const completed = events.filter((e) => eventPhase(e, now) === 'ended' && inRange(e))
    const cancelled = events.filter((e) => e.status === 'cancelled' && new Date(e.startsAt) < now && inRange(e))
    if (completed.length === 0) continue

    const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const latest = sorted[sorted.length - 1]
    const next = sorted.find((e) => e.status === 'scheduled' && eventPhase(e, now) === 'upcoming')

    // Filters describe the activity (its latest session).
    if (filters.categories.length && !filters.categories.includes(latest.categoryId)) continue
    if (filters.quadrants.length && !filters.quadrants.includes(latest.venue.quadrant)) continue
    if (filters.price === 'free' && latest.price > 0) continue
    if (filters.price === 'paid' && latest.price === 0) continue
    if (filters.access.some((f) => latest.accessibility[f] !== 'confirmed')) continue

    const completedIds = new Set(completed.map((e) => e.id))
    const reviews = db.reviews.filter((r) => completedIds.has(r.eventId))
    const summary = summarize(reviews)
    const n = reviews.length
    const sum = reviews.reduce((s, r) => s + r.overall, 0)
    const bayesian = (BAYES_C * m + sum) / (BAYES_C + n)
    const fill = completed.reduce((s, e) => s + Math.min(attendedCount(db, e) / e.capacity, 1), 0) / completed.length
    const completion = completed.length / (completed.length + cancelled.length)
    const confidence = n / (n + BAYES_C)
    const score =
      100 * (WEIGHTS.rating * ((bayesian - 1) / 4) + WEIGHTS.fill * fill + WEIGHTS.completion * completion + WEIGHTS.confidence * confidence)

    entries.push({
      key,
      title: latest.title,
      latest,
      next,
      categoryId: latest.categoryId,
      quadrant: latest.venue.quadrant,
      completedSessions: completed.length,
      cancelledSessions: cancelled.length,
      reviewCount: n,
      average: summary.average,
      bayesian,
      fill,
      completion,
      confidence,
      wouldReturnRate: summary.wouldReturnRate,
      attendance: completed.reduce((s, e) => s + attendedCount(db, e), 0),
      score,
      rank: null,
    })
  }

  const ranked = entries
    .filter((e) => e.reviewCount >= MIN_REVIEWS_FOR_RATING)
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }))
  const fresh = entries
    .filter((e) => e.reviewCount < MIN_REVIEWS_FOR_RATING)
    .sort((a, b) => b.latest.startsAt.localeCompare(a.latest.startsAt))

  return { ranked, fresh, globalMean: m }
}
