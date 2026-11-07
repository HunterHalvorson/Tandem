/**
 * Demo world generator. Every record created here is flagged `isDemo` and labelled in the UI.
 * Events are FICTIONAL listings placed at real public Calgary places. Dates are relative to the moment
 * the demo is seeded so the app always has upcoming events (Settings → "Reset demo data" regenerates).
 */
import { addDays, addMinutes, HOUR, MINUTE, nextWeekday, startOfDay, toDateInput } from '../lib/dates'
import type {
  AccessibilityInfo,
  AccessibilityPreferences,
  AvailabilitySlot,
  CalgaryEvent,
  CategoryId,
  ChatMessage,
  CommunityGroup,
  Database,
  EventRegistration,
  EventReview,
  EventSetting,
  FirstTimeInfo,
  GroupMembership,
  PrivacySettings,
  Quadrant,
  ResidencyStatus,
  SocialLinks,
  TravellerPreferences,
  User,
  VerificationStatus,
} from '../types'
import { unconfirmedAccessibility } from './accessibility'
import { neighbourhood, venue } from './calgary'

export const DB_VERSION = 1

/* ------------------------------------------------------------------ users */

type UKey =
  | 'alex'
  | 'sam'
  | 'priya'
  | 'jordan'
  | 'grace'
  | 'diego'
  | 'liam'
  | 'marcus'
  | 'chloe'
  | 'hannah'
  | 'ethan'
  | 'fatima'
  | 'noor'
  | 'ben'

export const userId = (k: UKey) => `usr-${k}`

/** Demo accounts offered on the sign-in screen (the story in spec §27 uses Alex then Sam). */
export const FEATURED_DEMO_ACCOUNTS: Array<{ id: string; persona: string; story: string }> = [
  { id: userId('alex'), persona: 'New to Calgary · student', story: 'Just moved for grad school and wants to meet people.' },
  { id: userId('sam'), persona: 'Visiting from Toronto', story: 'In town for a long weekend — wants to explore like a local.' },
  { id: userId('priya'), persona: 'Local organizer', story: 'Hosts Calgary Sunrise Runners and can edit their events.' },
]

export const DEFAULT_PRIVACY: PrivacySettings = {
  profileVisibility: 'members',
  showFullName: false,
  showLocation: true,
  showInterests: true,
  showSocialLinks: false,
  showAttendance: false,
  showAccessibility: false,
}

export const DEFAULT_COMFORT: AccessibilityPreferences = {
  features: [],
  essential: [],
  smallGroups: false,
  beginnerFriendly: false,
  prefersFree: false,
  privateNotes: '',
  easeIntoIt: false,
}

export const DEFAULT_TRAVELLER: TravellerPreferences = {
  arrival: null,
  departure: null,
  homeCity: '',
  budgetPerEvent: null,
  preferredQuadrants: [],
  itinerary: [],
}

export const AVATAR_COLORS = ['#9B1026', '#1D4E89', '#1E6B3A', '#7A4A1D', '#4B2E83', '#2E3A48', '#B4235A', '#0B7285']

interface UserSeed {
  key: UKey
  first: string
  last: string
  residency: ResidencyStatus
  hood: string | null
  interests: CategoryId[]
  bio: string
  color: string
  verification: VerificationStatus
  comfort?: Partial<AccessibilityPreferences>
  budget?: { max: number | null; strict: boolean }
  availability?: AvailabilitySlot[]
  travel?: Partial<TravellerPreferences>
  socials?: SocialLinks
  privacy?: Partial<PrivacySettings>
}

const USER_SEEDS: UserSeed[] = [
  {
    key: 'alex',
    first: 'Alex',
    last: 'Rivera',
    residency: 'new',
    hood: 'University District / Varsity',
    interests: ['running', 'reading', 'hiking', 'food'],
    bio: 'Just moved from Halifax for grad school at UCalgary. Looking for running buddies and a good book club.',
    color: '#1D4E89',
    verification: 'unverified',
    comfort: { smallGroups: true, beginnerFriendly: true, prefersFree: true },
    budget: { max: 20, strict: false },
    availability: ['weekdayEvening', 'weekend'],
    socials: { strava: 'https://www.strava.com/athletes/tandem-demo-alex' },
  },
  {
    key: 'sam',
    first: 'Sam',
    last: 'Okafor',
    residency: 'visiting',
    hood: null,
    interests: ['hiking', 'food', 'photography', 'culture'],
    bio: 'Visiting from Toronto for a long weekend — I want to see Calgary like a local, not a tourist.',
    color: '#7A4A1D',
    verification: 'demo_verified',
    comfort: { beginnerFriendly: true },
    budget: { max: 40, strict: true },
    availability: ['weekdayDaytime', 'weekdayEvening', 'weekend'],
    travel: { homeCity: 'Toronto, ON', budgetPerEvent: 40 },
    socials: { instagram: 'https://www.instagram.com/tandem.demo.sam' },
  },
  {
    key: 'priya',
    first: 'Priya',
    last: 'Sharma',
    residency: 'resident',
    hood: 'Beltline',
    interests: ['running', 'volunteering', 'hiking', 'food'],
    bio: 'Organizer of Calgary Sunrise Runners. Coffee after every run is non-negotiable.',
    color: '#9B1026',
    verification: 'demo_verified',
    socials: { strava: 'https://www.strava.com/clubs/tandem-demo-sunrise' },
  },
  {
    key: 'jordan',
    first: 'Jordan',
    last: 'Lee',
    residency: 'resident',
    hood: 'Brentwood',
    interests: ['tech', 'games', 'running', 'photography'],
    bio: 'Fourth-year software engineering student. I run Calgary Student Developers.',
    color: '#1E6B3A',
    verification: 'demo_verified',
    socials: { github: 'https://github.com/tandem-demo-jordan' },
  },
  {
    key: 'grace',
    first: 'Grace',
    last: 'Wong',
    residency: 'resident',
    hood: 'Kensington / Hillhurst',
    interests: ['reading', 'art', 'photography', 'food'],
    bio: 'Librarian by day, book club host by weekend.',
    color: '#4B2E83',
    verification: 'demo_verified',
  },
  {
    key: 'diego',
    first: 'Diego',
    last: 'Alvarez',
    residency: 'resident',
    hood: 'Beltline',
    interests: ['movies', 'music', 'language', 'sports'],
    bio: 'Film nerd. Ask me about Canadian cinema.',
    color: '#B4235A',
    verification: 'demo_verified',
    socials: { letterboxd: 'https://letterboxd.com/tandem_demo_diego' },
  },
  {
    key: 'liam',
    first: 'Liam',
    last: "O'Connor",
    residency: 'resident',
    hood: 'McKenzie Towne',
    interests: ['hiking', 'cycling', 'sports', 'photography'],
    bio: 'Weekend hiker, year-round cyclist.',
    color: '#0B7285',
    verification: 'demo_verified',
  },
  {
    key: 'marcus',
    first: 'Marcus',
    last: 'Johnson',
    residency: 'resident',
    hood: 'Marda Loop / Altadore',
    interests: ['fitness', 'running', 'sports', 'volunteering'],
    bio: 'Certified trainer. Beginner Gym Community organizer — no judgement, just progress.',
    color: '#2E3A48',
    verification: 'demo_verified',
  },
  {
    key: 'chloe',
    first: 'Chloe',
    last: 'Martin',
    residency: 'resident',
    hood: 'Inglewood',
    interests: ['music', 'art', 'food', 'culture'],
    bio: 'Guitarist, Inglewood local and YYC Jam Sessions host.',
    color: '#7A4A1D',
    verification: 'demo_verified',
  },
  {
    key: 'hannah',
    first: 'Hannah',
    last: 'Kim',
    residency: 'resident',
    hood: 'Dalhousie',
    interests: ['photography', 'hiking', 'art', 'reading'],
    bio: 'Nose Hill is my backyard. Golden-hour enthusiast.',
    color: '#1D4E89',
    verification: 'demo_verified',
  },
  {
    key: 'ethan',
    first: 'Ethan',
    last: 'Nguyen',
    residency: 'resident',
    hood: 'Ramsay',
    interests: ['games', 'tech', 'movies', 'food'],
    bio: 'Board game collector (400+ games and counting).',
    color: '#4B2E83',
    verification: 'demo_verified',
  },
  {
    key: 'fatima',
    first: 'Fatima',
    last: 'Ali',
    residency: 'resident',
    hood: 'Saddle Ridge',
    interests: ['volunteering', 'food', 'culture', 'running'],
    bio: 'Community organizer with Neighbours Helping Neighbours.',
    color: '#1E6B3A',
    verification: 'demo_verified',
  },
  {
    key: 'noor',
    first: 'Noor',
    last: 'Haddad',
    residency: 'resident',
    hood: 'East Village',
    interests: ['language', 'reading', 'culture', 'volunteering'],
    bio: 'Speaks Arabic, French and English. Runs the Calgary Language Café.',
    color: '#B4235A',
    verification: 'demo_verified',
  },
  {
    key: 'ben',
    first: 'Ben',
    last: 'Tremblay',
    residency: 'resident',
    hood: 'Bridgeland-Riverside',
    interests: ['meetups', 'food', 'running', 'culture'],
    bio: 'Moved here five years ago knowing no one. Now I host newcomer socials.',
    color: '#0B7285',
    verification: 'demo_verified',
  },
]

