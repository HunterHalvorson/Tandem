/** Event creation, editing and cancellation (host-only), plus the shared validation used by the form. */
import { unconfirmedAccessibility } from '../data/accessibility'
import { NEIGHBOURHOODS, guessQuadrant, venue as venueById, VENUES } from '../data/calgary'
import { addDays, combineDateTime, formatEventWhen, HOUR, toDateInput, toTimeInput } from '../lib/dates'
import { formatPrice } from '../lib/format'
import { haversineKm } from '../lib/geo'
import { uid } from '../lib/ids'
import type {
  AccessibilityInfo,
  CalgaryEvent,
  CategoryId,
  ChatMessage,
  Database,
  EventSetting,
  EventVenue,
  FirstTimeInfo,
  Quadrant,
} from '../types'
import { AppError, eventPhase, registeredCount, requireEvent } from './db'

export interface EventDraft {
  title: string
  description: string
  categoryId: CategoryId | ''
  coverVariant: number
  date: string
  startTime: string
  endTime: string
  locationMode: 'venue' | 'custom'
  venueId: string
  placeName: string
  area: string
  quadrant: Quadrant | ''
  lat: number | null
  lng: number | null
  /** Private/residential: only an approximate area is shown publicly; exact details go to attendees. */
  approximate: boolean
  privateDetails: string
  price: string
  capacity: string
  minParticipants: string
  beginnerFriendly: boolean
  firstTimeEnabled: boolean
  firstTime: FirstTimeInfo
  accessibility: AccessibilityInfo
  setting: EventSetting
  equipment: string
  guidelines: string
  travellerFriendly: boolean
  visibility: 'public' | 'private'
  groupId: string
}

export type DraftField = keyof EventDraft | 'when' | 'howToFindUs' | 'whatToExpect'
export type DraftErrors = Partial<Record<DraftField, string>>

/** Which fields belong to which step of the multi-step form (for per-step validation). */
export const DRAFT_STEP_FIELDS: DraftField[][] = [
  ['title', 'description', 'categoryId'],
  ['date', 'startTime', 'endTime', 'when', 'venueId', 'placeName', 'area', 'quadrant', 'lat'],
  ['price', 'capacity', 'minParticipants', 'whatToExpect', 'howToFindUs'],
  [],
  [],
]

export const EMPTY_FIRST_TIME: FirstTimeInfo = {
  whatToExpect: '',
  whatToBring: '',
  experienceNeeded: '',
  howToFindUs: '',
  bringAFriend: true,
}

export function emptyDraft(now: Date, defaults: Partial<EventDraft> = {}): EventDraft {
  const start = addDays(now, 3)
  start.setHours(18, 0, 0, 0)
  return {
    title: '',
    description: '',
    categoryId: '',
    coverVariant: 0,
    date: toDateInput(start),
    startTime: '18:00',
    endTime: '20:00',
    locationMode: 'venue',
    venueId: '',
    placeName: '',
    area: '',
    quadrant: '',
    lat: null,
    lng: null,
    approximate: false,
    privateDetails: '',
    price: '0',
    capacity: '12',
    minParticipants: '',
    beginnerFriendly: true,
    firstTimeEnabled: true,
    firstTime: { ...EMPTY_FIRST_TIME },
    accessibility: unconfirmedAccessibility(),
    setting: 'indoor',
    equipment: '',
    guidelines: '',
    travellerFriendly: false,
    visibility: 'public',
    groupId: '',
    ...defaults,
  }
}

