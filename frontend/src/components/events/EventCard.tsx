import { Bookmark, BookmarkCheck, CalendarDays, MapPin } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { CATEGORIES } from '../../data/categories'
import { eventPhoto } from '../../data/calgaryPhotos'
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
import { CategoryIcon } from './visuals'

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
  const photo = eventPhoto(event.venue)
  return (
    <article className={cn('group relative flex min-w-0 flex-col overflow-hidden rounded-control border border-line bg-white hover:border-line-strong', className)}>
      <div className="relative aspect-[2/1] bg-mist">
        <img src={photo.src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        {photo.kind !== 'Venue photo' && (
          <span className="absolute bottom-2 left-2 rounded bg-white px-2 py-0.5 text-xs text-ink-soft">{photo.kind}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold"><CategoryIcon id={event.categoryId} className="size-4" /> {cat.label}</span>
            {event.isDemo && <span>Demo listing</span>}
            {phase === 'live' && <Badge tone="brand">Happening now</Badge>}
          </div>
          <SaveButton event={event} className="relative z-10 shrink-0" />
        </div>
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
          <p className="text-xs text-muted">{rec.explanation}</p>
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
      <div className="skeleton aspect-[2/1] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-9 w-full" />
      </div>
    </div>
  )
}