/* ------------------------------------------------------------------ groups */

type GKey =
  | 'sunrise-runners'
  | 'kensington-book-club'
  | 'yyc-film-society'
  | 'weekend-hikers'
  | 'beginner-gym'
  | 'student-devs'
  | 'yyc-jam'
  | 'nose-hill-photo'
  | 'board-gamers'
  | 'neighbours-helping'
  | 'language-cafe'
  | 'newcomers'

export const groupId = (k: GKey) => `grp-${k}`

interface GroupSeed {
  key: GKey
  name: string
  cat: CategoryId
  organizer: UKey
  quadrant: Quadrant | null
  area: string
  description: string
  guidelines: string[]
  members: number
  extraMembers: UKey[]
}

const GROUP_SEEDS: GroupSeed[] = [
  {
    key: 'sunrise-runners',
    name: 'Calgary Sunrise Runners',
    cat: 'running',
    organizer: 'priya',
    quadrant: 'SW',
    area: 'Downtown & the Bow River pathways',
    description:
      'Early-morning runs along the Bow River pathways at a conversational pace. Every speed is welcome and nobody gets dropped — we regroup at every bridge.',
    guidelines: ['No-drop policy: we regroup at every bridge.', 'Wear something reflective before sunrise.', 'Walk-run is always welcome.'],
    members: 86,
    extraMembers: ['jordan', 'hannah', 'ben', 'marcus', 'chloe', 'noor'],
  },
  {
    key: 'kensington-book-club',
    name: 'Kensington Book Club',
    cat: 'reading',
    organizer: 'grace',
    quadrant: 'NW',
    area: 'Kensington / Hillhurst',
    description:
      'A small, friendly book club that meets in a quiet Kensington café. Finished the book or not — come for the conversation.',
    guidelines: ['Spoilers are fine after the first 30 minutes.', 'Everyone gets a turn to talk; nobody has to.', 'Book picks rotate between members.'],
    members: 23,
    extraMembers: ['noor', 'hannah', 'fatima'],
  },
  {
    key: 'yyc-film-society',
    name: 'YYC Film Society',
    cat: 'movies',
    organizer: 'diego',
    quadrant: 'SW',
    area: 'Beltline',
    description: 'Monthly screenings and relaxed discussion nights about films old and new, with a soft spot for Canadian cinema.',
    guidelines: ['Phones away during screenings.', 'Disagree with ideas, never with people.', 'Captions on for every screening.'],
    members: 64,
    extraMembers: ['ethan', 'chloe', 'liam', 'fatima', 'ben'],
  },
  {
    key: 'weekend-hikers',
    name: 'Calgary Weekend Hikers',
    cat: 'hiking',
    organizer: 'liam',
    quadrant: 'SE',
    area: 'City parks & river valleys',
    description: 'Easy-to-moderate weekend hikes inside city limits — Fish Creek, Nose Hill, Edworthy and more. Perfect if you are new to hiking.',
    guidelines: ['We hike at the pace of the slowest person.', 'Leave no trace.', 'Check the weather and dress in layers.'],
    members: 112,
    extraMembers: ['priya', 'marcus', 'chloe', 'ben'],
  },
  {
    key: 'beginner-gym',
    name: 'Beginner Gym Community',
    cat: 'fitness',
    organizer: 'marcus',
    quadrant: 'SW',
    area: 'Beltline',
    description: 'Small coached sessions for people who feel intimidated by the gym. Learn the basics with others who are starting out too.',
    guidelines: ['No judgement, ever.', 'Ask before giving advice.', 'Wipe down equipment.'],
    members: 41,
    extraMembers: ['fatima'],
  },
  {
    key: 'student-devs',
    name: 'Calgary Student Developers',
    cat: 'tech',
    organizer: 'jordan',
    quadrant: 'NW',
    area: 'University District',
    description: 'Lightning talks, project nights and study sessions for students and early-career developers across Calgary.',
    guidelines: ['Beginners first — no question is too basic.', 'Credit others for their ideas.', 'Be kind in code reviews.'],
    members: 156,
    extraMembers: ['alex', 'noor', 'ethan', 'marcus', 'liam'],
  },
  {
    key: 'yyc-jam',
    name: 'YYC Jam Sessions',
    cat: 'music',
    organizer: 'chloe',
    quadrant: 'SE',
    area: 'Inglewood',
    description: "Open jams and open mics in Inglewood, Calgary's music district. Bring an instrument or just your voice.",
    guidelines: ['Share the stage.', 'Ask before borrowing gear.', 'Ear plugs available at the door.'],
    members: 58,
    extraMembers: ['diego', 'ethan'],
  },
  {
    key: 'nose-hill-photo',
    name: 'Nose Hill Photo Collective',
    cat: 'photography',
    organizer: 'hannah',
    quadrant: 'NW',
    area: 'Nose Hill & viewpoints',
    description: 'Golden-hour photo walks at Nose Hill and the best skyline viewpoints. Phone cameras absolutely welcome.',
    guidelines: ['Ask before photographing people.', 'Stay on marked trails.', 'Share tips, not gear snobbery.'],
    members: 37,
    extraMembers: ['grace', 'jordan'],
  },
  {
    key: 'board-gamers',
    name: 'Inglewood Board Gamers',
    cat: 'games',
    organizer: 'ethan',
    quadrant: 'SE',
    area: 'Inglewood',
    description: 'Weekly board game nights with a huge shared library. We always run a newcomer table with easy-to-learn games.',
    guidelines: ['Teach before you play.', 'Newcomer table every week.', 'Good sports only.'],
    members: 45,
    extraMembers: ['jordan', 'diego', 'chloe'],
  },
  {
    key: 'neighbours-helping',
    name: 'YYC Neighbours Helping Neighbours',
    cat: 'volunteering',
    organizer: 'fatima',
    quadrant: 'NE',
    area: 'Bridgeland & Northeast Calgary',
    description: 'Hands-on volunteer shifts: community-kitchen meal prep, donation sorting and neighbourhood clean-ups.',
    guidelines: ['Food-safety briefing at every kitchen shift.', 'Respect the dignity and privacy of the people we serve.', 'No photos of guests.'],
    members: 73,
    extraMembers: ['priya', 'noor', 'hannah', 'liam', 'marcus'],
  },
  {
    key: 'language-cafe',
    name: 'Calgary Language Café',
    cat: 'language',
    organizer: 'noor',
    quadrant: 'SE',
    area: 'Central Library',
    description: 'Practice English, French, Spanish, Arabic and more with patient conversation partners. All levels welcome.',
    guidelines: ['Speak slowly and kindly.', 'Switch languages every 20 minutes.', 'Mistakes are how we learn.'],
    members: 52,
    extraMembers: ['diego', 'ben'],
  },
  {
    key: 'newcomers',
    name: 'Newcomers & Explorers YYC',
    cat: 'meetups',
    organizer: 'ben',
    quadrant: 'NE',
    area: 'Bridgeland & Downtown',
    description: 'For people new to Calgary and travellers passing through. Coffee chats, history walks and welcome socials hosted by locals.',
    guidelines: ['Everyone was new once.', 'Invite the person standing alone.', 'Share local tips generously.'],
    members: 94,
    extraMembers: ['fatima', 'noor'],
  },
]

/* ------------------------------------------------------------------ events */

