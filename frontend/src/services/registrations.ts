/** Joining, leaving, attendance confirmation and saved events. */
import { displayName } from '../lib/format'
import { uid } from '../lib/ids'
import type { ChatMessage, Database } from '../types'
import { AppError, canCheckIn, eventPhase, getRegistration, requireEvent, requireUser, spotsLeft } from './db'

function systemMessage(eventId: string, body: string, now: Date): ChatMessage {
  return { id: uid('msg'), eventId, userId: null, kind: 'system', body, createdAt: now.toISOString(), isDemo: false }
}

export function joinEvent(db: Database, eventId: string, userId: string, now: Date): Database {
  const user = requireUser(db, userId)
  const event = requireEvent(db, eventId)
  if (event.status === 'cancelled') throw new AppError('This event was cancelled.')
  if (event.hostId === userId) throw new AppError('You are hosting this event.')
  const phase = eventPhase(event, now)
  if (phase === 'ended') throw new AppError('This event has already happened.')
  if (phase === 'live') throw new AppError('This event has already started.')
  const existing = getRegistration(db, eventId, userId)
  if (existing?.status === 'going') throw new AppError("You're already going to this event.")
  if (spotsLeft(db, event) <= 0) throw new AppError('Sorry — this event is full.')

  const registrations = existing
    ? db.registrations.map((r) =>
        r.id === existing.id ? { ...r, status: 'going' as const, joinedAt: now.toISOString(), leftAt: undefined } : r,
      )
    : [
        ...db.registrations,
        { id: uid('reg'), eventId, userId, status: 'going' as const, joinedAt: now.toISOString(), isDemo: false },
      ]
  return {
    ...db,
    registrations,
    messages: [...db.messages, systemMessage(eventId, `${displayName(user)} joined the event. Say hi! 👋`, now)],
  }
}

export function leaveEvent(db: Database, eventId: string, userId: string, now: Date): Database {
  const user = requireUser(db, userId)
  const event = requireEvent(db, eventId)
  const reg = getRegistration(db, eventId, userId)
  if (!reg || reg.status !== 'going') throw new AppError("You're not registered for this event.")
  if (reg.checkedInAt) throw new AppError("You've already checked in to this event.")
  if (eventPhase(event, now) === 'ended') throw new AppError('This event has already happened.')
  return {
    ...db,
    registrations: db.registrations.map((r) => (r.id === reg.id ? { ...r, status: 'left' as const, leftAt: now.toISOString() } : r)),
    messages: [...db.messages, systemMessage(eventId, `${displayName(user)} left the event.`, now)],
  }
}

/**
 * Confirm attendance. Each registration can be checked in exactly once, which is what stops
 * Tandem Miles from being farmed by repeated check-ins. (Production: host-confirmed QR check-in.)
 */
export function checkIn(db: Database, eventId: string, userId: string, now: Date): Database {
  const event = requireEvent(db, eventId)
  const reg = getRegistration(db, eventId, userId)
  if (reg?.checkedInAt) throw new AppError("You've already confirmed attendance for this event.")
  if (!canCheckIn(db, event, userId, now)) throw new AppError('Attendance can be confirmed from 1 hour before the event until 14 days after it.')
  return {
    ...db,
    registrations: db.registrations.map((r) => (r.id === reg!.id ? { ...r, checkedInAt: now.toISOString() } : r)),
  }
}

export function toggleSavedEvent(db: Database, userId: string, eventId: string): { db: Database; saved: boolean } {
  const user = requireUser(db, userId)
  const saved = user.savedEventIds.includes(eventId)
  const savedEventIds = saved ? user.savedEventIds.filter((id) => id !== eventId) : [...user.savedEventIds, eventId]
  return { db: { ...db, users: db.users.map((u) => (u.id === userId ? { ...u, savedEventIds } : u)) }, saved: !saved }
}
