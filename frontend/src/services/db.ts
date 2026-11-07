/** Read-only query helpers over the Database. Pure functions — no storage, no React. */
import { HOUR } from '../lib/dates'
import type { CalgaryEvent, CommunityGroup, Database, EventRegistration, User, VerificationStatus } from '../types'

/** Domain errors carry a user-facing message. */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function getUser(db: Database, id: string | null | undefined): User | undefined {
  return id ? db.users.find((u) => u.id === id) : undefined
}

export function getEvent(db: Database, id: string | null | undefined): CalgaryEvent | undefined {
  return id ? db.events.find((e) => e.id === id) : undefined
}

export function getGroup(db: Database, id: string | null | undefined): CommunityGroup | undefined {
  return id ? db.groups.find((g) => g.id === id) : undefined
}

export function requireEvent(db: Database, id: string): CalgaryEvent {
  const e = getEvent(db, id)
  if (!e) throw new AppError('That event no longer exists.')
  return e
}

export function requireUser(db: Database, id: string): User {
  const u = getUser(db, id)
  if (!u) throw new AppError('Please sign in first.')
  return u
}

/* ------------------------------------------------------------------ registrations */

export function getRegistration(db: Database, eventId: string, userId: string | null | undefined): EventRegistration | undefined {
  if (!userId) return undefined
  return db.registrations.find((r) => r.eventId === eventId && r.userId === userId)
}

export function goingRegistrations(db: Database, eventId: string): EventRegistration[] {
  return db.registrations.filter((r) => r.eventId === eventId && r.status === 'going')
}

export function isGoing(db: Database, eventId: string, userId: string | null | undefined): boolean {
  return getRegistration(db, eventId, userId)?.status === 'going'
}

/** Registered participants (seeded anonymous demo participants + real registrations). Host not included. */
export function registeredCount(db: Database, event: CalgaryEvent): number {
  return db.eventCounts?.[event.id]?.going ?? event.baseAttendeeCount + goingRegistrations(db, event.id).length
}

export function spotsLeft(db: Database, event: CalgaryEvent): number {
  return Math.max(0, event.capacity - registeredCount(db, event))
}

/** Attendance for completed events: seeded anonymous attendees + checked-in registrations. */
export function attendedCount(db: Database, event: CalgaryEvent): number {
  return db.eventCounts?.[event.id]?.attended ?? event.baseAttendeeCount + db.registrations.filter((r) => r.eventId === event.id && r.status === 'going' && r.checkedInAt).length
}

/* ------------------------------------------------------------------ event lifecycle */

export type EventPhase = 'upcoming' | 'live' | 'ended' | 'cancelled'

export function eventPhase(event: CalgaryEvent, now: Date): EventPhase {
  if (event.status === 'cancelled') return 'cancelled'
  const t = now.getTime()
  if (t < new Date(event.startsAt).getTime()) return 'upcoming'
  if (t <= new Date(event.endsAt).getTime()) return 'live'
  return 'ended'
}

export function isCompleted(event: CalgaryEvent, now: Date): boolean {
  return eventPhase(event, now) === 'ended'
}

/** Attendance can be confirmed from 1h before start until 14 days after the end. */
export const CHECK_IN_OPENS_BEFORE_START = HOUR
export const CHECK_IN_CLOSES_AFTER_END = 14 * 24 * HOUR

export function canCheckIn(db: Database, event: CalgaryEvent, userId: string | null | undefined, now: Date): boolean {
  const reg = getRegistration(db, event.id, userId)
  if (!reg || reg.status !== 'going' || reg.checkedInAt || event.status === 'cancelled') return false
  const t = now.getTime()
  return (
    t >= new Date(event.startsAt).getTime() - CHECK_IN_OPENS_BEFORE_START &&
    t <= new Date(event.endsAt).getTime() + CHECK_IN_CLOSES_AFTER_END
  )
}

export type JoinState =
  | { kind: 'joinable' }
  | { kind: 'going' }
  | { kind: 'host' }
  | { kind: 'full' }
  | { kind: 'started' }
  | { kind: 'ended' }
  | { kind: 'cancelled' }

export function joinState(db: Database, event: CalgaryEvent, userId: string | null | undefined, now: Date): JoinState {
  if (event.status === 'cancelled') return { kind: 'cancelled' }
  if (userId && event.hostId === userId) return { kind: 'host' }
  if (isGoing(db, event.id, userId)) return { kind: 'going' }
  const phase = eventPhase(event, now)
  if (phase === 'ended') return { kind: 'ended' }
  if (phase === 'live') return { kind: 'started' }
  if (spotsLeft(db, event) <= 0) return { kind: 'full' }
  return { kind: 'joinable' }
}

/* ------------------------------------------------------------------ users */

/** Simulated verification: a pending request becomes "demo verified" after a short delay. */
export const DEMO_VERIFICATION_DELAY_MS = 4000

export function verificationStatus(user: User | undefined, now: Date): VerificationStatus {
  if (!user) return 'unverified'
  const v = user.verification
  if (v.status === 'pending' && v.requestedAt && now.getTime() - new Date(v.requestedAt).getTime() >= DEMO_VERIFICATION_DELAY_MS) {
    return 'demo_verified'
  }
  return v.status
}

export function eventsHostedBy(db: Database, userId: string): CalgaryEvent[] {
  return db.events.filter((e) => e.hostId === userId)
}

/** Seed dates are relative to the seeding day; offer a refresh when the demo world is from an earlier day. */
export function isSeedStale(db: Database, now: Date): boolean {
  const seeded = new Date(db.seededAt)
  return (
    seeded.getFullYear() !== now.getFullYear() || seeded.getMonth() !== now.getMonth() || seeded.getDate() !== now.getDate()
  )
}

/** Upcoming (or live) events the user is registered for, soonest first — used by the dashboard. */
export function userUpcomingEvents(db: Database, userId: string, now: Date): CalgaryEvent[] {
  const ids = new Set(db.registrations.filter((r) => r.userId === userId && r.status === 'going').map((r) => r.eventId))
  return db.events
    .filter((e) => ids.has(e.id) && e.status === 'scheduled' && eventPhase(e, now) !== 'ended')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** Past events the user registered for (attended or awaiting attendance confirmation), newest first. */
export function userPastEvents(db: Database, userId: string, now: Date): CalgaryEvent[] {
  const ids = new Set(db.registrations.filter((r) => r.userId === userId && r.status === 'going').map((r) => r.eventId))
  return db.events
    .filter((e) => ids.has(e.id) && e.status === 'scheduled' && eventPhase(e, now) === 'ended')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}
