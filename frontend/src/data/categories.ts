import type { CategoryId, Interest } from '../types'

/** Muted colour families for category covers. Brand red stays reserved for actions and highlights. */
export type Tone = 'sky' | 'sage' | 'sand' | 'blush' | 'lilac' | 'slate'

export const TONES: Record<Tone, { bg: string; ink: string; soft: string }> = {
  sky: { bg: '#E8F0FA', ink: '#1D4E89', soft: '#C9DCF2' },
  sage: { bg: '#E7F3EB', ink: '#1E6B3A', soft: '#C4E2CF' },
  sand: { bg: '#F7EFE4', ink: '#7A4A1D', soft: '#EBD7BC' },
  blush: { bg: '#FBEAED', ink: '#9B1026', soft: '#F3C7CF' },
  lilac: { bg: '#F0EBF8', ink: '#4B2E83', soft: '#D9CCEE' },
  slate: { bg: '#ECEFF3', ink: '#2E3A48', soft: '#CDD5DF' },
}

export interface CategoryDef extends Interest {
  /** Plural noun used in discovery copy, e.g. "Running clubs". */
  eventLabel: string
  tone: Tone
  /** Words recognised by the smart search / voice search parser. */
  keywords: string[]
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  running: {
    id: 'running',
    label: 'Running & athletics',
    phrase: 'running',
    eventLabel: 'Running clubs',
    description: 'Run clubs, 5Ks and pathway jogs at every pace.',
    tone: 'sage',
    keywords: ['run', 'runs', 'running', 'runner', 'runners', 'jog', 'jogging', '5k', '10k', 'athletics'],
  },
  fitness: {
    id: 'fitness',
    label: 'Gym & fitness',
    phrase: 'fitness',
    eventLabel: 'Gym meetups',
    description: 'Strength sessions, workout buddies and beginner gym groups.',
    tone: 'slate',
    keywords: ['gym', 'fitness', 'workout', 'workouts', 'strength', 'weights', 'lifting', 'exercise'],
  },
  cycling: {
    id: 'cycling',
    label: 'Cycling',
    phrase: 'cycling',
    eventLabel: 'Cycling events',
    description: 'Pathway rides, gravel loops and bike workshops.',
    tone: 'sky',
    keywords: ['bike', 'bikes', 'biking', 'cycling', 'cyclist', 'ride', 'rides', 'riding'],
  },
  hiking: {
    id: 'hiking',
    label: 'Hiking & outdoors',
    phrase: 'hiking and the outdoors',
    eventLabel: 'Hiking groups',
    description: 'Park walks, river valley trails and weekend hikes.',
    tone: 'sage',
    keywords: ['hike', 'hikes', 'hiking', 'hiker', 'hikers', 'trail', 'trails', 'outdoor adventures', 'nature', 'walk', 'walks'],
  },
  reading: {
    id: 'reading',
    label: 'Reading & literature',
    phrase: 'reading',
    eventLabel: 'Reading clubs',
    description: 'Book clubs, poetry nights and quiet reading hours.',
    tone: 'sand',
    keywords: ['book', 'books', 'reading', 'read', 'literature', 'novel', 'poetry', 'book club'],
  },
  movies: {
    id: 'movies',
    label: 'Movies & cinema',
    phrase: 'movies',
    eventLabel: 'Movie nights',
    description: 'Film clubs, screenings and discussion nights.',
    tone: 'lilac',
    keywords: ['movie', 'movies', 'film', 'films', 'cinema', 'screening'],
  },
  music: {
    id: 'music',
    label: 'Music & bands',
    phrase: 'music',
    eventLabel: 'Local bands & jam sessions',
    description: 'Jam sessions, open mics and local gigs.',
    tone: 'blush',
    keywords: ['music', 'band', 'bands', 'jam', 'jams', 'open mic', 'concert', 'gig', 'singing', 'choir'],
  },
  art: {
    id: 'art',
    label: 'Art & creativity',
    phrase: 'art and creativity',
    eventLabel: 'Art & making',
    description: 'Sketch nights, crafts and creative workshops.',
    tone: 'lilac',
    keywords: ['art', 'arts', 'sketch', 'sketching', 'drawing', 'painting', 'paint', 'craft', 'crafts', 'creative'],
  },
  tech: {
    id: 'tech',
    label: 'Tech & programming',
    phrase: 'technology',
    eventLabel: 'Technology meetups',
    description: 'Coding meetups, hack nights and tech talks.',
    tone: 'sky',
    keywords: ['tech', 'technology', 'coding', 'code', 'programming', 'developer', 'developers', 'hackathon', 'hack', 'software', 'data'],
  },
  games: {
    id: 'games',
    label: 'Board games & gaming',
    phrase: 'board games',
    eventLabel: 'Board game nights',
    description: 'Board game cafés, tabletop RPGs and casual gaming.',
    tone: 'lilac',
    keywords: ['game', 'games', 'board game', 'board games', 'boardgame', 'gaming', 'tabletop', 'dnd', 'cards'],
  },
  food: {
    id: 'food',
    label: 'Food & coffee',
    phrase: 'food and coffee',
    eventLabel: 'Coffee meetups',
    description: 'Coffee chats, food crawls and potlucks.',
    tone: 'sand',
    keywords: ['coffee', 'cafe', 'café', 'food', 'brunch', 'lunch', 'dinner', 'eat', 'eating', 'foodie', 'potluck'],
  },
  volunteering: {
    id: 'volunteering',
    label: 'Volunteering',
    phrase: 'volunteering',
    eventLabel: 'Volunteer opportunities',
    description: 'Meal prep, donation drives and neighbourhood clean-ups.',
    tone: 'blush',
    keywords: ['volunteer', 'volunteers', 'volunteering', 'charity', 'shelter', 'donate', 'donation', 'help out', 'giving back'],
  },
  photography: {
    id: 'photography',
    label: 'Photography',
    phrase: 'photography',
    eventLabel: 'Photography walks',
    description: 'Photo walks, golden-hour meetups and editing nights.',
    tone: 'slate',
    keywords: ['photo', 'photos', 'photography', 'photographer', 'camera', 'photowalk'],
  },
  language: {
    id: 'language',
    label: 'Language exchange',
    phrase: 'language exchange',
    eventLabel: 'Language exchanges',
    description: 'Practice a new language with friendly locals.',
    tone: 'sky',
    keywords: ['language', 'languages', 'spanish', 'french', 'english', 'conversation', 'exchange', 'esl'],
  },
  culture: {
    id: 'culture',
    label: 'Cultural experiences',
    phrase: 'cultural experiences',
    eventLabel: 'Cultural experiences',
    description: 'History walks, festivals and cultural celebrations.',
    tone: 'sand',
    keywords: ['culture', 'cultural', 'history', 'heritage', 'museum', 'festival', 'tour'],
  },
  study: {
    id: 'study',
    label: 'Study groups',
    phrase: 'studying with others',
    eventLabel: 'Study groups',
    description: 'Co-working sessions and exam-season study halls.',
    tone: 'slate',
    keywords: ['study', 'studying', 'homework', 'exam', 'exams', 'cowork', 'coworking'],
  },
  sports: {
    id: 'sports',
    label: 'Recreational sports',
    phrase: 'recreational sports',
    eventLabel: 'Recreational sports',
    description: 'Pickup games, rec leagues and game-night watch parties.',
    tone: 'sage',
    keywords: ['sport', 'sports', 'hockey', 'flames', 'basketball', 'soccer', 'volleyball', 'pickleball', 'pickup', 'skating'],
  },
  meetups: {
    id: 'meetups',
    label: 'Traveller & local meetups',
    phrase: 'meeting locals and travellers',
    eventLabel: 'Traveller & local meetups',
    description: 'Welcome socials where visitors and Calgarians connect.',
    tone: 'blush',
    keywords: ['meetup', 'meetups', 'social', 'travellers', 'travelers', 'locals', 'newcomers', 'newcomer', 'welcome'],
  },
}

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[]

export function category(id: CategoryId): CategoryDef {
  return CATEGORIES[id]
}

/** Loosely related interests (used for partial interest matches in recommendations). */
export const RELATED: Partial<Record<CategoryId, CategoryId[]>> = {
  running: ['fitness', 'sports', 'hiking'],
  fitness: ['running', 'sports'],
  cycling: ['hiking', 'running'],
  hiking: ['photography', 'cycling', 'running'],
  reading: ['study', 'language', 'culture'],
  movies: ['art', 'culture', 'music'],
  music: ['art', 'movies', 'culture'],
  art: ['photography', 'music', 'culture'],
  tech: ['study', 'games'],
  games: ['tech', 'movies'],
  food: ['culture', 'meetups'],
  volunteering: ['meetups', 'food'],
  photography: ['hiking', 'art'],
  language: ['culture', 'meetups', 'reading'],
  culture: ['food', 'meetups', 'art'],
  study: ['reading', 'tech'],
  sports: ['running', 'fitness'],
  meetups: ['food', 'culture', 'language'],
}
