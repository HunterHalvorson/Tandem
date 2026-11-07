/**
 * Google Identity Services ("Sign in with Google") — the pure, testable part.
 *
 * The browser receives a signed ID token (JWT) from Google. This prototype has no server, so we decode the token and
 * sanity-check its claims (audience = our client id, issuer = Google, not expired). A production deployment must verify
 * the token's signature on a server (or use a managed auth provider) before trusting it.
 */
import { AppError } from './db'
import type { GoogleProfile } from './users'

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

function base64UrlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

interface IdTokenClaims {
  iss?: string
  aud?: string
  sub?: string
  exp?: number
  email?: string
  email_verified?: boolean | string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

export function parseGoogleCredential(credential: string, clientId: string, now: Date = new Date()): GoogleProfile {
  const parts = credential.split('.')
  if (parts.length !== 3) throw new AppError('Google sign-in returned an unexpected response. Please try again.')
  let claims: IdTokenClaims
  try {
    claims = JSON.parse(base64UrlDecode(parts[1])) as IdTokenClaims
  } catch {
    throw new AppError('Google sign-in returned an unreadable response. Please try again.')
  }
  if (claims.aud !== clientId) throw new AppError('This Google sign-in was issued for a different app.')
  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) throw new AppError('That sign-in didn’t come from Google.')
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now.getTime()) throw new AppError('Your Google sign-in expired. Please try again.')
  if (!claims.sub || !claims.email) throw new AppError('Google didn’t share an account id and email, so we couldn’t sign you in.')
  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    givenName: claims.given_name ?? '',
    familyName: claims.family_name ?? '',
    name: claims.name ?? '',
    picture: claims.picture,
  }
}
