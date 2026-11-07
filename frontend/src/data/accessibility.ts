import type { AccessFeature, AccessStatus, AccessibilityInfo } from '../types'

export interface AccessFeatureDef {
  id: AccessFeature
  label: string
  /** Short form for cards. */
  short: string
  description: string
}

export const ACCESS_FEATURES: AccessFeatureDef[] = [
  {
    id: 'wheelchair',
    label: 'Wheelchair accessible',
    short: 'Wheelchair',
    description: 'Route, entrance and activity area are usable by wheelchair users.',
  },
  {
    id: 'stepFree',
    label: 'Step-free access',
    short: 'Step-free',
    description: 'No stairs or steps are needed to reach or take part.',
  },
  {
    id: 'accessibleWashroom',
    label: 'Accessible washrooms',
    short: 'Accessible washroom',
    description: 'An accessible washroom is available at or next to the venue.',
  },
  {
    id: 'quiet',
    label: 'Quiet environment',
    short: 'Quiet',
    description: 'Low background noise; easy to hear and talk.',
  },
  {
    id: 'sensoryFriendly',
    label: 'Sensory-friendly',
    short: 'Sensory-friendly',
    description: 'Lower sensory stimulation: no loud music, harsh lighting or crowds.',
  },
  {
    id: 'virtual',
    label: 'Virtual participation available',
    short: 'Virtual option',
    description: 'You can join remotely (video call or stream).',
  },
]

export const ACCESS_FEATURE_IDS = ACCESS_FEATURES.map((f) => f.id)

export function accessFeature(id: AccessFeature): AccessFeatureDef {
  return ACCESS_FEATURES.find((f) => f.id === id)!
}

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  confirmed: 'Confirmed by organizer',
  unconfirmed: 'Not yet confirmed',
  unavailable: 'Not available',
}

/** Default for new events: nothing is assumed. */
export function unconfirmedAccessibility(): AccessibilityInfo {
  return {
    wheelchair: 'unconfirmed',
    stepFree: 'unconfirmed',
    accessibleWashroom: 'unconfirmed',
    quiet: 'unconfirmed',
    sensoryFriendly: 'unconfirmed',
    virtual: 'unconfirmed',
  }
}

export function confirmedFeatures(info: AccessibilityInfo): AccessFeature[] {
  return ACCESS_FEATURE_IDS.filter((id) => info[id] === 'confirmed')
}
