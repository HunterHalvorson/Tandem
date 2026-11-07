/** Small, reusable event UI pieces. */
import { Check, CircleHelp, Hourglass, MessageCircle, Shield, ShieldCheck, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { ACCESS_FEATURES, ACCESS_STATUS_LABEL } from '../../data/accessibility'
import { cn } from '../../lib/cn'
import { formatPrice } from '../../lib/format'
import { eventPhase, joinState, registeredCount, spotsLeft } from '../../services/db'
import { ratingSummary } from '../../services/reviews'
import { useApp } from '../../state/AppStore'
import { useToast } from '../../state/toast'
import type { AccessStatus, AccessibilityInfo, CalgaryEvent, VerificationStatus } from '../../types'
import { Badge, Button, ButtonLink, ProgressBar, StarRating } from '../ui/primitives'
import { ACCESS_ICON } from './visuals'
import { MILES_NAME } from '../../lib/brand'

export function VerificationBadge({ status, compact = false, iconOnly = false }: { status: VerificationStatus; compact?: boolean; iconOnly?: boolean }) {
  if (iconOnly)
    return status === 'demo_verified' ? (
      <span title="Demo-verified host (simulated — no real ID check)" className="inline-flex shrink-0 text-success">
        <ShieldCheck aria-hidden className="size-4" />
        <span className="sr-only">Demo-verified host</span>
      </span>
    ) : null
  if (status === 'demo_verified')
    return (
      <Badge tone="success" title="Simulated for the hackathon demo — no real identity check took place.">
        <ShieldCheck aria-hidden />
        Demo verified
      </Badge>
    )
  if (status === 'pending')
    return (
      <Badge tone="warning">
        <Hourglass aria-hidden />
        Verification pending
      </Badge>
    )
  return compact ? null : (
    <Badge tone="neutral">
      <Shield aria-hidden />
      Not verified
    </Badge>
  )
}

export function DemoLabel({ className }: { className?: string }) {
  return (
    <Badge tone="outline" className={className} title="Fictional event created for the hackathon demo. The venue is a real public place; the event itself is not real.">
      Demo listing
    </Badge>
  )
}

export function PriceTag({ price, className }: { price: number; className?: string }) {
  return (
    <Badge tone={price === 0 ? 'success' : 'neutral'} className={className}>
      {formatPrice(price)}
    </Badge>
  )
}

export function RatingBadge({ event, size = 'sm' }: { event: CalgaryEvent; size?: 'sm' | 'md' }) {
  const { db } = useApp()
  const s = ratingSummary(db, event)
  if (s.sufficient && s.average !== null) return <StarRating value={s.average} count={s.count} size={size} />
  return (
    <Badge tone="info" title={s.count ? `Only ${s.count} review${s.count === 1 ? '' : 's'} so far — not enough to show a rating.` : 'No reviews yet.'}>
      New
    </Badge>
  )
}

const STATUS_STYLE: Record<AccessStatus, { icon: typeof Check; cls: string }> = {
  confirmed: { icon: Check, cls: 'bg-success-tint text-success' },
  unconfirmed: { icon: CircleHelp, cls: 'bg-mist text-ink-soft' },
  unavailable: { icon: X, cls: 'bg-warning-tint text-warning' },
}

/** Full Comfort & Access card: every feature with an explicit status (never assumed). */
export function AccessibilityList({ info, beginnerFriendly }: { info: AccessibilityInfo; beginnerFriendly?: boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ACCESS_FEATURES.map((f) => {
        const status = info[f.id]
        const S = STATUS_STYLE[status]
        const Icon = ACCESS_ICON[f.id]
        return (
          <li key={f.id} className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{f.label}</p>
              <p className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', S.cls)}>
                <S.icon aria-hidden className="size-3.5" />
                {ACCESS_STATUS_LABEL[status]}
              </p>
            </div>
          </li>
        )
      })}
      {beginnerFriendly !== undefined && (
        <li className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
          <ACCESS_ICON.beginner aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" />
          <div>
            <p className="text-sm font-semibold text-ink">Beginner-friendly</p>
            <p className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', beginnerFriendly ? STATUS_STYLE.confirmed.cls : STATUS_STYLE.unavailable.cls)}>
              {beginnerFriendly ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}
              {beginnerFriendly ? 'Yes — no experience needed' : 'Some experience expected'}
            </p>
          </div>
        </li>
      )}
    </ul>
  )
}

