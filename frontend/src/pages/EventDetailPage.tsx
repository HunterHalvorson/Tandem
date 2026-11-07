import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  DoorOpen,
  Flag,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Square,
  Users,
  Volume2,
  XCircle,
  Ticket,
  Trees,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AccessibilityList, CapacityMeter, DemoLabel, JoinButton, VerificationBadge } from '../components/events/EventBits'
import { SaveButton } from '../components/events/EventCard'
import { RecommendationWhy } from '../components/events/RecommendationWhy'
import { ReportDialog } from '../components/events/ReportDialog'
import { CategoryCover, CategoryIcon } from '../components/events/visuals'
import { LazyMiniMap } from '../components/map/lazy'
import { ReviewForm } from '../components/reviews/ReviewForm'
import { Dialog } from '../components/ui/Dialog'
import { Avatar, Badge, Button, ButtonLink, Card, Container, EmptyState, StarRating, Textarea } from '../components/ui/primitives'
import { confirmedFeatures, accessFeature } from '../data/accessibility'
import { CATEGORIES } from '../data/categories'
import { QUADRANT_INFO } from '../data/calgary'
import { BRAND, MILES_NAME } from '../lib/brand'
import { formatEventRange, formatRelative } from '../lib/dates'
import { displayName, formatPrice, pluralize } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { buildIcs, downloadFile } from '../lib/ics'
import { isSpeechSynthesisSupported, speak, stopSpeaking } from '../lib/speech'
import { eventParticipants } from '../services/chat'
import { canCheckIn, eventPhase, getEvent, getGroup, getRegistration, getUser, isGoing, spotsLeft, verificationStatus } from '../services/db'
import { SIZE_LABEL, sizeBucket } from '../services/events'
import { computeMiles } from '../services/miles'
import { hardConstraint, scoreEvent } from '../services/recommendations'
import { checkIn } from '../services/registrations'
import { canReview, ratingSummary, reviewsForSeries, seriesKey } from '../services/reviews'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'
import type { CalgaryEvent } from '../types'

export default function EventDetailPage() {
  const { id } = useParams()
  const { db } = useApp()
  const event = getEvent(db, id)
  usePageTitle(event?.title ?? 'Event not found')
  if (!event)
    return (
      <Container className="py-16">
        <EmptyState title="We couldn't find that event" actions={<ButtonLink to="/discover">Browse events</ButtonLink>}>
          It may have been removed by its host, or the link is incomplete.
        </EmptyState>
      </Container>
    )
  return <EventDetail event={event} />
}

