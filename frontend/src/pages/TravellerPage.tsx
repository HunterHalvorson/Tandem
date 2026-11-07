import { CalendarDays, Check, Clock, Luggage, Map as MapIcon, MapPin, Plane, Save, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { JoinButton, PriceTag } from '../components/events/EventBits'
import { EventCard } from '../components/events/EventCard'
import { CategoryIcon } from '../components/events/visuals'
import { Badge, Button, ButtonLink, Card, Chip, Container, EmptyState, Field, Input, Segmented, Select, Switch } from '../components/ui/primitives'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { QUADRANT_INFO, QUADRANTS } from '../data/calgary'
import { GUEST_USER as GUEST } from '../data/guest'
import { addDays, formatTime, toDateInput } from '../lib/dates'
import { formatPrice, pluralize } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { getUser } from '../services/db'
import { planItinerary, type PlannerPrefs } from '../services/itinerary'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'


const BUDGETS = [
  { value: '', label: 'Any budget' },
  { value: '0', label: 'Free only' },
  { value: '20', label: 'Up to $20' },
  { value: '40', label: 'Up to $40' },
  { value: '75', label: 'Up to $75' },
]

export default function TravellerPage() {
  usePageTitle('Explore Like a Local')
  const { db, user, now, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const base = user ?? GUEST
  const [prefs, setPrefs] = useState<PlannerPrefs>(() => {
    const t = base.traveller
    const arrival = t.arrival && t.arrival >= toDateInput(now) ? t.arrival : toDateInput(addDays(now, 1))
    const departure = t.departure && t.departure >= arrival ? t.departure : toDateInput(addDays(new Date(arrival + 'T00:00'), 3))
    return {
      arrival,
      departure,
      interests: base.interests.length ? base.interests : ['hiking', 'food', 'photography'],
      budgetPerEvent: t.budgetPerEvent ?? base.budget.max,
      quadrants: t.preferredQuadrants,
      beginner: base.comfort.beginnerFriendly || !user,
      travellerOnly: true,
      perDay: 2,
      easeIntoIt: base.comfort.easeIntoIt,
    }
  })
  const set = (patch: Partial<PlannerPrefs>) => setPrefs((p) => ({ ...p, ...patch }))
  const plan = useMemo(() => planItinerary(db, base, prefs, now), [db, base, prefs, now])
  const planned = plan.days.flatMap((d) => d.items)
  const plannedIds = new Set(planned.map((i) => i.rec.event.id))
  const more = plan.matches.filter((r) => !plannedIds.has(r.event.id)).slice(0, 6)
  const mapLink = `/map?travel=${prefs.travellerOnly ? 1 : 0}&date=custom&from=${prefs.arrival}&to=${prefs.departure}${prefs.budgetPerEvent !== null ? `&max=${prefs.budgetPerEvent}` : ''}${prefs.quadrants.length ? `&quad=${prefs.quadrants.join(',')}` : ''}`

  const joinAll = () => {
    if (!user) {
      navigate('/login?next=/explore-like-a-local')
      return
    }
    let joined = 0
    for (const it of planned) if (!it.alreadyGoing && actions.joinEvent(it.rec.event.id)) joined++
    toast(joined ? `You joined ${pluralize(joined, 'activity', 'activities')}. Their group chats are on your dashboard.` : 'You’re already going to everything in this plan.', {
      action: { label: 'Open dashboard', to: '/dashboard' },
    })
  }
  const save = () => {
    if (!user) {
      navigate('/login?next=/explore-like-a-local')
      return
    }
    if (
      actions.updateProfile({
        travelMode: true,
        traveller: { ...user.traveller, arrival: prefs.arrival, departure: prefs.departure, budgetPerEvent: prefs.budgetPerEvent, preferredQuadrants: prefs.quadrants, itinerary: planned.map((i) => i.rec.event.id) },
      })
    )
      toast('Itinerary saved to your dashboard.', { action: { label: 'View dashboard', to: '/dashboard' } })
  }

  return (
    <>
      <section className="border-b border-line bg-white">
        <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-bold tracking-wide text-brand-deep uppercase">
              <Plane aria-hidden className="size-3.5" /> For visitors & newcomers
            </p>
            <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">Explore Like a Local</h1>
            <p className="mt-3 max-w-xl text-lg text-ink-soft">
              Skip the expensive tour packages. Join real Calgarians doing what they love — sunrise runs, food crawls, history walks — on the dates you’re in town.
            </p>
            {user?.travelMode && (
              <p className="mt-4 text-sm text-muted">
                Travel mode is on for {user.firstName}
                {user.traveller.homeCity ? ` (visiting from ${user.traveller.homeCity})` : ''}. We pre-filled your dates.
              </p>
            )}
          </div>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: CalendarDays, t: 'Tell us your dates', d: 'Plus interests and budget.' },
              { icon: Sparkles, t: 'Get a real plan', d: 'Only events that exist, have space and fit your budget.' },
              { icon: Users, t: 'Join before you land', d: 'Chat with your hosts and group ahead of time.' },
            ].map((s, i) => (
              <li key={s.t} className="flex items-start gap-3 rounded-card border border-line bg-paper p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block font-semibold text-ink">{s.t}</span>
                  <span className="text-sm text-muted">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <Container className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card as="section" className="h-fit space-y-5 p-5 lg:sticky lg:top-20">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Luggage aria-hidden className="size-5 text-brand" /> Your visit
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Arriving">{(p) => <Input {...p} type="date" min={toDateInput(now)} value={prefs.arrival} onChange={(e) => set({ arrival: e.target.value })} />}</Field>
            <Field label="Leaving">{(p) => <Input {...p} type="date" min={prefs.arrival} value={prefs.departure} onChange={(e) => set({ departure: e.target.value })} />}</Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Interests</legend>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_IDS.map((c) => (
                <Chip
                  key={c}
                  selected={prefs.interests.includes(c)}
                  onToggle={() => set({ interests: prefs.interests.includes(c) ? prefs.interests.filter((x) => x !== c) : [...prefs.interests, c] })}
                  className="min-h-8 px-2.5 py-1 text-xs"
                >
                  {CATEGORIES[c].label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field label="Budget per activity">
            {(p) => (
              <Select {...p} value={prefs.budgetPerEvent === null ? '' : String(prefs.budgetPerEvent)} onChange={(e) => set({ budgetPerEvent: e.target.value === '' ? null : Number(e.target.value) })}>
                {BUDGETS.map((b) => (
                  <option key={b.label} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Preferred areas</legend>
            <div className="flex flex-wrap gap-1.5">
              {QUADRANTS.map((q) => (
                <Chip key={q} selected={prefs.quadrants.includes(q)} onToggle={() => set({ quadrants: prefs.quadrants.includes(q) ? prefs.quadrants.filter((x) => x !== q) : [...prefs.quadrants, q] })}>
                  {q}
                  <span className="sr-only"> {QUADRANT_INFO[q].name}</span>
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">None selected = favour places close to downtown.</p>
          </fieldset>
          <div>
            <p className="mb-2 text-sm font-semibold">Activities per day</p>
            <Segmented
              label="Activities per day"
              value={String(prefs.perDay) as '1' | '2' | '3'}
              onChange={(v) => set({ perDay: Number(v) })}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
              ]}
            />
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <Switch checked={prefs.beginner} onChange={(v) => set({ beginner: v })} label="Beginner-friendly only" />
            <Switch checked={prefs.travellerOnly} onChange={(v) => set({ travellerOnly: v })} label="Traveller-friendly hosts" description="Hosts who said visitors are welcome." />
            <Switch checked={prefs.easeIntoIt} onChange={(v) => set({ easeIntoIt: v })} label="Ease Into It" description="Smaller groups, clear arrival details." />
          </div>
        </Card>

        <section aria-labelledby="planner" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="planner" className="text-2xl font-extrabold text-ink">
                Your Calgary Weekend Planner
              </h2>
              <p className="text-sm text-muted" aria-live="polite">
                {plan.error ?? `${pluralize(planned.length, 'activity', 'activities')} planned · ${planned.length ? (plan.totalCost === 0 ? 'all free' : `total ${formatPrice(plan.totalCost)}`) : 'adjust your filters for more options'}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={mapLink} variant="secondary" size="sm">
                <MapIcon aria-hidden /> View on map
              </ButtonLink>
              <Button variant="secondary" size="sm" onClick={save} disabled={!planned.length}>
                <Save aria-hidden /> Save itinerary
              </Button>
              <Button size="sm" onClick={joinAll} disabled={!planned.length}>
                <Check aria-hidden /> Join all
              </Button>
            </div>
          </div>

          {plan.error ? (
            <EmptyState icon={<CalendarDays aria-hidden />} title="Let’s fix your dates">
              {plan.error}
            </EmptyState>
          ) : (
            <ol className="space-y-4">
              {plan.days.map((day) => (
                <li key={day.date}>
                  <Card className="overflow-hidden">
                    <h3 className="border-b border-line bg-paper px-4 py-2.5 text-sm font-bold text-ink">{day.label}</h3>
                    {day.items.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted">
                        Free day — no matching community events. Try the <Link to={mapLink} className="font-semibold text-brand underline">map</Link> or widen your interests.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {day.items.map(({ rec, alreadyGoing }) => {
                          const host = getUser(db, rec.event.hostId)
                          return (
                            <li key={rec.event.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                              <span className="flex w-20 shrink-0 items-center gap-1 text-sm font-bold text-ink">
                                <Clock aria-hidden className="size-4 text-muted" />
                                {formatTime(new Date(rec.event.startsAt))}
                              </span>
                              <div className="min-w-0 flex-1">
                                <Link to={`/events/${rec.event.id}`} className="font-bold text-ink hover:text-brand hover:underline">
                                  {rec.event.title}
                                </Link>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                                  <span className="inline-flex items-center gap-1">
                                    <CategoryIcon id={rec.event.categoryId} className="size-3.5" /> {CATEGORIES[rec.event.categoryId].label}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin aria-hidden className="size-3.5" /> {rec.event.venue.approximate ? rec.event.venue.area : rec.event.venue.name}
                                  </span>
                                  {host?.residency === 'resident' && <Badge tone="success">Hosted by a local</Badge>}
                                  <PriceTag price={rec.event.price} />
                                </p>
                                <p className="mt-1 text-xs text-brand-deep">{rec.explanation}</p>
                              </div>
                              {alreadyGoing ? <Badge tone="success" className="self-start sm:self-center"><Check aria-hidden /> Going</Badge> : <JoinButton event={rec.event} size="sm" />}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Card>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">Rule-based planner: highest-matching events first, at most {prefs.perDay} per day, no overlaps, no repeated category on the same day, and only events with space left.</p>

          {more.length > 0 && (
            <section className="mt-10" aria-labelledby="more">
              <h2 id="more" className="mb-4 text-xl font-bold text-ink">
                More local activities during your visit
              </h2>
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {more.map((r) => (
                  <li key={r.event.id} className="flex min-w-0">
                    <EventCard event={r.event} rec={r} className="w-full" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </Container>
    </>
  )
}
