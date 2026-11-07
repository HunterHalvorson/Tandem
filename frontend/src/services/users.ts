/** Accounts (simulated auth), profile updates, simulated verification, data export and deletion. */
import { AVATAR_COLORS, DEFAULT_COMFORT, DEFAULT_PRIVACY, DEFAULT_TRAVELLER } from '../data/seed'
import { uid } from '../lib/ids'
import type { Database, ResidencyStatus, User, Verification } from '../types'
import { AppError, requireUser, verificationStatus } from './db'

export interface SignupInput {
  firstName: string
  lastName: string
  email: string
  /** Validated for the demo but NEVER stored (spec: no passwords in localStorage). */
  password: string
  ageConfirmed: boolean
  residency: ResidencyStatus | ''
}

export type SignupErrors = Partial<Record<keyof SignupInput, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function findUserByEmail(db: Database, email: string): User | undefined {
  const e = email.trim().toLowerCase()
  return db.users.find((u) => u.email.toLowerCase() === e)
}

export function validateSignup(db: Database, input: SignupInput): SignupErrors {
  const errors: SignupErrors = {}
  if (!input.firstName.trim()) errors.firstName = 'Enter your first name.'
  else if (input.firstName.trim().length > 40) errors.firstName = 'Keep it under 40 characters.'
  if (!input.lastName.trim()) errors.lastName = 'Enter your last name.'
  else if (input.lastName.trim().length > 40) errors.lastName = 'Keep it under 40 characters.'
  if (!input.email.trim()) errors.email = 'Enter your email address.'
  else if (!EMAIL_RE.test(input.email.trim())) errors.email = 'Enter an email like name@example.com.'
  else if (findUserByEmail(db, input.email)) errors.email = 'An account with this email already exists in this browser. Sign in instead.'
  if (input.password.length < 8) errors.password = 'Use at least 8 characters.'
  else if (!/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) errors.password = 'Include at least one letter and one number.'
  if (!input.ageConfirmed) errors.ageConfirmed = 'You must be 18 or older to join in-person events.'
  if (!input.residency) errors.residency = 'Let us know whether you live in or are visiting Calgary.'
  return errors
}

export function createAccount(db: Database, input: SignupInput, now: Date): { db: Database; user: User } {
  const errors = validateSignup(db, input)
  if (Object.keys(errors).length) throw new AppError('Please fix the highlighted fields.')
  const residency = input.residency as ResidencyStatus
  const user = newUserRecord(db, now, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    ageConfirmed: true,
    residency,
    travelMode: residency === 'visiting' || residency === 'planning',
    authProvider: 'email',
  })
  return { db: { ...db, users: [...db.users, user] }, user }
}

/** A fresh, privacy-first account record (members-only profile, nothing optional shared). */
function newUserRecord(db: Database, now: Date, fields: Pick<User, 'firstName' | 'lastName' | 'email' | 'ageConfirmed' | 'residency' | 'travelMode'> & Partial<User>): User {
  return {
    id: uid('usr'),
    createdAt: now.toISOString(),
    isDemo: false,
    onboardingComplete: false,
    quadrant: null,
    neighbourhood: null,
    interests: [],
    socials: {},
    privacy: { ...DEFAULT_PRIVACY },
    comfort: { ...DEFAULT_COMFORT },
    budget: { max: null, strict: false },
    availability: [],
    traveller: { ...DEFAULT_TRAVELLER },
    bio: '',
    avatar: { color: AVATAR_COLORS[db.users.length % AVATAR_COLORS.length] },
    verification: { status: 'unverified' },
    savedEventIds: [],
    ...fields,
  }
}

export function sharedUser(db: Database, fields: Pick<User, 'id' | 'firstName' | 'email'> & Partial<User>): User {
  return newUserRecord(db, new Date(), {
    lastName: '', ageConfirmed: false, residency: 'resident', travelMode: false,
    ...fields,
  })
}

/** The identity claims we use from a Google ID token (see services/googleAuth.ts). */
export interface GoogleProfile {
  sub: string
  email: string
  emailVerified: boolean
  givenName: string
  familyName: string
  name: string
  picture?: string
}

/**
 * Sign in with Google: returning Google users get their existing profile; a verified Google email that matches an
 * account created in this browser is linked to it; otherwise a new profile is created and the person continues to
 * onboarding (where they confirm age and residency). Nothing from Google is stored except the stable account id,
 * name, email and — optionally — the profile photo URL. The ID token itself is never stored.
 */
