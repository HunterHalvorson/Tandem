import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button, Checkbox, Container, Field, Select } from '../components/ui/primitives'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { QUADRANT_INFO, QUADRANTS } from '../data/calgary'
import { usePageTitle } from '../lib/hooks'
import { useApp } from '../state/AppStore'
import type { CategoryId, Quadrant, ResidencyStatus } from '../types'
import { safeNext } from './LoginPage'
import { RESIDENCY_OPTIONS } from './SignupPage'

export default function OnboardingPage() {
  const { user, actions } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const destination = safeNext(params.get('next')) ?? '/discover'
  const [ageConfirmed, setAgeConfirmed] = useState(user?.ageConfirmed ?? false)
  const [residency, setResidency] = useState<ResidencyStatus>(user?.residency ?? 'resident')
  const [quadrant, setQuadrant] = useState<Quadrant | null>(user?.quadrant ?? null)
  const [interests, setInterests] = useState<CategoryId[]>(user?.interests ?? [])
  const [saving, setSaving] = useState(false)
  usePageTitle('Set up your profile')

  if (!user) return null
  if (user.onboardingComplete) return <Navigate to={destination} replace />

  return (
    <Container className="max-w-xl py-10">
      <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.firstName}</h1>
      <p className="mt-2 text-muted">Choose an area or a few interests to personalize your event suggestions.</p>
      <form className="mt-6 space-y-5" onSubmit={async (event) => {
        event.preventDefault()
        if (!ageConfirmed || saving) return
        setSaving(true)
        try {
          if (await actions.updateProfile({
            ageConfirmed, quadrant, interests, residency, onboardingComplete: true,
            travelMode: residency === 'visiting' || residency === 'planning',
            neighbourhood: quadrant === user.quadrant ? user.neighbourhood : null,
          })) navigate(destination, { replace: true })
        } finally {
          setSaving(false)
        }
      }}>
        {!user.ageConfirmed && (
          <Checkbox checked={ageConfirmed} onChange={setAgeConfirmed} label="I confirm I’m 18 or older" />
        )}
        {user.authProvider === 'google' && (
          <Field label="How do you know Calgary?">
            {(props) => (
              <Select {...props} value={residency} onChange={(event) => setResidency(event.target.value as ResidencyStatus)}>
                {RESIDENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            )}
          </Field>
        )}
        <Field label="Calgary area" optional>
          {(props) => (
            <Select {...props} value={quadrant ?? ''} onChange={(event) => setQuadrant((event.target.value || null) as Quadrant | null)}>
              <option value="">All Calgary</option>
              {QUADRANTS.map((area) => <option key={area} value={area}>{QUADRANT_INFO[area].name}</option>)}
            </Select>
          )}
        </Field>
        <details className="border-y border-line py-3">
          <summary className="cursor-pointer py-2 font-semibold">Interests <span className="font-normal text-muted">· {interests.length ? `${interests.length} selected` : 'Optional'}</span></summary>
          <fieldset className="grid grid-cols-1 gap-2 pt-3 pb-1 sm:grid-cols-2">
            <legend className="sr-only">Event interests</legend>
            {CATEGORY_IDS.map((category) => (
              <Checkbox key={category} label={CATEGORIES[category].label} checked={interests.includes(category)}
                onChange={(checked) => setInterests((current) => checked ? [...current, category] : current.filter((item) => item !== category))} />
            ))}
          </fieldset>
        </details>
        <Button type="submit" disabled={!ageConfirmed || saving}>{saving ? 'Saving…' : 'Find events'}</Button>
        <p className="text-sm text-muted">You can update these choices from your profile at any time.</p>
      </form>
    </Container>
  )
}