function EventDetail({ event }: { event: CalgaryEvent }) {
  const { db, user, now, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [speaking, setSpeaking] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => () => stopSpeaking(), [])

  const host = getUser(db, event.hostId)
  const group = getGroup(db, event.groupId)
  const phase = eventPhase(event, now)
  const going = isGoing(db, event.id, user?.id)
  const isHost = user?.id === event.hostId
  const reg = getRegistration(db, event.id, user?.id)
  const summary = ratingSummary(db, event)
  const reviews = reviewsForSeries(db, seriesKey(event))
  const reviewEligibility = canReview(db, event.id, user?.id, now)
  const participants = eventParticipants(db, event)
  // Attendees only appear (even as initials) if they share attendance — or the viewer is in the group already.
  const visibleMembers = going || isHost ? participants.members : participants.members.filter((m) => m.privacy.showAttendance && m.privacy.profileVisibility !== 'private')
  const hiddenCount = participants.members.length + participants.anonymous - Math.min(visibleMembers.length, 6)
  const left = spotsLeft(db, event)
  const rec = useMemo(() => (user && !hardConstraint(db, event, user, now) ? scoreEvent(db, event, user, now) : null), [db, event, user, now])
  const confirmed = confirmedFeatures(event.accessibility)

  const readAloud = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const parts = [
      event.title,
      formatEventRange(event.startsAt, event.endsAt, now).replace('·', ','),
      `At ${event.venue.approximate ? `the ${event.venue.area} area` : event.venue.name}, in ${QUADRANT_INFO[event.venue.quadrant].name} Calgary.`,
      event.price === 0 ? 'Free.' : `Costs ${formatPrice(event.price)}.`,
      left === 0 ? 'This event is full.' : `${pluralize(left, 'spot')} left.`,
      event.beginnerFriendly ? 'Beginner-friendly.' : '',
      confirmed.length ? `Confirmed by the organizer: ${confirmed.map((f) => accessFeature(f).label).join(', ')}.` : 'No accessibility features confirmed yet.',
      event.firstTime ? `What to expect: ${event.firstTime.whatToExpect}` : '',
      event.description,
    ]
    setSpeaking(true)
    speak(parts.filter(Boolean).join(' '), () => setSpeaking(false))
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: event.title, text: `Join me at ${event.title} on ${BRAND.name}`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied to clipboard.', { tone: 'info' })
      }
    } catch {
      /* user cancelled */
    }
  }

  const doCheckIn = async () => {
    if (!user) return
    const before = computeMiles(db, user.id, now)
    const after = computeMiles(checkIn(db, event.id, user.id, new Date()), user.id, now)
    if (await actions.checkIn(event.id)) {
      const unlocked = after.milestones.filter((m) => m.achieved && !before.milestones.find((b) => b.id === m.id)?.achieved)
      toast(
        `Attendance confirmed: +${after.total - before.total} ${MILES_NAME}.${unlocked.length ? ` Milestone unlocked: ${unlocked.map((m) => m.title).join(', ')} 🎉` : ''}`,
        { action: { label: 'See your Miles', to: '/dashboard#miles' } },
      )
    }
  }

  const cat = CATEGORIES[event.categoryId]
  const seeExact = going || isHost

  return (
    <Container className="py-6 sm:py-8">
      <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/discover'))} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Back
      </button>

      {event.status === 'cancelled' && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-card border border-brand/40 bg-brand-tint p-4 text-brand-deep">
          <XCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong>This event was cancelled.</strong> {event.cancelReason ? `Reason: ${event.cancelReason}` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0">
          {event.id === 'evt-cranston-run-club' ? (
            <img
              src="/images/events/cranston-run-club.jpg"
              alt="Cranston Run Club"
              className="aspect-[21/8] w-full rounded-card border border-line object-cover"
            />
          ) : (
            <CategoryCover
              categoryId={event.categoryId}
              variant={event.coverVariant}
              iconSize="lg"
              className="aspect-[21/8] rounded-card border border-line"
            />
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="outline">
              <CategoryIcon id={event.categoryId} /> {cat.label}
            </Badge>
            {phase === 'live' && <Badge tone="brand">Happening now</Badge>}
            {phase === 'ended' && <Badge tone="neutral">Past event</Badge>}
            {event.visibility === 'private' && (
              <Badge tone="warning">
                <Lock aria-hidden /> Unlisted — link only
              </Badge>
            )}
            {event.isDemo && <DemoLabel />}
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-extrabold text-ink sm:text-4xl">{event.title}</h1>
          {host && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-ink-soft">
              <Avatar user={host} size="sm" />
              Hosted by{' '}
              <Link to={`/people/${host.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                {displayName(host)}
              </Link>
              <VerificationBadge status={verificationStatus(host, now)} compact />
              {group && (
                <>
                  <span aria-hidden>·</span>
                  <Link to={`/groups/${group.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                    {group.name}
                  </Link>
                </>
              )}
            </p>
          )}

          <ul className="mt-5 grid grid-cols-1 gap-3 rounded-card border border-line bg-white p-4 sm:grid-cols-2">
            <Fact icon={<CalendarDays aria-hidden />} label="When">
              {formatEventRange(event.startsAt, event.endsAt, now)}
            </Fact>
            <Fact icon={<MapPin aria-hidden />} label="Where">
              {event.venue.approximate ? `${event.venue.area} (approximate area)` : event.venue.name} · {event.venue.quadrant}
            </Fact>
            <Fact icon={<Ticket aria-hidden />} label="Cost">
              {formatPrice(event.price)}
            </Fact>
            <Fact icon={<Users aria-hidden />} label="Group size">
              {SIZE_LABEL[sizeBucket(event.capacity)]}
              {event.minParticipants ? ` · runs with ${event.minParticipants}+` : ''}
            </Fact>
            <Fact icon={<Trees aria-hidden />} label="Setting">
              {event.setting === 'indoor' ? 'Indoors' : event.setting === 'outdoor' ? 'Outdoors' : 'Indoors & outdoors'}
            </Fact>
            <Fact icon={<Clock aria-hidden />} label="Listed">
              {formatRelative(event.createdAt, now)}
            </Fact>
          </ul>

          {rec && phase === 'upcoming' && <div className="mt-5"><RecommendationWhy rec={rec} /></div>}

          <Section title="About this event">
            <p className="leading-relaxed whitespace-pre-line text-ink-soft">{event.description}</p>
          </Section>

          {event.firstTime && (
            <Section title="First-Time Friendly" eyebrow="New here? Here's what to expect">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info term="What to expect">{event.firstTime.whatToExpect}</Info>
                <Info term="What to bring">{event.firstTime.whatToBring || 'Nothing special.'}</Info>
                <Info term="Experience needed">{event.firstTime.experienceNeeded || 'None.'}</Info>
                <Info term="Approximate group size">
                  {event.capacity <= 12 ? 'Small and cozy' : event.capacity <= 40 ? 'Medium' : 'Large'} — up to {event.capacity} people
                </Info>
                <Info term="How to find the group">{event.firstTime.howToFindUs}</Info>
                <Info term="Bring a friend?">{event.firstTime.bringAFriend ? 'Yes — friends are welcome (they just need to join too).' : 'Please register individually.'}</Info>
              </dl>
            </Section>
          )}

          <Section title="Comfort & Access" eyebrow="Accessibility information">
            <p className="mb-3 text-sm text-muted">We never assume a venue is accessible. Each feature is either confirmed by the organizer, not yet confirmed, or not available.</p>
            <AccessibilityList info={event.accessibility} beginnerFriendly={event.beginnerFriendly} />
          </Section>

          {(event.equipment || event.guidelines) && (
            <Section title="Good to know">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {event.equipment && <Info term="Equipment">{event.equipment}</Info>}
                {event.guidelines && <Info term="Event guidelines">{event.guidelines}</Info>}
              </dl>
            </Section>
          )}

          <Section title="Location">
            <LazyMiniMap event={event} />
            <p className="mt-3 text-sm text-ink-soft">
              <strong className="text-ink">{event.venue.approximate ? `${event.venue.area} — approximate area` : event.venue.name}</strong>, {event.venue.area}, {QUADRANT_INFO[event.venue.quadrant].name} Calgary.
            </p>
            {event.venue.privateDetails &&
              (seeExact ? (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
                  <DoorOpen aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <strong>Meeting details (attendees only):</strong> {event.venue.privateDetails}
                  </span>
                </p>
              ) : (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-mist px-3 py-2 text-sm text-ink-soft">
                  <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Exact meeting details are shared with registered attendees only.
                </p>
              ))}
          </Section>

          <Section title="Reviews" eyebrow={event.seriesId ? 'Feedback from past sessions of this activity' : undefined}>
            {summary.count === 0 ? (
              <p className="text-sm text-muted">No reviews yet. Attendees can review once the event is over.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-white p-4">
                  {summary.sufficient && summary.average !== null ? (
                    <StarRating value={summary.average} count={summary.count} size="md" />
                  ) : (
                    <span className="text-sm">
                      <Badge tone="info">New</Badge> <span className="text-muted">Only {pluralize(summary.count, 'review')} so far — a rating appears after 3.</span>
                    </span>
                  )}
                  {summary.organization !== null && <span className="text-sm text-muted">Organization {summary.organization.toFixed(1)}</span>}
                  {summary.accuracy !== null && <span className="text-sm text-muted">Description accuracy {summary.accuracy.toFixed(1)}</span>}
                  {summary.accessibilityAccuracy !== null && <span className="text-sm text-muted">Accessibility info {summary.accessibilityAccuracy.toFixed(1)}</span>}
                  {summary.wouldReturnRate !== null && <span className="text-sm font-semibold text-success">{Math.round(summary.wouldReturnRate * 100)}% would come back</span>}
                </div>
                <ul className="space-y-3">
                  {reviews.slice(0, 6).map((r) => {
                    const author = getUser(db, r.userId)
                    return (
                      <li key={r.id} className="rounded-card border border-line bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <StarRating value={r.overall} />
                          <span className="text-muted">·</span>
                          <span className="font-semibold text-ink">{author ? author.firstName : 'Former member'}</span>
                          <Badge tone="success">
                            <CheckCircle2 aria-hidden /> Attended
                          </Badge>
                          <span className="text-muted">{formatRelative(r.createdAt, now)}</span>
                          {r.isDemo && <span className="text-xs text-muted">(demo review)</span>}
                        </div>
                        {r.comment && <p className="mt-2 text-sm text-ink-soft">{r.comment}</p>}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {user && reg?.status === 'going' && phase === 'ended' && (
              <div className="mt-5 rounded-card border border-line bg-white p-5">
                {reviewEligibility.ok ? (
                  <>
                    <h3 className="mb-4 text-lg font-bold">Review this event</h3>
                    <ReviewForm event={event} />
                  </>
                ) : (
                  <p className="text-sm text-ink-soft">{reviewEligibility.reason}</p>
                )}
              </div>
            )}
          </Section>

          {user && !isHost && (
            <button type="button" onClick={() => setReportOpen(true)} className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-deep">
              <Flag aria-hidden className="size-4" /> Report this event
            </button>
          )}
        </article>

        <aside aria-label="Join and actions" className="lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-extrabold text-ink">{formatPrice(event.price)}</p>
                <p className="text-sm text-muted">{formatEventRange(event.startsAt, event.endsAt, now)}</p>
              </div>
              <SaveButton event={event} />
            </div>
            <CapacityMeter event={event} />
            <JoinButton event={event} size="lg" fullWidth />
            {phase === 'upcoming' && !going && !isHost && left > 0 && (
              <p className="text-center text-xs text-muted">
                +10 {MILES_NAME} when you check in{event.categoryId === 'volunteering' ? ' (+10 bonus for volunteering)' : ''}.
              </p>
            )}
            {user && canCheckIn(db, event, user.id, now) && (
              <div className="rounded-xl bg-success-tint p-3">
                <p className="text-sm font-semibold text-success">{phase === 'ended' ? 'Did you make it?' : "You're here!"}</p>
                <p className="mb-2 text-xs text-success">Confirm attendance once to earn {MILES_NAME}. (Production: host-confirmed QR check-in.)</p>
                <Button size="sm" className="w-full" onClick={doCheckIn}>
                  <CheckCircle2 aria-hidden /> {phase === 'ended' ? 'Confirm I attended' : 'Check in'}
                </Button>
              </div>
            )}
            {reg?.checkedInAt && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                <CheckCircle2 aria-hidden className="size-4" /> Attendance confirmed
              </p>
            )}
            {(going || isHost) && (
              <ButtonLink to={`/events/${event.id}/chat`} variant="secondary" className="w-full">
                <MessageCircle aria-hidden /> Open group chat
              </ButtonLink>
            )}
            {isHost && phase === 'upcoming' && event.status === 'scheduled' && (
              <div className="grid grid-cols-2 gap-2">
                <ButtonLink to={`/events/${event.id}/edit`} variant="secondary" size="sm">
                  <Pencil aria-hidden /> Edit
                </ButtonLink>
                <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                  <XCircle aria-hidden /> Cancel event
                </Button>
              </div>
            )}
            {going && phase !== 'ended' && !reg?.checkedInAt && (
              <Button variant="ghost" size="sm" className="w-full text-muted" onClick={() => setLeaveOpen(true)}>
                <DoorOpen aria-hidden /> Leave event
              </Button>
            )}
            <div className="grid grid-cols-3 gap-2 border-t border-line pt-4">
              <ToolButton onClick={() => downloadFile(`${event.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`, buildIcs(event, BRAND.name), 'text/calendar')} icon={<CalendarPlus aria-hidden />} label="Calendar" />
              <ToolButton onClick={share} icon={<Share2 aria-hidden />} label="Share" />
              {isSpeechSynthesisSupported() && (
                <ToolButton onClick={readAloud} icon={speaking ? <Square aria-hidden /> : <Volume2 aria-hidden />} label={speaking ? 'Stop' : 'Read aloud'} pressed={speaking} />
              )}
            </div>
          </Card>

          <Card className="mt-4 p-5">
            <h2 className="text-base font-bold text-ink">Who's going</h2>
            <p className="mt-0.5 text-sm text-muted">{pluralize(participants.members.length + participants.anonymous, 'person', 'people')} registered · names are shared with attendees in the group chat.</p>
            <div className="mt-3 flex items-center">
              <span className="flex -space-x-2">
                {visibleMembers.slice(0, 6).map((m) => (
                  <Avatar key={m.id} user={m} size="sm" className="ring-2 ring-white" />
                ))}
              </span>
              {hiddenCount > 0 && <span className="ml-3 text-sm text-muted">+{hiddenCount} {participants.anonymous ? 'others (incl. demo participants)' : 'others'}</span>}
            </div>
            <p className="mt-3 text-xs text-muted">{BRAND.name} never shows follower counts or ranks people — only the activity.</p>
          </Card>
          {pastPill(event)}
        </aside>
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="event" targetId={event.id} subject={event.title} />
      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this event?"
        description="Attendees will see a cancellation notice in the event page and group chat."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep event
            </Button>
            <Button
              onClick={async () => {
                if (await actions.cancelEvent(event.id, cancelReason)) {
                  toast('Event cancelled. Attendees have been notified in the group chat.', { tone: 'info' })
                  setCancelOpen(false)
                }
              }}
            >
              Cancel event
            </Button>
          </>
        }
      >
        <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-semibold">
          Reason <span className="font-normal text-muted">(optional, shared with attendees)</span>
        </label>
        <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} placeholder="e.g. Extreme cold warning — let's reschedule!" />
      </Dialog>
      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this event?"
        description="Your spot will open up for someone else. You can re-join later if there's space."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              Stay registered
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await actions.leaveEvent(event.id)) {
                  toast(`You left ${event.title}.`, { tone: 'info' })
                  setLeaveOpen(false)
                }
              }}
            >
              Leave event
            </Button>
          </>
        }
      />
    </Container>
  )
}

function pastPill(event: CalgaryEvent) {
  return event.seriesId ? (
    <p className="mt-4 px-1 text-xs text-muted">This is a recurring activity — ratings combine feedback from its past sessions.</p>
  ) : null
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-muted [&_svg]:size-5">{icon}</span>
      <span>
        <span className="block text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
        <span className="text-sm font-medium text-ink">{children}</span>
      </span>
    </li>
  )
}

function Info({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <dt className="text-xs font-bold tracking-wide text-muted uppercase">{term}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  )
}

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      {eyebrow && <p className="mb-1 text-xs font-bold tracking-wider text-brand uppercase">{eyebrow}</p>}
      <h2 className="mb-3 text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function ToolButton({ onClick, icon, label, pressed }: { onClick: () => void; icon: React.ReactNode; label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold text-ink-soft hover:bg-mist hover:text-ink [&_svg]:size-5"
    >
      {icon}
      {label}
    </button>
  )
}
