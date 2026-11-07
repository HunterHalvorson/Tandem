import { useState } from 'react'
import { Navigate } from 'react-router'
import { supabase } from '../../services/supabase'
import { useApp } from '../../state/AppStore'
import { Button, Card, Container } from '../ui/primitives'

export function SharedSignIn({ next }: { next: string | null }) {
  const { user } = useApp()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  if (user) {
    const destination = user.onboardingComplete
      ? next ?? '/dashboard'
      : `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`
    return <Navigate to={destination} replace />
  }

  return (
    <Container className="max-w-lg py-12">
      <Card className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Sign in to Tandem</h1>
        <p className="text-ink-soft">Use your Google account to join events and collaborate with other members.</p>
        <Button
          disabled={pending}
          onClick={async () => {
            if (!supabase || pending) return
            setPending(true)
            setError('')
            try {
              const redirectTo = new URL('/login', window.location.origin)
              if (next) redirectTo.searchParams.set('next', next)
              const result = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectTo.href },
              })
              if (result.error) throw result.error
            } catch {
              setError('Google sign-in couldn’t start. Please try again.')
              setPending(false)
            }
          }}
        >
          {pending ? 'Opening Google…' : 'Continue with Google'}
        </Button>
        {error && <p role="alert" className="text-brand-deep">{error}</p>}
      </Card>
    </Container>
  )
}
