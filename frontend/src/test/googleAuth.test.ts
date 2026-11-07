import { describe, expect, it } from 'vitest'
import { createSeedDatabase } from '../data/seed'
import { AppError, getUser } from '../services/db'
import { parseGoogleCredential } from '../services/googleAuth'
import { createAccount, signInWithGoogle, type GoogleProfile } from '../services/users'

const NOW = new Date(2026, 10, 8, 9, 0, 0)
const CLIENT = 'test-client.apps.googleusercontent.com'
// base64url without Node's Buffer (app code is typed for the browser).
const b64 = (o: object) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const token = (claims: Record<string, unknown>) =>
  `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '1234567890', exp: Math.floor(NOW.getTime() / 1000) + 3600, email: 'zoe@example.com', email_verified: true, name: 'Zoë Côté', given_name: 'Zoë', family_name: 'Côté', picture: 'https://lh3.googleusercontent.com/a/photo', ...claims })}.signature`

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: 'g-1',
  email: 'jamie@gmail.com',
  emailVerified: true,
  givenName: 'Jamie',
  familyName: 'Nguyen',
  name: 'Jamie Nguyen',
  picture: 'https://lh3.googleusercontent.com/a/x',
  ...over,
})

describe('Google ID token parsing', () => {
  it('reads the claims we use (including non-ASCII names)', () => {
    const p = parseGoogleCredential(token({}), CLIENT, NOW)
    expect(p).toMatchObject({ sub: '1234567890', email: 'zoe@example.com', emailVerified: true, givenName: 'Zoë', familyName: 'Côté' })
  })
  it('rejects tokens for another app, from another issuer, or expired', () => {
    expect(() => parseGoogleCredential(token({ aud: 'someone-else' }), CLIENT, NOW)).toThrow(AppError)
    expect(() => parseGoogleCredential(token({ iss: 'https://evil.example' }), CLIENT, NOW)).toThrow(AppError)
    expect(() => parseGoogleCredential(token({ exp: Math.floor(NOW.getTime() / 1000) - 10 }), CLIENT, NOW)).toThrow(/expired/)
    expect(() => parseGoogleCredential('not-a-jwt', CLIENT, NOW)).toThrow(AppError)
  })
})

describe('Sign in with Google', () => {
  it('creates a profile on first sign-in, then signs the same person back in', () => {
    const first = signInWithGoogle(createSeedDatabase(NOW), profile(), NOW)
    expect(first.isNew).toBe(true)
    expect(first.user).toMatchObject({ firstName: 'Jamie', lastName: 'Nguyen', authProvider: 'google', googleSub: 'g-1', ageConfirmed: false, onboardingComplete: false })
    expect(first.user.avatar.photo).toContain('googleusercontent')
    const again = signInWithGoogle(first.db, profile(), NOW)
    expect(again.isNew).toBe(false)
    expect(again.user.id).toBe(first.user.id)
    expect(again.db.users.length).toBe(first.db.users.length)
    expect(JSON.stringify(again.db)).not.toContain('signature')
  })
  it('links a verified Google email to an existing email account instead of duplicating it', () => {
    const created = createAccount(createSeedDatabase(NOW), { firstName: 'Jamie', lastName: 'N', email: 'jamie@gmail.com', password: 'calgary2026', ageConfirmed: true, residency: 'new' }, NOW)
    const res = signInWithGoogle(created.db, profile(), NOW)
    expect(res.linked).toBe(true)
    expect(res.user.id).toBe(created.user.id)
    expect(getUser(res.db, created.user.id)?.googleSub).toBe('g-1')
    expect(() => signInWithGoogle(created.db, profile({ emailVerified: false }), NOW)).toThrow(AppError)
  })
  it('never hijacks demo accounts and handles single-word names', () => {
    expect(() => signInWithGoogle(createSeedDatabase(NOW), profile({ email: 'alex@demo.tandem.ca' }), NOW)).toThrow(/demo account/)
    const res = signInWithGoogle(createSeedDatabase(NOW), profile({ sub: 'g-2', email: 'cher@gmail.com', givenName: '', familyName: '', name: 'Cher' }), NOW)
    expect(res.user.firstName).toBe('Cher')
    expect(res.user.lastName).toBe('')
  })
})
