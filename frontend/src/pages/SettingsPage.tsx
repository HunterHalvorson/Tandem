import { Download, Fingerprint, Loader2, LogOut, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { VerificationBadge } from '../components/events/EventBits'
import { ComfortEditor, PrivacyEditor } from '../components/profile/editors'
import { Dialog } from '../components/ui/Dialog'
import { Button, Card, Container, Field, Input, Segmented, Switch } from '../components/ui/primitives'
import { BRAND } from '../lib/brand'
import { toDateInput } from '../lib/dates'
import { usePageTitle } from '../lib/hooks'
import { downloadFile } from '../lib/ics'
import { DEMO_VERIFICATION_DELAY_MS, verificationStatus } from '../services/db'
import { useApp } from '../state/AppStore'
import { useDisplay } from '../state/display'
import { useToast } from '../state/toast'
import type { Verification } from '../types'

const SECTIONS = [
  ['privacy', 'Privacy'],
  ['comfort', 'Comfort & Access'],
  ['display', 'Display'],
  ['travel', 'Travel mode'],
  ['verification', 'Verification'],
  ['data', 'Your data'],
] as const

export default function SettingsPage() {
  usePageTitle('Privacy & accessibility settings')
  const { user, now, actions, shared } = useApp()
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const { prefs, update } = useDisplay()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [resetOpen, setResetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView())
  }, [hash])

  if (!user) return null
  const saved = () => toast('Saved.', { tone: 'info', duration: 1800 })

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Privacy & accessibility</h1>
      <p className="mt-1 text-muted">{shared ? "Changes save automatically. Your display name and attendance visibility sync across the shared workspace." : "Changes save automatically and live only in this browser."}</p>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink-soft hover:bg-mist hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-8">
          <SettingsCard id="privacy" title="Privacy" description="Choose what other members can see. Accessibility preferences are private unless you opt in.">
            <fieldset disabled={savingPrivacy}>
              <legend className="sr-only">Profile privacy</legend>
              <PrivacyEditor value={user.privacy} onChange={async (privacy) => {
                setSavingPrivacy(true)
                try {
                  if (await actions.updateProfile({ privacy })) saved()
                } finally {
                  setSavingPrivacy(false)
                }
              }} />
            </fieldset>
          </SettingsCard>

          <SettingsCard id="comfort" title="Comfort & Access" description="Practical preferences that shape your recommendations. Never medical labels.">
            <ComfortEditor
              comfort={user.comfort}
              budget={user.budget}
              availability={user.availability}
              onChange={(v) => {
                actions.updateProfile(v)
                saved()
              }}
            />
          </SettingsCard>

          <SettingsCard id="display" title="Display & reading" description="Also available any time from the accessibility button in the header.">
            <p className="mb-2 text-sm font-semibold">Text size</p>
            <Segmented
              label="Text size"
              value={String(prefs.textScale) as '1'}
              onChange={(v) => update({ textScale: Number(v) as 1 })}
              options={[
                { value: '1', label: 'Default' },
                { value: '1.125', label: 'Large' },
                { value: '1.25', label: 'Larger' },
                { value: '1.375', label: 'Largest' },
              ]}
            />
            <div className="mt-5 space-y-4">
              <Switch checked={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" description="We also follow your device’s reduced-motion setting automatically." />
              <Switch checked={prefs.highContrast} onChange={(v) => update({ highContrast: v })} label="High contrast" />
              <Switch checked={prefs.readableFont} onChange={(v) => update({ readableFont: v })} label="Readable font (Atkinson Hyperlegible)" />
              <Switch checked={prefs.underlineLinks} onChange={(v) => update({ underlineLinks: v })} label="Always underline links" />
            </div>
            <p className="mt-5 text-sm text-muted">Speech: use “Read aloud” on any event page, or the microphone in Discover search to search by voice (supported browsers).</p>
          </SettingsCard>

          <SettingsCard id="travel" title="Travel mode" description="Visiting Calgary? Travel mode shows Explore Like a Local picks and your itinerary on the dashboard.">
            <Switch
              checked={user.travelMode}
              onChange={(v) => {
                actions.updateProfile({ travelMode: v })
                saved()
              }}
              label="Travel mode"
              description={user.travelMode ? 'On — your profile shows you’re visiting.' : 'Off'}
            />
            {user.travelMode && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Arriving">
                  {(p) => <Input {...p} type="date" min={toDateInput(now)} value={user.traveller.arrival ?? ''} onChange={(e) => actions.updateProfile({ traveller: { ...user.traveller, arrival: e.target.value || null } })} />}
                </Field>
                <Field label="Leaving">
                  {(p) => <Input {...p} type="date" min={user.traveller.arrival ?? toDateInput(now)} value={user.traveller.departure ?? ''} onChange={(e) => actions.updateProfile({ traveller: { ...user.traveller, departure: e.target.value || null } })} />}
                </Field>
                <Field label="Visiting from">
                  {(p) => <Input {...p} value={user.traveller.homeCity} onChange={(e) => actions.updateProfile({ traveller: { ...user.traveller, homeCity: e.target.value } })} />}
                </Field>
              </div>
            )}
          </SettingsCard>

          <SettingsCard id="verification" title="Identity verification (simulated)" description="Builds trust without judging anyone.">
            <VerificationFlow />
          </SettingsCard>

          <SettingsCard id="data" title="Your data" description={shared ? "Collaboration data is shared through Supabase. Your profile preferences, reviews and reports are stored in this browser." : `Everything ${BRAND.name} knows about you lives in this browser’s local storage.`}>
            <p className="mb-4 rounded-lg bg-mist px-3 py-2 text-sm text-ink-soft">
              <strong className="text-ink">Signed in with:</strong>{' '}
              {user.authProvider === 'google' ? `Google (${user.email})` : user.isDemo ? 'Demo account (simulated sign-in)' : `Email — ${user.email} (simulated sign-in)`}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  const data = actions.exportMyData()
                  if (data) downloadFile(`tandem-my-data-${toDateInput(now)}.json`, JSON.stringify(data, null, 2), 'application/json')
                }}
              >
                <Download aria-hidden /> Download my data
              </Button>
              {!shared && <Button variant="secondary" onClick={() => setResetOpen(true)}>
                <RotateCcw aria-hidden /> Reset demo data
              </Button>}
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden /> Delete my account
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!await actions.signOut()) return
                  navigate('/')
                }}
              >
                <LogOut aria-hidden /> Sign out
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted">
              Passwords, government IDs and medical information are never stored. {!shared && "Reset regenerates the demo world with dates starting today."}
            </p>
          </SettingsCard>
        </div>
      </div>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all demo data?"
        description="This clears every account, event, message and review in this browser and regenerates the seeded Calgary demo with fresh dates."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                actions.resetDemo()
                setResetOpen(false)
                toast('Demo data reset. Pick a demo account to continue.', { tone: 'info' })
                navigate('/login')
              }}
            >
              Reset demo data
            </Button>
          </>
        }
      />
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description={shared ? "Your account, hosted events, groups, registrations and messages will be removed from the shared workspace." : "Your profile, registrations, messages, reviews and hosted events will be permanently removed from this browser."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              disabled={deleteText.trim().toUpperCase() !== 'DELETE'}
              onClick={async () => {
                if (!await actions.deleteMyAccount()) return
                setDeleteOpen(false)
                toast('Your account and its data were deleted.', { tone: 'info' })
                navigate('/')
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <Field label='Type "DELETE" to confirm'>{(p) => <Input {...p} value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />}</Field>
      </Dialog>
    </Container>
  )
}

function SettingsCard({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card as="section" className="scroll-mt-24 p-6">
      <h2 id={id} className="scroll-mt-24 text-xl font-bold text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 mb-5 text-sm text-muted">{description}</p>}
      {children}
    </Card>
  )
}

