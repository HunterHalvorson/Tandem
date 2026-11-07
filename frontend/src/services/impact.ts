/**
 * Community impact metrics, computed live from the dataset in this browser.
 * Seeded numbers are DEMO DATA; the "live in this browser" counters only count actions taken here.
 */
import { CATEGORY_IDS } from '../data/categories'
import { QUADRANTS } from '../data/calgary'
import type { CategoryId, Database, Quadrant } from '../types'
import { eventPhase, registeredCount } from './db'
import { confirmedFeatures } from '../data/accessibility'

export function impactMetrics(db: Database, now: Date) {
  const scheduled = db.events.filter((e) => e.status === 'scheduled' && e.visibility === 'public')
  const upcoming = scheduled.filter((e) => eventPhase(e, now) !== 'ended')
  const completed = scheduled.filter((e) => eventPhase(e, now) === 'ended')
  const travellers = new Set(db.users.filter((u) => u.travelMode || u.residency === 'visiting' || u.residency === 'planning').map((u) => u.id))

  const byQuadrant = Object.fromEntries(QUADRANTS.map((q) => [q, upcoming.filter((e) => e.venue.quadrant === q).length])) as Record<Quadrant, number>
  const byCategory = Object.fromEntries(
    CATEGORY_IDS.map((c) => [c, upcoming.filter((e) => e.categoryId === c).length]).filter(([, n]) => (n as number) > 0),
  ) as Partial<Record<CategoryId, number>>
  const returns = db.reviews.filter((r) => r.wouldReturn !== null)

  return {
    registrations: db.events.reduce((s, e) => s + (e.status === 'scheduled' ? registeredCount(db, e) : 0), 0),
    upcomingParticipants: upcoming.reduce((s, e) => s + registeredCount(db, e), 0),
    upcomingEvents: upcoming.length,
    completedEvents: completed.length,
    groups: db.groups.length,
    freeActivities: upcoming.filter((e) => e.price === 0).length,
    accessibilityLabelled: upcoming.filter((e) => confirmedFeatures(e.accessibility).length > 0).length,
    firstTimeFriendly: upcoming.filter((e) => !!e.firstTime).length,
    travellerFriendly: upcoming.filter((e) => e.travellerFriendly).length,
    travellerRegistrations: db.registrations.filter((r) => r.status === 'going' && travellers.has(r.userId)).length,
    categoriesRepresented: new Set(upcoming.map((e) => e.categoryId)).size,
    quadrantsCovered: QUADRANTS.filter((q) => byQuadrant[q] > 0).length,
    wouldReturnRate: returns.length ? returns.filter((r) => r.wouldReturn).length / returns.length : null,
    wouldReturnResponses: returns.length,
    byQuadrant,
    byCategory,
    live: {
      registrations: db.registrations.filter((r) => !r.isDemo && r.status === 'going').length,
      eventsCreated: db.events.filter((e) => !e.isDemo).length,
      messages: db.messages.filter((m) => !m.isDemo && m.kind !== 'system').length,
      reviews: db.reviews.filter((r) => !r.isDemo).length,
      accounts: db.users.filter((u) => !u.isDemo).length,
      groupJoins: db.memberships.filter((m) => new Date(m.joinedAt) > new Date(db.seededAt)).length,
    },
  }
}
