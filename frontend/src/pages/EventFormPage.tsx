import { ArrowLeft, ArrowRight, Check, CircleHelp, MapPin, Rocket, Wand2, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { CategoryCover, CategoryIcon, ACCESS_ICON } from '../components/events/visuals'
import { LazyLocationPicker } from '../components/map/lazy'
import { Badge, Button, ButtonLink, Card, Checkbox, Container, EmptyState, Field, Input, Segmented, Select, Switch, Textarea } from '../components/ui/primitives'
import { ACCESS_FEATURES, ACCESS_STATUS_LABEL } from '../data/accessibility'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { guessQuadrant, QUADRANT_INFO, QUADRANTS, VENUES } from '../data/calgary'
import { cn } from '../lib/cn'
import { combineDateTime, formatEventRange, toDateInput } from '../lib/dates'
import { formatPrice } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { eventPhase, getEvent, registeredCount } from '../services/db'
import { draftFromEvent, emptyDraft, stepErrors, validateDraft, type DraftErrors, type DraftField, type EventDraft } from '../services/events'
import { groupsOrganizedBy } from '../services/groups'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'
import type { AccessStatus } from '../types'

const STEPS = ['Basics', 'When & where', 'Details', 'Comfort & Access', 'Review'] as const

const TEMPLATES: Array<{ label: string; patch: Partial<EventDraft> }> = [
  {
    label: 'Book club',
    patch: {
      title: 'Neighbourhood Book Club',
      description: 'A relaxed monthly book club. Finished the book or not, come for good conversation and tea. We keep groups small so everyone can be heard.',
      categoryId: 'reading',
      venueId: 'memorial-park',
      price: '0',
      capacity: '10',
      setting: 'indoor',
      beginnerFriendly: true,
      firstTimeEnabled: true,
      firstTime: { whatToExpect: 'Introductions, then an hour of easy discussion. Nobody is put on the spot.', whatToBring: 'The book if you have it.', experienceNeeded: 'None.', howToFindUs: 'Library program room — look for the stack of books on the table.', bringAFriend: true },
      accessibility: { wheelchair: 'confirmed', stepFree: 'confirmed', accessibleWashroom: 'confirmed', quiet: 'confirmed', sensoryFriendly: 'unconfirmed', virtual: 'unavailable' },
    },
  },
  {
    label: 'Run club',
    patch: {
      title: 'Easy Pathway Run',
      description: 'A friendly 5 km run along the river pathways at a conversational pace. Walk breaks welcome, nobody gets left behind, coffee afterwards.',
      categoryId: 'running',
      venueId: 'princes-island',
      price: '0',
      capacity: '25',
      setting: 'outdoor',
      startTime: '07:30',
      endTime: '08:30',
      beginnerFriendly: true,
      travellerFriendly: true,
      firstTimeEnabled: true,
      firstTime: { whatToExpect: 'A 5 km loop with regroups at every bridge.', whatToBring: 'Running shoes and layers.', experienceNeeded: 'None.', howToFindUs: 'South end of the Peace Bridge — look for the red flag.', bringAFriend: true },
      accessibility: { wheelchair: 'unconfirmed', stepFree: 'confirmed', accessibleWashroom: 'unconfirmed', quiet: 'unavailable', sensoryFriendly: 'unconfirmed', virtual: 'unavailable' },
    },
  },
  {
    label: 'Coffee meetup',
    patch: {
      title: 'Newcomer Coffee Chat',
      description: 'New to Calgary? Meet a few friendly locals over coffee. Small tables, simple conversation prompts, and plenty of tips about the city.',
      categoryId: 'food',
      venueId: 'bridgeland',
      price: '0',
      capacity: '8',
      setting: 'indoor',
      startTime: '10:00',
      endTime: '11:30',
      beginnerFriendly: true,
      travellerFriendly: true,
      firstTimeEnabled: true,
      firstTime: { whatToExpect: 'Small tables of four, gentle prompts, leave whenever you like.', whatToBring: 'Money for your own coffee (optional).', experienceNeeded: 'None.', howToFindUs: 'Look for the small red bike sign on our table.', bringAFriend: true },
      accessibility: { wheelchair: 'unconfirmed', stepFree: 'confirmed', accessibleWashroom: 'unconfirmed', quiet: 'confirmed', sensoryFriendly: 'unconfirmed', virtual: 'unavailable' },
    },
  },
  {
    label: 'Volunteer shift',
    patch: {
      title: 'Neighbourhood Clean-Up',
      description: 'Help tidy a local park with neighbours. Gloves, grabbers and bags are provided, and we finish with snacks. A great way to meet people and give back.',
      categoryId: 'volunteering',
      venueId: 'riverwalk',
      price: '0',
      capacity: '20',
      setting: 'outdoor',
      startTime: '10:00',
      endTime: '12:00',
      beginnerFriendly: true,
      firstTimeEnabled: true,
      firstTime: { whatToExpect: 'A short safety briefing, then small teams along the river.', whatToBring: 'Weather-appropriate clothes.', experienceNeeded: 'None.', howToFindUs: 'By the RiverWalk benches — red vests.', bringAFriend: true },
      accessibility: { wheelchair: 'confirmed', stepFree: 'confirmed', accessibleWashroom: 'unconfirmed', quiet: 'unconfirmed', sensoryFriendly: 'unconfirmed', virtual: 'unavailable' },
    },
  },
]

export default function EventFormPage() {
  const [params] = useSearchParams()
  const groupParam = params.get('group')
  const { id } = useParams()
  const { db, user, now } = useApp()
  const editing = id ? getEvent(db, id) : undefined
  usePageTitle(id ? 'Edit event' : 'Create an event')

  if (id && !editing)
    return (
      <Container className="py-16">
        <EmptyState title="Event not found" actions={<ButtonLink to="/discover">Browse events</ButtonLink>} />
      </Container>
    )
  if (editing && editing.hostId !== user?.id)
    return (
      <Container className="py-16">
        <EmptyState title="Only the host can edit this event" actions={<ButtonLink to={`/events/${editing.id}`}>Back to event</ButtonLink>} />
      </Container>
    )
  if (editing && (editing.status === 'cancelled' || eventPhase(editing, now) !== 'upcoming'))
    return (
      <Container className="py-16">
        <EmptyState title="This event can't be edited" actions={<ButtonLink to={`/events/${editing.id}`}>Back to event</ButtonLink>}>
          Events that are cancelled or have already started are locked.
        </EmptyState>
      </Container>
    )
  return <EventForm key={editing?.id ?? 'new'} initial={editing ? draftFromEvent(editing) : emptyDraft(now, { groupId: db.groups.find((group) => group.id === groupParam && group.organizerId === user?.id)?.id ?? '' })} eventId={editing?.id} registered={editing ? registeredCount(db, editing) : undefined} />
}

function EventForm({ initial, eventId, registered }: { initial: EventDraft; eventId?: string; registered?: number }) {
  const { db, user, now, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<EventDraft>(initial)
  const [step, setStep] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [shownErrors, setShownErrors] = useState<DraftErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)
  const myGroups = groupsOrganizedBy(db, user?.id)

  const allErrors = useMemo(() => validateDraft(draft, now, { registered }), [draft, now, registered])
  const set = (patch: Partial<EventDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    // Clear errors for fields the user just changed.
    setShownErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch) && !(k === 'when' && ('date' in patch || 'startTime' in patch)))))
  }
  const err = (f: DraftField) => shownErrors[f]

  const goTo = (next: number) => {
    if (next > step) {
      for (let s = step; s < next; s++) {
        const errs = stepErrors(allErrors, s)
        if (Object.keys(errs).length) {
          setStep(s)
          setShownErrors(errs)
          requestAnimationFrame(() => summaryRef.current?.focus())
          return
        }
      }
    }
    setShownErrors({})
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  const publish = async () => {
    if (publishing) return
    if (Object.keys(allErrors).length) {
      const firstBad = [0, 1, 2].find((s) => Object.keys(stepErrors(allErrors, s)).length) ?? 0
      setStep(firstBad)
      setShownErrors(stepErrors(allErrors, firstBad))
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setPublishing(true)
    try {
      if (eventId) {
        if (await actions.updateEvent(eventId, draft)) {
          toast('Changes saved. Attendees can see the update in the group chat.')
          navigate(`/events/${eventId}`)
        }
      } else {
        const created = await actions.createEvent(draft)
        if (created) {
          toast('Your event is live! It’s in Discover, on the Calgary map, and its group chat is ready.', { action: { label: 'See it on the map', to: `/map?cat=${created.categoryId}` } })
          navigate(`/events/${created.id}`)
        }
      }
    } finally {
      setPublishing(false)
    }
  }

  const venue = VENUES.find((v) => v.id === draft.venueId)
  const start = combineDateTime(draft.date, draft.startTime)
  const end = combineDateTime(draft.date, draft.endTime)
  const errorList = Object.entries(shownErrors) as Array<[DraftField, string]>

  return (
    <Container className="max-w-4xl py-6 sm:py-8">
      <Link to={eventId ? `/events/${eventId}` : '/discover'} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {eventId ? 'Back to event' : 'Back'}
      </Link>
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{eventId ? 'Edit your event' : 'Host an activity'}</h1>
      <p className="mt-1 text-muted">{eventId ? 'Attendees are notified in the group chat when you save.' : 'Five quick steps. Your event gets a group chat and a spot on the Calgary map automatically.'}</p>

      <ol className="mt-6 mb-6 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined}>
            <button type="button" onClick={() => goTo(i)} className="group w-full text-left">
              <span className={cn('block h-1.5 rounded-full transition-colors', i < step ? 'bg-brand' : i === step ? 'bg-brand' : 'bg-line')} />
              <span className={cn('mt-2 hidden text-xs font-semibold sm:block', i === step ? 'text-brand-deep' : 'text-muted group-hover:text-ink')}>
                {i + 1}. {s}
              </span>
              <span className="sr-only sm:hidden">
                Step {i + 1}: {s}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-semibold text-ink sm:hidden">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-5 rounded-card border border-brand/40 bg-brand-tint p-4 outline-none focus-visible:outline-3 focus-visible:outline-brand">
          <p className="font-bold text-brand-deep">Please fix {errorList.length === 1 ? 'this' : `these ${errorList.length}`} before continuing:</p>
          <ul className="mt-1.5 list-disc pl-5 text-sm text-brand-deep">
            {errorList.map(([f, msg]) => (
              <li key={f}>
                <a href={`#field-${f}`} className="underline underline-offset-2">
                  {msg}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card className="p-5 sm:p-7">
        {step === 0 && (
          <div className="space-y-6">
            {!eventId && (
              <div className="rounded-xl bg-mist p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Wand2 aria-hidden className="size-4 text-brand" /> Start from a template
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TEMPLATES.map((t) => (
                    <Button key={t.label} variant="secondary" size="sm" onClick={() => set({ ...t.patch, date: toDateInput(new Date(now.getTime() + 2 * 86_400_000)) })}>
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <Field id="field-title" label="Event title" required error={err('title')} hint={`${draft.title.trim().length}/80`}>
              {(p) => <Input {...p} value={draft.title} maxLength={90} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Kensington Sci-Fi Book Club" />}
            </Field>
            <Field id="field-description" label="Description" required error={err('description')} hint="What will people do? Who is it for? Clear descriptions help newcomers feel comfortable.">
              {(p) => <Textarea {...p} rows={5} value={draft.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} />}
            </Field>
            <fieldset id="field-categoryId" aria-describedby={err('categoryId') ? 'cat-err' : undefined}>
              <legend className="mb-2 text-sm font-semibold text-ink">
                Category <span className="text-brand" aria-hidden>*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORY_IDS.map((c) => (
                  <label
                    key={c}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2.5 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand',
                      draft.categoryId === c ? 'border-brand bg-brand-tint text-brand-deep' : 'border-line-strong hover:bg-mist',
                    )}
                  >
                    <input type="radio" name="category" className="sr-only" checked={draft.categoryId === c} onChange={() => set({ categoryId: c })} />
                    <CategoryIcon id={c} className="size-4 shrink-0" />
                    {CATEGORIES[c].label}
                  </label>
                ))}
              </div>
              {err('categoryId') && (
                <p id="cat-err" className="mt-1.5 text-sm font-medium text-brand-deep">
                  ⚠ {err('categoryId')}
                </p>
              )}
            </fieldset>
            {draft.categoryId && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">Cover illustration</legend>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((v) => (
                    <label key={v} className={cn('cursor-pointer overflow-hidden rounded-xl border-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand', draft.coverVariant === v ? 'border-brand' : 'border-transparent')}>
                      <input type="radio" name="cover" className="sr-only" checked={draft.coverVariant === v} onChange={() => set({ coverVariant: v })} />
                      <span className="sr-only">Cover style {v + 1}</span>
                      <CategoryCover categoryId={draft.categoryId as never} variant={v} iconSize="sm" className="aspect-[16/9]" />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="field-date" label="Date" required error={err('date') ?? err('when')}>
                {(p) => <Input {...p} type="date" min={toDateInput(now)} value={draft.date} onChange={(e) => set({ date: e.target.value })} />}
              </Field>
              <Field id="field-startTime" label="Start time" required error={err('startTime')}>
                {(p) => <Input {...p} type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />}
              </Field>
              <Field id="field-endTime" label="End time" required error={err('endTime')}>
                {(p) => <Input {...p} type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} />}
              </Field>
            </div>
            {start && end && end > start && <p className="-mt-3 text-sm text-muted">{formatEventRange(start.toISOString(), end.toISOString(), now)}</p>}

            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Location</p>
              <Segmented
                label="How do you want to set the location?"
                value={draft.locationMode}
                onChange={(v) => set({ locationMode: v })}
                options={[
                  { value: 'venue', label: 'Choose a public place' },
                  { value: 'custom', label: 'Drop a pin', icon: <MapPin aria-hidden /> },
                ]}
              />
            </div>
            {draft.locationMode === 'venue' ? (
              <Field id="field-venueId" label="Public place" required error={err('venueId')} hint={venue ? `${venue.area} · ${QUADRANT_INFO[venue.quadrant].name} Calgary` : 'Recognisable Calgary parks, libraries and community spaces.'}>
                {(p) => (
                  <Select {...p} value={draft.venueId} onChange={(e) => set({ venueId: e.target.value })}>
                    <option value="">Select a place…</option>
                    {QUADRANTS.map((q) => (
                      <optgroup key={q} label={`${QUADRANT_INFO[q].name} (${q})`}>
                        {VENUES.filter((v) => v.quadrant === q).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <div className="space-y-4">
                <div id="field-lat">
                  <p className="mb-2 text-sm text-muted">Click or tap the map to drop a pin. (Keyboard users: switch to "Choose a public place".)</p>
                  <LazyLocationPicker
                    lat={draft.lat}
                    lng={draft.lng}
                    categoryId={draft.categoryId}
                    onPick={(lat, lng) => set({ lat, lng, quadrant: guessQuadrant({ lat, lng }) })}
                  />
                  {err('lat') && <p className="mt-1.5 text-sm font-medium text-brand-deep">⚠ {err('lat')}</p>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="field-placeName" label="Place name" required error={err('placeName')}>
                    {(p) => <Input {...p} value={draft.placeName} onChange={(e) => set({ placeName: e.target.value })} placeholder="e.g. Riley Park picnic shelter" />}
                  </Field>
                  <Field id="field-area" label="Neighbourhood" optional hint="Leave blank to use the nearest neighbourhood.">
                    {(p) => <Input {...p} value={draft.area} onChange={(e) => set({ area: e.target.value })} />}
                  </Field>
                </div>
                <div id="field-quadrant">
                  <p className="mb-2 text-sm font-semibold text-ink">
                    Calgary quadrant <span className="text-brand" aria-hidden>*</span>
                    {draft.lat !== null && draft.lng !== null && <span className="ml-2 font-normal text-muted">Suggested from your pin: {guessQuadrant({ lat: draft.lat, lng: draft.lng })}</span>}
                  </p>
                  <Segmented label="Calgary quadrant" value={draft.quadrant || ('' as never)} onChange={(v) => set({ quadrant: v })} options={QUADRANTS.map((q) => ({ value: q, label: q }))} />
                  {err('quadrant') && <p className="mt-1.5 text-sm font-medium text-brand-deep">⚠ {err('quadrant')}</p>}
                </div>
              </div>
            )}
            <div className="rounded-xl border border-line p-4">
              <Switch
                checked={draft.approximate}
                onChange={(v) => set({ approximate: v })}
                label="Private or residential location"
                description="We'll only show the approximate neighbourhood publicly. Exact details below are shared with registered attendees only."
              />
              {(draft.approximate || draft.privateDetails) && (
                <Field id="field-privateDetails" label="Meeting details for attendees" optional className="mt-4" hint="e.g. buzzer number, which door, table location. Never shown publicly.">
                  {(p) => <Textarea {...p} rows={2} value={draft.privateDetails} maxLength={300} onChange={(e) => set({ privateDetails: e.target.value })} />}
                </Field>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="field-price" label="Cost per person (CAD)" required error={err('price')} hint={Number(draft.price) === 0 ? 'Shows as Free' : undefined}>
                {(p) => <Input {...p} type="number" inputMode="decimal" min={0} step="0.01" value={draft.price} onChange={(e) => set({ price: e.target.value })} />}
              </Field>
              <Field id="field-capacity" label="Maximum participants" required error={err('capacity')} hint={registered ? `${registered} already registered` : 'Small groups (≤12) feel most welcoming.'}>
                {(p) => <Input {...p} type="number" inputMode="numeric" min={2} max={500} value={draft.capacity} onChange={(e) => set({ capacity: e.target.value })} />}
              </Field>
              <Field id="field-minParticipants" label="Minimum to run" optional error={err('minParticipants')}>
                {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={draft.minParticipants} onChange={(e) => set({ minParticipants: e.target.value })} />}
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Setting</p>
                <Segmented
                  label="Setting"
                  value={draft.setting}
                  onChange={(v) => set({ setting: v })}
                  options={[
                    { value: 'indoor', label: 'Indoor' },
                    { value: 'outdoor', label: 'Outdoor' },
                    { value: 'mixed', label: 'Both' },
                  ]}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Visibility</p>
                <Segmented
                  label="Visibility"
                  value={draft.visibility}
                  onChange={(v) => set({ visibility: v })}
                  options={[
                    { value: 'public', label: 'Public' },
                    { value: 'private', label: 'Unlisted (link only)' },
                  ]}
                />
              </div>
            </div>
            {myGroups.length > 0 && (
              <Field label="Hosted by one of your groups?" optional>
                {(p) => (
                  <Select {...p} value={draft.groupId} onChange={(e) => set({ groupId: e.target.value })}>
                    <option value="">No group — just me</option>
                    {myGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Checkbox checked={draft.beginnerFriendly} onChange={(v) => set({ beginnerFriendly: v })} label="Beginner-friendly" description="No experience needed." />
              <Checkbox checked={draft.travellerFriendly} onChange={(v) => set({ travellerFriendly: v })} label="Traveller-friendly" description="Visitors welcome — shows in Explore Like a Local." />
            </div>
            <Field label="Required equipment" optional>
              {(p) => <Input {...p} value={draft.equipment} onChange={(e) => set({ equipment: e.target.value })} placeholder="e.g. running shoes, a sketchbook" />}
            </Field>
            <Field label="Event guidelines" optional>
              {(p) => <Textarea {...p} rows={2} value={draft.guidelines} onChange={(e) => set({ guidelines: e.target.value })} placeholder="e.g. 18+, phones away, be kind" />}
            </Field>
            <div className="rounded-xl border border-line p-4">
              <Switch
                checked={draft.firstTimeEnabled}
                onChange={(v) => set({ firstTimeEnabled: v })}
                label="First-Time Friendly"
                description="Help newcomers know exactly what to expect. Events with arrival details rank higher for people using Ease Into It."
              />
              {draft.firstTimeEnabled && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="field-whatToExpect" label="What to expect" required error={err('whatToExpect')}>
                    {(p) => <Textarea {...p} rows={2} value={draft.firstTime.whatToExpect} onChange={(e) => set({ firstTime: { ...draft.firstTime, whatToExpect: e.target.value } })} />}
                  </Field>
                  <Field id="field-howToFindUs" label="How to find the group on arrival" required error={err('howToFindUs')}>
                    {(p) => <Textarea {...p} rows={2} value={draft.firstTime.howToFindUs} onChange={(e) => set({ firstTime: { ...draft.firstTime, howToFindUs: e.target.value } })} />}
                  </Field>
                  <Field label="What to bring" optional>
                    {(p) => <Input {...p} value={draft.firstTime.whatToBring} onChange={(e) => set({ firstTime: { ...draft.firstTime, whatToBring: e.target.value } })} />}
                  </Field>
                  <Field label="Experience needed" optional>
                    {(p) => <Input {...p} value={draft.firstTime.experienceNeeded} onChange={(e) => set({ firstTime: { ...draft.firstTime, experienceNeeded: e.target.value } })} placeholder="None" />}
                  </Field>
                  <Checkbox checked={draft.firstTime.bringAFriend} onChange={(v) => set({ firstTime: { ...draft.firstTime, bringAFriend: v } })} label="Friends are welcome to come along" />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="mb-1 text-sm text-ink-soft">Tell people what to expect. Only mark a feature as confirmed if you’ve checked it — accuracy is rated by attendees.</p>
            <p className="mb-5 text-sm text-muted">Anything you leave as “Not sure yet” is shown honestly as “Not yet confirmed”.</p>
            <div className="space-y-3">
              {ACCESS_FEATURES.map((f) => {
                const Icon = ACCESS_ICON[f.id]
                return (
                  <fieldset key={f.id} className="rounded-xl border border-line p-4">
                    <legend className="sr-only">{f.label}</legend>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Icon aria-hidden className="mt-0.5 size-5 text-ink-soft" />
                        <div>
                          <p className="text-sm font-semibold text-ink" aria-hidden>
                            {f.label}
                          </p>
                          <p className="text-xs text-muted">{f.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {(['confirmed', 'unconfirmed', 'unavailable'] as AccessStatus[]).map((s) => {
                          const SIcon = s === 'confirmed' ? Check : s === 'unconfirmed' ? CircleHelp : X
                          return (
                            <label
                              key={s}
                              className={cn(
                                'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand',
                                draft.accessibility[f.id] === s ? 'border-ink bg-ink text-white' : 'border-line-strong text-ink-soft hover:bg-mist',
                              )}
                            >
                              <input type="radio" name={`acc-${f.id}`} className="sr-only" checked={draft.accessibility[f.id] === s} onChange={() => set({ accessibility: { ...draft.accessibility, [f.id]: s } })} />
                              <SIcon aria-hidden className="size-3.5" />
                              {s === 'unconfirmed' ? 'Not sure yet' : s === 'confirmed' ? 'Confirmed' : 'Not available'}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </fieldset>
                )
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-ink">Ready to publish?</h2>
            <p className="mb-5 text-sm text-muted">Here’s how your event will appear.</p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr]">
              {draft.categoryId && <CategoryCover categoryId={draft.categoryId as never} variant={draft.coverVariant} className="aspect-[4/3] rounded-card border border-line" />}
              <dl className="space-y-2 text-sm">
                <Row term="Title">{draft.title || '—'}</Row>
                <Row term="When">{start && end ? formatEventRange(start.toISOString(), end.toISOString(), now) : '—'}</Row>
                <Row term="Where">
                  {draft.locationMode === 'venue' ? venue?.name ?? '—' : draft.placeName || '—'}
                  {draft.approximate && <Badge tone="warning" className="ml-2">Approximate area shown publicly</Badge>}
                </Row>
                <Row term="Cost">{formatPrice(Number(draft.price) || 0)}</Row>
                <Row term="Capacity">{draft.capacity} people</Row>
                <Row term="Tags">
                  <span className="flex flex-wrap gap-1.5">
                    {draft.beginnerFriendly && <Badge tone="info">Beginner-friendly</Badge>}
                    {draft.travellerFriendly && <Badge tone="brand">Traveller-friendly</Badge>}
                    {draft.firstTimeEnabled && <Badge tone="success">First-Time Friendly</Badge>}
                    {draft.visibility === 'private' && <Badge tone="warning">Unlisted</Badge>}
                  </span>
                </Row>
                <Row term="Accessibility">{ACCESS_FEATURES.filter((f) => draft.accessibility[f.id] === 'confirmed').map((f) => f.short).join(', ') || ACCESS_STATUS_LABEL.unconfirmed}</Row>
              </dl>
            </div>
            {!eventId && (
              <ul className="mt-6 space-y-1.5 rounded-xl bg-mist p-4 text-sm text-ink-soft">
                <li>✓ Appears in Discover and on the Calgary map instantly</li>
                <li>✓ A private group chat is created for attendees</li>
                <li>✓ You’ll earn +15 Miles once it’s completed</li>
              </ul>
            )}
          </div>
        )}
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => goTo(step + 1)}>
            Next: {STEPS[step + 1]} <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="lg" onClick={publish} disabled={publishing}>
            <Rocket aria-hidden /> {eventId ? 'Save changes' : 'Publish event'}
          </Button>
        )}
      </div>
    </Container>
  )
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="font-semibold text-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}