type ReviewSeed = [UKey, number, number, number, number | null, boolean | null, string]

interface EventSeed {
  key: string
  series?: string
  group?: GKey
  host: UKey
  title: string
  cat: CategoryId
  venue: string
  /** Private/residential location: shown publicly as an approximate area. */
  approx?: { hood: string; label: string }
  privateDetails?: string
  day: number | 'sat' | 'sun' | 'nextSat'
  time: string
  minutes: number
  price: number
  capacity: number
  min?: number
  base: number
  going?: UKey[]
  attended?: UKey[]
  noShow?: UKey[]
  reviews?: ReviewSeed[]
  beginner: boolean
  traveller: boolean
  setting: EventSetting
  access: Partial<AccessibilityInfo>
  firstTime?: FirstTimeInfo
  equipment?: string
  guidelines?: string
  description: string
  cancelled?: string
  cover?: number
}

const SUNRISE_RUN_DESC =
  'A relaxed 5 km loop along the Bow River pathways starting from Prince\'s Island Park. Conversational pace, walk-run group available, and coffee together afterwards for anyone who wants to stay.'
const SUNRISE_RUN_FIRST: FirstTimeInfo = {
  whatToExpect: 'A 5 km loop at a chatty pace with a walk-run option. We stop at every bridge so the group stays together.',
  whatToBring: 'Running shoes, layers and a reflective or bright top. Water is optional — it is a short route.',
  experienceNeeded: 'None. If you can walk-run 5 km, you are good.',
  howToFindUs: 'South end of the Peace Bridge, look for the red Tandem flag.',
  bringAFriend: true,
}
const SUNRISE_RUN_ACCESS: Partial<AccessibilityInfo> = {
  stepFree: 'confirmed',
  quiet: 'unavailable',
  virtual: 'unavailable',
}

const BOOK_CLUB_DESC =
  'Small, cozy book club in a quiet Kensington café. This month: a short literary novel — finished or not, come for the conversation. Tea and pastries available to buy.'
const BOOK_CLUB_FIRST: FirstTimeInfo = {
  whatToExpect: 'Introductions, then an hour of relaxed discussion with 6–10 people. Nobody is put on the spot.',
  whatToBring: 'The book if you have it (e-books and audiobooks count). Nothing else.',
  experienceNeeded: 'None — you do not even need to have finished the book.',
  howToFindUs: 'Exact café is shared in the group chat after you join. Look for the table with a stack of books.',
  bringAFriend: true,
}
const BOOK_CLUB_ACCESS: Partial<AccessibilityInfo> = { quiet: 'confirmed', sensoryFriendly: 'confirmed', virtual: 'unavailable' }

const FILM_DESC =
  'Screening of a Canadian indie film followed by a relaxed discussion. Captions on, lights up for the discussion, popcorn included in the ticket.'
const FILM_ACCESS: Partial<AccessibilityInfo> = {
  wheelchair: 'confirmed',
  stepFree: 'confirmed',
  accessibleWashroom: 'confirmed',
  quiet: 'unavailable',
  virtual: 'unavailable',
}

const PHOTO_DESC =
  'Golden-hour photo walk across the Nose Hill grasslands with sweeping skyline and mountain views. Phone cameras welcome; we share composition tips as we go.'
const PHOTO_ACCESS: Partial<AccessibilityInfo> = {
  wheelchair: 'unavailable',
  stepFree: 'unavailable',
  accessibleWashroom: 'unavailable',
  quiet: 'confirmed',
  sensoryFriendly: 'confirmed',
  virtual: 'unavailable',
}

const TECH_DESC =
  'Lightning talks from students, a beginner-friendly Q&A and project show-and-tell. Pizza provided. A livestream is available for anyone who wants to join remotely.'
const TECH_FIRST: FirstTimeInfo = {
  whatToExpect: 'Three 5-minute talks, open Q&A, then small-group project chats. About 40–60 people.',
  whatToBring: 'Just yourself. A laptop is optional.',
  experienceNeeded: 'None — many attendees are just starting to code.',
  howToFindUs: 'MacEwan Hall, follow the "Student Devs" signs to the second-floor room.',
  bringAFriend: true,
}
const TECH_ACCESS: Partial<AccessibilityInfo> = {
  wheelchair: 'confirmed',
  stepFree: 'confirmed',
  accessibleWashroom: 'confirmed',
  quiet: 'unavailable',
  virtual: 'confirmed',
}

const HIKE_DESC =
  'An easy-to-moderate 8 km hike through Fish Creek Provincial Park, starting at Bow Valley Ranch. We go at the pace of the slowest hiker and stop for photos.'
const HIKE_FIRST: FirstTimeInfo = {
  whatToExpect: 'About 2.5 hours on wide, well-marked trails with a snack break by the creek.',
  whatToBring: 'Sturdy shoes, warm layers, water and a snack. Ice cleats if it has been icy.',
  experienceNeeded: 'None. The route is mostly flat with a couple of gentle hills.',
  howToFindUs: 'Bow Valley Ranch parking lot, by the visitor centre doors. Liam wears a red toque.',
  bringAFriend: true,
}
const HIKE_ACCESS: Partial<AccessibilityInfo> = {
  wheelchair: 'unavailable',
  stepFree: 'unavailable',
  accessibleWashroom: 'confirmed',
  quiet: 'confirmed',
  virtual: 'unavailable',
}

const GAMES_DESC =
  'Weekly board game night with a shared library of hundreds of games. There is always a newcomer table with quick-to-learn games and someone happy to teach.'
const GAMES_ACCESS: Partial<AccessibilityInfo> = {
  wheelchair: 'unavailable',
  stepFree: 'unavailable',
  quiet: 'unavailable',
  virtual: 'unavailable',
}

const KITCHEN_DESC =
  'Prepare and pack hot meals for a local shelter alongside friendly regulars. A short food-safety briefing is included, so no experience is needed.'
const KITCHEN_FIRST: FirstTimeInfo = {
  whatToExpect: 'A 15-minute briefing, then chopping, cooking and packing in small teams.',
  whatToBring: 'Closed-toe shoes and hair ties. Aprons and gloves are provided.',
  experienceNeeded: 'None.',
  howToFindUs: 'The exact entrance is shared with registered volunteers in the group chat.',
  bringAFriend: true,
}
const KITCHEN_ACCESS: Partial<AccessibilityInfo> = {
  wheelchair: 'confirmed',
  stepFree: 'confirmed',
  accessibleWashroom: 'confirmed',
  quiet: 'unavailable',
  sensoryFriendly: 'unavailable',
  virtual: 'unavailable',
}

