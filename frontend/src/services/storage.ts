/**
 * Data-access layer. This is the ONLY module that touches browser storage.
 *
 * Swapping to a real backend means replacing this adapter (and making the service calls async) —
 * components never read or write storage themselves.
 *
 * localStorage is per-browser-profile: on its own it is NOT shared between people or devices. We use the
 * `storage` event so several tabs in the same browser stay in sync, and services/liveSync.ts optionally mirrors
 * changes through the Tandem Live server (server/live-server.mjs) so several devices stay in sync.
 */
import { createSeedDatabase, DB_VERSION, RATING_DEMO_EVENT_ID } from '../data/seed'
import type { Database } from '../types'

const DB_KEY = 'tandem.db.v1'
const SESSION_KEY = 'tandem.session'
const DISPLAY_KEY = 'tandem.display'
const BANNER_KEY = 'tandem.banner.dismissed'
/** Keys written before the product was renamed to Tandem. Their demo data is obsolete, so it is cleared once. */
const LEGACY_KEYS = ['tnadem.db.v1', 'tnadem.session', 'tnadem.display', 'tnadem.banner.dismissed']

export function removeLegacyKeys(): void {
  try {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }
  } catch {
    /* storage blocked — nothing to clean */
  }
}

export interface StorageAdapter {
  /** True for adapters backed by this browser's localStorage. */
  persistsInBrowser?: boolean
  load(): Database | null
  save(db: Database): { ok: true } | { ok: false; error: string }
  clear(): void
  /** Subscribe to changes made in other tabs. Returns an unsubscribe function. */
  subscribe(onChange: (db: Database | null) => void): () => void
}

export function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Database>
  return (
    v.version === DB_VERSION &&
    Array.isArray(v.users) &&
    Array.isArray(v.events) &&
    Array.isArray(v.registrations) &&
    Array.isArray(v.groups) &&
    Array.isArray(v.memberships) &&
    Array.isArray(v.reviews) &&
    Array.isArray(v.messages) &&
    Array.isArray(v.reports)
  )
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function browserAdapter(key: string): StorageAdapter {
  return {
    persistsInBrowser: true,
    load() {
      try {
        const parsed = safeParse(localStorage.getItem(key))
        return isDatabase(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    save(db) {
      try {
        localStorage.setItem(key, JSON.stringify(db))
        return { ok: true }
      } catch (e) {
        const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
        return { ok: false, error: quota ? 'Browser storage is full. Try removing your profile photo or resetting demo data.' : 'Could not save to browser storage.' }
      }
    },
    clear() {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key !== key) return
        const parsed = safeParse(e.newValue)
        onChange(isDatabase(parsed) ? parsed : null)
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}

export const localStorageAdapter = browserAdapter(DB_KEY)
export const sharedPreferencesAdapter = browserAdapter('tandem.shared.preferences.v1')

/** In-memory adapter (tests, or environments where storage is blocked). */
export function createMemoryAdapter(initial: Database | null = null): StorageAdapter {
  let current = initial
  return {
    load: () => current,
    save: (db) => {
      current = db
      return { ok: true }
    },
    clear: () => {
      current = null
    },
    subscribe: () => () => {},
  }
}

export function loadOrSeed(adapter: StorageAdapter, now = new Date()): Database {
  if (adapter.persistsInBrowser) removeLegacyKeys()
  const existing = adapter.load()
  if (existing) {
    if (existing.events.some((event) => event.id === RATING_DEMO_EVENT_ID)
        || !existing.users.some((user) => user.id === 'usr-alex' && user.isDemo)
        || !existing.users.some((user) => user.id === 'usr-jordan' && user.isDemo)) return existing

    // Add the rating fixture to older demo databases without resetting saved activity.
    const fixtures = createSeedDatabase(now)
    const upgraded = {
      ...existing,
      events: [...existing.events, ...fixtures.events.filter((event) => event.id === RATING_DEMO_EVENT_ID)],
      registrations: [...existing.registrations, ...fixtures.registrations.filter((registration) => registration.eventId === RATING_DEMO_EVENT_ID)],
    }
    adapter.save(upgraded)
    return upgraded
  }
  const seeded = createSeedDatabase(now)
  adapter.save(seeded)
  return seeded
}

/* ------------------------------------------------------------------ session (simulated auth) */

/**
 * The signed-in demo user id. Stored in sessionStorage (per tab) AND localStorage (default for new tabs),
 * so two tabs can be signed in as two different demo users and chat live with each other.
 * This is a simulated session — there are no passwords or tokens.
 */
export function loadSessionUserId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function saveSessionUserId(userId: string | null): void {
  try {
    if (userId) {
      sessionStorage.setItem(SESSION_KEY, userId)
      localStorage.setItem(SESSION_KEY, userId)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    /* storage blocked — session lives in memory only */
  }
}

/* ------------------------------------------------------------------ display preferences */

export interface DisplayPrefs {
  textScale: 1 | 1.125 | 1.25 | 1.375
  reduceMotion: boolean
  highContrast: boolean
  readableFont: boolean
  underlineLinks: boolean
}

export const DEFAULT_DISPLAY: DisplayPrefs = {
  textScale: 1,
  reduceMotion: false,
  highContrast: false,
  readableFont: false,
  underlineLinks: false,
}

export function loadDisplayPrefs(): DisplayPrefs {
  try {
    const parsed = safeParse(localStorage.getItem(DISPLAY_KEY))
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_DISPLAY, ...(parsed as Partial<DisplayPrefs>) } : DEFAULT_DISPLAY
  } catch {
    return DEFAULT_DISPLAY
  }
}

export function saveDisplayPrefs(prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function isBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissBanner(): void {
  try {
    localStorage.setItem(BANNER_KEY, '1')
  } catch {
    /* ignore */
  }
}
