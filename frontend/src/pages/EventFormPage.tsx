import { ArrowLeft, MapPin } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { LazyLocationPicker } from '../components/map/lazy'
import { Button, ButtonLink, Checkbox, Container, EmptyState, Field, Input, Segmented, Select, Switch, Textarea } from '../components/ui/primitives'
import { ACCESS_FEATURES, ACCESS_STATUS_LABEL } from '../data/accessibility'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { guessQuadrant, QUADRANT_INFO, QUADRANTS, VENUES } from '../data/calgary'
import { combineDateTime, formatEventRange, toDateInput } from '../lib/dates'
import { usePageTitle } from '../lib/hooks'
import { eventPhase, getEvent, registeredCount } from '../services/db'
import { draftFromEvent, emptyDraft, validateDraft, type DraftErrors, type DraftField, type EventDraft } from '../services/events'
import { groupsOrganizedBy } from '../services/groups'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'
import type { AccessStatus, CategoryId } from '../types'

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
  return <EventForm key={editing?.id ?? 'new'} initial={editing ? draftFromEvent(editing) : emptyDraft(now, { firstTimeEnabled: false, groupId: db.groups.find((group) => group.id === groupParam && group.organizerId === user?.id)?.id ?? '' })} eventId={editing?.id} registered={editing ? registeredCount(db, editing) : undefined} />
}

function EventForm({ initial, eventId, registered }: { initial: EventDraft; eventId?: string; registered?: number }) {
  const { db, user, now, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<EventDraft>(initial)
  const [publishing, setPublishing] = useState(false)
  const [shownErrors, setShownErrors] = useState<DraftErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDetailsElement>(null)
  const myGroups = groupsOrganizedBy(db, user?.id)

  const allErrors = useMemo(() => validateDraft(draft, now, { registered }), [draft, now, registered])
  const set = (patch: Partial<EventDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    // Clear errors for fields the user just changed.
    setShownErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch) && !(k === 'when' && ('date' in patch || 'startTime' in patch)))))
  }
  const err = (f: DraftField) => shownErrors[f]

  const publish = async () => {
    if (publishing) return
    if (Object.keys(allErrors).length) {
      if (optionsRef.current && (allErrors.minParticipants || allErrors.whatToExpect || allErrors.howToFindUs)) {
        optionsRef.current.open = true
      }
      setShownErrors(allErrors)
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setPublishing(true)
    try {
      if (eventId) {
        if (await actions.updateEvent(eventId, draft)) {
          toast('Event updated.')
          navigate(`/events/${eventId}`)
        }
      } else {
        const created = await actions.createEvent(draft)
        if (created) {
          toast('Event published.')
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
        <ArrowLeft aria-hidden className="size-4" /> {eventId ? 'Back to event' : 'Back to events'}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{eventId ? 'Edit event' : 'Create an event'}</h1>
      <p className="mt-2 mb-6 text-muted">{eventId ? 'Attendees will see an update in the event chat.' : 'Add the essentials to publish your event.'}</p>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-5 rounded-card border border-brand/40 bg-brand-tint p-4 outline-none focus-visible:outline-3 focus-visible:outline-brand">
          <p className="font-bold text-brand-deep">Please fix {errorList.length === 1 ? 'this' : `these ${errorList.length}`} before saving.</p>
          <ul className="mt-1.5 list-disc pl-5 text-sm text-brand-deep">
            {errorList.map(([f, msg]) => (
              <li key={f}>
                <a href={`#field-${f === 'when' ? 'date' : f}`} className="underline underline-offset-2">
                  {msg}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form noValidate className="space-y-6" onSubmit={(event) => { event.preventDefault(); void publish() }}>
        <section aria-labelledby="event-basics" className="space-y-4 border-t border-line pt-5">
          <h2 id="event-basics" className="text-lg font-bold">Event details</h2>
          {!eventId && (
            <details className="text-sm">
              <summary className="cursor-pointer py-2 font-semibold text-brand">Use a template</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {TEMPLATES.map((template) => (
                  <Button key={template.label} variant="secondary" size="sm" onClick={() => set({
                    ...template.patch, date: toDateInput(new Date(now.getTime() + 2 * 86_400_000)),
                  })}>{template.label}</Button>
                ))}
              </div>
            </details>
          )}
          <Field id="field-title" label="Event title" required error={err('title')} hint={`${draft.title.trim().length}/80`}>
            {(p) => <Input {...p} value={draft.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Kensington Sci-Fi Book Club" />}
          </Field>
          <Field id="field-description" label="Description" required error={err('description')} hint="Say what people will do and who can join.">
            {(p) => <Textarea {...p} rows={3} value={draft.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} />}
          </Field>
          <Field id="field-categoryId" label="Category" required error={err('categoryId')}>
            {(props) => (
              <Select {...props} value={draft.categoryId} onChange={(event) => set({ categoryId: event.target.value as CategoryId | '' })}>
                <option value="">Select a category</option>
                {CATEGORY_IDS.map((category) => <option key={category} value={category}>{CATEGORIES[category].label}</option>)}
              </Select>
            )}
          </Field>
        </section>

        <section aria-labelledby="event-when" className="space-y-4 border-t border-line pt-5">
          <h2 id="event-when" className="text-lg font-bold">When and where</h2>
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
        </section>

        <section aria-labelledby="event-rsvp" className="space-y-4 border-t border-line pt-5">
          <h2 id="event-rsvp" className="text-lg font-bold">Attendance</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="field-price" label="Cost per person (CAD)" required error={err('price')} hint="Enter 0 for a free event.">
              {(props) => <Input {...props} type="number" inputMode="decimal" min={0} step="0.01" value={draft.price} onChange={(event) => set({ price: event.target.value })} />}
            </Field>
            <Field id="field-capacity" label="Maximum participants" required error={err('capacity')} hint={registered ? `${registered} already registered` : undefined}>
              {(props) => <Input {...props} type="number" inputMode="numeric" min={2} max={500} value={draft.capacity} onChange={(event) => set({ capacity: event.target.value })} />}
            </Field>
          </div>
          <Field label="Who can find this event?">
            {(props) => (
              <Select {...props} value={draft.visibility} onChange={(event) => set({ visibility: event.target.value as EventDraft['visibility'] })}>
                <option value="public">Everyone</option>
                <option value="private">Anyone with the link</option>
              </Select>
            )}
          </Field>
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
        </section>

        <details ref={optionsRef} className="border-y border-line py-3">
          <summary className="cursor-pointer py-2 font-semibold">Additional details <span className="font-normal text-muted">· Optional</span></summary>
          <div className="space-y-4 py-4">
            <Field id="field-minParticipants" label="Minimum to run" optional error={err('minParticipants')}>
              {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={draft.minParticipants} onChange={(e) => set({ minParticipants: e.target.value })} />}
            </Field>
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
            <fieldset>
              <legend className="mb-2 font-semibold">Accessibility</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {ACCESS_FEATURES.map((feature) => (
                  <Field key={feature.id} label={feature.label}>
                    {(props) => (
                      <Select {...props} value={draft.accessibility[feature.id]} onChange={(event) => set({
                        accessibility: { ...draft.accessibility, [feature.id]: event.target.value as AccessStatus },
                      })}>
                        {Object.entries(ACCESS_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={publishing}>
            {publishing ? 'Saving…' : eventId ? 'Save changes' : 'Publish event'}
          </Button>
          <Link to={eventId ? `/events/${eventId}` : '/discover'} className="text-sm font-semibold text-ink-soft hover:underline">Cancel</Link>
        </div>
      </form>
    </Container>
  )
}