function VerificationFlow() {
  const { user, now, actions } = useApp()
  const [open, setOpen] = useState(false)
  const [doc, setDoc] = useState<NonNullable<Verification['documentType']>>('passport')
  const [, tick] = useState(0)
  const status = verificationStatus(user, now)

  // Re-render once the simulated provider "finishes".
  useEffect(() => {
    if (status !== 'pending') return
    const t = setTimeout(() => tick((n) => n + 1), DEMO_VERIFICATION_DELAY_MS)
    return () => clearTimeout(t)
  }, [status])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Status:</span>
        <VerificationBadge status={status} />
      </div>
      <div className="mt-4 rounded-xl bg-mist p-4 text-sm text-ink-soft">
        <p>
          <strong className="text-ink">How it would work in production:</strong> you’d verify a government-issued ID or passport with a certified third-party identity provider. {BRAND.name} would
          only receive a pass/fail result — never your document images or numbers.
        </p>
        <p className="mt-2">
          <strong className="text-ink">In this demo:</strong> no documents or photos are collected. The badge reads <em>“Demo verified”</em> so it never implies a real identity check took place.
          Verification shows an account completed a trust process — it doesn’t make anyone more valuable than anyone else.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {status === 'unverified' && (
          <Button onClick={() => setOpen(true)}>
            <Fingerprint aria-hidden /> Start demo verification
          </Button>
        )}
        {status === 'pending' && (
          <p className="flex items-center gap-2 text-sm font-semibold text-warning" role="status">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Simulated provider is checking… (a few seconds)
          </p>
        )}
        {status === 'demo_verified' && (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-success" role="status">
              <ShieldCheck aria-hidden className="size-4" /> Demo verification complete.
            </p>
            <Button variant="ghost" size="sm" onClick={() => actions.resetVerification()}>
              Reset (for demos)
            </Button>
          </>
        )}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Simulated ID verification"
        description="Nothing is uploaded or stored — this walks through the flow only."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actions.requestVerification(doc)) setOpen(false)
              }}
            >
              Simulate verification
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Which document would you use?</legend>
          <div className="space-y-2">
            {(
              [
                ['passport', 'Passport'],
                ['drivers_licence', 'Driver’s licence'],
                ['provincial_id', 'Provincial ID card'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint/50">
                <input type="radio" name="doc" checked={doc === v} onChange={() => setDoc(v)} className="size-4" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>A real provider would ask for a photo of the document and a quick selfie liveness check.</li>
          <li>The provider confirms the match and sends back pass/fail.</li>
          <li>{BRAND.name} stores only the result and the date.</li>
        </ol>
      </Dialog>
    </div>
  )
}