export function draftFromEvent(e: CalgaryEvent): EventDraft {
  const start = new Date(e.startsAt)
  const end = new Date(e.endsAt)
  const known = VENUES.find((v) => v.name === e.venue.name && v.lat === e.venue.lat && v.lng === e.venue.lng)
  return {
    title: e.title,
    description: e.description,
    categoryId: e.categoryId,
    coverVariant: e.coverVariant,
    date: toDateInput(start),
    startTime: toTimeInput(start),
    endTime: toTimeInput(end),
    locationMode: known ? 'venue' : 'custom',
    venueId: known?.id ?? '',
    placeName: known ? '' : e.venue.name,
    area: e.venue.area,
    quadrant: e.venue.quadrant,
    lat: e.venue.lat,
    lng: e.venue.lng,
    approximate: e.venue.approximate,
    privateDetails: e.venue.privateDetails,
    price: String(e.price),
    capacity: String(e.capacity),
    minParticipants: e.minParticipants ? String(e.minParticipants) : '',
    beginnerFriendly: e.beginnerFriendly,
    firstTimeEnabled: !!e.firstTime,
    firstTime: e.firstTime ?? { ...EMPTY_FIRST_TIME },
    accessibility: { ...e.accessibility },
    setting: e.setting,
    equipment: e.equipment,
    guidelines: e.guidelines,
    travellerFriendly: e.travellerFriendly,
    visibility: e.visibility,
    groupId: e.groupId ?? '',
  }
}

const isInt = (s: string) => /^\d+$/.test(s.trim())

export function validateDraft(draft: EventDraft, now: Date, opts: { registered?: number } = {}): DraftErrors {
  const errors: DraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = 'Give your event a title.'
  else if (title.length < 4) errors.title = 'Titles need at least 4 characters.'
  else if (title.length > 80) errors.title = 'Keep the title under 80 characters.'

  const desc = draft.description.trim()
  if (!desc) errors.description = 'Describe what people will do.'
  else if (desc.length < 20) errors.description = 'Add a little more detail (at least 20 characters) so people know what to expect.'
  else if (desc.length > 2000) errors.description = 'Keep the description under 2,000 characters.'

  if (!draft.categoryId) errors.categoryId = 'Choose a category.'

  const start = combineDateTime(draft.date, draft.startTime)
  const end = combineDateTime(draft.date, draft.endTime)
  if (!draft.date) errors.date = 'Choose a date.'
  if (!draft.startTime) errors.startTime = 'Choose a start time.'
  if (!draft.endTime) errors.endTime = 'Choose an end time.'
  if (draft.date && !start) errors.date = 'Enter a valid date.'
  if (start && end) {
    if (start.getTime() < now.getTime() + 15 * 60_000) errors.when = 'The event must start in the future (at least 15 minutes from now).'
    else if (end.getTime() <= start.getTime()) errors.endTime = 'The end time must be after the start time.'
    else if (end.getTime() - start.getTime() > 12 * HOUR) errors.endTime = 'Events can be at most 12 hours long.'
    else if (start.getTime() > addDays(now, 365).getTime()) errors.date = 'Events can be scheduled up to a year ahead.'
  }

  if (draft.locationMode === 'venue') {
    if (!draft.venueId) errors.venueId = 'Choose a venue or switch to "Drop a pin".'
  } else {
    if (draft.lat === null || draft.lng === null) errors.lat = 'Drop a pin on the map to set the location.'
    if (!draft.placeName.trim()) errors.placeName = 'Name the place (e.g. "Riley Park picnic shelter").'
    if (!draft.quadrant) errors.quadrant = 'Choose the Calgary quadrant.'
  }

  const priceText = draft.price.trim()
  const price = Number(priceText)
  if (priceText === '' || Number.isNaN(price)) errors.price = 'Enter a price (0 for free).'
  else if (price < 0) errors.price = "Price can't be negative."
  else if (price > 1000) errors.price = 'Prices over $1,000 are not supported.'
  else if (Math.round(price * 100) !== price * 100) errors.price = 'Use at most two decimal places.'

  if (!isInt(draft.capacity)) errors.capacity = 'Enter a whole number of spots.'
  else {
    const cap = Number(draft.capacity)
    if (cap < 2) errors.capacity = 'Group events need at least 2 spots.'
    else if (cap > 500) errors.capacity = 'Capacity can be at most 500.'
    else if (opts.registered !== undefined && cap < opts.registered)
      errors.capacity = `${opts.registered} people are already registered — capacity can't be lower than that.`
  }

  if (draft.minParticipants.trim()) {
    if (!isInt(draft.minParticipants)) errors.minParticipants = 'Enter a whole number or leave blank.'
    else if (Number(draft.minParticipants) < 1) errors.minParticipants = 'Minimum must be at least 1.'
    else if (isInt(draft.capacity) && Number(draft.minParticipants) > Number(draft.capacity))
      errors.minParticipants = 'The minimum can\'t be more than the capacity.'
  }

  if (draft.firstTimeEnabled) {
    if (!draft.firstTime.whatToExpect.trim()) errors.whatToExpect = 'Tell first-timers what to expect.'
    if (!draft.firstTime.howToFindUs.trim()) errors.howToFindUs = 'Explain how to find the group on arrival.'
  }
  return errors
}

