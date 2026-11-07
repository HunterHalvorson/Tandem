/**
 * "Sign in with Google" via Google Identity Services. Real authentication — no passwords touch Tandem.
 * Renders Google's own (accessible) button. When no client id is configured, developers see setup instructions
 * and production builds show nothing (never a fake button).
 */
import { Info, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../../lib/googleIdentity'
import { AppError } from '../../services/db'
import { parseGoogleCredential } from '../../services/googleAuth'
import { useApp } from '../../state/AppStore'
import { useToast } from '../../state/toast'
import { BRAND } from '../../lib/brand'
import { Skeleton } from '../ui/primitives'

export function GoogleSignInButton({ mode = 'signin', next }: { mode?: 'signin' | 'signup'; next?: string | null }) {
  const { actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const container = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Keep the latest handler without re-initialising Google on every render.
  const onCredential = useRef<(credential: string) => void>(() => {})
  useEffect(() => {
    onCredential.current = (credential) => {
      try {
        const profile = parseGoogleCredential(credential, GOOGLE_CLIENT_ID ?? '')
        const res = actions.signInWithGoogle(profile)
        if (!res) return
        toast(
          res.isNew
            ? `Welcome to ${BRAND.name}, ${res.user.firstName}! Let’s set up your profile.`
            : res.linked
              ? `Google is now linked to your ${BRAND.name} account. Welcome back, ${res.user.firstName}!`
              : `Welcome back, ${res.user.firstName}!`,
        )
        const q = next ? `?next=${encodeURIComponent(next)}` : ''
        navigate(res.user.onboardingComplete ? (next ?? '/dashboard') : `/onboarding${q}`)
      } catch (e) {
        toast(e instanceof AppError ? e.message : 'Google sign-in failed. Please try again.', { tone: 'error' })
      }
    }
  })

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGoogleIdentity()
      .then((gid) => {
        if (cancelled || !container.current) return
        gid.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          callback: (r) => onCredential.current(r.credential),
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
          context: mode === 'signup' ? 'signup' : 'signin',
        })
        container.current.replaceChildren()
        gid.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          logo_alignment: 'left',
          width: Math.max(220, Math.min(400, container.current.offsetWidth || 320)),
          locale: 'en-CA',
        })
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  if (!GOOGLE_CLIENT_ID) {
    if (!import.meta.env.DEV) return null
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-mist p-3 text-sm text-ink-soft">
        <p className="flex items-start gap-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
          <span>
            <strong className="text-ink">Sign in with Google is ready but not configured.</strong> Add <code className="rounded bg-white px-1">VITE_GOOGLE_CLIENT_ID</code> to{' '}
            <code className="rounded bg-white px-1">frontend/.env.local</code> and restart <code className="rounded bg-white px-1">npm run dev</code> (see README). This note only shows in development.
          </span>
        </p>
      </div>
    )
  }

  return (
    <div>
      <div ref={container} className="flex min-h-11 w-full justify-center" />
      {state === 'loading' && <Skeleton className="h-11 w-full" />}
      {state === 'error' && (
        <p role="alert" className="flex items-start gap-2 text-sm text-brand-deep">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Couldn’t load Google sign-in (offline, or blocked by a browser extension). You can still use email or a demo account.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Google shares your name, email and profile photo with {BRAND.name} — never your password.</p>
    </div>
  )
}
