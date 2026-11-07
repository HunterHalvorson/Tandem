import { CalendarDays, Check, Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CreateGroup } from '../components/events/CreateGroup'
import { CategoryCover, CategoryIcon } from '../components/events/visuals'
import { Avatar, Badge, Button, Chip, Container, EmptyState, PageHeader } from '../components/ui/primitives'
import { CATEGORIES } from '../data/categories'
import { QUADRANTS } from '../data/calgary'
import { formatEventWhen } from '../lib/dates'
import { displayName } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { getUser } from '../services/db'
import { groupEvents, groupMemberCount, isMember } from '../services/groups'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'
import type { CommunityGroup, Quadrant } from '../types'

export function GroupJoinButton({ group, size = 'md' }: { group: CommunityGroup; size?: 'sm' | 'md' }) {
  const { db, user, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  if (user?.id === group.organizerId)
    return (
      <Badge tone="brand" className="py-1.5">
        Organizer
      </Badge>
    )
  const member = isMember(db, group.id, user?.id)
  return member ? (
    <Button
      variant="subtle"
      size={size === 'sm' ? 'sm' : 'md'}
      onClick={async () => {
        if (await actions.leaveGroup(group.id)) toast(`You left ${group.name}.`, { tone: 'info' })
      }}
    >
      <Check aria-hidden /> Member<span className="sr-only"> of {group.name} — select to leave</span>
    </Button>
  ) : (
    <Button
      size={size === 'sm' ? 'sm' : 'md'}
      onClick={async () => {
        if (!user) {
          navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
          return
        }
        if (await actions.joinGroup(group.id)) toast(`Welcome to ${group.name}! Their events now appear on your dashboard.`, { action: { label: 'View group', to: `/groups/${group.id}` } })
      }}
    >
      Join group<span className="sr-only">: {group.name}</span>
    </Button>
  )
}

export default function GroupsPage() {
  usePageTitle('Community groups')
  const { db, now, shared } = useApp()
  const [q, setQ] = useState('')
  const [quad, setQuad] = useState<Quadrant | null>(null)
  const groups = useMemo(
    () =>
      db.groups
        .filter((g) => !quad || g.quadrant === quad)
        .filter((g) => {
          const t = q.trim().toLowerCase()
          return !t || `${g.name} ${g.description} ${CATEGORIES[g.categoryId].label} ${g.area}`.toLowerCase().includes(t)
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db.groups, q, quad],
  )
  return (
    <Container className="py-8">
      <PageHeader
        eyebrow="Groups outlast events"
        title="Community groups"
        description="Persistent interest groups that host activities again and again. Join a few — their events show up on your dashboard."
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {shared && <CreateGroup />}
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Search groups</span>
          <Search aria-hidden className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search groups" className="h-11 w-full rounded-control border border-line-strong bg-white pr-3 pl-10 text-[0.9375rem]" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by quadrant">
          <Chip selected={quad === null} onToggle={() => setQuad(null)}>
            All Calgary
          </Chip>
          {QUADRANTS.map((x) => (
            <Chip key={x} selected={quad === x} onToggle={() => setQuad(quad === x ? null : x)}>
              {x}
            </Chip>
          ))}
        </div>
        <p className="ml-auto text-sm text-muted" aria-live="polite">
          {groups.length} groups
        </p>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={<UsersRound aria-hidden />} title="No groups match" actions={<Button variant="secondary" onClick={() => { setQ(''); setQuad(null) }}>Clear search</Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const organizer = getUser(db, g.organizerId)
            const next = groupEvents(db, g.id, now).upcoming[0]
            return (
              <li key={g.id}>
                <article className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition-shadow hover:shadow-lift">
                  <CategoryCover categoryId={g.categoryId} variant={g.coverVariant} className="aspect-[16/7]" />
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="outline">
                        <CategoryIcon id={g.categoryId} /> {CATEGORIES[g.categoryId].label}
                      </Badge>
                      {g.quadrant && <Badge tone="neutral">{g.quadrant}</Badge>}
                    </div>
                    <h2 className="text-lg font-bold text-ink">
                      <Link to={`/groups/${g.id}`} className="after:absolute after:inset-0 hover:text-brand-deep">
                        {g.name}
                      </Link>
                    </h2>
                    <p className="line-clamp-3 text-sm text-ink-soft">{g.description}</p>
                    {next ? (
                      <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                        <CalendarDays aria-hidden className="size-4 text-muted" /> Next: {formatEventWhen(next.startsAt, now)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">No upcoming events scheduled</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-ink">{groupMemberCount(db, g)} members</p>
                        {organizer && (
                          <p className="flex items-center gap-1 truncate text-xs text-muted">
                            <Avatar user={organizer} size="xs" /> Organized by {displayName(organizer)}
                          </p>
                        )}
                      </div>
                      <div className="relative z-10">
                        <GroupJoinButton group={g} size="sm" />
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-8 text-center text-xs text-muted">{!shared && "Member counts include seeded demo members. "}Groups have no rankings, likes or follower lists.</p>
    </Container>
  )
}
