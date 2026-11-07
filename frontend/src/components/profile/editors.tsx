/** Controlled editors shared by onboarding and settings: privacy, Comfort & Access, social links. */
import { CheckCircle2, Eye, Globe, Lock, Users } from 'lucide-react'
import { useState } from 'react'
import { ACCESS_FEATURES } from '../../data/accessibility'
import { cn } from '../../lib/cn'
import { SOCIALS, validateSocial } from '../../services/socials'
import type { AccessibilityPreferences, AvailabilitySlot, PrivacySettings, ProfileVisibility, SocialLinks, SocialPlatform } from '../../types'
import { ACCESS_ICON } from '../events/visuals'
import { Checkbox, Chip, Field, Input, Select, Switch, Textarea } from '../ui/primitives'

export function PrivacyEditor({ value, onChange }: { value: PrivacySettings; onChange: (v: PrivacySettings) => void }) {
  const set = (patch: Partial<PrivacySettings>) => onChange({ ...value, ...patch })
  const options: Array<{ v: ProfileVisibility; label: string; desc: string; icon: typeof Globe }> = [
    { v: 'public', label: 'Public', desc: 'Anyone viewing an event can open your profile.', icon: Globe },
    { v: 'members', label: 'Members only', desc: 'Only signed-in members can see it.', icon: Users },
    { v: 'private', label: 'Private', desc: 'Only you. Hosts see your first name on their event.', icon: Lock },
  ]
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Who can see your profile?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {options.map((o) => (
            <label
              key={o.v}
              className={cn(
                'cursor-pointer rounded-xl border p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand',
                value.profileVisibility === o.v ? 'border-brand bg-brand-tint/60' : 'border-line-strong hover:bg-mist',
              )}
            >
              <input type="radio" name="profile-visibility" className="sr-only" checked={value.profileVisibility === o.v} onChange={() => set({ profileVisibility: o.v })} />
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <o.icon aria-hidden className="size-4" /> {o.label}
              </span>
              <span className="mt-1 block text-xs text-muted">{o.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-3.5">
        <Switch checked={value.showFullName} onChange={(v) => set({ showFullName: v })} label="Show my full last name" description="Off: people see “Alex R.” instead of your full name." />
        <Switch checked={value.showLocation} onChange={(v) => set({ showLocation: v })} label="Show my approximate area" description="Your quadrant or neighbourhood — never an address." />
        <Switch checked={value.showInterests} onChange={(v) => set({ showInterests: v })} label="Show my interests" />
        <Switch checked={value.showSocialLinks} onChange={(v) => set({ showSocialLinks: v })} label="Show my linked social profiles" />
        <Switch checked={value.showAttendance} onChange={(v) => set({ showAttendance: v })} label="Show events I’ve attended" />
        <Switch
          checked={value.showAccessibility}
          onChange={(v) => set({ showAccessibility: v })}
          label="Show my Comfort & Access preferences"
          description="Off by default. Your preferences still improve your recommendations privately."
        />
      </div>
    </div>
  )
}

const BUDGETS: Array<{ value: string; label: string }> = [
  { value: '', label: 'No budget limit' },
  { value: '0', label: 'Free only' },
  { value: '10', label: 'Up to $10' },
  { value: '20', label: 'Up to $20' },
  { value: '40', label: 'Up to $40' },
  { value: '75', label: 'Up to $75' },
]

export function ComfortEditor({
  comfort,
  budget,
  availability,
  onChange,
}: {
  comfort: AccessibilityPreferences
  budget: { max: number | null; strict: boolean }
  availability: AvailabilitySlot[]
  onChange: (v: { comfort: AccessibilityPreferences; budget: { max: number | null; strict: boolean }; availability: AvailabilitySlot[] }) => void
}) {
  const set = (patch: Partial<AccessibilityPreferences>) => onChange({ comfort: { ...comfort, ...patch }, budget, availability })
  const toggleFeature = (f: (typeof ACCESS_FEATURES)[number]['id']) => {
    const has = comfort.features.includes(f)
    set({ features: has ? comfort.features.filter((x) => x !== f) : [...comfort.features, f], essential: has ? comfort.essential.filter((x) => x !== f) : comfort.essential })
  }
  const toggleEssential = (f: (typeof ACCESS_FEATURES)[number]['id']) =>
    set({ essential: comfort.essential.includes(f) ? comfort.essential.filter((x) => x !== f) : [...comfort.essential, f] })
  const slots: Array<{ v: AvailabilitySlot; label: string }> = [
    { v: 'weekdayDaytime', label: 'Weekday daytime' },
    { v: 'weekdayEvening', label: 'Weekday evenings' },
    { v: 'weekend', label: 'Weekends' },
  ]
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-mist px-3 py-2 text-sm text-ink-soft">
        <Lock aria-hidden className="mr-1 inline size-4 align-[-3px]" />
        Optional and private by default. We ask about <strong>practical preferences</strong>, never diagnoses or medical details. You can change or delete these any time.
      </p>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">I’m most comfortable with…</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Checkbox checked={comfort.smallGroups} onChange={(v) => set({ smallGroups: v })} label="Small groups" description="12 people or fewer" />
          <Checkbox checked={comfort.beginnerFriendly} onChange={(v) => set({ beginnerFriendly: v })} label="Beginner-friendly activities" description="No experience needed" />
          <Checkbox checked={comfort.prefersFree} onChange={(v) => set({ prefersFree: v })} label="Free activities" />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Access features I look for</legend>
        <p className="mb-3 text-xs text-muted">Mark a feature as a <strong>must-have</strong> and we’ll never recommend events that haven’t confirmed it.</p>
        <ul className="space-y-2">
          {ACCESS_FEATURES.map((f) => {
            const Icon = ACCESS_ICON[f.id]
            const on = comfort.features.includes(f.id)
            return (
              <li key={f.id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border p-3', on ? 'border-brand/40 bg-brand-tint/40' : 'border-line')}>
                <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" className="size-4.5" checked={on} onChange={() => toggleFeature(f.id)} />
                  <Icon aria-hidden className="size-4.5 text-ink-soft" />
                  <span>
                    <span className="font-semibold text-ink">{f.label}</span>
                    <span className="block text-xs text-muted">{f.description}</span>
                  </span>
                </label>
                {on && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-white px-3 py-1 text-xs font-semibold">
                    <input type="checkbox" checked={comfort.essential.includes(f.id)} onChange={() => toggleEssential(f.id)} />
                    Must-have
                  </label>
                )}
              </li>
            )
          })}
        </ul>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Budget per event">
          {(p) => (
            <Select {...p} value={budget.max === null ? '' : String(budget.max)} onChange={(e) => onChange({ comfort, availability, budget: { ...budget, max: e.target.value === '' ? null : Number(e.target.value) } })}>
              {BUDGETS.map((b) => (
                <option key={b.label} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:pt-7">
          <Checkbox checked={budget.strict} onChange={(v) => onChange({ comfort, availability, budget: { ...budget, strict: v } })} label="Never recommend events over my budget" />
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">When are you usually free?</legend>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <Chip key={s.v} selected={availability.includes(s.v)} onToggle={() => onChange({ comfort, budget, availability: availability.includes(s.v) ? availability.filter((x) => x !== s.v) : [...availability, s.v] })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Field label="Anything else hosts could help with?" optional hint="For example dietary considerations. Private — never shown on your profile.">
        {(p) => <Textarea {...p} rows={2} maxLength={300} value={comfort.privateNotes} onChange={(e) => set({ privateNotes: e.target.value })} />}
      </Field>
      <div className={cn('rounded-xl border p-4', comfort.easeIntoIt ? 'border-brand/40 bg-brand-tint/50' : 'border-line')}>
        <Switch
          checked={comfort.easeIntoIt}
          onChange={(v) => set({ easeIntoIt: v })}
          label="Ease Into It"
          description="Prioritise smaller, beginner-friendly, low-pressure events with clear arrival details. Turn it on or off whenever you like."
        />
      </div>
    </div>
  )
}

export function SocialLinksEditor({ value, onChange }: { value: SocialLinks; onChange: (v: SocialLinks) => void }) {
  const [drafts, setDrafts] = useState<Partial<Record<SocialPlatform, string>>>(value)
  const [errors, setErrors] = useState<Partial<Record<SocialPlatform, string>>>({})
  const commit = (p: SocialPlatform) => {
    const res = validateSocial(p, drafts[p] ?? '')
    if (!res.ok) {
      setErrors((e) => ({ ...e, [p]: res.error }))
      return
    }
    setErrors((e) => ({ ...e, [p]: undefined }))
    setDrafts((d) => ({ ...d, [p]: res.url }))
    const next = { ...value }
    if (res.url) next[p] = res.url
    else delete next[p]
    onChange(next)
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SOCIALS.map((s) => (
        <Field key={s.id} label={s.label} optional error={errors[s.id]} hint={value[s.id] && !errors[s.id] ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 aria-hidden className="size-3.5" /> Looks good</span> : undefined}>
          {(p) => (
            <Input
              {...p}
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder={s.placeholder}
              value={drafts[s.id] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
              onBlur={() => commit(s.id)}
            />
          )}
        </Field>
      ))}
      <p className="text-xs text-muted sm:col-span-2">
        <Eye aria-hidden className="mr-1 inline size-3.5 align-[-2px]" /> We only check the link’s format — there’s no account connection or data import (no OAuth).
      </p>
    </div>
  )
}
