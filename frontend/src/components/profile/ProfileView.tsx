/** A user's profile as others see it — every section respects the user's privacy settings. */
import { CalendarCheck, CalendarDays, ExternalLink, Lock, MapPin, Medal, Plane } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ACCESS_FEATURES } from '../../data/accessibility'
import { CATEGORIES } from '../../data/categories'
import { QUADRANT_INFO } from '../../data/calgary'
import { formatDateRange, formatEventWhen } from '../../lib/dates'
import { displayName } from '../../lib/format'
import { eventPhase, userPastEvents, verificationStatus } from '../../services/db'
import { computeMiles } from '../../services/miles'
import { SOCIALS } from '../../services/socials'
import { useApp } from '../../state/AppStore'
import type { User } from '../../types'
import { VerificationBadge } from '../events/EventBits'
import { CategoryIcon } from '../events/visuals'
import { Avatar, Badge, Card } from '../ui/primitives'

export function residencyLabel(u: User): string {
  switch (u.residency) {
    case 'resident':
      return 'Calgary resident'
    case 'new':
      return 'New to Calgary'
    case 'visiting':
      return u.traveller.homeCity ? `Visiting from ${u.traveller.homeCity}` : 'Visiting Calgary'
    default:
      return 'Planning a visit to Calgary'
  }
}

export function ProfileView({ user, asPublic }: { user: User; asPublic: boolean }) {
  const { db, now } = useApp()
  const p = user.privacy
  const show = (flag: boolean) => !asPublic || flag
  const miles = computeMiles(db, user.id, now)
  const attended = userPastEvents(db, user.id, now).filter((e) => db.registrations.some((r) => r.eventId === e.id && r.userId === user.id && r.checkedInAt))
  const hosted = db.events.filter((e) => e.hostId === user.id && e.status === 'scheduled' && e.visibility === 'public').sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  const name = asPublic ? displayName(user) : `${user.firstName} ${user.lastName}`
  const area = user.neighbourhood ?? (user.quadrant ? `${QUADRANT_INFO[user.quadrant].name} Calgary` : null)

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar user={user} size="xl" decorative={false} />
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-ink">{name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <VerificationBadge status={verificationStatus(user, now)} />
              <Badge tone={user.travelMode ? 'brand' : 'neutral'}>
                {user.travelMode && <Plane aria-hidden />}
                {residencyLabel(user)}
              </Badge>
              {show(p.showLocation) && area && (
                <Badge tone="outline">
                  <MapPin aria-hidden /> {area}
                </Badge>
              )}
            </div>
            {user.travelMode && show(p.showLocation) && (user.traveller.arrival || user.traveller.departure) && (
              <p className="mt-2 text-sm text-muted">In Calgary {formatDateRange(user.traveller.arrival, user.traveller.departure)}</p>
            )}
            {user.bio && <p className="mt-3 max-w-2xl text-ink-soft">{user.bio}</p>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ProfileSection title="Interests" hidden={!show(p.showInterests)}>
          {user.interests.length ? (
            <ul className="flex flex-wrap gap-2">
              {user.interests.map((i) => (
                <li key={i}>
                  <Badge tone="outline" className="py-1 text-sm">
                    <CategoryIcon id={i} /> {CATEGORIES[i].label}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No interests added yet.</p>
          )}
        </ProfileSection>

        <ProfileSection title="Participation milestones">
          {miles.milestones.some((m) => m.achieved) ? (
            <ul className="flex flex-wrap gap-2">
              {miles.milestones
                .filter((m) => m.achieved)
                .map((m) => (
                  <li key={m.id}>
                    <Badge tone="success" className="py-1 text-sm" title={m.description}>
                      <Medal aria-hidden /> {m.title}
                    </Badge>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Milestones appear after the first event.</p>
          )}
          <p className="mt-3 text-xs text-muted">Milestones celebrate taking part. There are no follower counts or rankings of people on Tandem.</p>
        </ProfileSection>

        <ProfileSection title="Social profiles" hidden={!show(p.showSocialLinks)}>
          {Object.keys(user.socials).length ? (
            <ul className="space-y-1.5">
              {SOCIALS.filter((s) => user.socials[s.id]).map((s) => (
                <li key={s.id}>
                  <a href={user.socials[s.id]} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-brand hover:underline">
                    {s.label} <ExternalLink aria-hidden className="size-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No linked profiles.</p>
          )}
        </ProfileSection>

        <ProfileSection title="Comfort & Access preferences" hidden={!show(p.showAccessibility)} privateNote={!asPublic && !p.showAccessibility}>
          {user.comfort.features.length || user.comfort.smallGroups || user.comfort.beginnerFriendly ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {user.comfort.smallGroups && <li><Badge tone="outline">Small groups</Badge></li>}
              {user.comfort.beginnerFriendly && <li><Badge tone="outline">Beginner-friendly</Badge></li>}
              {ACCESS_FEATURES.filter((f) => user.comfort.features.includes(f.id)).map((f) => (
                <li key={f.id}>
                  <Badge tone="outline">{f.short}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">None set.</p>
          )}
        </ProfileSection>

        <ProfileSection title="Events hosted">
          {hosted.length ? (
            <ul className="space-y-2">
              {hosted.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <CalendarDays aria-hidden className="size-4 text-muted" />
                  <Link to={`/events/${e.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                    {e.title}
                  </Link>
                  <span className="text-muted">· {eventPhase(e, now) === 'ended' ? 'past' : formatEventWhen(e.startsAt, now)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Hasn’t hosted yet.</p>
          )}
        </ProfileSection>

        <ProfileSection title="Events attended" hidden={!show(p.showAttendance)} privateNote={!asPublic && !p.showAttendance}>
          {attended.length ? (
            <ul className="space-y-2">
              {attended.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <CalendarCheck aria-hidden className="size-4 text-success" />
                  <Link to={`/events/${e.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No confirmed attendance yet.</p>
          )}
        </ProfileSection>
      </div>
    </div>
  )
}

function ProfileSection({ title, children, hidden, privateNote }: { title: string; children: ReactNode; hidden?: boolean; privateNote?: boolean }) {
  if (hidden) return null
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center justify-between gap-2 text-base font-bold text-ink">
        {title}
        {privateNote && (
          <Badge tone="neutral" title="Only you can see this section.">
            <Lock aria-hidden /> Only you
          </Badge>
        )}
      </h3>
      {children}
    </Card>
  )
}
