/**
 * Tandem domain model.
 *
 * Everything persisted lives in a single `Database` object (see services/storage.ts).
 * Relationships are by id: events → host (User), group (CommunityGroup); registrations/reviews/messages → event + user.
 * Timestamps are ISO-8601 strings; calendar dates (traveller arrival/departure) are `YYYY-MM-DD`.
 */

export type Quadrant = 'NW' | 'NE' | 'SW' | 'SE'

export type CategoryId =
  | 'running'
  | 'fitness'
  | 'cycling'
  | 'hiking'
  | 'reading'
  | 'movies'
  | 'music'
  | 'art'
  | 'tech'
  | 'games'
  | 'food'
  | 'volunteering'
  | 'photography'
  | 'language'
  | 'culture'
  | 'study'
  | 'sports'
  | 'meetups'

/** An interest a user can pick. Interests and event categories share one taxonomy. */
export interface Interest {
  id: CategoryId
  label: string
  /** Lower-case phrase used in sentences: "you enjoy {phrase}". */
  phrase: string
  description: string
}

/* ------------------------------------------------------------------ accessibility */

export type AccessFeature =
  | 'wheelchair'
  | 'stepFree'
  | 'accessibleWashroom'
  | 'quiet'
  | 'sensoryFriendly'
  | 'virtual'

/** Never assume a venue is accessible: every feature is explicitly one of these. */
export type AccessStatus = 'confirmed' | 'unconfirmed' | 'unavailable'

export type AccessibilityInfo = Record<AccessFeature, AccessStatus>

/** "Comfort & Access" — practical participation preferences, never medical labels. */
export interface AccessibilityPreferences {
  /** Features the user would like events to have. */
  features: AccessFeature[]
  /** Subset of features that are must-haves (applied as a hard constraint in recommendations). */
  essential: AccessFeature[]
  smallGroups: boolean
  beginnerFriendly: boolean
  prefersFree: boolean
  /** Optional private note (e.g. dietary considerations). Never shown publicly. */
  privateNotes: string
  /** Social comfort mode: prioritise small, beginner-friendly, low-pressure events with clear arrival info. */
  easeIntoIt: boolean
}

/* ------------------------------------------------------------------ users */

export type ResidencyStatus = 'resident' | 'new' | 'visiting' | 'planning'
export type VerificationStatus = 'unverified' | 'pending' | 'demo_verified'
export type ProfileVisibility = 'public' | 'members' | 'private'
export type AvailabilitySlot = 'weekdayDaytime' | 'weekdayEvening' | 'weekend'

export type SocialPlatform =
  | 'instagram'
  | 'strava'
  | 'discord'
  | 'alltrails'
  | 'letterboxd'
  | 'spotify'
  | 'github'
  | 'website'

export type SocialLinks = Partial<Record<SocialPlatform, string>>

export interface PrivacySettings {
  profileVisibility: ProfileVisibility
  /** Show "Alex Rivera" instead of "Alex R." */
  showFullName: boolean
  showLocation: boolean
  showInterests: boolean
  showSocialLinks: boolean
  showAttendance: boolean
  /** Accessibility preferences are private unless the user explicitly opts in. */
  showAccessibility: boolean
}

export interface TravellerPreferences {
  arrival: string | null
  departure: string | null
  homeCity: string
  budgetPerEvent: number | null
  preferredQuadrants: Quadrant[]
  /** Event ids saved from the Weekend Planner. */
  itinerary: string[]
}

export interface Verification {
  status: VerificationStatus
  documentType?: 'passport' | 'drivers_licence' | 'provincial_id'
  requestedAt?: string
}

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  createdAt: string
  /** Preconfigured demo account (seeded). */
  isDemo: boolean
  ageConfirmed: boolean
  onboardingComplete: boolean
  residency: ResidencyStatus
  /** "Travel mode" — visitor features on (Explore Like a Local, itinerary on dashboard). */
  travelMode: boolean
  quadrant: Quadrant | null
  neighbourhood: string | null
  interests: CategoryId[]
  socials: SocialLinks
  privacy: PrivacySettings
  comfort: AccessibilityPreferences
  budget: { max: number | null; strict: boolean }
  availability: AvailabilitySlot[]
  traveller: TravellerPreferences
  bio: string
  avatar: { color: string; photo?: string }
  verification: Verification
  savedEventIds: string[]
  /** How this account signs in. Older/demo records omit it. */
  authProvider?: AuthProvider
  /** Google account id ("sub" claim) for accounts created/linked with Sign in with Google. */
  googleSub?: string
}

export type AuthProvider = 'demo' | 'email' | 'google'

/* ------------------------------------------------------------------ groups */

