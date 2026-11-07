import { ArrowLeft, CalendarPlus, ListChecks, MapPin, UsersRound } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { RatingBadge, VerificationBadge } from '../components/events/EventBits'
import { EventCard } from '../components/events/EventCard'
import { CategoryCover, CategoryIcon } from '../components/events/visuals'
import { Avatar, Badge, ButtonLink, Card, Container, EmptyState, SectionHeading } from '../components/ui/primitives'
import { CATEGORIES } from '../data/categories'
import { formatMonthDay } from '../lib/dates'
import { displayName } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { getGroup, getUser, verificationStatus } from '../services/db'
import { groupEvents, groupMemberCount } from '../services/groups'
import { useApp } from '../state/AppStore'
import type { User } from '../types'
import { GroupJoinButton } from './GroupsPage'

export default function GroupDetailPage() {
  const { id } = useParams()
  const { db, user, now } = useApp()
  const group = getGroup(db, id)
  usePageTitle(group?.name ?? 'Group not found')
  if (!group)
    return (
      <Container className="py-16">
        <EmptyState title="Group not found" actions={<ButtonLink to="/groups">All groups</ButtonLink>} />
      </Container>
    )
  const organizer = getUser(db, group.organizerId)
  const { upcoming, past } = groupEvents(db, group.id, now)
  const members = db.memberships
    .filter((m) => m.groupId === group.id)
    .map((m) => getUser(db, m.userId))
    .filter((u): u is User => !!u)
  return (
    <Container className="py-6 sm:py-8">
      <Link to="/groups" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All groups
      </Link>
      <CategoryCover categoryId={group.categoryId} variant={group.coverVariant} iconSize="lg" className="aspect-[21/6] rounded-card border border-line" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">
              <CategoryIcon id={group.categoryId} /> {CATEGORIES[group.categoryId].label}
            </Badge>
            <Badge tone="neutral">
              <MapPin aria-hidden /> {group.area}
            </Badge>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">{group.name}</h1>
          <p className="mt-3 max-w-3xl text-lg text-ink-soft">{group.description}</p>

          <section className="mt-10" aria-labelledby="g-upcoming">
            <SectionHeading
              id="g-upcoming"
              title="Upcoming events"
              action={
                user?.id === group.organizerId ? (
                  <ButtonLink to="/events/new" size="sm">
                    <CalendarPlus aria-hidden /> Schedule an event
                  </ButtonLink>
                ) : undefined
              }
            />
            {upcoming.length ? (
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex min-w-0">
                    <EventCard event={e} className="w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing scheduled yet">Join the group to hear about the next one.</EmptyState>
            )}
          </section>

          {past.length > 0 && (
            <section className="mt-10" aria-labelledby="g-past">
              <SectionHeading id="g-past" title="Past events" />
              <ul className="divide-y divide-line rounded-card border border-line bg-white">
                {past.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <Link to={`/events/${e.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                      {e.title} <span className="font-normal text-muted">· {formatMonthDay(new Date(e.startsAt))}</span>
                    </Link>
                    {e.status === 'cancelled' ? <Badge tone="warning">Cancelled</Badge> : <RatingBadge event={e} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-2xl font-extrabold text-ink">{groupMemberCount(db, group)}</p>
            <p className="text-sm text-muted">members (includes seeded demo members)</p>
            <div className="mt-4">
              <GroupJoinButton group={group} />
            </div>
            {members.length > 0 && (
              <div className="mt-4 flex -space-x-2" role="img" aria-label={`${members.length} members with accounts in this demo`}>
                {members.slice(0, 8).map((m) => (
                  <Avatar key={m.id} user={m} size="sm" className="ring-2 ring-white" />
                ))}
              </div>
            )}
          </Card>
          {organizer && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-muted uppercase">Organizer</h2>
              <Link to={`/people/${organizer.id}`} className="flex items-center gap-3 rounded-lg hover:bg-mist">
                <Avatar user={organizer} />
                <span>
                  <span className="block font-semibold text-ink">{displayName(organizer)}</span>
                  <VerificationBadge status={verificationStatus(organizer, now)} compact />
                </span>
              </Link>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold">
              <ListChecks aria-hidden className="size-4.5" /> Group guidelines
            </h2>
            <ul className="space-y-2 text-sm text-ink-soft">
              {group.guidelines.map((g) => (
                <li key={g} className="flex gap-2">
                  <span aria-hidden className="text-brand">•</span>
                  {g}
                </li>
              ))}
            </ul>
          </Card>
          <p className="flex items-start gap-2 px-1 text-xs text-muted">
            <UsersRound aria-hidden className="mt-0.5 size-3.5 shrink-0" /> One group can host many events over time. No popularity metrics — just people doing things together.
          </p>
        </aside>
      </div>
    </Container>
  )
}