const EVENT_SEEDS: EventSeed[] = [
  {
    key: 'cranston-run-club',
    host: 'priya',
    title: 'Cranston Run Club',
    cat: 'running',
    venue: 'fish-creek',
    day: 'nextSat',
    time: '09:00',
    minutes: 60,
    price: 0,
    capacity: 25,
    base: 0,
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: { quiet: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'A relaxed, social run with options to run or walk-run. We regroup along the way.',
      whatToBring: 'Running shoes, water and weather-appropriate layers.',
      experienceNeeded: 'None. All paces are welcome.',
      howToFindUs: 'The exact Cranston meeting point will be confirmed by the organizer before the event.',
      bringAFriend: true,
    },
    guidelines: 'Respect other pathway users and stay with the group.',
    description:
      'Meet fellow runners in Cranston, southeast Calgary, for a friendly community run. All paces are welcome, including beginners and walk-runners. Meeting point to be confirmed.',
  },
  /* ---------------- Bow River Sunrise Run (series) ---------------- */
  {
    key: 'sunrise-run-past-2',
    series: 'sunrise-run',
    group: 'sunrise-runners',
    host: 'priya',
    title: 'Bow River Sunrise Run',
    cat: 'running',
    venue: 'princes-island',
    day: -14,
    time: '07:00',
    minutes: 60,
    price: 0,
    capacity: 30,
    base: 11,
    attended: ['jordan', 'ben', 'chloe', 'noor'],
    reviews: [
      ['chloe', 5, 5, 5, null, true, 'Exactly as described. The walk-run group made it easy to keep up.'],
      ['noor', 4, 4, 5, null, null, 'Lovely group — a little chilly at 7am!'],
      ['jordan', 5, 5, 5, 5, true, 'Super welcoming. Nobody got left behind.'],
    ],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: SUNRISE_RUN_ACCESS,
    firstTime: SUNRISE_RUN_FIRST,
    equipment: 'Running shoes, layers, something reflective.',
    description: SUNRISE_RUN_DESC,
  },
  {
    key: 'sunrise-run-past-1',
    series: 'sunrise-run',
    group: 'sunrise-runners',
    host: 'priya',
    title: 'Bow River Sunrise Run',
    cat: 'running',
    venue: 'princes-island',
    day: -7,
    time: '07:00',
    minutes: 60,
    price: 0,
    capacity: 30,
    base: 14,
    attended: ['jordan', 'ben', 'hannah', 'marcus'],
    noShow: ['alex'],
    reviews: [
      ['ben', 5, 5, 5, null, true, 'Great pace for beginners, and the coffee afterwards was a bonus.'],
      ['hannah', 4, 5, 4, null, true, 'Loved it. Wish it started 30 minutes later in winter!'],
      ['marcus', 5, 5, 5, 5, true, 'Well organized and genuinely friendly.'],
      ['jordan', 5, 5, 5, null, true, 'My favourite way to start the week.'],
    ],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: SUNRISE_RUN_ACCESS,
    firstTime: SUNRISE_RUN_FIRST,
    equipment: 'Running shoes, layers, something reflective.',
    description: SUNRISE_RUN_DESC,
  },
  {
    key: 'sunrise-run-next',
    series: 'sunrise-run',
    group: 'sunrise-runners',
    host: 'priya',
    title: 'Bow River Sunrise Run',
    cat: 'running',
    venue: 'princes-island',
    day: 1,
    time: '07:00',
    minutes: 60,
    price: 0,
    capacity: 30,
    base: 9,
    going: ['jordan', 'hannah', 'ben'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: SUNRISE_RUN_ACCESS,
    firstTime: SUNRISE_RUN_FIRST,
    equipment: 'Running shoes, layers, something reflective.',
    guidelines: 'No-drop policy. Headphones on low volume so you can hear bikes on the pathway.',
    description: SUNRISE_RUN_DESC,
  },
  {
    key: 'sunrise-run-following',
    series: 'sunrise-run',
    group: 'sunrise-runners',
    host: 'priya',
    title: 'Bow River Sunrise Run',
    cat: 'running',
    venue: 'princes-island',
    day: 8,
    time: '07:00',
    minutes: 60,
    price: 0,
    capacity: 30,
    base: 4,
    going: ['ben'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: SUNRISE_RUN_ACCESS,
    firstTime: SUNRISE_RUN_FIRST,
    equipment: 'Running shoes, layers, something reflective.',
    description: SUNRISE_RUN_DESC,
  },

  /* ---------------- Kensington Weekend Book Club (series) ---------------- */
  {
    key: 'book-club-past',
    series: 'book-club',
    group: 'kensington-book-club',
    host: 'grace',
    title: 'Kensington Weekend Book Club',
    cat: 'reading',
    venue: 'kensington',
    approx: { hood: 'Kensington / Hillhurst', label: 'Kensington (café — exact spot shared after joining)' },
    privateDetails: 'Back room of a café on Kensington Rd NW — Grace will be at the long table by the window.',
    day: -6,
    time: '10:30',
    minutes: 90,
    price: 0,
    capacity: 12,
    base: 5,
    attended: ['noor', 'hannah', 'fatima'],
    reviews: [
      ['noor', 5, 5, 5, 5, true, 'Cozy, thoughtful and very welcoming to quiet people like me.'],
      ['hannah', 5, 5, 5, null, true, 'Grace is a wonderful host.'],
      ['fatima', 5, 4, 5, 4, true, 'Lovely conversation. The café was a bit busy at first.'],
    ],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: BOOK_CLUB_ACCESS,
    firstTime: BOOK_CLUB_FIRST,
    description: BOOK_CLUB_DESC,
  },
  {
    key: 'book-club-next',
    series: 'book-club',
    group: 'kensington-book-club',
    host: 'grace',
    title: 'Kensington Weekend Book Club',
    cat: 'reading',
    venue: 'kensington',
    approx: { hood: 'Kensington / Hillhurst', label: 'Kensington (café — exact spot shared after joining)' },
    privateDetails: 'Back room of a café on Kensington Rd NW — Grace will be at the long table by the window.',
    day: 'nextSat',
    time: '10:30',
    minutes: 90,
    price: 0,
    capacity: 12,
    base: 6,
    going: ['noor', 'hannah'],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: BOOK_CLUB_ACCESS,
    firstTime: BOOK_CLUB_FIRST,
    guidelines: 'Everyone gets a turn to talk; nobody has to.',
    description: BOOK_CLUB_DESC,
  },

  /* ---------------- YYC Film Discussion Night (series) ---------------- */
  {
    key: 'film-past',
    series: 'film-night',
    group: 'yyc-film-society',
    host: 'diego',
    title: 'YYC Film Discussion Night',
    cat: 'movies',
    venue: 'memorial-park',
    day: -5,
    time: '19:00',
    minutes: 150,
    price: 8,
    capacity: 25,
    base: 12,
    attended: ['ethan', 'chloe', 'liam', 'fatima', 'ben'],
    reviews: [
      ['ethan', 4, 4, 4, null, true, 'Great pick and a really good discussion.'],
      ['chloe', 5, 5, 5, 5, true, 'Captions on and lights up for the talk — so thoughtful.'],
      ['liam', 4, 4, 5, null, true, 'Fun night. Would go again.'],
      ['fatima', 3, 3, 4, null, false, 'Film was not for me but the people were lovely.'],
      ['ben', 4, 4, 4, null, true, 'Good mix of film buffs and casual watchers.'],
    ],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: FILM_ACCESS,
    description: FILM_DESC,
  },
  {
    key: 'film-next',
    series: 'film-night',
    group: 'yyc-film-society',
    host: 'diego',
    title: 'YYC Film Discussion Night',
    cat: 'movies',
    venue: 'memorial-park',
    day: 2,
    time: '19:00',
    minutes: 150,
    price: 8,
    capacity: 25,
    base: 10,
    going: ['ethan', 'chloe'],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: FILM_ACCESS,
    firstTime: {
      whatToExpect: 'A 90-minute film, a short break, then a relaxed 45-minute group discussion.',
      whatToBring: 'Nothing — popcorn is included.',
      experienceNeeded: 'None. You do not need to know anything about film.',
      howToFindUs: 'Library program room on the main floor; Diego will be at the door.',
      bringAFriend: true,
    },
    description: FILM_DESC,
  },

  /* ---------------- Nose Hill Photography Walk (series) ---------------- */
  {
    key: 'photo-past',
    series: 'nose-hill-photo',
    group: 'nose-hill-photo',
    host: 'hannah',
    title: 'Nose Hill Photography Walk',
    cat: 'photography',
    venue: 'nose-hill',
    day: -9,
    time: '16:00',
    minutes: 120,
    price: 0,
    capacity: 15,
    base: 6,
    attended: ['jordan', 'grace'],
    reviews: [
      ['jordan', 5, 5, 5, null, true, 'Learned more about composition in 2 hours than in a year of YouTube.'],
      ['grace', 4, 4, 4, null, null, 'Beautiful light, quite windy up top!'],
    ],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: PHOTO_ACCESS,
    description: PHOTO_DESC,
  },
  {
    key: 'photo-next',
    series: 'nose-hill-photo',
    group: 'nose-hill-photo',
    host: 'hannah',
    title: 'Nose Hill Photography Walk',
    cat: 'photography',
    venue: 'nose-hill',
    day: 5,
    time: '15:00',
    minutes: 120,
    price: 0,
    capacity: 15,
    base: 5,
    going: ['grace'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: PHOTO_ACCESS,
    equipment: 'Any camera (phones welcome), warm layers, gloves you can tap a screen with.',
    firstTime: {
      whatToExpect: 'A slow 4 km walk with stops for composition tips. Golden hour lands around 4:30 pm.',
      whatToBring: 'Any camera or phone, warm layers and water.',
      experienceNeeded: 'None.',
      howToFindUs: 'Nose Hill parking lot off 14 Street NW; Hannah carries a yellow tripod.',
      bringAFriend: true,
    },
    description: PHOTO_DESC,
  },

  /* ---------------- Calgary Student Tech Meetup (series) ---------------- */
  {
    key: 'tech-past',
    series: 'student-tech',
    group: 'student-devs',
    host: 'jordan',
    title: 'Calgary Student Tech Meetup',
    cat: 'tech',
    venue: 'ucalgary',
    day: -10,
    time: '18:00',
    minutes: 120,
    price: 0,
    capacity: 60,
    base: 30,
    attended: ['alex', 'noor', 'ethan', 'marcus', 'liam', 'fatima', 'chloe'],
    reviews: [
      ['noor', 4, 4, 4, 5, true, 'Very beginner friendly. The livestream worked well too.'],
      ['ethan', 4, 4, 5, null, true, 'Great talks, slightly too short Q&A.'],
      ['marcus', 5, 5, 5, null, true, 'Came knowing nothing and left with a project idea.'],
      ['liam', 5, 4, 5, null, true, 'Well run!'],
      ['fatima', 3, 4, 3, 4, false, 'Room was crowded, but the content was good.'],
      ['chloe', 4, 4, 4, null, true, 'Pizza + lightning talks = perfect.'],
    ],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: TECH_ACCESS,
    firstTime: TECH_FIRST,
    description: TECH_DESC,
  },
  {
    key: 'tech-next',
    series: 'student-tech',
    group: 'student-devs',
    host: 'jordan',
    title: 'Calgary Student Tech Meetup',
    cat: 'tech',
    venue: 'ucalgary',
    day: 3,
    time: '18:00',
    minutes: 120,
    price: 0,
    capacity: 60,
    base: 22,
    going: ['noor', 'ethan'],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: TECH_ACCESS,
    firstTime: TECH_FIRST,
    description: TECH_DESC,
  },

  /* ---------------- Fish Creek Weekend Hiking Group (series) ---------------- */
  {
    key: 'hike-past',
    series: 'fish-creek-hike',
    group: 'weekend-hikers',
    host: 'liam',
    title: 'Fish Creek Weekend Hiking Group',
    cat: 'hiking',
    venue: 'fish-creek',
    day: -8,
    time: '09:30',
    minutes: 180,
    price: 0,
    capacity: 20,
    base: 9,
    attended: ['priya', 'marcus', 'chloe', 'ben'],
    reviews: [
      ['priya', 5, 5, 5, null, true, 'Gorgeous route and a very patient leader.'],
      ['marcus', 5, 5, 5, null, true, 'Perfect intro hike.'],
      ['chloe', 4, 4, 5, null, true, 'Lovely morning. Bring cleats in November!'],
      ['ben', 5, 5, 4, 5, true, 'Felt totally safe as a newbie hiker.'],
    ],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: HIKE_ACCESS,
    firstTime: HIKE_FIRST,
    description: HIKE_DESC,
  },
  {
    key: 'hike-next',
    series: 'fish-creek-hike',
    group: 'weekend-hikers',
    host: 'liam',
    title: 'Fish Creek Weekend Hiking Group',
    cat: 'hiking',
    venue: 'fish-creek',
    day: 'nextSat',
    time: '09:30',
    minutes: 180,
    price: 0,
    capacity: 20,
    base: 8,
    going: ['priya', 'marcus'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: HIKE_ACCESS,
    firstTime: HIKE_FIRST,
    equipment: 'Sturdy shoes, warm layers, water, snacks; ice cleats if icy.',
    guidelines: 'We hike at the pace of the slowest person. Leave no trace.',
    description: HIKE_DESC,
  },

  /* ---------------- Inglewood Board Game Night (series) ---------------- */
  {
    key: 'games-cancelled',
    series: 'board-games',
    group: 'board-gamers',
    host: 'ethan',
    title: 'Inglewood Board Game Night',
    cat: 'games',
    venue: 'inglewood',
    day: -19,
    time: '18:30',
    minutes: 180,
    price: 5,
    capacity: 16,
    base: 0,
    cancelled: 'Venue was double-booked — sorry, everyone!',
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: GAMES_ACCESS,
    description: GAMES_DESC,
  },
  {
    key: 'games-past',
    series: 'board-games',
    group: 'board-gamers',
    host: 'ethan',
    title: 'Inglewood Board Game Night',
    cat: 'games',
    venue: 'inglewood',
    day: -12,
    time: '18:30',
    minutes: 180,
    price: 5,
    capacity: 16,
    base: 7,
    attended: ['jordan', 'chloe', 'diego'],
    reviews: [
      ['jordan', 4, 4, 4, null, true, 'Huge game library. Gets loud later in the night.'],
      ['chloe', 3, 3, 3, 2, false, 'Fun, but the room is upstairs — the listing should say so clearly.'],
      ['diego', 4, 4, 4, null, true, 'Ethan taught us three new games. Great host.'],
    ],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: GAMES_ACCESS,
    description: GAMES_DESC,
  },
  {
    key: 'games-today',
    series: 'board-games',
    group: 'board-gamers',
    host: 'ethan',
    title: 'Inglewood Board Game Night',
    cat: 'games',
    venue: 'inglewood',
    privateDetails: 'Upstairs room of a board game café on 9 Ave SE (no elevator).',
    day: 0,
    time: '18:30',
    minutes: 180,
    price: 5,
    capacity: 16,
    base: 6,
    going: ['jordan', 'diego'],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: GAMES_ACCESS,
    firstTime: {
      whatToExpect: 'A newcomer table with quick co-op games, plus bigger tables for regulars.',
      whatToBring: 'Nothing — the $5 covers the game library.',
      experienceNeeded: 'None. Someone will teach every game.',
      howToFindUs: 'Upstairs room — the venue has stairs only (no elevator).',
      bringAFriend: true,
    },
    description: GAMES_DESC,
  },

  /* ---------------- Community Kitchen Volunteer Shift (series) ---------------- */
  {
    key: 'kitchen-past',
    series: 'community-kitchen',
    group: 'neighbours-helping',
    host: 'fatima',
    title: 'Community Kitchen Volunteer Shift',
    cat: 'volunteering',
    venue: 'bridgeland',
    approx: { hood: 'Bridgeland-Riverside', label: 'Bridgeland-Riverside (exact entrance shared with volunteers)' },
    privateDetails: 'Community kitchen side entrance — ring the bell marked "Volunteers".',
    day: -4,
    time: '13:00',
    minutes: 180,
    price: 0,
    capacity: 12,
    base: 6,
    attended: ['priya', 'noor', 'hannah', 'liam', 'marcus'],
    reviews: [
      ['priya', 5, 5, 5, 5, true, 'Meaningful afternoon with kind people.'],
      ['noor', 5, 5, 5, null, true, 'Fatima makes everyone feel useful.'],
      ['hannah', 5, 5, 5, null, true, 'Will definitely come back.'],
      ['liam', 4, 4, 5, null, true, 'Busy but rewarding.'],
      ['marcus', 5, 5, 5, null, true, 'Great team, great cause.'],
    ],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: KITCHEN_ACCESS,
    firstTime: KITCHEN_FIRST,
    description: KITCHEN_DESC,
  },
  {
    key: 'kitchen-next',
    series: 'community-kitchen',
    group: 'neighbours-helping',
    host: 'fatima',
    title: 'Community Kitchen Volunteer Shift',
    cat: 'volunteering',
    venue: 'bridgeland',
    approx: { hood: 'Bridgeland-Riverside', label: 'Bridgeland-Riverside (exact entrance shared with volunteers)' },
    privateDetails: 'Community kitchen side entrance — ring the bell marked "Volunteers".',
    day: 4,
    time: '13:00',
    minutes: 180,
    price: 0,
    capacity: 12,
    min: 4,
    base: 5,
    going: ['noor'],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: KITCHEN_ACCESS,
    firstTime: KITCHEN_FIRST,
    guidelines: 'Respect the dignity and privacy of guests. No photos inside the kitchen.',
    description: KITCHEN_DESC,
  },

  /* ---------------- standalone upcoming events ---------------- */
  {
    key: 'strength-basics',
    group: 'beginner-gym',
    host: 'marcus',
    title: 'Beginner Strength Basics',
    cat: 'fitness',
    venue: 'beltline-aquatic',
    day: 2,
    time: '18:00',
    minutes: 60,
    price: 15,
    capacity: 10,
    base: 9,
    going: ['fatima'],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', accessibleWashroom: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'A coached small-group session covering squats, hinges and pushes with light weights.',
      whatToBring: 'Indoor shoes, water bottle, comfortable clothes. The $15 covers facility drop-in and coaching.',
      experienceNeeded: 'None — designed for people who have never lifted.',
      howToFindUs: 'Meet at the front desk; Marcus will walk you to the weight room.',
      bringAFriend: false,
    },
    description:
      'A no-judgement intro to strength training for absolute beginners. Learn three foundational movements with a certified trainer in a group of ten.',
  },
  {
    key: 'glenmore-ride',
    host: 'liam',
    title: 'Glenmore Reservoir Sunday Ride',
    cat: 'cycling',
    venue: 'glenmore',
    day: 'sun',
    time: '10:00',
    minutes: 150,
    price: 0,
    capacity: 25,
    base: 7,
    going: ['priya'],
    beginner: false,
    traveller: false,
    setting: 'outdoor',
    access: { wheelchair: 'unavailable', virtual: 'unavailable', quiet: 'confirmed' },
    equipment: 'Road or gravel bike in good shape, helmet (required), lights, cold-weather layers.',
    guidelines: 'Helmets required. We ride single-file on the pathway and call out passes.',
    description:
      'A steady 30 km loop around the Glenmore Reservoir pathways with a coffee stop. Intermediate pace (20–24 km/h); studded tires welcome if it is icy.',
  },
  {
    key: 'jam-session',
    group: 'yyc-jam',
    host: 'chloe',
    title: 'YYC Jam Session & Open Mic',
    cat: 'music',
    venue: 'inglewood',
    day: 3,
    time: '19:30',
    minutes: 180,
    price: 10,
    capacity: 40,
    base: 18,
    going: ['diego', 'ethan'],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: { quiet: 'unavailable', sensoryFriendly: 'unavailable', virtual: 'unavailable' },
    guidelines: '18+. Share the stage — sign-up sheet at the door. Ear plugs available.',
    description:
      'Open jam in Inglewood, Calgary\'s music district. A house band keeps things rolling; bring an instrument, sing, or just listen.',
  },
  {
    key: 'coffee-newcomers',
    group: 'newcomers',
    host: 'ben',
    title: 'Coffee & Conversation: Newcomers Meetup',
    cat: 'food',
    venue: 'bridgeland',
    day: 5,
    time: '10:00',
    minutes: 90,
    price: 0,
    capacity: 10,
    base: 4,
    going: ['fatima'],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: { stepFree: 'confirmed', quiet: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'Small tables of four or five, easy conversation prompts and local tips. Leave whenever you like.',
      whatToBring: 'Money for your own coffee (or not — no purchase needed).',
      experienceNeeded: 'None. Most people come alone.',
      howToFindUs: 'Café on 1 Ave NE — look for the small red bike sign on our table.',
      bringAFriend: true,
    },
    description:
      'New to Calgary or just visiting? Grab a coffee with friendly locals and other newcomers. Small tables, gentle conversation prompts and plenty of insider tips.',
  },
  {
    key: 'language-exchange',
    group: 'language-cafe',
    host: 'noor',
    title: 'Language Exchange: English · Español · Français',
    cat: 'language',
    venue: 'central-library',
    day: 2,
    time: '18:30',
    minutes: 120,
    price: 0,
    capacity: 30,
    base: 11,
    going: ['diego', 'ben'],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', accessibleWashroom: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'Rotating tables by language; we switch every 20 minutes. All levels welcome.',
      whatToBring: 'Curiosity. Name tags are provided.',
      experienceNeeded: 'None.',
      howToFindUs: 'Central Library, level 2 community room — follow the "Language Café" sign.',
      bringAFriend: true,
    },
    description:
      'Practise English, Spanish or French with patient conversation partners at the Central Library. Tables by language and level; we rotate every 20 minutes.',
  },
  {
    key: 'history-walk',
    group: 'newcomers',
    host: 'ben',
    title: 'Stephen Avenue History Walk',
    cat: 'culture',
    venue: 'stephen-ave',
    day: 6,
    time: '14:00',
    minutes: 90,
    price: 0,
    capacity: 20,
    base: 6,
    going: ['noor'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'A gentle 2 km walk along Stephen Avenue\'s sandstone buildings with short stories at each stop.',
      whatToBring: 'Warm layers. Stops are short and there are cafés along the way.',
      experienceNeeded: 'None.',
      howToFindUs: 'East end of Stephen Avenue at Olympic Plaza; Ben holds a red umbrella.',
      bringAFriend: true,
    },
    description:
      'Discover the stories behind downtown\'s historic sandstone buildings with a local who loves Calgary history. Flat, step-free route along the pedestrian mall.',
  },
  {
    key: 'study-hall',
    host: 'alex',
    title: 'Quiet Study Hall @ Central Library',
    cat: 'study',
    venue: 'central-library',
    day: 3,
    time: '13:00',
    minutes: 180,
    price: 0,
    capacity: 20,
    base: 5,
    going: ['noor'],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: {
      wheelchair: 'confirmed',
      stepFree: 'confirmed',
      accessibleWashroom: 'confirmed',
      quiet: 'confirmed',
      sensoryFriendly: 'confirmed',
      virtual: 'confirmed',
    },
    firstTime: {
      whatToExpect: '50-minute focus blocks with 10-minute breaks. Quiet working, optional chat on breaks.',
      whatToBring: 'Whatever you are working on, headphones if you like.',
      experienceNeeded: 'None.',
      howToFindUs: 'Level 4 quiet study area — look for the Tandem table tent.',
      bringAFriend: true,
    },
    description:
      'Exam season co-working: bring your own work and focus alongside others. Silent focus blocks, short social breaks, and a video room for anyone studying from home.',
  },
  {
    key: 'watch-party',
    host: 'diego',
    title: 'Hockey Night Watch Party on the Red Mile',
    cat: 'sports',
    venue: 'seventeenth-ave',
    day: 6,
    time: '19:00',
    minutes: 180,
    price: 0,
    capacity: 60,
    base: 26,
    going: ['liam'],
    beginner: true,
    traveller: true,
    setting: 'indoor',
    access: { quiet: 'unavailable', sensoryFriendly: 'unavailable', virtual: 'unavailable' },
    guidelines: '18+. Food and drinks are pay-your-own. Cheer loudly, be kind to the other team\'s fans.',
    description:
      'Cheer on the Flames with fellow fans at a pub on 17th Avenue SW — the legendary "Red Mile". No hockey knowledge needed; we will explain the rules between periods.',
  },
  {
    key: 'bowness-walk',
    host: 'hannah',
    title: 'Bowness Park Autumn Walk & Cocoa',
    cat: 'hiking',
    venue: 'bowness-park',
    day: 4,
    time: '11:00',
    minutes: 90,
    price: 0,
    capacity: 20,
    base: 6,
    going: ['grace'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: {
      wheelchair: 'confirmed',
      stepFree: 'confirmed',
      accessibleWashroom: 'confirmed',
      quiet: 'confirmed',
      sensoryFriendly: 'confirmed',
      virtual: 'unavailable',
    },
    firstTime: {
      whatToExpect: 'A flat, paved 3 km loop around the lagoon at an easy pace, then hot cocoa.',
      whatToBring: 'Warm layers. Cocoa is provided.',
      experienceNeeded: 'None.',
      howToFindUs: 'By the main pavilion near the lagoon; look for the red thermos.',
      bringAFriend: true,
    },
    description:
      'An easy, paved stroll around the Bowness Park lagoon followed by hot cocoa. A gentle way to meet people outdoors — perfect for a first Tandem event.',
  },
  {
    key: 'sunset-photo',
    group: 'nose-hill-photo',
    host: 'hannah',
    title: "Tom Campbell's Hill Sunset Photo Meetup",
    cat: 'photography',
    venue: 'tom-campbells-hill',
    day: 6,
    time: '16:00',
    minutes: 75,
    price: 0,
    capacity: 15,
    base: 4,
    going: ['jordan'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: { wheelchair: 'unavailable', stepFree: 'unavailable', accessibleWashroom: 'unavailable', quiet: 'confirmed', virtual: 'unavailable' },
    description:
      'Catch sunset over the downtown skyline from one of Calgary\'s best viewpoints. Short but steep walk up; tripods and phones both welcome.',
  },
  {
    key: 'prairie-winds-5k',
    host: 'fatima',
    title: 'Prairie Winds Park Community 5K',
    cat: 'running',
    venue: 'prairie-winds',
    day: 'nextSat',
    time: '10:00',
    minutes: 60,
    price: 0,
    capacity: 50,
    base: 18,
    going: ['noor', 'marcus'],
    beginner: true,
    traveller: false,
    setting: 'outdoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', virtual: 'unavailable' },
    description:
      'A friendly, untimed 5K on the paved paths of Prairie Winds Park in Northeast Calgary. Runners, walkers, strollers and wheelchair users all welcome.',
  },
  {
    key: 'food-crawl',
    host: 'chloe',
    title: 'Inglewood Food Crawl: Taste of 9th Ave',
    cat: 'food',
    venue: 'inglewood',
    day: 5,
    time: '17:30',
    minutes: 150,
    price: 35,
    capacity: 12,
    base: 10,
    going: ['ben'],
    beginner: true,
    traveller: true,
    setting: 'mixed',
    access: { virtual: 'unavailable', quiet: 'unavailable' },
    guidelines: 'Tell Chloe about dietary needs in the chat before the event — vegetarian options at every stop.',
    description:
      'Four tasting stops along 9th Avenue SE, Calgary\'s oldest main street, hosted by an Inglewood local. The $35 covers all tastings.',
  },
  {
    key: 'welcome-social',
    group: 'newcomers',
    host: 'ben',
    title: 'Calgary Welcome Social: Locals Meet Travellers',
    cat: 'meetups',
    venue: 'olympic-plaza',
    day: 4,
    time: '18:00',
    minutes: 120,
    price: 0,
    capacity: 40,
    base: 14,
    going: ['fatima', 'noor'],
    beginner: true,
    traveller: true,
    setting: 'mixed',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'Meet at Olympic Plaza, then warm up at a nearby café. Name tags say where you are from.',
      whatToBring: 'Warm layers and your favourite travel story.',
      experienceNeeded: 'None.',
      howToFindUs: 'North side of Olympic Plaza by the arches — red Tandem banner.',
      bringAFriend: true,
    },
    description:
      'Visitors and Calgarians swap stories and tips, then head somewhere warm together. The easiest way to find people to explore the city with this week.',
  },
  {
    key: 'open-data-night',
    group: 'student-devs',
    host: 'jordan',
    title: 'Open Data Hack Night: Civic Data for Good',
    cat: 'tech',
    venue: 'central-library',
    day: 9,
    time: '18:00',
    minutes: 180,
    price: 0,
    capacity: 30,
    base: 8,
    going: ['ethan'],
    beginner: true,
    traveller: false,
    setting: 'indoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', accessibleWashroom: 'confirmed', virtual: 'confirmed' },
    description:
      'Explore Government of Canada and City of Calgary open datasets in small teams and build something useful for your neighbourhood. Mentors on hand; virtual teams welcome.',
  },
  {
    key: 'skyline-sketch',
    host: 'grace',
    title: 'Skyline Sketching at Crescent Heights',
    cat: 'art',
    venue: 'crescent-heights',
    day: 5,
    time: '13:00',
    minutes: 90,
    price: 12,
    capacity: 12,
    base: 3,
    going: ['hannah'],
    beginner: true,
    traveller: true,
    setting: 'outdoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', accessibleWashroom: 'unavailable', quiet: 'confirmed', sensoryFriendly: 'confirmed', virtual: 'unavailable' },
    equipment: 'The $12 covers a sketchbook and pencils to keep. Bring a folding stool if you have one.',
    description:
      'Sketch the downtown skyline from the Crescent Heights lookout. Total beginners welcome — Grace shares a few simple techniques to get started.',
  },
  {
    key: 'confederation-5k',
    host: 'hannah',
    title: 'Confederation Park Easy 5K',
    cat: 'running',
    venue: 'confederation-park',
    day: 2,
    time: '17:30',
    minutes: 45,
    price: 0,
    capacity: 20,
    base: 6,
    going: ['grace'],
    beginner: true,
    traveller: false,
    setting: 'outdoor',
    access: { wheelchair: 'confirmed', stepFree: 'confirmed', quiet: 'confirmed', virtual: 'unavailable' },
    firstTime: {
      whatToExpect: 'An easy, paved after-work 5K through the park with walk breaks.',
      whatToBring: 'Running shoes, a headlamp or light, warm layers.',
      experienceNeeded: 'None.',
      howToFindUs: 'Parking lot off 10 Street NW; Hannah wears a red vest.',
      bringAFriend: true,
    },
    description: 'After-work easy run through Confederation Park on paved paths, with walk breaks for anyone who wants them.',
  },
]

