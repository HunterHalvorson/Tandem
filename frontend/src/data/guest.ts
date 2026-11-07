import type { User } from '../types'
import { DEFAULT_COMFORT, DEFAULT_PRIVACY, DEFAULT_TRAVELLER } from './seed'

/** A signed-out "guest" profile so planners and previews work before anyone has an account. */
export const GUEST_USER: User = {
  id: 'guest',
  firstName: 'Guest',
  lastName: '',
  email: '',
  createdAt: new Date(0).toISOString(),
  isDemo: false,
  ageConfirmed: false,
  onboardingComplete: false,
  residency: 'visiting',
  travelMode: true,
  quadrant: null,
  neighbourhood: null,
  interests: [],
  socials: {},
  privacy: DEFAULT_PRIVACY,
  comfort: DEFAULT_COMFORT,
  budget: { max: null, strict: false },
  availability: [],
  traveller: DEFAULT_TRAVELLER,
  bio: '',
  avatar: { color: '#202124' },
  verification: { status: 'unverified' },
  savedEventIds: [],
}
