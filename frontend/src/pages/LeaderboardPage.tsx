import { CalendarDays, Info, Scale, Sparkles, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '../components/events/visuals'
import { Badge, Card, Chip, Container, EmptyState, PageHeader, Segmented, Select, StarRating } from '../components/ui/primitives'
import { ACCESS_FEATURES } from '../data/accessibility'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { QUADRANTS } from '../data/calgary'
import { formatEventWhen, formatMonthDay } from '../lib/dates'
import { usePageTitle } from '../lib/hooks'
import { BAYES_C, buildLeaderboard, DEFAULT_LEADERBOARD_FILTERS, WEIGHTS, type LeaderboardEntry, type LeaderboardFilters } from '../services/leaderboard'
import { MIN_REVIEWS_FOR_RATING } from '../services/reviews'
import { useApp } from '../state/AppStore'

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

export default function LeaderboardPage() {
  usePageTitle('Calgary event leaderboard')
  const { db, now } = useApp()
  const [f, setF] = useState<LeaderboardFilters>(DEFAULT_LEADERBOARD_FILTERS)
  const { ranked, fresh, globalMean } = useMemo(() => buildLeaderboard(db, f, now), [db, f, now])
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <Container className="py-8">
      <PageHeader
        eyebrow="Rank events, not individuals"
        title="Calgary Event Leaderboard"
        description="The best-loved community activities in the city, ranked by a fair, transparent formula — so a great small book club can beat a big but so-so meetup."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4" role="group" aria-label="Leaderboard filters">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Category
          <Select compact value={f.categories[0] ?? ''} onChange={(e) => setF({ ...f, categories: e.target.value ? [e.target.value as never] : [] })}>
            <option value="">All categories</option>
            {CATEGORY_IDS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].label}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          <span id="lb-range">Date range</span>
          <Segmented
            label="Date range"
            size="sm"
            value={f.range}
            onChange={(range) => setF({ ...f, range })}
            options={[
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: '90 days' },
              { value: 'all', label: 'All time' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          <span>Price</span>
          <Segmented
            label="Price"
            size="sm"
            value={f.price}
            onChange={(price) => setF({ ...f, price })}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm font-semibold">
          <span>Quadrant</span>
          <div className="flex gap-1.5">
            {QUADRANTS.map((q) => (
              <Chip key={q} selected={f.quadrants.includes(q)} onToggle={() => setF({ ...f, quadrants: toggle(f.quadrants, q) })} className="min-h-8 px-2.5 py-1">
                {q}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex basis-full flex-col gap-1 text-sm font-semibold">
          <span>Confirmed accessibility</span>
          <div className="flex flex-wrap gap-1.5">
            {ACCESS_FEATURES.map((a) => (
              <Chip key={a.id} selected={f.access.includes(a.id)} onToggle={() => setF({ ...f, access: toggle(f.access, a.id) })} className="min-h-8 px-2.5 py-1">
                {a.short}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <details className="group mb-6 rounded-card border border-info/25 bg-info-tint/60 p-4 text-sm text-ink-soft">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-info [&::-webkit-details-marker]:hidden">
          <Scale aria-hidden className="size-4" /> How rankings work (and why they’re fair)
        </summary>
        <div className="mt-3 space-y-2">
          <p>Ranking purely by attendance or number of reviews would always favour big events. Instead each activity gets a score out of 100:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>{Math.round(WEIGHTS.rating * 100)}% Bayesian-adjusted rating</strong> — the average is blended with the city-wide mean ({globalMean.toFixed(2)}★) as if every event started with {BAYES_C} average reviews, so three 5-star reviews can’t automatically beat thirty 4.8s.
            </li>
            <li>
              <strong>{Math.round(WEIGHTS.fill * 100)}% participation relative to capacity</strong> — a full 10-person book club counts the same as a full 60-person meetup.
            </li>
            <li>
              <strong>{Math.round(WEIGHTS.completion * 100)}% event completion</strong> — sessions that actually happened vs. ones that were cancelled.
            </li>
            <li>
              <strong>{Math.round(WEIGHTS.confidence * 100)}% review confidence</strong> — more reviews means more certainty: n ÷ (n + {BAYES_C}).
            </li>
          </ul>
          <p>Activities with fewer than {MIN_REVIEWS_FOR_RATING} reviews are listed as <strong>New</strong> instead of being ranked. Only confirmed attendees can review, once per event. People are never ranked.</p>
        </div>
      </details>

      {ranked.length === 0 ? (
        <EmptyState icon={<Trophy aria-hidden />} title="No ranked events match these filters">
          Try a wider date range or fewer filters.
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card border border-line bg-white shadow-card md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Ranked Calgary events with ratings, reviews, attendance and engagement</caption>
              <thead className="border-b border-line bg-mist text-xs font-bold tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Rank</th>
                  <th scope="col" className="px-4 py-3">Event</th>
                  <th scope="col" className="px-4 py-3">Rating</th>
                  <th scope="col" className="px-4 py-3">Reviews</th>
                  <th scope="col" className="px-4 py-3">Attendance</th>
                  <th scope="col" className="px-4 py-3">Engagement</th>
                  <th scope="col" className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ranked.map((e) => (
                  <Row key={e.key} e={e} />
                ))}
              </tbody>
            </table>
          </div>
          <ol className="space-y-3 md:hidden">
            {ranked.map((e) => (
              <li key={e.key}>
                <MobileCard e={e} />
              </li>
            ))}
          </ol>
        </>
      )}

      {fresh.length > 0 && (
        <section className="mt-10" aria-labelledby="new-events">
          <h2 id="new-events" className="mb-1 flex items-center gap-2 text-xl font-bold text-ink">
            <Sparkles aria-hidden className="size-5 text-info" /> New — not enough reviews to rank yet
          </h2>
          <p className="mb-4 text-sm text-muted">These activities have fewer than {MIN_REVIEWS_FOR_RATING} reviews, so we don’t pretend to know how they compare.</p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((e) => (
              <li key={e.key}>
                <Card className="flex h-full items-start gap-3 p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mist">
                    <CategoryIcon id={e.categoryId} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <Link to={`/events/${(e.next ?? e.latest).id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                      {e.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {CATEGORIES[e.categoryId].label} · {e.quadrant} · {e.reviewCount} review{e.reviewCount === 1 ? '' : 's'}
                    </p>
                    <Badge tone="info" className="mt-2">New</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 flex items-start gap-2 text-xs text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" /> Seeded reviews and attendance are demo data. Recurring activities combine feedback from all completed sessions.
      </p>
    </Container>
  )
}

function Row({ e }: { e: LeaderboardEntry }) {
  const { now } = useApp()
  return (
    <tr className="align-top hover:bg-paper">
      <td className="px-4 py-4">
        <span className={e.rank && e.rank <= 3 ? 'grid size-8 place-items-center rounded-full bg-brand font-extrabold text-white' : 'grid size-8 place-items-center rounded-full bg-mist font-bold text-ink'}>
          {e.rank}
        </span>
      </td>
      <td className="px-4 py-4">
        <Link to={`/events/${(e.next ?? e.latest).id}`} className="font-bold text-ink hover:text-brand hover:underline">
          {e.title}
        </Link>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <CategoryIcon id={e.categoryId} className="size-3.5" /> {CATEGORIES[e.categoryId].label} · {e.quadrant} · {e.completedSessions} session{e.completedSessions === 1 ? '' : 's'}
          {e.cancelledSessions > 0 && ` (${e.cancelledSessions} cancelled)`}
        </p>
        {e.next ? (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-deep">
            <CalendarDays aria-hidden className="size-3.5" /> Next: {formatEventWhen(e.next.startsAt, now)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">Last held {formatMonthDay(new Date(e.latest.startsAt))}</p>
        )}
      </td>
      <td className="px-4 py-4">
        {e.average !== null && <StarRating value={e.average} />}
        <p className="mt-0.5 text-xs text-muted">Adjusted {e.bayesian.toFixed(2)}</p>
      </td>
      <td className="px-4 py-4 tabular-nums">{e.reviewCount}</td>
      <td className="px-4 py-4">
        <span className="tabular-nums">{e.attendance}</span>
        <p className="text-xs text-muted">{pct(e.fill)} of capacity</p>
      </td>
      <td className="px-4 py-4">
        <span className="tabular-nums">{pct(e.wouldReturnRate)}</span>
        <p className="text-xs text-muted">would come back</p>
      </td>
      <td className="px-4 py-4 text-right text-base font-extrabold tabular-nums">{e.score.toFixed(1)}</td>
    </tr>
  )
}

function MobileCard({ e }: { e: LeaderboardEntry }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-extrabold text-white" aria-label={`Rank ${e.rank}`}>
          {e.rank}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/events/${(e.next ?? e.latest).id}`} className="font-bold text-ink hover:underline">
            {e.title}
          </Link>
          <p className="text-xs text-muted">
            {CATEGORIES[e.categoryId].label} · {e.quadrant}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {e.average !== null && <StarRating value={e.average} count={e.reviewCount} />}
            <span>{pct(e.fill)} full</span>
            <span>{pct(e.wouldReturnRate)} would return</span>
          </div>
        </div>
        <span className="text-lg font-extrabold">{e.score.toFixed(0)}</span>
      </div>
    </Card>
  )
}
