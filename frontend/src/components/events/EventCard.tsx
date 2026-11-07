import { Bookmark, BookmarkCheck, CalendarDays, MapPin, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { CATEGORIES } from '../../data/categories'
import { cn } from '../../lib/cn'
import { formatEventWhen } from '../../lib/dates'
import { displayName } from '../../lib/format'
import { formatDistance, haversineKm, type LatLng } from '../../lib/geo'
import { eventPhase, getUser, verificationStatus } from '../../services/db'
import type { Recommendation } from '../../services/recommendations'
import { useApp } from '../../state/AppStore'
import { useToast } from '../../state/toast'
import type { CalgaryEvent } from '../../types'
import { Avatar, Badge } from '../ui/primitives'
import { AccessSummary, CapacityMeter, JoinButton, PriceTag, RatingBadge, VerificationBadge } from './EventBits'
import { CategoryCover, CategoryIcon } from './visuals'

export function SaveButton({ event, className }: { event: CalgaryEvent; className?: string }) {
  const { user, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const saved = !!user?.savedEventIds.includes(event.id)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${event.title} from saved events` : `Save ${event.title}`}
      title={saved ? 'Saved' : 'Save for later'}
      onClick={() => {
        if (!user) {
          navigate(`/login?next=/events/${event.id}`)
          return
        }
        const now = actions.toggleSaved(event.id)
        if (now !== null) toast(now ? 'Saved — find it on your dashboard.' : 'Removed from saved events.', { tone: 'info', action: now ? { label: 'View dashboard', to: '/dashboard' } : undefined })
      }}
      className={cn(
        'grid size-10 place-items-center rounded-full border border-line bg-white/95 text-ink shadow-card transition-colors hover:bg-white [&_svg]:size-5',
        saved && 'text-brand',
        className,
      )}
    >
      {saved ? <BookmarkCheck aria-hidden className="fill-brand-tint" /> : <Bookmark aria-hidden />}
    </button>
  )
}

export function EventCard({
  event,
  rec,
  distanceFrom,
  className,
  headingLevel = 3,
}: {
  event: CalgaryEvent
  rec?: Recommendation | null
  distanceFrom?: { point: LatLng; label: string }
  className?: string
  headingLevel?: 2 | 3 | 4
}) {
  const { db, now } = useApp()
  const host = getUser(db, event.hostId)
  const phase = eventPhase(event, now)
  const Heading = `h${headingLevel}` as 'h3'
  const cat = CATEGORIES[event.categoryId]
  return (
    <article className={cn('group relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition-shadow duration-200 hover:shadow-lift', className)}>
      <div className="relative aspect-[16/8]">
        <CategoryCover categoryId={event.categoryId} variant={event.coverVariant} className="absolute inset-0" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge tone="outline" className="bg-white/95">
            <CategoryIcon id={event.categoryId} />
            {cat.label}
          </Badge>
          {phase === 'live' && <Badge tone="brand">Happening now</Badge>}
        </div>
        <SaveButton event={event} className="absolute top-2 right-2 z-10" />
        {event.isDemo && (
          <span className="absolute bottom-2 left-3 rounded bg-white/90 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-ink-soft uppercase" title="Fictional event for the hackathon demo at a real public venue">
            Demo listing
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <Heading className="text-[1.05rem] leading-snug font-bold text-ink">
          <Link to={`/events/${event.id}`} className="outline-none after:absolute after:inset-0 after:z-0 after:content-[''] hover:text-brand-deep focus-visible:after:rounded-card focus-visible:after:outline-3 focus-visible:after:outline-brand">
            {event.title}
          </Link>
        </Heading>
        <div className="space-y-1 text-sm text-ink-soft">
          <p className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" />
            {formatEventWhen(event.startsAt, now)}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin aria-hidden className="size-4 shrink-0 text-muted" />
            <span className="min-w-0 truncate">{event.venue.approximate ? event.venue.area : event.venue.name}</span>
            <Badge tone="neutral" className="ml-auto shrink-0">
              <span className="sr-only">Quadrant: </span>
              {event.venue.quadrant}
            </Badge>
          </p>
          {distanceFrom && <p className="text-xs text-muted">{formatDistance(haversineKm(distanceFrom.point, event.venue))} from {distanceFrom.label}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <PriceTag price={event.price} />
          {event.beginnerFriendly && <Badge tone="info">Beginner-friendly</Badge>}
          {event.travellerFriendly && <Badge tone="brand">Traveller-friendly</Badge>}
          <AccessSummary info={event.accessibility} max={2} />
        </div>
        {rec && (
          <p className="relative z-10 flex items-start gap-1.5 rounded-lg bg-brand-tint/60 px-2.5 py-2 text-xs text-brand-deep">
            <Sparkles aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              <span className="font-bold">{Math.round(rec.score * 100)}% match.</span> {rec.explanation}
            </span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
          {host && (
            <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
              <Avatar user={host} size="xs" />
              <span className="truncate">{displayName(host)}</span>
              <VerificationBadge status={verificationStatus(host, now)} iconOnly />
            </span>
          )}
          <RatingBadge event={event} />
        </div>
        <div className="relative z-10 flex items-center gap-3 border-t border-line pt-3">
          <CapacityMeter event={event} compact />
          <JoinButton event={event} size="sm" />
        </div>
      </div>
    </article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <div className="skeleton aspect-[16/8] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-9 w-full" />
      </div>
    </div>
  )
}