/* ------------------------------------------------------------------ chat scripts */

type ChatLine = [UKey | null, 'message' | 'announcement' | 'system', string, number] // [from, kind, body, hoursAgo]

const CHAT_SCRIPTS: Record<string, ChatLine[]> = {
  'sunrise-run-next': [
    ['priya', 'announcement', 'We meet at the south end of the Peace Bridge at 6:55. Look for the red Tandem flag. Pace is conversational, and nobody gets dropped!', 30],
    ['hannah', 'message', 'Is it okay if I walk-run the second half? Coming back from a sore knee.', 20],
    ['priya', 'message', 'Totally! There is a walk-run group every week, so you will have company.', 19],
    ['ben', 'message', 'I will bring the coffee thermos for afterwards ☕', 6],
  ],
  'book-club-next': [
    ['grace', 'announcement', 'This month we are reading a short novel. No need to finish it, just come for the chat. The exact café is shown on the event page once you join.', 72],
    ['noor', 'message', 'Halfway through and loving it. Can\'t wait to talk about the ending (without spoilers until 11!).', 26],
  ],
  'coffee-newcomers': [
    ['ben', 'announcement', 'Look for the small red bike sign on our table. Introverts welcome: we keep tables to 4–5 people.', 40],
    ['fatima', 'message', 'I moved here last year. Happy to share tips on getting around by CTrain!', 12],
  ],
  'bowness-walk': [
    ['hannah', 'announcement', 'We will do the paved lagoon loop (about 3 km, flat). Cocoa is on me!', 48],
    ['grace', 'message', 'Bringing my camera. The light should be gorgeous.', 10],
  ],
  'tech-next': [
    ['jordan', 'announcement', 'Lightning talks + pizza. The livestream link will be posted here 10 minutes before start for anyone joining virtually.', 50],
    ['noor', 'message', 'Can first-years come? I am just learning Python.', 22],
    ['jordan', 'message', 'Absolutely. Half the room is beginners. Bring questions!', 21],
  ],
  'games-today': [
    ['ethan', 'announcement', 'Tonight: a newcomer table with quick co-op games and a big Codenames table. Heads-up that the room is upstairs (stairs only).', 28],
    ['diego', 'message', 'Saving a seat at the newcomer table for anyone coming solo 🙂', 3],
  ],
  'welcome-social': [
    ['ben', 'announcement', 'Name tags will say where you are from. We start at the arches, then walk two minutes to a warm café.', 36],
    ['noor', 'message', 'Looking forward to meeting everyone visiting this week!', 8],
  ],
  'kitchen-next': [
    ['fatima', 'announcement', 'Closed-toe shoes please! Aprons and gloves are provided. Entrance details are on the event page for registered volunteers.', 60],
  ],
  'sunrise-run-past-1': [
    ['priya', 'announcement', 'Thanks everyone. 18 of us braved the chill this morning! Same time next week. 🏃', -1],
  ],
}

