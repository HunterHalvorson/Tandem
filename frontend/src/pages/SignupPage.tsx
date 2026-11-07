import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'
import { Button, Card, Checkbox, Container, Field, Input } from '../components/ui/primitives'
import { BRAND } from '../lib/brand'
import { cn } from '../lib/cn'
import { usePageTitle } from '../lib/hooks'
import { validateSignup, type SignupErrors, type SignupInput } from '../services/users'
import { useApp } from '../state/AppStore'
import type { ResidencyStatus } from '../types'
import { safeNext } from './LoginPage'

export const RESIDENCY_OPTIONS: Array<{ value: ResidencyStatus; label: string; desc: string }> = [
  { value: 'resident', label: 'Calgary resident', desc: 'I live here' },
  { value: 'new', label: 'New to Calgary', desc: 'Moved here recently' },
  { value: 'visiting', label: 'Visiting Calgary', desc: 'In town for a while' },
  { value: 'planning', label: 'Planning a visit', desc: 'Coming soon' },
]

export function ResidencyPicker({ value, onChange, error }: { value: ResidencyStatus | ''; onChange: (v: ResidencyStatus) => void; error?: string }) {
  return (
    <fieldset id="field-residency" aria-describedby={error ? 'res-err' : undefined}>
      <legend className="mb-2 text-sm font-semibold text-ink">
        Are you a Calgarian or visiting? <span className="text-brand" aria-hidden>*</span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {RESIDENCY_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              'cursor-pointer rounded-xl border p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand',
              value === o.value ? 'border-brand bg-brand-tint/60' : 'border-line-strong hover:bg-mist',
            )}
          >
            <input type="radio" name="residency" className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="block text-sm font-semibold text-ink">{o.label}</span>
            <span className="block text-xs text-muted">{o.desc}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id="res-err" className="mt-1.5 text-sm font-medium text-brand-deep">
          ⚠ {error}
        </p>
      )}
    </fieldset>
  )
}

export default function SignupPage() {
  usePageTitle('Create your account')
  const { db, actions } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [form, setForm] = useState<SignupInput>({ firstName: '', lastName: '', email: '', password: '', ageConfirmed: false, residency: '' })
  const [errors, setErrors] = useState<SignupErrors>({})
  const [showPw, setShowPw] = useState(false)
  const summary = useRef<HTMLDivElement>(null)
  const set = (patch: Partial<SignupInput>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs = validateSignup(db, form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summary.current?.focus())
      return
    }
    const user = actions.signUp(form)
    if (user) navigate(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  }
  const errorList = Object.entries(errors).filter(([, v]) => v) as Array<[keyof SignupInput, string]>

  return (
    <Container className="max-w-xl py-10">
      <p className="text-xs font-bold tracking-wider text-brand uppercase">Step 1 of 5 · Account</p>
      <h1 className="mt-1 text-3xl font-extrabold text-ink">Join {BRAND.name}</h1>
      <p className="mt-1 text-muted">Find your people through the things you love doing.</p>
      {errorList.length > 0 && (
        <div ref={summary} tabIndex={-1} role="alert" className="mt-5 rounded-card border border-brand/40 bg-brand-tint p-4 outline-none">
          <p className="font-bold text-brand-deep">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-brand-deep">
            {errorList.map(([k, v]) => (
              <li key={k}>
                <a href={`#field-${k}`} className="underline">
                  {v}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Card className="mt-6 p-6">
        <GoogleSignInButton mode="signup" next={next} />
        <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wide text-muted uppercase" aria-hidden>
          <span className="h-px flex-1 bg-line" /> or sign up with email <span className="h-px flex-1 bg-line" />
        </div>
        <form noValidate onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="field-firstName" label="First name" required error={errors.firstName}>
              {(p) => <Input {...p} autoComplete="given-name" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />}
            </Field>
            <Field id="field-lastName" label="Last name" required error={errors.lastName} hint="Shown as an initial unless you choose otherwise.">
              {(p) => <Input {...p} autoComplete="family-name" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />}
            </Field>
          </div>
          <Field id="field-email" label="Email" required error={errors.email}>
            {(p) => <Input {...p} type="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />}
          </Field>
          <Field id="field-password" label="Password" required error={errors.password} hint="At least 8 characters with a letter and a number. Simulated: checked here, never stored.">
            {(p) => (
              <div className="relative">
                <Input {...p} type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} className="pr-12" />
                <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-mist hover:text-ink">
                  {showPw ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
                </button>
              </div>
            )}
          </Field>
          <ResidencyPicker value={form.residency} onChange={(v) => set({ residency: v })} error={errors.residency} />
          <div id="field-ageConfirmed">
            <Checkbox checked={form.ageConfirmed} onChange={(v) => set({ ageConfirmed: v })} label="I confirm I’m 18 or older" description="Tandem connects adults for in-person activities." />
            {errors.ageConfirmed && <p className="mt-1.5 text-sm font-medium text-brand-deep">⚠ {errors.ageConfirmed}</p>}
          </div>
          <Button type="submit" size="lg" className="w-full">
            <UserPlus aria-hidden /> Create account
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </Container>
  )
}
