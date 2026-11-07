import { List, Map as MapIcon, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { EaseIntoItCard } from '../components/events/EaseIntoItCard'
import { EventCard } from '../components/events/EventCard'
import { JoinButton } from '../components/events/EventBits'
import { FilterPanel } from '../components/filters/FilterPanel'
import { SmartSearch } from '../components/filters/SmartSearch'
import { useEventFilters } from '../components/filters/useEventFilters'
import { Dialog } from '../components/ui/Dialog'
import { Button, ButtonLink, Container, EmptyState, Select } from '../components/ui/primitives'
import { cn } from '../lib/cn'
import { formatEventWhen } from '../lib/dates'
import { usePageTitle } from '../lib/hooks'
import { activeFilterChips, activeFilterCount, DEFAULT_FILTERS, filterEvents, SORT_LABEL, sortEvents, sortReference, type SortKey } from '../services/filters'
import { recommendationScores } from '../services/recommendations'
import { useApp } from '../state/AppStore'

export function ViewToggle({ view }: { view: 'list' | 'map' }) {
  const { search } = useLocation()
  const base = 'inline-flex h-9 items-center gap-1.5 rounded-[0.45rem] px-3 text-sm font-semibold [&_svg]:size-4'
  return (
    <nav aria-label="View" className="inline-flex rounded-control border border-line-strong bg-mist p-1">
      <Link to={{ pathname: '/discover', search }} aria-current={view === 'list' ? 'page' : undefined} className={cn(base, view === 'list' ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink')}>
        <List aria-hidden /> List
      </Link>
      <Link to={{ pathname: '/map', search }} aria-current={view === 'map' ? 'page' : undefined} className={cn(base, view === 'map' ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink')}>
        <MapIcon aria-hidden /> Map
      </Link>
    </nav>
  )
}

export default function DiscoverPage() {
  usePageTitle('Discover events')
  const { db, user, now } = useApp()
  const [filters, setFilters] = useEventFilters()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { search } = useLocation()

  const filtered = useMemo(() => filterEvents(db, filters, now), [db, filters, now])
  const recs = useMemo(() => (user ? recommendationScores(db, user, filtered, now) : null), [db, user, filtered, now])
  const scores = useMemo(() => (recs ? new Map([...recs].map(([id, r]) => [id, r?.score ?? 0])) : undefined), [recs])
  const sorted = useMemo(() => sortEvents(db, filtered, filters, { now, user, scores }), [db, filtered, filters, now, user, scores])
  const chips = activeFilterChips(filters)
  const count = activeFilterCount(filters)
  const reference = filters.sort === 'closest' ? sortReference(filters, user) : undefined
  const showRecs = !!user && filters.sort === 'recommended'
  const topPick = showRecs ? sorted.map((e) => recs?.get(e.id)).find((r) => r && r.score > 0) : undefined

  return (
    <Container wide className="py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold tracking-wider text-brand uppercase">Less scrolling. More doing.</p>
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Discover Calgary</h1>
          <p className="mt-1 text-muted">Real activities with real people — filtered for what matters to you.</p>
        </div>
        <ButtonLink to={{ pathname: '/map', search }} variant="secondary" className="max-sm:hidden">
          <MapIcon aria-hidden /> Explore Calgary Map
        </ButtonLink>
      </div>

      <SmartSearch key={filters.q} filters={filters} onChange={setFilters} className="mb-6" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside aria-label="Event filters" className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-card border border-line bg-white px-4 pt-3 pb-2 shadow-card">
            <FilterPanel filters={filters} onChange={setFilters} />
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              <SlidersHorizontal aria-hidden /> Filters{count > 0 && ` (${count})`}
            </Button>
            <h2 id="results-heading" className="mr-auto text-base font-bold text-ink" aria-live="polite">
              {sorted.length} {sorted.length === 1 ? 'event' : 'events'}
              <span className="font-normal text-muted"> {count || filters.q ? 'match your filters' : 'coming up in Calgary'}</span>
            </h2>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold whitespace-nowrap text-muted">Sort by</span>
              <Select compact value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </Select>
            </label>
            <ViewToggle view="list" />
          </div>

          {chips.length > 0 && (
            <ul aria-label="Active filters" className="mb-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => setFilters(c.remove(filters))}
                    className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-white py-1 pr-2 pl-3 text-sm font-medium text-ink hover:border-brand hover:text-brand-deep"
                    aria-label={`Remove filter: ${c.label}`}
                  >
                    {c.label}
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} className="px-2 py-1 text-sm font-semibold text-brand hover:underline">
                  Clear all
                </button>
              </li>
            </ul>
          )}

          <EaseIntoItCard className="mb-4" />

          {filters.sort === 'closest' && reference && <p className="mb-4 text-sm text-muted">Distances measured from <strong className="text-ink">{reference.label}</strong>. Pick a single quadrant filter to change the reference point.</p>}

          {topPick && (
            <div className="mb-6 flex flex-col gap-4 rounded-card border border-brand/30 bg-brand-tint/50 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand uppercase">
                  <Sparkles aria-hidden className="size-4" /> Your best next step
                </p>
                <p className="mt-1 text-lg font-bold text-ink">
                  <Link to={`/events/${topPick.event.id}`} className="hover:text-brand-deep hover:underline">
                    {topPick.event.title}
                  </Link>
                </p>
                <p className="text-sm text-ink-soft">
                  {formatEventWhen(topPick.event.startsAt, now)} · {topPick.event.venue.approximate ? topPick.event.venue.area : topPick.event.venue.name}
                </p>
                <p className="mt-1 text-sm text-brand-deep">{topPick.explanation}</p>
              </div>
              <JoinButton event={topPick.event} size="lg" />
            </div>
          )}

          {sorted.length === 0 ? (
            <EmptyState
              icon={<SlidersHorizontal aria-hidden />}
              title="No events match these filters"
              actions={
                <>
                  <Button variant="secondary" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>
                    Reset filters
                  </Button>
                  <ButtonLink to="/events/new">Host this event yourself</ButtonLink>
                </>
              }
            >
              Try widening the price or date range — or be the person who starts the group Calgary is missing.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {sorted.map((e) => (
                <li key={e.id} className="flex min-w-0">
                  <EventCard event={e} rec={showRecs ? recs?.get(e.id) : undefined} distanceFrom={reference} className="w-full" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        variant="sheet"
        footer={
          <Button className="w-full" onClick={() => setSheetOpen(false)}>
            Show {sorted.length} {sorted.length === 1 ? 'event' : 'events'}
          </Button>
        }
      >
        <FilterPanel filters={filters} onChange={setFilters} />
      </Dialog>
    </Container>
  )
}
