import { Accessibility, BadgeCheck, CalendarDays, HandHeart, Info, Map as MapIcon, MessageCircle, Plane, RefreshCw, Sprout, Star, UserPlus, UsersRound } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { CategoryIcon } from '../components/events/visuals'
import { Badge, Card, Container, PageHeader, SectionHeading } from '../components/ui/primitives'
import { CATEGORIES } from '../data/categories'
import { QUADRANT_INFO, QUADRANTS } from '../data/calgary'
import { BRAND } from '../lib/brand'
import { cn } from '../lib/cn'
import { usePageTitle } from '../lib/hooks'
import { impactMetrics } from '../services/impact'
import { useApp } from '../state/AppStore'
import type { CategoryId } from '../types'

const compact = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString('en-CA'))

export default function ImpactPage() {
  usePageTitle('Community impact')
  const { db, now } = useApp()
  const m = impactMetrics(db, now)
  const byCategory = (Object.entries(m.byCategory) as Array<[CategoryId, number]>).sort((a, b) => b[1] - a[1])

  return (
    <Container className="py-8">
      <PageHeader
        eyebrow="Measuring connection, not clicks"
        title="Community impact"
        description={`How ${BRAND.name} moves Calgarians and visitors from scrolling to showing up — computed live from this browser’s dataset.`}
        actions={
          <Badge tone="warning" className="py-1.5 text-sm" title="Seeded numbers are demonstration data, not real Calgary outcomes.">
            <Info aria-hidden /> Demo data
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col justify-between p-6">
          <p className="text-sm font-semibold text-muted">People signed up for upcoming activities</p>
          <p className="mt-2 text-6xl font-extrabold tracking-tight text-ink">{compact(m.upcomingParticipants)}</p>
          <p className="mt-3 text-sm text-muted">
            Includes seeded demo participants. Events joined in this browser: <strong className="text-ink">{m.live.registrations}</strong>.
          </p>
        </Card>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={<CalendarDays aria-hidden />} label="Upcoming events" value={m.upcomingEvents} />
          <Stat icon={<Sprout aria-hidden />} label="Free activities" value={m.freeActivities} />
          <Stat icon={<Accessibility aria-hidden />} label="With confirmed accessibility info" value={m.accessibilityLabelled} />
          <Stat icon={<BadgeCheck aria-hidden />} label="First-Time Friendly events" value={m.firstTimeFriendly} />
          <Stat icon={<UsersRound aria-hidden />} label="Community groups" value={m.groups} />
          <Stat icon={<Plane aria-hidden />} label="Traveller-friendly events" value={m.travellerFriendly} />
          <Stat icon={<CalendarDays aria-hidden />} label="Completed events" value={m.completedEvents} />
          <Stat icon={<HandHeart aria-hidden />} label="Interest categories represented" value={m.categoriesRepresented} />
          <Stat icon={<Star aria-hidden />} label="Would attend again with the group" value={m.wouldReturnRate === null ? '—' : `${Math.round(m.wouldReturnRate * 100)}%`} note={`${m.wouldReturnResponses} responses`} />
        </ul>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <BarChart
          title="Upcoming events by quadrant"
          subtitle={`All four quadrants covered (${m.quadrantsCovered}/4) — not just downtown.`}
          rows={QUADRANTS.map((q) => ({ key: q, label: `${q} · ${QUADRANT_INFO[q].name}`, value: m.byQuadrant[q] }))}
        />
        <BarChart
          title="Upcoming events by interest"
          subtitle="Niche interests find their people too."
          rows={byCategory.map(([c, n]) => ({ key: c, label: CATEGORIES[c].label, value: n, icon: <CategoryIcon id={c} className="size-3.5" /> }))}
        />
      </div>

      <section className="mt-10" aria-labelledby="live">
        <SectionHeading
          id="live"
          eyebrow={
            <span className="inline-flex items-center gap-1">
              <RefreshCw aria-hidden className="size-3.5" /> Updates as you use the app
            </span>
          }
          title="Live in this browser"
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat icon={<UserPlus aria-hidden />} label="Accounts created" value={m.live.accounts} />
          <Stat icon={<CalendarDays aria-hidden />} label="Events joined" value={m.live.registrations} />
          <Stat icon={<MapIcon aria-hidden />} label="Events created" value={m.live.eventsCreated} />
          <Stat icon={<MessageCircle aria-hidden />} label="Chat messages" value={m.live.messages} />
          <Stat icon={<Star aria-hidden />} label="Reviews written" value={m.live.reviews} />
          <Stat icon={<UsersRound aria-hidden />} label="Groups joined" value={m.live.groupJoins} />
        </ul>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2" aria-label="Impact approach">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">Calgary challenges we’re designed for</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-soft">
            <li><strong className="text-ink">Newcomers and students</strong> arriving without a local network — onboarding goes straight to small, beginner-friendly activities nearby.</li>
            <li><strong className="text-ink">Visitors</strong> who want authentic experiences — Explore Like a Local connects them with resident hosts instead of paid tours.</li>
            <li><strong className="text-ink">Fragmented event information</strong> across many apps — one map organised by Calgary’s four quadrants.</li>
            <li><strong className="text-ink">Missing accessibility details</strong> — every event states each feature as confirmed, unconfirmed or unavailable.</li>
            <li><strong className="text-ink">Cost and intimidation barriers</strong> — free-only filters, First-Time Friendly details and Ease Into It.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">How a real deployment would measure impact</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-soft">
            <li><strong className="text-ink">“Would you attend another activity with this group?”</strong> — asked after each event, reported only as an aggregate per event or group.</li>
            <li><strong className="text-ink">Return participation</strong> — share of people who attend a second event within 60 days.</li>
            <li><strong className="text-ink">Newcomer integration</strong> — new residents reaching three events in their first two months.</li>
            <li><strong className="text-ink">Reach</strong> — participation across all four quadrants and income-friendly (free) activities.</li>
            <li><strong className="text-ink">Accessibility accuracy</strong> — attendee ratings of whether access info matched reality.</li>
          </ul>
          <p className="mt-4 text-xs text-muted">All measures are aggregated. {BRAND.name} never publishes individual scores or ranks people.</p>
        </Card>
      </section>
      <p className="mt-8 text-xs text-muted">The numbers on this page come from seeded demonstration data plus actions taken in this browser. They are not real Calgary statistics.</p>
    </Container>
  )
}

function Stat({ icon, label, value, note }: { icon: ReactNode; label: string; value: number | string; note?: string }) {
  return (
    <li className="rounded-card border border-line bg-white p-4 shadow-card">
      <span className="text-muted [&_svg]:size-4.5">{icon}</span>
      <p className="mt-2 text-2xl font-bold text-ink">{typeof value === 'number' ? compact(value) : value}</p>
      <p className="text-sm text-ink-soft">{label}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </li>
  )
}

/** Single-series horizontal bar chart: thin bars, value at the tip, hover/focus detail, table view. */
function BarChart({ title, subtitle, rows }: { title: string; subtitle: string; rows: Array<{ key: string; label: string; value: number; icon?: ReactNode }> }) {
  const [active, setActive] = useState<string | null>(null)
  const [table, setTable] = useState(false)
  const id = useId()
  const max = Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <Card as="section" className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-t`} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-ink-soft underline-offset-2 hover:bg-mist hover:underline">
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-1.5 font-semibold">Group</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Events</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line/70">
                <th scope="row" className="py-1.5 text-left font-medium text-ink">{r.label}</th>
                <td className="py-1.5 text-right tabular-nums">{r.value}</td>
                <td className="py-1.5 text-right text-muted tabular-nums">{total ? Math.round((r.value / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul aria-labelledby={`${id}-t`} className="space-y-1">
          {rows.map((r) => {
            const on = active === r.key
            const share = total ? Math.round((r.value / total) * 100) : 0
            return (
              <li
                key={r.key}
                tabIndex={0}
                aria-label={`${r.label}: ${r.value} events, ${share}% of upcoming events`}
                onPointerEnter={() => setActive(r.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(r.key)}
                onBlur={() => setActive(null)}
                className="grid grid-cols-[minmax(0,11.5rem)_1fr] items-center gap-3 rounded-md px-1 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span aria-hidden className="flex min-w-0 items-center gap-1.5 truncate text-sm text-ink-soft">
                  {r.icon}
                  <span className="truncate">{r.label}</span>
                </span>
                <span aria-hidden className="flex items-center gap-2">
                  <span className={cn('h-3.5 rounded-r-[4px] transition-colors', on ? 'bg-brand' : 'bg-ink-soft')} style={{ width: `${Math.max(2, (r.value / max) * 85)}%` }} />
                  <span className="text-sm font-semibold text-ink">{r.value}</span>
                  {on && <span className="text-xs text-muted">{share}% of all</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
