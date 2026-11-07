import { ArrowLeft, ArrowRight, Check, Compass, LayoutDashboard, Map as MapIcon, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { EventCard } from '../components/events/EventCard'
import { CategoryIcon } from '../components/events/visuals'
import { ComfortEditor, PrivacyEditor, SocialLinksEditor } from '../components/profile/editors'
import { ProfileView } from '../components/profile/ProfileView'
import { Button, ButtonLink, Card, Checkbox, Container, Field, Input, Select } from '../components/ui/primitives'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { NEIGHBOURHOODS, QUADRANT_INFO, QUADRANTS } from '../data/calgary'
import { cn } from '../lib/cn'
import { toDateInput } from '../lib/dates'
import { usePageTitle } from '../lib/hooks'
import { recommendEvents } from '../services/recommendations'
import { useApp } from '../state/AppStore'
import type { CategoryId, Quadrant, ResidencyStatus, User } from '../types'
import { safeNext } from './LoginPage'
import { ResidencyPicker } from './SignupPage'

const STEP_TITLES = ['Location', 'Interests', 'Social connections', 'Privacy & comfort']

export default function OnboardingPage() {
  const { user } = useApp()
  usePageTitle('Set up your profile')
  if (!user) return null
  return <Onboarding user={user} />
}

function Onboarding({ user }: { user: User }) {
  const { db, now, actions } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [step, setStep] = useState(user.onboardingComplete ? 4 : 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 2 — location (+ 18+ confirmation for people who joined with Google)
  const [ageConfirmed, setAgeConfirmed] = useState(user.ageConfirmed)
  const [residency, setResidency] = useState<ResidencyStatus>(user.residency)
  const [quadrant, setQuadrant] = useState<Quadrant | null>(user.quadrant)
  const [hood, setHood] = useState(user.neighbourhood ?? '')
  const [arrival, setArrival] = useState(user.traveller.arrival ?? '')
  const [departure, setDeparture] = useState(user.traveller.departure ?? '')
  const [homeCity, setHomeCity] = useState(user.traveller.homeCity)
  // Step 3 — interests
  const [interests, setInterests] = useState<CategoryId[]>(user.interests)
  // Step 5 — privacy & comfort
  const [privacy, setPrivacy] = useState(user.privacy)
  const [comfort, setComfort] = useState({ comfort: user.comfort, budget: user.budget, availability: user.availability })

  const travelling = residency === 'visiting' || residency === 'planning'
  const recs = useMemo(() => (step === 4 ? recommendEvents(db, user, now, { limit: 3 }) : []), [step, db, user, now])
  const preview: User = { ...user, privacy, interests, residency, quadrant, neighbourhood: hood || null, comfort: comfort.comfort, travelMode: travelling }

  const go = (n: number) => {
    setError('')
    setStep(n)
    window.scrollTo({ top: 0 })
  }

  const saveStep = async () => {
    if (saving) return
    if (step === 0) {
      if (!ageConfirmed) return setError('Please confirm you’re 18 or older — Tandem connects adults for in-person activities.')
      if (!travelling && !quadrant) return setError('Choose the quadrant you’ll mostly be exploring (you can change it later).')
      if (travelling && arrival && departure && departure < arrival) return setError('Your departure date must be after your arrival date.')
      actions.updateProfile({
        ageConfirmed: true,
        residency,
        travelMode: travelling,
        quadrant: travelling ? quadrant : quadrant,
        neighbourhood: travelling ? null : hood || null,
        traveller: { ...user.traveller, arrival: arrival || null, departure: departure || null, homeCity: homeCity.trim() },
      })
    }
    if (step === 1) {
      if (!interests.length) return setError('Pick at least one interest so we can suggest activities.')
      actions.updateProfile({ interests })
    }
    if (step === 3) {
      setSaving(true)
      try {
        if (!await actions.updateProfile({ privacy, comfort: comfort.comfort, budget: comfort.budget, availability: comfort.availability, onboardingComplete: true })) return
      } finally {
        setSaving(false)
      }
    }
    go(step + 1)
  }

  if (step === 4)
    return (
      <Container className="max-w-5xl py-10">
        <div className="text-center">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-brand text-white">
            <PartyPopper aria-hidden className="size-7" />
          </span>
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">You’re all set, {user.firstName}!</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted">Less scrolling, more doing — here are three things you could join right now, picked from your interests and preferences.</p>
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {recs.map((r) => (
            <li key={r.event.id} className="flex min-w-0">
              <EventCard event={r.event} rec={r} className="w-full" headingLevel={2} />
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {next && (
            <Button size="lg" onClick={() => navigate(next)}>
              Continue where you left off <ArrowRight aria-hidden />
            </Button>
          )}
          <ButtonLink to="/discover" size="lg" variant={next ? 'secondary' : 'primary'}>
            <Compass aria-hidden /> Discover events
          </ButtonLink>
          <ButtonLink to="/map" size="lg" variant="secondary">
            <MapIcon aria-hidden /> Explore Calgary map
          </ButtonLink>
          <ButtonLink to="/dashboard" size="lg" variant="secondary">
            <LayoutDashboard aria-hidden /> Go to dashboard
          </ButtonLink>
        </div>
      </Container>
    )

  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Sign-up progress">
        {['Account', ...STEP_TITLES].map((t, i) => (
          <li key={t} aria-current={i === step + 1 ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full', i <= step + 1 ? 'bg-brand' : 'bg-line')} />
            <span className={cn('mt-2 hidden items-center gap-1 text-xs font-semibold sm:flex', i === step + 1 ? 'text-brand-deep' : 'text-muted')}>
              {i < step + 1 && <Check aria-hidden className="size-3.5" />}
              {t}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs font-bold tracking-wider text-brand uppercase">
        Step {step + 2} of 5 · {STEP_TITLES[step]}
      </p>

      {step === 0 && (
        <section aria-labelledby="s-loc">
          <h1 id="s-loc" className="mt-1 text-3xl font-extrabold text-ink">Where will you be exploring?</h1>
          <p className="mt-1 text-muted">We never need your home address — a quadrant is plenty.</p>
          {user.authProvider === 'google' && (
            <p className="mt-3 rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
              ✓ Signed in with Google as <strong>{user.email}</strong>. Your name and photo came from Google — you can change them on your profile.
            </p>
          )}
          <Card className="mt-6 space-y-6 p-6">
            {!user.ageConfirmed && (
              <Checkbox checked={ageConfirmed} onChange={setAgeConfirmed} label="I confirm I’m 18 or older" description="Tandem connects adults for in-person activities." />
            )}
            <ResidencyPicker value={residency} onChange={setResidency} />
            {!travelling ? (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-ink">Which part of Calgary?</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUADRANTS.map((q) => (
                      <label
                        key={q}
                        className={cn(
                          'cursor-pointer rounded-xl border p-3.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand',
                          quadrant === q ? 'border-brand bg-brand-tint/60' : 'border-line-strong hover:bg-mist',
                        )}
                      >
                        <input
                          type="radio"
                          name="quadrant"
                          className="sr-only"
                          checked={quadrant === q}
                          onChange={() => {
                            setQuadrant(q)
                            setHood('')
                          }}
                        />
                        <span className="flex items-center gap-2 font-bold text-ink">
                          <span className="rounded-md bg-ink px-1.5 py-0.5 text-xs text-white">{q}</span> {QUADRANT_INFO[q].name}
                        </span>
                        <span className="mt-1 block text-xs text-muted">{QUADRANT_INFO[q].blurb}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {quadrant && (
                  <Field label="Neighbourhood" optional hint="Helps with “closest to me” sorting. Shown only if you choose to share your area.">
                    {(p) => (
                      <Select {...p} value={hood} onChange={(e) => setHood(e.target.value)}>
                        <option value="">Prefer not to say</option>
                        {NEIGHBOURHOODS.filter((n) => n.quadrant === quadrant).map((n) => (
                          <option key={n.name} value={n.name}>
                            {n.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <p className="rounded-lg bg-brand-tint/60 px-3 py-2 text-sm text-brand-deep">
                  ✈️ <strong>Travel mode</strong> will be on — you’ll get Explore Like a Local picks for your dates.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Arriving" optional>
                    {(p) => <Input {...p} type="date" min={toDateInput(now)} value={arrival} onChange={(e) => setArrival(e.target.value)} />}
                  </Field>
                  <Field label="Leaving" optional>
                    {(p) => <Input {...p} type="date" min={arrival || toDateInput(now)} value={departure} onChange={(e) => setDeparture(e.target.value)} />}
                  </Field>
                </div>
                <Field label="Visiting from" optional>
                  {(p) => <Input {...p} value={homeCity} onChange={(e) => setHomeCity(e.target.value)} placeholder="e.g. Toronto, ON" />}
                </Field>
              </div>
            )}
          </Card>
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="s-int">
          <h1 id="s-int" className="mt-1 text-3xl font-extrabold text-ink">What do you love doing?</h1>
          <p className="mt-1 text-muted">Pick as many as you like — we use these to personalise discovery. ({interests.length} selected)</p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_IDS.map((c) => {
              const on = interests.includes(c)
              return (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setInterests((xs) => (on ? xs.filter((x) => x !== c) : [...xs, c]))}
                    className={cn(
                      'flex h-full w-full items-start gap-3 rounded-card border p-4 text-left transition-colors',
                      on ? 'border-brand bg-brand-tint/60 shadow-card' : 'border-line bg-white hover:border-ink/30',
                    )}
                  >
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', on ? 'bg-brand text-white' : 'bg-mist text-ink')}>
                      {on ? <Check aria-hidden className="size-5" strokeWidth={3} /> : <CategoryIcon id={c} className="size-5" />}
                    </span>
                    <span>
                      <span className="block font-semibold text-ink">{CATEGORIES[c].label}</span>
                      <span className="block text-xs text-muted">{CATEGORIES[c].description}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="s-soc">
          <h1 id="s-soc" className="mt-1 text-3xl font-extrabold text-ink">Link your other profiles</h1>
          <p className="mt-1 text-muted">Optional. Handy for sharing Strava routes or Letterboxd lists with your groups. You control who sees them in the next step.</p>
          <Card className="mt-6 p-6">
            <SocialLinksEditor value={user.socials} onChange={(socials) => actions.updateProfile({ socials })} />
          </Card>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="s-priv">
          <h1 id="s-priv" className="mt-1 text-3xl font-extrabold text-ink">Your privacy, your comfort</h1>
          <p className="mt-1 text-muted">Decide what others see, and tell us what makes an event work for you.</p>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-bold">What others can see</h2>
                <PrivacyEditor value={privacy} onChange={setPrivacy} />
              </Card>
              <Card className="p-6" >
                <h2 id="comfort" className="mb-4 text-lg font-bold">Comfort & Access</h2>
                <ComfortEditor comfort={comfort.comfort} budget={comfort.budget} availability={comfort.availability} onChange={setComfort} />
              </Card>
            </div>
            <div className="lg:sticky lg:top-20 lg:self-start">
              <p className="mb-2 text-sm font-bold text-ink">Live preview — what members see</p>
              <div className="pointer-events-none max-h-[70vh] overflow-hidden rounded-card opacity-95 [&_h2]:text-xl">
                {privacy.profileVisibility === 'private' ? (
                  <Card className="p-6 text-sm text-muted">Your profile is private. Other members only see your first name and initial on events you join.</Card>
                ) : (
                  <ProfileView user={preview} asPublic />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-brand/40 bg-brand-tint px-4 py-3 text-sm font-medium text-brand-deep">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <div className="flex gap-2">
          {step === 2 && (
            <Button variant="secondary" onClick={() => go(3)}>
              Skip for now
            </Button>
          )}
          <Button onClick={saveStep} disabled={saving} size="lg">
            {step === 3 ? 'Finish' : 'Continue'} <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </Container>
  )
}
