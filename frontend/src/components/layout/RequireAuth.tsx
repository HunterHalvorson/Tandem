import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useApp } from '../../state/AppStore'

/** Simulated auth guard: signed-out users go to /login; unfinished onboarding resumes first. */
export function RequireAuth({ children, allowIncomplete = false }: { children: ReactNode; allowIncomplete?: boolean }) {
  const { user } = useApp()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (!user.onboardingComplete && !allowIncomplete) return <Navigate to={`/onboarding?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}