export function stepErrors(errors: DraftErrors, step: number): DraftErrors {
  const fields = DRAFT_STEP_FIELDS[step] ?? []
  return Object.fromEntries(Object.entries(errors).filter(([k]) => fields.includes(k as DraftField))) as DraftErrors
}

/** Approximate locations snap to the nearest neighbourhood centroid — the exact spot is never stored. */
function nearestNeighbourhood(lat: number, lng: number) {
  let best = NEIGHBOURHOODS[0]
  let bestKm = Infinity
  for (const n of NEIGHBOURHOODS) {
    const km = haversineKm({ lat, lng }, n)
    if (km < bestKm) {
      best = n
      bestKm = km
    }
  }
  return best
}

export function buildVenue(draft: EventDraft): EventVenue {
  let name: string
  let area: string
  let lat: number
  let lng: number
  let quadrant: Quadrant
  if (draft.locationMode === 'venue') {
    const v = venueById(draft.venueId)
    ;({ name, area, lat, lng, quadrant } = v)
  } else {
    lat = draft.lat ?? 0
    lng = draft.lng ?? 0
    name = draft.placeName.trim()
    quadrant = (draft.quadrant || guessQuadrant({ lat, lng })) as Quadrant
    area = draft.area.trim() || nearestNeighbourhood(lat, lng).name
  }
  if (draft.approximate) {
    const n = nearestNeighbourhood(lat, lng)
    return {
      name: `${n.name} (approximate area)`,
      area: n.name,
      quadrant: n.quadrant,
      lat: n.lat,
      lng: n.lng,
      approximate: true,
      privateDetails: draft.privateDetails.trim(),
    }
  }
  return { name, area, quadrant, lat, lng, approximate: false, privateDetails: draft.privateDetails.trim() }
}

function fieldsFromDraft(draft: EventDraft) {
  const start = combineDateTime(draft.date, draft.startTime)!
  const end = combineDateTime(draft.date, draft.endTime)!
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId as CategoryId,
    coverVariant: draft.coverVariant,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    venue: buildVenue(draft),
    price: Math.round(Number(draft.price) * 100) / 100,
    capacity: Number(draft.capacity),
    minParticipants: draft.minParticipants.trim() ? Number(draft.minParticipants) : null,
    beginnerFriendly: draft.beginnerFriendly,
    firstTime: draft.firstTimeEnabled
      ? {
          whatToExpect: draft.firstTime.whatToExpect.trim(),
          whatToBring: draft.firstTime.whatToBring.trim(),
          experienceNeeded: draft.firstTime.experienceNeeded.trim(),
          howToFindUs: draft.firstTime.howToFindUs.trim(),
          bringAFriend: draft.firstTime.bringAFriend,
        }
      : null,
    accessibility: { ...draft.accessibility },
    setting: draft.setting,
    equipment: draft.equipment.trim(),
    guidelines: draft.guidelines.trim(),
    travellerFriendly: draft.travellerFriendly,
    visibility: draft.visibility,
    groupId: draft.groupId || null,
  }
}

function systemMessage(eventId: string, body: string, now: Date): ChatMessage {
  return { id: uid('msg'), eventId, userId: null, kind: 'system', body, createdAt: now.toISOString(), isDemo: false }
}

