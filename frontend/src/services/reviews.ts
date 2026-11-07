/**
 * Event reviews. Only confirmed attendees can review, once per event, and only events — never people.
 * Ratings aggregate across a recurring series so upcoming sessions show feedback from past ones.
 */
import { uid } from '../lib/ids'
import type { CalgaryEvent, Database, EventReview, RatingSummary } from '../types'
import { AppError, eventPhase, getRegistration, requireEvent } from './db'

/** Fewer reviews than this → show "New" instead of a rating. */
export const MIN_REVIEWS_FOR_RATING = 3

export function seriesKey(event: CalgaryEvent): string {
  return event.seriesId ?? event.id
}

export function eventsInSeries(db: Database, key: string): CalgaryEvent[] {
  return db.events.filter((e) => seriesKey(e) === key)
}

export function reviewsForSeries(db: Database, key: string): EventReview[] {
  const ids = new Set(eventsInSeries(db, key).map((e) => e.id))
  return db.reviews.filter((r) => ids.has(r.eventId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

export function summarize(reviews: EventReview[]): RatingSummary {
  const ret = reviews.filter((r) => r.wouldReturn !== null)
  return {
    count: reviews.length,
    average: avg(reviews.map((r) => r.overall)),
    organization: avg(reviews.map((r) => r.organization)),
    accuracy: avg(reviews.map((r) => r.accuracy)),
    accessibilityAccuracy: avg(reviews.filter((r) => r.accessibilityAccuracy !== null).map((r) => r.accessibilityAccuracy!)),
    wouldReturnRate: ret.length ? ret.filter((r) => r.wouldReturn).length / ret.length : null,
    sufficient: reviews.length >= MIN_REVIEWS_FOR_RATING,
  }
}

export function ratingSummary(db: Database, event: CalgaryEvent): RatingSummary {
  return summarize(reviewsForSeries(db, seriesKey(event)))
}

/** City-wide mean rating — the prior for Bayesian adjustment. */
export function globalMeanRating(db: Database): number {
  return avg(db.reviews.map((r) => r.overall)) ?? 4
}

export type ReviewEligibility = { ok: true } | { ok: false; reason: string; needsCheckIn?: boolean }

export function canReview(db: Database, eventId: string, userId: string | null | undefined, now: Date): ReviewEligibility {
  if (!userId) return { ok: false, reason: 'Sign in to review events you attended.' }
  const event = db.events.find((e) => e.id === eventId)
  if (!event) return { ok: false, reason: 'Event not found.' }
  if (event.hostId === userId) return { ok: false, reason: 'Hosts can’t review their own events.' }
  if (event.status === 'cancelled') return { ok: false, reason: 'Cancelled events can’t be reviewed.' }
  if (eventPhase(event, now) !== 'ended') return { ok: false, reason: 'Reviews open once the event has finished.' }
  const reg = getRegistration(db, eventId, userId)
  if (!reg || reg.status !== 'going') return { ok: false, reason: 'Only attendees can review this event.' }
  if (!reg.checkedInAt) return { ok: false, reason: 'Confirm your attendance first to leave a review.', needsCheckIn: true }
  if (db.reviews.some((r) => r.eventId === eventId && r.userId === userId)) return { ok: false, reason: 'You’ve already reviewed this event. Thank you!' }
  return { ok: true }
}

export interface ReviewInput {
  overall: number
  organization: number
  accuracy: number
  accessibilityAccuracy: number | null
  wouldReturn: boolean | null
  comment: string
}

const validStar = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5

export function submitReview(db: Database, eventId: string, userId: string, input: ReviewInput, now: Date): Database {
  requireEvent(db, eventId)
  const eligibility = canReview(db, eventId, userId, now)
  if (!eligibility.ok) throw new AppError(eligibility.reason)
  if (![input.overall, input.organization, input.accuracy].every(validStar)) throw new AppError('Choose 1–5 stars for each rating.')
  if (input.accessibilityAccuracy !== null && !validStar(input.accessibilityAccuracy)) throw new AppError('Choose 1–5 stars or "Not applicable".')
  if (input.comment.length > 1000) throw new AppError('Keep written feedback under 1,000 characters.')
  const review: EventReview = { id: uid('rev'), eventId, userId, ...input, comment: input.comment.trim(), createdAt: now.toISOString(), isDemo: false }
  return { ...db, reviews: [...db.reviews, review] }
}
