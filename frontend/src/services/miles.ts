/**
 * Tandem Miles — a participation score that replaces the idea of a "credit score".
 * Miles celebrate taking part; they are never ranked publicly and never describe a person's worth.
 * Everything is DERIVED from registrations/events, so totals can't be inflated by repeated check-ins.
 */
import type { CategoryId, Database, MilesEntry, MilesSummary, ParticipationMilestone, Quadrant } from '../types'
import { category } from '../data/categories'
import { eventPhase } from './db'

export const MILES_RULES = {
  attend: 10,
  hostCompleted: 15,
  newCategory: 5,
  volunteer: 10,
} as const

export function computeMiles(db: Database, userId: string, now: Date): MilesSummary {
  const entries: MilesEntry[] = []
  const attendedEvents = db.registrations
    .filter((r) => r.userId === userId && r.status === 'going' && r.checkedInAt)
    .map((r) => ({ reg: r, event: db.events.find((e) => e.id === r.eventId) }))
    .filter((x) => x.event && x.event.status !== 'cancelled')
    .sort((a, b) => a.event!.startsAt.localeCompare(b.event!.startsAt))

  const seen = new Set<CategoryId>()
  const quadrants = new Set<Quadrant>()
  let volunteerEvents = 0
  for (const { reg, event } of attendedEvents) {
    const e = event!
    const at = reg.checkedInAt!
    entries.push({ id: `att-${e.id}`, label: `Attended ${e.title}`, miles: MILES_RULES.attend, at, eventId: e.id })
    if (!seen.has(e.categoryId)) {
      seen.add(e.categoryId)
      entries.push({ id: `cat-${e.categoryId}`, label: `New interest explored: ${category(e.categoryId).label}`, miles: MILES_RULES.newCategory, at, eventId: e.id })
    }
    if (e.categoryId === 'volunteering') {
      volunteerEvents++
      entries.push({ id: `vol-${e.id}`, label: `Volunteered: ${e.title}`, miles: MILES_RULES.volunteer, at, eventId: e.id })
    }
    quadrants.add(e.venue.quadrant)
  }

  const hostedAll = db.events.filter((e) => e.hostId === userId && e.status === 'scheduled')
  const hostedCompleted = hostedAll.filter((e) => eventPhase(e, now) === 'ended')
  for (const e of hostedCompleted) {
    entries.push({ id: `host-${e.id}`, label: `Hosted ${e.title}`, miles: MILES_RULES.hostCompleted, at: e.endsAt, eventId: e.id })
  }
  const hostedFirstTime = hostedAll.some((e) => !!e.firstTime)

  entries.sort((a, b) => b.at.localeCompare(a.at))
  const attended = attendedEvents.length
  const milestones: ParticipationMilestone[] = [
    { id: 'first-ride', title: 'First Ride', description: 'Attended your first event.', current: Math.min(attended, 1), target: 1, achieved: attended >= 1 },
    {
      id: 'calgary-explorer',
      title: 'Calgary Explorer',
      description: 'Took part in 4 different event categories.',
      current: Math.min(seen.size, 4),
      target: 4,
      achieved: seen.size >= 4,
    },
    {
      id: 'community-builder',
      title: 'Community Builder',
      description: 'Hosted 3 events.',
      current: Math.min(hostedAll.length, 3),
      target: 3,
      achieved: hostedAll.length >= 3,
    },
    {
      id: 'helping-hand',
      title: 'Helping Hand',
      description: 'Took part in a volunteer event.',
      current: Math.min(volunteerEvents, 1),
      target: 1,
      achieved: volunteerEvents >= 1,
    },
    {
      id: 'four-quadrants',
      title: 'All Four Quadrants',
      description: 'Attended events in NW, NE, SW and SE Calgary.',
      current: quadrants.size,
      target: 4,
      achieved: quadrants.size >= 4,
    },
    {
      id: 'welcome-wagon',
      title: 'Welcome Wagon',
      description: 'Hosted an event marked First-Time Friendly.',
      current: hostedFirstTime ? 1 : 0,
      target: 1,
      achieved: hostedFirstTime,
    },
  ]

  return {
    total: entries.reduce((s, e) => s + e.miles, 0),
    attended,
    hosted: hostedCompleted.length,
    categoriesExplored: [...seen],
    volunteerEvents,
    quadrantsVisited: [...quadrants],
    entries,
    milestones,
  }
}