export function createEvent(db: Database, draft: EventDraft, hostId: string, now: Date): { db: Database; event: CalgaryEvent } {
  if (!db.users.some((u) => u.id === hostId)) throw new AppError('Please sign in to host an event.')
  const errors = validateDraft(draft, now)
  if (Object.keys(errors).length) throw new AppError('Please fix the highlighted fields before publishing.')
  const fields = fieldsFromDraft(draft)
  const event: CalgaryEvent = {
    id: uid('evt'),
    seriesId: null,
    hostId,
    ...fields,
    status: 'scheduled',
    baseAttendeeCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    isDemo: false,
  }
  const messages: ChatMessage[] = [systemMessage(event.id, `Group chat created for ${event.title}.`, now)]
  if (event.firstTime?.howToFindUs) {
    messages.push({
      id: uid('msg'),
      eventId: event.id,
      userId: hostId,
      kind: 'announcement',
      body: `Meeting point: ${event.firstTime.howToFindUs}`,
      createdAt: new Date(now.getTime() + 1).toISOString(),
      isDemo: false,
    })
  }
  return { db: { ...db, events: [...db.events, event], messages: [...db.messages, ...messages] }, event }
}

export function updateEvent(db: Database, eventId: string, draft: EventDraft, userId: string, now: Date): Database {
  const existing = requireEvent(db, eventId)
  if (existing.hostId !== userId) throw new AppError('Only the host can edit this event.')
  if (existing.status === 'cancelled') throw new AppError('Cancelled events can’t be edited.')
  if (eventPhase(existing, now) !== 'upcoming') throw new AppError('Events that have started can’t be edited.')
  const errors = validateDraft(draft, now, { registered: registeredCount(db, existing) })
  if (Object.keys(errors).length) throw new AppError('Please fix the highlighted fields before saving.')
  const fields = fieldsFromDraft(draft)
  const updated: CalgaryEvent = { ...existing, ...fields, updatedAt: now.toISOString() }

  const changes: string[] = []
  if (existing.startsAt !== updated.startsAt || existing.endsAt !== updated.endsAt)
    changes.push(`new time ${formatEventWhen(updated.startsAt, now)}`)
  if (existing.venue.name !== updated.venue.name) changes.push(`new location ${updated.venue.name}`)
  if (existing.price !== updated.price) changes.push(`price is now ${formatPrice(updated.price)}`)
  if (existing.capacity !== updated.capacity) changes.push(`capacity is now ${updated.capacity}`)
  const note = changes.length ? `The host updated this event: ${changes.join('; ')}.` : 'The host updated the event details.'

  return {
    ...db,
    events: db.events.map((e) => (e.id === eventId ? updated : e)),
    messages: [...db.messages, systemMessage(eventId, note, now)],
  }
}

export function cancelEvent(db: Database, eventId: string, userId: string, reason: string, now: Date): Database {
  const existing = requireEvent(db, eventId)
  if (existing.hostId !== userId) throw new AppError('Only the host can cancel this event.')
  if (existing.status === 'cancelled') throw new AppError('This event is already cancelled.')
  if (eventPhase(existing, now) === 'ended') throw new AppError('This event has already finished.')
  const why = reason.trim()
  return {
    ...db,
    events: db.events.map((e) =>
      e.id === eventId ? { ...e, status: 'cancelled' as const, cancelReason: why || undefined, updatedAt: now.toISOString() } : e,
    ),
    messages: [...db.messages, systemMessage(eventId, `The host cancelled this event.${why ? ` Reason: ${why}` : ''}`, now)],
  }
}

export type SizeBucket = 'small' | 'medium' | 'large'

export function sizeBucket(capacity: number): SizeBucket {
  if (capacity <= 12) return 'small'
  if (capacity <= 40) return 'medium'
  return 'large'
}

export const SIZE_LABEL: Record<SizeBucket, string> = {
  small: 'Small group (up to 12)',
  medium: 'Medium group (13–40)',
  large: 'Large group (40+)',
}
