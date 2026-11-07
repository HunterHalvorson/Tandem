import { CalendarCheck, CalendarPlus, CheckCircle2, Compass, MessageCircle, Pencil, Plane, ShieldCheck, Sparkles, Star, UsersRound } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { EaseIntoItCard } from '../components/events/EaseIntoItCard'
import { EventCard } from '../components/events/EventCard'
import { CategoryIcon } from '../components/events/visuals'
import { MilesCard } from '../components/miles/MilesCard'
import { Badge, Button, ButtonLink, Card, Container, EmptyState, SectionHeading } from '../components/ui/primitives'
import { CATEGORIES } from '../data/categories'
import { formatDateRange, formatEventWhen, formatLongDay } from '../lib/dates'
import { pluralize } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { canCheckIn, eventPhase, getEvent, userPastEvents, userUpcomingEvents, verificationStatus } from '../services/db'
import { userGroups } from '../services/groups'
import { computeMiles } from '../services/miles'
import { recommendEvents } from '../services/recommendations'
import { canReview } from '../services/reviews'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'
import type { CalgaryEvent, CategoryId } from '../types'
import { MILES_NAME } from '../lib/brand'

function greeting(now: Date) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  usePageTitle('Your dashboard')
  const { db, user, now, actions } = useApp()
  const { toast } = useToast()
  const upcoming = useMemo(() => (user ? userUpcomingEvents(db, user.id, now) : []), [db, user, now])
  const recs = useMemo(() => (user ? recommendEvents(db, user, now, { limit: 3 }) : []), [db, user, now])
  if (!user) return null

  const past = userPastEvents(db, user.id, now)
  const toConfirm = past.filter((e) => canCheckIn(db, e, user.id, now))
  const toReview = past.filter((e) => canReview(db, e.id, user.id, now).ok)
  const saved = user.savedEventIds.map((id) => getEvent(db, id)).filter((e): e is CalgaryEvent => !!e && e.status === 'scheduled' && eventPhase(e, now) !== 'ended')
  const hosting = db.events.filter((e) => e.hostId === user.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const hostingUpcoming = hosting.filter((e) => e.status === 'scheduled' && eventPhase(e, now) !== 'ended')
  const groups = userGroups(db, user.id)
  const miles = computeMiles(db, user.id, now)
  const itinerary = user.traveller.itinerary.map((id) => getEvent(db, id)).filter((e): e is CalgaryEvent => !!e)
  const recentCats = [
    ...new Set(
      db.registrations
        .filter((r) => r.userId === user.id && r.status === 'going')
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
        .map((r) => getEvent(db, r.eventId)?.categoryId)
        .filter((c): c is CategoryId => !!c),
    ),
  ].slice(0, 6)

  return (
    <Container className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
            {greeting(now)}, {user.firstName}
          </h1>
          <p className="mt-1 text-muted">
            {upcoming.length ? `You have ${pluralize(upcoming.length, 'event')} coming up.` : 'Nothing on your calendar yet — let’s fix that.'} · {miles.total} {MILES_NAME}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/discover" variant="secondary">
            <Compass aria-hidden /> Find something to do
          </ButtonLink>
          <ButtonLink to="/events/new">
            <CalendarPlus aria-hidden /> Create event
          </ButtonLink>
        </div>
      </div>

      {user.travelMode && (
        <Card className="mt-6 flex flex-col gap-4 border-brand/30 bg-brand-tint/40 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white">
            <Plane aria-hidden className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-bold text-ink">Travel mode is on{user.traveller.arrival ? ` · ${formatDateRange(user.traveller.arrival, user.traveller.departure)}` : ''}</p>
            <p className="text-sm text-ink-soft">
              {itinerary.length ? `Your itinerary has ${pluralize(itinerary.length, 'activity', 'activities')}.` : 'Build a weekend plan from real community events hosted by locals.'}
            </p>
            {itinerary.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {itinerary.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <Link to={`/events/${e.id}`} className="font-semibold text-ink hover:underline">
                      {formatEventWhen(e.startsAt, now)} — {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ButtonLink to="/explore-like-a-local">{itinerary.length ? 'Edit itinerary' : 'Plan my visit'}</ButtonLink>
        </Card>
      )}

      {(toConfirm.length > 0 || toReview.length > 0) && (
        <section aria-labelledby="todo" className="mt-6">
          <h2 id="todo" className="sr-only">
            Things to do
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {toConfirm.map((e) => (
              <li key={e.id}>
                <Card className="flex items-center gap-4 border-success/30 bg-success-tint/50 p-4">
                  <CheckCircle2 aria-hidden className="size-6 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">Did you make it to {e.title}?</p>
                    <p className="text-sm text-muted">Confirm once to earn +10 {MILES_NAME}.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (await actions.checkIn(e.id)) toast(`Attendance confirmed for ${e.title}. Thanks for showing up!`, { action: { label: 'Leave a review', to: `/events/${e.id}` } })
                    }}
                  >
                    Confirm
                  </Button>
                </Card>
              </li>
            ))}
            {toReview.map((e) => (
              <li key={e.id}>
                <Card className="flex items-center gap-4 p-4">
                  <Star aria-hidden className="size-6 shrink-0 text-[#B7791F]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">How was {e.title}?</p>
                    <p className="text-sm text-muted">Your review rates the event, never the people.</p>
                  </div>
                  <ButtonLink to={`/events/${e.id}`} size="sm" variant="secondary">
                    Review
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="upcoming">
            <SectionHeading id="upcoming" title="Your upcoming events" />
            {upcoming.length === 0 ? (
              <EmptyState icon={<CalendarCheck aria-hidden />} title="No upcoming events" actions={<ButtonLink to="/discover">Browse events</ButtonLink>}>
                Join an activity and it’ll show up here with its group chat.
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <UpcomingRow event={e} hosting={e.hostId === user.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recs">
            <SectionHeading
              id="recs"
              eyebrow={
                <span className="inline-flex items-center gap-1">
                  <Sparkles aria-hidden className="size-3.5" /> Picked for you
                </span>
              }
              title="Recommended activities"
              action={<Link to="/discover" className="text-sm font-semibold text-brand hover:underline">See all</Link>}
            />
            <EaseIntoItCard className="mb-4" compact />
            {recs.length ? (
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {recs.map((r) => (
                  <li key={r.event.id} className="flex min-w-0">
                    <EventCard event={r.event} rec={r} className="w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No recommendations right now" actions={<ButtonLink to="/settings#comfort" variant="secondary">Adjust preferences</ButtonLink>}>
                Your must-have accessibility needs or budget may be filtering everything out.
              </EmptyState>
            )}
          </section>

          <section aria-labelledby="saved">
            <SectionHeading id="saved" title="Saved events" />
            {saved.length ? (
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {saved.map((e) => (
                  <li key={e.id} className="flex min-w-0">
                    <EventCard event={e} className="w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-card border border-dashed border-line-strong bg-white p-5 text-sm text-muted">Tap the bookmark on any event to save it for later.</p>
            )}
          </section>

          <section aria-labelledby="hosting">
            <SectionHeading id="hosting" title="Events you’re hosting" action={<ButtonLink to="/events/new" size="sm" variant="secondary"><CalendarPlus aria-hidden /> Host another</ButtonLink>} />
            {hostingUpcoming.length ? (
              <ul className="space-y-3">
                {hostingUpcoming.map((e) => (
                  <li key={e.id}>
                    <UpcomingRow event={e} hosting />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-card border border-dashed border-line-strong bg-white p-5 text-sm text-muted">
                You’re not hosting anything right now. Hosting an event that takes place earns +15 {MILES_NAME}.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6" aria-label="Your progress">
          <div id="miles">
            <MilesCard userId={user.id} />
          </div>
          {verificationStatus(user, now) !== 'demo_verified' && (
            <Card className="flex items-start gap-3 p-4">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="text-sm">
                <p className="font-semibold text-ink">Add a trust badge</p>
                <p className="text-muted">Try the simulated ID verification flow (no documents are collected).</p>
                <Link to="/settings#verification" className="mt-1 inline-block font-semibold text-brand hover:underline">
                  Start demo verification
                </Link>
              </div>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold">
              <UsersRound aria-hidden className="size-4.5" /> Your groups
            </h2>
            {groups.length ? (
              <ul className="space-y-2">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link to={`/groups/${g.id}`} className="flex items-center gap-2 rounded-lg p-1.5 text-sm font-semibold text-ink hover:bg-mist">
                      <span className="grid size-8 place-items-center rounded-lg bg-mist">
                        <CategoryIcon id={g.categoryId} className="size-4" />
                      </span>
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">You haven’t joined any groups yet.</p>
            )}
            <Link to="/groups" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              Browse community groups
            </Link>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-base font-bold">Recently explored interests</h2>
            {recentCats.length ? (
              <ul className="flex flex-wrap gap-2">
                {recentCats.map((c) => (
                  <li key={c}>
                    <Link to={`/discover?cat=${c}`}>
                      <Badge tone="outline" className="py-1 text-sm hover:border-brand">
                        <CategoryIcon id={c} /> {CATEGORIES[c].label}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Join an event to start exploring.</p>
            )}
          </Card>
        </aside>
      </div>
    </Container>
  )
}

function UpcomingRow({ event, hosting }: { event: CalgaryEvent; hosting?: boolean }) {
  const { now } = useApp()
  const d = new Date(event.startsAt)
  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-brand-tint py-1.5 text-center text-brand-deep" aria-hidden>
        <span className="text-xs font-bold uppercase">{d.toLocaleString('en-US', { month: 'short' })}</span>
        <span className="text-xl leading-none font-extrabold">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/events/${event.id}`} className="font-bold text-ink hover:text-brand hover:underline">
          {event.title}
        </Link>
        <p className="text-sm text-muted">
          <span className="sr-only">{formatLongDay(d)}, </span>
          {formatEventWhen(event.startsAt, now)} · {event.venue.approximate ? event.venue.area : event.venue.name}
        </p>
        <div className="mt-1 flex gap-1.5">{hosting ? <Badge tone="brand">Hosting</Badge> : <Badge tone="success">Going</Badge>}</div>
      </div>
      <div className="flex gap-2">
        {hosting && (
          <ButtonLink to={`/events/${event.id}/edit`} size="sm" variant="ghost" aria-label={`Edit ${event.title}`}>
            <Pencil aria-hidden /> Edit
          </ButtonLink>
        )}
        <ButtonLink to={`/events/${event.id}/chat`} size="sm" variant="secondary" aria-label={`Open group chat for ${event.title}`}>
          <MessageCircle aria-hidden /> Chat
        </ButtonLink>
      </div>
    </Card>
  )
}