/** Compact list of organizer-confirmed features for cards. */
export function AccessSummary({ info, max = 2 }: { info: AccessibilityInfo; max?: number }) {
  const confirmed = ACCESS_FEATURES.filter((f) => info[f.id] === 'confirmed')
  if (!confirmed.length) return null
  return (
    <>
      {confirmed.slice(0, max).map((f) => {
        const Icon = ACCESS_ICON[f.id]
        return (
          <Badge key={f.id} tone="outline" title={`${f.label}: confirmed by organizer`}>
            <Icon aria-hidden />
            {f.short}
            <span className="sr-only">(confirmed by organizer)</span>
          </Badge>
        )
      })}
      {confirmed.length > max && (
        <Badge tone="outline" title={confirmed.slice(max).map((f) => f.label).join(', ')}>
          +{confirmed.length - max} more
        </Badge>
      )}
    </>
  )
}

export function CapacityMeter({ event, compact = false }: { event: CalgaryEvent; compact?: boolean }) {
  const { db, now } = useApp()
  const going = registeredCount(db, event)
  const left = spotsLeft(db, event)
  const past = eventPhase(event, now) === 'ended'
  return (
    <div className={compact ? 'min-w-0 flex-1' : ''}>
      <p className={cn('flex min-w-0 items-baseline gap-1.5 whitespace-nowrap text-ink', compact ? 'text-xs' : 'text-sm')}>
        <span className="shrink-0 font-semibold">{past ? `${going} registered` : `${going}/${event.capacity} going`}</span>
        {!past && (
          <span className={cn('min-w-0 truncate text-muted', left === 0 && 'font-semibold text-brand-deep', left > 0 && left <= 2 && 'font-semibold text-warning')}>
            · {left === 0 ? 'Full' : compact ? `${left} left` : `${left} spot${left === 1 ? '' : 's'} left`}
          </span>
        )}
      </p>
      <ProgressBar value={going} max={event.capacity} label={`${going} of ${event.capacity} spots taken`} className={compact ? 'mt-1 h-1.5' : 'mt-1.5'} />
    </div>
  )
}

/** The primary call to action, aware of capacity, timing, hosting and session state. */
export function JoinButton({ event, size = 'md', className, fullWidth }: { event: CalgaryEvent; size?: 'sm' | 'md' | 'lg'; className?: string; fullWidth?: boolean }) {
  const { db, user, now, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const state = joinState(db, event, user?.id, now)
  const w = fullWidth ? 'w-full' : ''

  if (!user)
    return (
      <Button
        size={size}
        className={cn(w, className)}
        onClick={() => {
          toast('Sign in or create an account to join events.', { tone: 'info' })
          navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        }}
      >
        Join event<span className="sr-only">: {event.title}</span>
      </Button>
    )

  switch (state.kind) {
    case 'joinable':
      return (
        <Button
          size={size}
          className={cn(w, className)}
          onClick={async () => {
            if (await actions.joinEvent(event.id))
              toast(`You're going to ${event.title}! You'll earn +10 ${MILES_NAME} when you check in.`, {
                action: { label: 'Open group chat', to: `/events/${event.id}/chat` },
              })
          }}
        >
          Join event<span className="sr-only">: {event.title}</span>
        </Button>
      )
    case 'going':
      if (eventPhase(event, now) === 'ended')
        return (
          <ButtonLink to={`/events/${event.id}/chat`} variant="secondary" size={size} className={cn(w, className)}>
            <MessageCircle aria-hidden /> Chat archive<span className="sr-only">: {event.title}</span>
          </ButtonLink>
        )
      return (
        <ButtonLink to={`/events/${event.id}/chat`} variant="subtle" size={size} className={cn(w, className)}>
          <Check aria-hidden /> Going · <MessageCircle aria-hidden /> Chat<span className="sr-only"> with the {event.title} group</span>
        </ButtonLink>
      )
    case 'host':
      return (
        <ButtonLink to={`/events/${event.id}`} variant="secondary" size={size} className={cn(w, className)}>
          Hosting · Manage<span className="sr-only">: {event.title}</span>
        </ButtonLink>
      )
    default: {
      const label = { full: 'Full', started: 'Started', ended: 'Ended', cancelled: 'Cancelled' }[state.kind]
      return (
        <Button size={size} variant="secondary" disabled className={cn(w, className)}>
          {label}
          <span className="sr-only">: {event.title}</span>
        </Button>
      )
    }
  }
}
