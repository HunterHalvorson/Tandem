import { CalendarDays, Crosshair, Layers, MapPin, SlidersHorizontal } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { FilterPanel } from '../components/filters/FilterPanel'
import { useEventFilters } from '../components/filters/useEventFilters'
import { CategoryIcon } from '../components/events/visuals'
import { LazyCalgaryMap } from '../components/map/lazy'
import type { CalgaryMapApi } from '../components/map/CalgaryMap'
import { Dialog } from '../components/ui/Dialog'
import { Badge, Button, Chip } from '../components/ui/primitives'
import { QUADRANT_INFO, QUADRANTS } from '../data/calgary'
import { cn } from '../lib/cn'
import { formatEventWhen } from '../lib/dates'
import { formatPrice } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { spotsLeft } from '../services/db'
import { activeFilterCount, filterEvents, sortEvents } from '../services/filters'
import { recommendationScores } from '../services/recommendations'
import { useApp } from '../state/AppStore'
import { useDisplay } from '../state/display'
import { ViewToggle } from './DiscoverPage'

export default function MapPage() {
  usePageTitle('Calgary map')
  const { db, user, now } = useApp()
  const { reducedMotion } = useDisplay()
  const [filters, setFilters] = useEventFilters()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showQuadrants, setShowQuadrants] = useState(true)
  const [muted, setMuted] = useState(true)
  const [mobileList, setMobileList] = useState(false)
  const api = useRef<CalgaryMapApi | null>(null)

  const filtered = useMemo(() => filterEvents(db, filters, now), [db, filters, now])
  const scores = useMemo(() => {
    if (!user) return undefined
    const recs = recommendationScores(db, user, filtered, now)
    return new Map([...recs].map(([id, r]) => [id, r?.score ?? 0]))
  }, [db, user, filtered, now])
  const sorted = useMemo(() => sortEvents(db, filtered, filters, { now, user, scores }), [db, filtered, filters, now, user, scores])
  const count = activeFilterCount(filters)

  const onMapReady = useCallback((a: CalgaryMapApi) => {
    api.current = a
  }, [])

  const focusEvent = (id: string) => {
    setMobileList(false)
    api.current?.openEvent(id)
  }

  const fitAll = () => {
    if (!api.current || !sorted.length) return
    const pts = sorted.map((e) => [e.venue.lat, e.venue.lng] as [number, number])
    api.current.map.fitBounds(pts, { padding: [40, 40], maxZoom: 14, animate: !reducedMotion })
  }

  const toggleQuadrant = (q: (typeof QUADRANTS)[number] | 'all') =>
    setFilters({ ...filters, quadrants: q === 'all' ? [] : filters.quadrants.includes(q) ? filters.quadrants.filter((x) => x !== q) : [...filters.quadrants, q] })

  const list = (
    <ol className="divide-y divide-line">
      {sorted.map((e) => {
        const left = spotsLeft(db, e)
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => focusEvent(e.id)}
              aria-current={selectedId === e.id ? 'true' : undefined}
              className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-mist', selectedId === e.id && 'bg-brand-tint/60')}
            >
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-2 border-brand bg-white text-ink">
                <CategoryIcon id={e.categoryId} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{e.title}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <CalendarDays aria-hidden className="size-3.5" /> {formatEventWhen(e.startsAt, now)}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <MapPin aria-hidden className="size-3.5" /> <span className="truncate">{e.venue.approximate ? e.venue.area : e.venue.name}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  <Badge tone="neutral">{e.venue.quadrant}</Badge>
                  <Badge tone={e.price === 0 ? 'success' : 'neutral'}>{formatPrice(e.price)}</Badge>
                  <Badge tone={left === 0 ? 'brand' : 'outline'}>{left === 0 ? 'Full' : `${left} left`}</Badge>
                </span>
              </span>
            </button>
          </li>
        )
      })}
      {sorted.length === 0 && (
        <li className="p-6 text-center text-sm text-muted">
          No events match. <button type="button" className="font-semibold text-brand underline" onClick={() => setFilters({ ...filters, quadrants: [], categories: [], access: [], date: 'any', freeOnly: false, maxPrice: 150, q: '' })}>Clear filters</button>
        </li>
      )}
    </ol>
  )

  return (
    <div className="flex h-[calc(100dvh-var(--chrome-top,4rem)-4rem)] min-h-[520px] lg:h-[calc(100dvh-var(--chrome-top,4rem))]">
      <aside aria-labelledby="map-results" className="hidden w-[360px] shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-extrabold text-ink">Explore Calgary</h1>
            <ViewToggle view="map" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p id="map-results" className="text-sm text-muted" aria-live="polite">
              <strong className="text-ink">{sorted.length}</strong> events on the map
            </p>
            <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              <SlidersHorizontal aria-hidden /> Filters{count > 0 && ` (${count})`}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
      </aside>

      <section aria-label="Map" className="relative min-w-0 flex-1">
        <h1 className="sr-only lg:hidden">Explore Calgary map</h1>
        <LazyCalgaryMap
          events={sorted}
          selectedId={selectedId}
          onSelect={setSelectedId}
          highlightQuadrants={filters.quadrants}
          showQuadrants={showQuadrants}
          muted={muted}
          onMapReady={onMapReady}
          className="absolute inset-0"
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start gap-2">
          <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-card border border-line bg-white/95 p-1.5 shadow-lift" role="group" aria-label="Filter by quadrant">
            <Chip selected={filters.quadrants.length === 0} onToggle={() => toggleQuadrant('all')}>
              All
            </Chip>
            {QUADRANTS.map((q) => (
              <Chip key={q} selected={filters.quadrants.includes(q)} onToggle={() => toggleQuadrant(q)}>
                <span aria-hidden>{q}</span>
                <span className="sr-only">{QUADRANT_INFO[q].name}</span>
              </Chip>
            ))}
          </div>
          <div className="pointer-events-auto ml-auto flex gap-2 lg:hidden">
            <Button variant="secondary" size="sm" className="shadow-lift" onClick={() => setSheetOpen(true)}>
              <SlidersHorizontal aria-hidden /> Filters{count > 0 && ` (${count})`}
            </Button>
            <Button variant="secondary" size="sm" className="shadow-lift" onClick={() => setMobileList((v) => !v)} aria-expanded={mobileList}>
              {mobileList ? 'Show map' : `List (${sorted.length})`}
            </Button>
          </div>
        </div>

        <div className="absolute bottom-6 left-3 z-[500] flex flex-col gap-2">
          <Button variant="secondary" size="sm" className="shadow-lift" onClick={fitAll}>
            <Crosshair aria-hidden /> Fit to events
          </Button>
          <Button variant="secondary" size="sm" className="shadow-lift" aria-pressed={showQuadrants} onClick={() => setShowQuadrants((v) => !v)}>
            <Layers aria-hidden /> Quadrants {showQuadrants ? 'on' : 'off'}
          </Button>
          <Button variant="secondary" size="sm" className="shadow-lift" aria-pressed={!muted} onClick={() => setMuted((v) => !v)}>
            Map colour: {muted ? 'muted' : 'full'}
          </Button>
        </div>

        {mobileList && <div className="absolute inset-x-0 top-16 bottom-0 z-[600] overflow-y-auto border-t border-line bg-white lg:hidden">{list}</div>}
        <p className="absolute right-2 bottom-7 z-[500] hidden max-w-[16rem] rounded-md bg-white/90 px-2 py-1 text-[0.7rem] text-muted shadow-card sm:block">
          Quadrant lines are approximate. Dashed circles mark private locations (area only).
        </p>
      </section>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter the map"
        description="Same filters as the list view — results stay in sync."
        variant="sheet"
        footer={
          <Button className="w-full" onClick={() => setSheetOpen(false)}>
            Show {sorted.length} on map
          </Button>
        }
      >
        <FilterPanel filters={filters} onChange={setFilters} />
      </Dialog>
    </div>
  )
}
