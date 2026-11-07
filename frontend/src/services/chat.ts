/** Event group chats: access control, messages, announcements, participants and reporting. */
import { uid } from '../lib/ids'
import type { CalgaryEvent, ChatMessage, Database, Report, ReportReason, User } from '../types'
import { AppError, getUser, goingRegistrations, isGoing, requireEvent } from './db'

export const MAX_MESSAGE_LENGTH = 1000

/** Chats are private to the host and registered attendees — there is no public messaging directory. */
export function canAccessChat(db: Database, event: CalgaryEvent, userId: string | null | undefined): boolean {
  if (!userId) return false
  return event.hostId === userId || isGoing(db, event.id, userId)
}

export function eventMessages(db: Database, eventId: string): ChatMessage[] {
  return db.messages
    .filter((m) => m.eventId === eventId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function announcements(db: Database, eventId: string): ChatMessage[] {
  return eventMessages(db, eventId).filter((m) => m.kind === 'announcement')
}

export function sendMessage(
  db: Database,
  input: { eventId: string; userId: string; body: string; announcement?: boolean },
  now: Date,
): Database {
  const event = requireEvent(db, input.eventId)
  if (!canAccessChat(db, event, input.userId)) throw new AppError('Join this event to chat with the group.')
  const body = input.body.trim()
  if (!body) throw new AppError('Write a message first.')
  if (body.length > MAX_MESSAGE_LENGTH) throw new AppError(`Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`)
  if (input.announcement && event.hostId !== input.userId) throw new AppError('Only the host can post announcements.')
  const message: ChatMessage = {
    id: uid('msg'),
    eventId: event.id,
    userId: input.userId,
    kind: input.announcement ? 'announcement' : 'message',
    body,
    createdAt: now.toISOString(),
    isDemo: false,
  }
  return { ...db, messages: [...db.messages, message] }
}

export interface Participants {
  host: User | undefined
  members: User[]
  /** Seeded anonymous demo participants (not individual accounts). */
  anonymous: number
}

export function eventParticipants(db: Database, event: CalgaryEvent): Participants {
  const members = goingRegistrations(db, event.id)
    .map((r) => getUser(db, r.userId))
    .filter((u): u is User => !!u)
  return { host: getUser(db, event.hostId), members, anonymous: event.baseAttendeeCount }
}

export const REPORT_REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: 'safety', label: 'Safety concern' },
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'misleading', label: 'Misleading or inaccurate information' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'other', label: 'Something else' },
]

export function reportContent(
  db: Database,
  input: { targetType: Report['targetType']; targetId: string; reporterId: string; reason: ReportReason; details: string },
  now: Date,
): Database {
  if (!input.reporterId) throw new AppError('Please sign in to report content.')
  if (hasReported(db, input.targetType, input.targetId, input.reporterId)) throw new AppError("You've already reported this.")
  const report: Report = { id: uid('rpt'), ...input, details: input.details.trim().slice(0, 1000), createdAt: now.toISOString() }
  return { ...db, reports: [...db.reports, report] }
}

export function hasReported(db: Database, targetType: Report['targetType'], targetId: string, userId: string | null | undefined): boolean {
  return !!userId && db.reports.some((r) => r.targetType === targetType && r.targetId === targetId && r.reporterId === userId)
}
