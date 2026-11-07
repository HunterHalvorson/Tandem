import { ArrowRight, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'
import { LogoMark } from '../components/brand/Logo'
import { Avatar, Button, Card, Container, Field, Input } from '../components/ui/primitives'
import { FEATURED_DEMO_ACCOUNTS } from '../data/seed'
import { BRAND } from '../lib/brand'
import { usePageTitle } from '../lib/hooks'
import { getUser } from '../services/db'
import { findUserByEmail } from '../services/users'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'

export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

export default function LoginPage() {
  usePageTitle('Sign in')
  const { db, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const go = (userId: string) => {
    if (!actions.signIn(userId)) return
    const u = getUser(db, userId)!
    toast(`Welcome back, ${u.firstName}!`, { tone: 'info' })
    navigate(u.onboardingComplete ? next ?? '/dashboard' : `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  }

  return (
    <Container className="grid grid-cols-1 max-w-6xl gap-10 py-10 lg:grid-cols-[1fr_440px] lg:py-16">
      <div>
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Welcome to {BRAND.name}</h1>
        <p className="mt-2 max-w-xl text-lg text-muted">Continue with Google, pick a demo account to explore instantly, or sign in with an account you created in this browser.</p>

        <h2 className="mt-8 mb-3 text-sm font-bold tracking-wide text-muted uppercase">Demo accounts</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {FEATURED_DEMO_ACCOUNTS.map((a) => {
            const u = getUser(db, a.id)
            if (!u) return null
            return (
              <li key={a.id}>
                <button type="button" onClick={() => go(u.id)} className="group flex h-full w-full flex-col items-start gap-3 rounded-card border border-line bg-white p-4 text-left shadow-card transition hover:border-brand/50 hover:shadow-lift">
                  <span className="flex items-center gap-3">
                    <Avatar user={u} size="md" />
                    <span>
                      <span className="block font-bold text-ink">{u.firstName} {u.lastName}</span>
                      <span className="block text-xs font-semibold text-brand">{a.persona}</span>
                    </span>
                  </span>
                  <span className="text-sm text-muted">{a.story}</span>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-ink group-hover:text-brand">
                    Continue as {u.firstName} <ArrowRight aria-hidden className="size-4" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-6 text-sm text-muted">
          New here?{' '}
          <Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand hover:underline">
            Create an account
          </Link>{' '}
          — it takes about a minute.
        </p>
      </div>

      <Card className="h-fit p-6">
        <div className="mb-5 flex items-center gap-3">
          <LogoMark className="h-8 w-auto" />
          <h2 className="text-xl font-bold">Sign in</h2>
        </div>
        <GoogleSignInButton next={next} />
        <div className="my-5 flex items-center gap-3 text-xs font-semibold tracking-wide text-muted uppercase" aria-hidden>
          <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const u = findUserByEmail(db, email)
            if (!u) {
              setError('No account with that email exists in this browser. Try a demo account or create one.')
              return
            }
            setError('')
            go(u.id)
          }}
          className="space-y-4"
        >
          <Field label="Email" error={error || undefined}>
            {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password" hint="Simulated sign-in: this demo never stores passwords, so any password works for accounts created in this browser.">
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" className="w-full">
            <KeyRound aria-hidden /> Sign in
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Email sign-in is simulated in this prototype (passwords are never stored), so it only works for accounts created in this browser. Google sign-in is real.
        </p>
      </Card>
    </Container>
  )
}
