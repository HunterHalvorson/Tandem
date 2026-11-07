/** Community groups — persistent interest communities that host many events over time. */
import { uid } from '../lib/ids'
import type { CalgaryEvent, CommunityGroup, Database } from '../types'
import { AppError, eventPhase, getGroup, requireUser } from './db'

export function groupMemberCount(db: Database, group: CommunityGroup): number {
  return group.baseMemberCount + db.memberships.filter((m) => m.groupId === group.id).length
}

export function isMember(db: Database, groupId: string, userId: string | null | undefined): boolean {
  return !!userId && db.memberships.some((m) => m.groupId === groupId && m.userId === userId)
}

export function joinGroup(db: Database, groupId: string, userId: string, now: Date): Database {
  requireUser(db, userId)
  if (!getGroup(db, groupId)) throw new AppError('That group no longer exists.')
  if (isMember(db, groupId, userId)) throw new AppError("You're already a member.")
  return {
    ...db,
    memberships: [...db.memberships, { id: uid('mem'), groupId, userId, role: 'member', joinedAt: now.toISOString() }],
  }
}

export function leaveGroup(db: Database, groupId: string, userId: string): Database {
  const membership = db.memberships.find((m) => m.groupId === groupId && m.userId === userId)
  if (!membership) throw new AppError("You're not a member of this group.")
  if (membership.role === 'organizer') throw new AppError('Organizers can’t leave their own group.')
  return { ...db, memberships: db.memberships.filter((m) => m.id !== membership.id) }
}

export function groupEvents(db: Database, groupId: string, now: Date): { upcoming: CalgaryEvent[]; past: CalgaryEvent[] } {
  const events = db.events.filter((e) => e.groupId === groupId && e.visibility === 'public')
  const upcoming = events
    .filter((e) => e.status === 'scheduled' && eventPhase(e, now) !== 'ended')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const past = events
    .filter((e) => eventPhase(e, now) === 'ended')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  return { upcoming, past }
}

export function userGroups(db: Database, userId: string | null | undefined): CommunityGroup[] {
  if (!userId) return []
  const ids = new Set(db.memberships.filter((m) => m.userId === userId).map((m) => m.groupId))
  return db.groups.filter((g) => ids.has(g.id))
}

export function groupsOrganizedBy(db: Database, userId: string | null | undefined): CommunityGroup[] {
  if (!userId) return []
  return db.groups.filter((g) => g.organizerId === userId)
}