export interface CommunityGroup {
  id: string
  name: string
  description: string
  categoryId: CategoryId
  organizerId: string
  quadrant: Quadrant | null
  area: string
  guidelines: string[]
  coverVariant: number
  /** Seeded demo members that are not individual user records (labelled as demo data in the UI). */
  baseMemberCount: number
  createdAt: string
  isDemo: boolean
}

export interface GroupMembership {
  id: string
  groupId: string
  userId: string
  role: 'organizer' | 'member'
  joinedAt: string
}

/* ------------------------------------------------------------------ events */

export interface EventVenue {
  /** Public place name, e.g. "Prince's Island Park". For approximate locations, the area name. */
  name: string
  /** Neighbourhood / area, e.g. "Eau Claire". */
  area: string
  quadrant: Quadrant
  lat: number
  lng: number
  /** Private / residential location: only the approximate area is shown publicly. */
  approximate: boolean
  /** Exact meeting details, shown only to registered attendees (and the host). */
  privateDetails: string
}

/** "First-Time Friendly" details shown to help newcomers know what to expect. */
export interface FirstTimeInfo {
  whatToExpect: string
  whatToBring: string
  experienceNeeded: string
  howToFindUs: string
  bringAFriend: boolean
}

export type EventSetting = 'indoor' | 'outdoor' | 'mixed'

export interface CalgaryEvent {
  id: string
  /** Recurring activities share a series id; ratings aggregate across a series. */
  seriesId: string | null
  groupId: string | null
  hostId: string
  title: string
  description: string
  categoryId: CategoryId
  coverVariant: number
  startsAt: string
  endsAt: string
  venue: EventVenue
  /** CAD; 0 = free. */
  price: number
  capacity: number
  minParticipants: number | null
  beginnerFriendly: boolean
  firstTime: FirstTimeInfo | null
  accessibility: AccessibilityInfo
  setting: EventSetting
  equipment: string
  guidelines: string
  travellerFriendly: boolean
  /** Private events are unlisted: reachable by link, hidden from discovery/map. */
  visibility: 'public' | 'private'
  status: 'scheduled' | 'cancelled'
  cancelReason?: string
  /** Seeded anonymous demo participants (not user records). Counted toward capacity; labelled in the UI. */
  baseAttendeeCount: number
  createdAt: string
  updatedAt: string
  isDemo: boolean
}

export interface EventRegistration {
  id: string
  eventId: string
  userId: string
  status: 'going' | 'left'
  joinedAt: string
  leftAt?: string
  /** Attendance confirmation. Each registration can be checked in once → Miles can't be farmed. */
  checkedInAt?: string
  isDemo: boolean
}

export interface EventReview {
  id: string
  eventId: string
  userId: string
  overall: number
  organization: number | null
  accuracy: number | null
  /** null = "not applicable / didn't need it". */
  accessibilityAccuracy: number | null
  /** "Would you attend another activity with this group?" — aggregated, never shown per person. */
  wouldReturn: boolean | null
  comment: string
  createdAt: string
  isDemo: boolean
}

export type MessageKind = 'message' | 'announcement' | 'system'

export interface ChatMessage {
  id: string
  eventId: string
  /** null for system messages. */
  userId: string | null
  kind: MessageKind
  body: string
  createdAt: string
  isDemo: boolean
}

export type ReportReason = 'misleading' | 'safety' | 'harassment' | 'inappropriate' | 'spam' | 'other'

export interface Report {
  id: string
  targetType: 'event' | 'message'
  targetId: string
  reporterId: string
  reason: ReportReason
  details: string
  createdAt: string
}

export interface EventCounts {
  going: number
  attended: number
}

export interface GroupMessage {
  id: string
  groupId: string
  userId: string
  body: string
  createdAt: string
}

export interface Database {
  version: number
  /** ISO timestamp of when the demo world was generated (seed dates are relative to it). */
  seededAt: string
  users: User[]
  groups: CommunityGroup[]
  memberships: GroupMembership[]
  events: CalgaryEvent[]
  registrations: EventRegistration[]
  reviews: EventReview[]
  messages: ChatMessage[]
  reports: Report[]
  eventCounts?: Record<string, EventCounts>
}

/* ------------------------------------------------------------------ derived */

export interface ParticipationMilestone {
  id: string
  title: string
  description: string
  achieved: boolean
  current: number
  target: number
}

export interface MilesEntry {
  id: string
  label: string
  miles: number
  at: string
  eventId?: string
}

export interface MilesSummary {
  total: number
  attended: number
  hosted: number
  categoriesExplored: CategoryId[]
  volunteerEvents: number
  quadrantsVisited: Quadrant[]
  entries: MilesEntry[]
  milestones: ParticipationMilestone[]
}

export interface RatingSummary {
  count: number
  average: number | null
  organization: number | null
  accuracy: number | null
  accessibilityAccuracy: number | null
  wouldReturnRate: number | null
  /** Enough reviews to show a rating publicly (otherwise label "New"). */
  sufficient: boolean
}