/* ------------------------------------------------------------------ builder */

function dayFrom(spec: EventSeed['day'], today: Date): Date {
  if (spec === 'sat') return nextWeekday(today, 6)
  if (spec === 'sun') return nextWeekday(addDays(today, 1), 0)
  if (spec === 'nextSat') return nextWeekday(addDays(today, 1), 6)
  return addDays(today, spec)
}

function eventTimes(spec: EventSeed, now: Date): { start: Date; end: Date } {
  const today = startOfDay(now)
  const day = dayFrom(spec.day, today)
  const [h, m] = spec.time.split(':').map(Number)
  let start = new Date(day)
  start.setHours(h, m, 0, 0)
  // "Today" events must still be upcoming when the demo is seeded late in the day.
  if (spec.day === 0 && start.getTime() < now.getTime() + 45 * MINUTE) {
    start = new Date(Math.ceil((now.getTime() + 60 * MINUTE) / (30 * MINUTE)) * 30 * MINUTE)
  }
  return { start, end: addMinutes(start, spec.minutes) }
}

function buildUser(s: UserSeed, now: Date): User {
  const hood = neighbourhood(s.hood)
  const today = startOfDay(now)
  const travel = s.residency === 'visiting' || s.residency === 'planning'
  return {
    id: userId(s.key),
    firstName: s.first,
    lastName: s.last,
    email: `${s.key}@demo.tandem.ca`,
    createdAt: addDays(now, -40).toISOString(),
    isDemo: true,
    ageConfirmed: true,
    onboardingComplete: true,
    residency: s.residency,
    travelMode: travel,
    quadrant: hood?.quadrant ?? null,
    neighbourhood: s.hood,
    interests: s.interests,
    socials: s.socials ?? {},
    privacy: {
      ...DEFAULT_PRIVACY,
      profileVisibility: 'public',
      showSocialLinks: true,
      showAttendance: true,
      ...s.privacy,
    },
    comfort: { ...DEFAULT_COMFORT, ...s.comfort },
    budget: s.budget ?? { max: null, strict: false },
    availability: s.availability ?? [],
    traveller: {
      ...DEFAULT_TRAVELLER,
      ...(travel ? { arrival: toDateInput(addDays(today, 4)), departure: toDateInput(addDays(today, 7)) } : {}),
      ...s.travel,
    },
    bio: s.bio,
    avatar: { color: s.color },
    verification:
      s.verification === 'demo_verified'
        ? { status: 'demo_verified', documentType: 'passport', requestedAt: addDays(now, -30).toISOString() }
        : { status: s.verification },
    savedEventIds: [],
  }
}