export function signInWithGoogle(db: Database, profile: GoogleProfile, now: Date): { db: Database; user: User; isNew: boolean; linked: boolean } {
  if (!profile.sub || !profile.email) throw new AppError('Google didn’t share an account id and email, so we couldn’t sign you in.')
  const existing = db.users.find((u) => u.googleSub === profile.sub)
  if (existing) return { db, user: existing, isNew: false, linked: false }

  const byEmail = findUserByEmail(db, profile.email)
  if (byEmail) {
    if (byEmail.isDemo) throw new AppError('That email belongs to a demo account. Use the demo account button instead.')
    if (byEmail.googleSub) throw new AppError('This email is already linked to a different Google account.')
    if (!profile.emailVerified) throw new AppError('Google hasn’t verified this email, so we can’t link it to the existing account. Sign in with email instead.')
    const user: User = { ...byEmail, googleSub: profile.sub, authProvider: 'google' }
    return { db: { ...db, users: db.users.map((u) => (u.id === user.id ? user : u)) }, user, isNew: false, linked: true }
  }

  const nameParts = profile.name.trim().split(/\s+/).filter(Boolean)
  const user = newUserRecord(db, now, {
    firstName: (profile.givenName || nameParts[0] || 'Friend').slice(0, 40),
    lastName: (profile.familyName || nameParts.slice(1).join(' ')).slice(0, 40),
    email: profile.email.trim().toLowerCase(),
    ageConfirmed: false,
    residency: 'resident',
    travelMode: false,
    authProvider: 'google',
    googleSub: profile.sub,
  })
  if (profile.picture?.startsWith('https://')) user.avatar = { ...user.avatar, photo: profile.picture }
  return { db: { ...db, users: [...db.users, user] }, user, isNew: true, linked: false }
}

export function updateUser(db: Database, userId: string, patch: Partial<Omit<User, 'id' | 'email' | 'createdAt' | 'isDemo'>>): Database {
  requireUser(db, userId)
  return { ...db, users: db.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)) }
}

/**
 * Simulated identity verification. NO document images or numbers are collected or stored —
 * only the document *type* the user says they would use. Production would hand off to a
 * third-party provider and store only the pass/fail result.
 */
export function requestVerification(db: Database, userId: string, documentType: Verification['documentType'], now: Date): Database {
  const user = requireUser(db, userId)
  const status = verificationStatus(user, now)
  if (status === 'demo_verified') throw new AppError('Your account already has the demo verification badge.')
  if (status === 'pending') throw new AppError('Verification is already in progress.')
  return updateUser(db, userId, { verification: { status: 'pending', documentType, requestedAt: now.toISOString() } })
}

export function resetVerification(db: Database, userId: string): Database {
  return updateUser(db, userId, { verification: { status: 'unverified' } })
}

/** Everything this browser stores about a user (privacy transparency: "Download my data"). */
export function exportUserData(db: Database, userId: string) {
  const user = requireUser(db, userId)
  return {
    exportedAt: new Date().toISOString(),
    note: 'Tandem hackathon demo — this data only exists in your browser\'s local storage.',
    profile: user,
    registrations: db.registrations.filter((r) => r.userId === userId),
    hostedEvents: db.events.filter((e) => e.hostId === userId),
    reviews: db.reviews.filter((r) => r.userId === userId),
    messages: db.messages.filter((m) => m.userId === userId),
    groupMemberships: db.memberships.filter((m) => m.userId === userId),
    reports: db.reports.filter((r) => r.reporterId === userId),
  }
}

/** Delete an account and everything that references it (hosted events, their chats, registrations…). */
export function deleteAccount(db: Database, userId: string): Database {
  requireUser(db, userId)
  const hosted = new Set(db.events.filter((e) => e.hostId === userId).map((e) => e.id))
  const organized = new Set(db.groups.filter((g) => g.organizerId === userId).map((g) => g.id))
  return {
    ...db,
    users: db.users.filter((u) => u.id !== userId),
    events: db.events.filter((e) => !hosted.has(e.id)).map((e) => (e.groupId && organized.has(e.groupId) ? { ...e, groupId: null } : e)),
    groups: db.groups.filter((g) => !organized.has(g.id)),
    memberships: db.memberships.filter((m) => m.userId !== userId && !organized.has(m.groupId)),
    registrations: db.registrations.filter((r) => r.userId !== userId && !hosted.has(r.eventId)),
    reviews: db.reviews.filter((r) => r.userId !== userId && !hosted.has(r.eventId)),
    messages: db.messages.filter((m) => m.userId !== userId && !hosted.has(m.eventId)),
    reports: db.reports.filter((r) => r.reporterId !== userId),
  }
}