export function createSeedDatabase(now: Date = new Date()): Database {
  const users = USER_SEEDS.map((s) => buildUser(s, now))

  const groups: CommunityGroup[] = GROUP_SEEDS.map((g, i) => ({
    id: groupId(g.key),
    name: g.name,
    description: g.description,
    categoryId: g.cat,
    organizerId: userId(g.organizer),
    quadrant: g.quadrant,
    area: g.area,
    guidelines: g.guidelines,
    coverVariant: i % 3,
    baseMemberCount: g.members,
    createdAt: addDays(now, -200 + i * 9).toISOString(),
    isDemo: true,
  }))

  const memberships: GroupMembership[] = GROUP_SEEDS.flatMap((g) => [
    { id: `mem-${g.key}-${g.organizer}`, groupId: groupId(g.key), userId: userId(g.organizer), role: 'organizer' as const, joinedAt: addDays(now, -180).toISOString() },
    ...g.extraMembers.map((u, i) => ({
      id: `mem-${g.key}-${u}`,
      groupId: groupId(g.key),
      userId: userId(u),
      role: 'member' as const,
      joinedAt: addDays(now, -120 + i * 7).toISOString(),
    })),
  ])

  const events: CalgaryEvent[] = []
  const registrations: EventRegistration[] = []
  const reviews: EventReview[] = []
  const messages: ChatMessage[] = []

  EVENT_SEEDS.forEach((s, index) => {
    const { start, end } = eventTimes(s, now)
    const isPast = end.getTime() < now.getTime()
    const createdAt = isPast ? addDays(start, -10) : addDays(now, -(3 + (index % 12)))
    const v = venue(s.venue)
    const hood = s.approx ? neighbourhood(s.approx.hood) : undefined
    const id = `evt-${s.key}`

    events.push({
      id,
      seriesId: s.series ? `series-${s.series}` : null,
      groupId: s.group ? groupId(s.group) : null,
      hostId: userId(s.host),
      title: s.title,
      description: s.description,
      categoryId: s.cat,
      coverVariant: index % 3,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      venue: s.key === 'cranston-run-club'
        ? {
            name: 'Cranston, Calgary (meeting point TBC)',
            area: 'Cranston',
            quadrant: 'SE',
            lat: 50.879,
            lng: -113.974,
            approximate: true,
            privateDetails: 'Organizer will confirm the meeting point before the run.',
          }
        : s.approx
        ? {
            name: s.approx.label,
            area: s.approx.hood,
            quadrant: hood?.quadrant ?? v.quadrant,
            lat: hood?.lat ?? v.lat,
            lng: hood?.lng ?? v.lng,
            approximate: true,
            privateDetails: s.privateDetails ?? '',
          }
        : { name: v.name, area: v.area, quadrant: v.quadrant, lat: v.lat, lng: v.lng, approximate: false, privateDetails: s.privateDetails ?? '' },
      price: s.price,
      capacity: s.capacity,
      minParticipants: s.min ?? null,
      beginnerFriendly: s.beginner,
      firstTime: s.firstTime ?? null,
      accessibility: { ...unconfirmedAccessibility(), ...s.access },
      setting: s.setting,
      equipment: s.equipment ?? '',
      guidelines: s.guidelines ?? '',
      travellerFriendly: s.traveller,
      visibility: 'public',
      status: s.cancelled ? 'cancelled' : 'scheduled',
      cancelReason: s.cancelled,
      baseAttendeeCount: s.base,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      isDemo: true,
    })

    const joined = (i: number) => addMinutes(createdAt, 90 + i * 37 * 60).toISOString()
    ;(s.going ?? []).forEach((u, i) =>
      registrations.push({ id: `reg-${s.key}-${u}`, eventId: id, userId: userId(u), status: 'going', joinedAt: joined(i), isDemo: true }),
    )
    ;(s.attended ?? []).forEach((u, i) =>
      registrations.push({
        id: `reg-${s.key}-${u}`,
        eventId: id,
        userId: userId(u),
        status: 'going',
        joinedAt: joined(i),
        checkedInAt: addMinutes(start, 5 + i).toISOString(),
        isDemo: true,
      }),
    )
    ;(s.noShow ?? []).forEach((u, i) =>
      registrations.push({ id: `reg-${s.key}-${u}`, eventId: id, userId: userId(u), status: 'going', joinedAt: joined(10 + i), isDemo: true }),
    )
    ;(s.reviews ?? []).forEach(([u, overall, organization, accuracy, accessibilityAccuracy, wouldReturn, comment], i) =>
      reviews.push({
        id: `rev-${s.key}-${u}`,
        eventId: id,
        userId: userId(u),
        overall,
        organization,
        accuracy,
        accessibilityAccuracy,
        wouldReturn,
        comment,
        createdAt: addMinutes(end, 120 + i * 45).toISOString(),
        isDemo: true,
      }),
    )

    // Chat: every event gets its group chat at creation time.
    messages.push({
      id: `msg-${s.key}-created`,
      eventId: id,
      userId: null,
      kind: 'system',
      body: `Group chat created for ${s.title}.`,
      createdAt: createdAt.toISOString(),
      isDemo: true,
    })
    const script = CHAT_SCRIPTS[s.key]
    if (script) {
      script.forEach(([from, kind, body, hoursAgo], i) => {
        // Negative "hoursAgo" on past events = hours after the event ended.
        const at = hoursAgo < 0 ? new Date(end.getTime() - hoursAgo * HOUR) : new Date(now.getTime() - hoursAgo * HOUR)
        const ts = at.getTime() < createdAt.getTime() ? addMinutes(createdAt, 30 + i) : at
        messages.push({ id: `msg-${s.key}-${i}`, eventId: id, userId: from ? userId(from) : null, kind, body, createdAt: ts.toISOString(), isDemo: true })
      })
    } else if (s.cancelled) {
      messages.push({
        id: `msg-${s.key}-cancelled`,
        eventId: id,
        userId: null,
        kind: 'system',
        body: `This event was cancelled by the host. Reason: ${s.cancelled}`,
        createdAt: addDays(start, -1).toISOString(),
        isDemo: true,
      })
    } else if (!isPast && s.firstTime?.howToFindUs) {
      messages.push({
        id: `msg-${s.key}-meet`,
        eventId: id,
        userId: userId(s.host),
        kind: 'announcement',
        body: `Meeting point: ${s.firstTime.howToFindUs}`,
        createdAt: addMinutes(createdAt, 60).toISOString(),
        isDemo: true,
      })
    }
  })

  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    users,
    groups,
    memberships,
    events,
    registrations,
    reviews,
    messages,
    reports: [],
  }
}
