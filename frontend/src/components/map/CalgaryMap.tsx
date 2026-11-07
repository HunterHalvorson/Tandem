/**
 * Interactive Calgary map (Leaflet + OpenStreetMap). Shows the SAME filtered events as the list,
 * with category-icon markers, an approximate quadrant overlay, previews in popups, and keyboard access.
 */
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Link } from 'react-router'
import { CATEGORIES } from '../../data/categories'
import { CITY_CENTRE, QUADRANT_INFO, QUADRANT_LINES, QUADRANT_POLYGONS, QUADRANTS } from '../../data/calgary'
import { formatEventWhen } from '../../lib/dates'
import { formatPrice } from '../../lib/format'
import { spotsLeft } from '../../services/db'
import { useApp } from '../../state/AppStore'
import { useDisplay } from '../../state/display'
import type { CalgaryEvent, Quadrant } from '../../types'
import { JoinButton } from '../events/EventBits'
import { CategoryCover, CategoryIcon } from '../events/visuals'
import { clusterIcon, eventMarkerIcon, quadrantLabelIcon } from './markers'

export interface CalgaryMapApi {
  map: L.Map
  /** Fly to an event (pulling it out of any cluster) and open its preview. */
  openEvent: (id: string) => void
}

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function FitToEvents({ events, signature }: { events: CalgaryEvent[]; signature: string }) {
  const map = useMap()
  const { reducedMotion } = useDisplay()
  useEffect(() => {
    if (!events.length) {
      map.setView([CITY_CENTRE.lat, CITY_CENTRE.lng], 11, { animate: !reducedMotion })
      return
    }
    const bounds = L.latLngBounds(events.map((e) => [e.venue.lat, e.venue.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.15), { maxZoom: 14, animate: !reducedMotion })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
  return null
}

type Layout = Array<{ kind: 'event'; event: CalgaryEvent; lat: number; lng: number } | { kind: 'cluster'; events: CalgaryEvent[]; lat: number; lng: number }>

/**
 * Zoom-aware marker layout: events closer than ~44px on screen merge into a numbered cluster
 * (below zoom 15); events at the same venue fan out in a small ring so each stays clickable.
 * The selected event is never hidden inside a cluster.
 */
function layoutAtZoom(map: L.Map, events: CalgaryEvent[], zoom: number, selectedId: string | null | undefined): Layout {
  const R = zoom >= 15 ? 0 : 44
  const pts = [...events]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((e) => ({ e, p: map.project([e.venue.lat, e.venue.lng], zoom) }))
  const used = new Set<string>()
  const out: Layout = []
  const singles: typeof pts = []
  for (const a of pts) {
    if (used.has(a.e.id)) continue
    used.add(a.e.id)
    const group = [a]
    if (R > 0 && a.e.id !== selectedId)
      for (const b of pts)
        if (!used.has(b.e.id) && b.e.id !== selectedId && a.p.distanceTo(b.p) < R) {
          group.push(b)
          used.add(b.e.id)
        }
    if (group.length === 1) singles.push(a)
    else {
      const cx = group.reduce((s, g) => s + g.p.x, 0) / group.length
      const cy = group.reduce((s, g) => s + g.p.y, 0) / group.length
      const c = map.unproject([cx, cy], zoom)
      out.push({ kind: 'cluster', events: group.map((g) => g.e), lat: c.lat, lng: c.lng })
    }
  }
  // Fan out singles that sit on (almost) the same pixel.
  const done = new Set<string>()
  for (const a of singles) {
    if (done.has(a.e.id)) continue
    const stack = singles.filter((b) => !done.has(b.e.id) && a.p.distanceTo(b.p) < 10)
    stack.forEach((b) => done.add(b.e.id))
    if (stack.length === 1) {
      out.push({ kind: 'event', event: a.e, lat: a.e.venue.lat, lng: a.e.venue.lng })
      continue
    }
    stack.forEach((b, i) => {
      const angle = (2 * Math.PI * i) / stack.length - Math.PI / 2
      const ll = map.unproject([a.p.x + 26 * Math.cos(angle), a.p.y + 26 * Math.sin(angle)], zoom)
      out.push({ kind: 'event', event: b.e, lat: ll.lat, lng: ll.lng })
    })
  }
  return out
}

function EventMarkers({
  events,
  selectedId,
  onSelect,
  onReady,
}: {
  events: CalgaryEvent[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onReady?: (api: CalgaryMapApi) => void
}) {
  const map = useMap()
  const { db } = useApp()
  const { reducedMotion } = useDisplay()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const markerRefs = useRef(new Map<string, L.Marker>())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const layout = useMemo(() => layoutAtZoom(map, events, zoom, selectedId), [map, events, zoom, selectedId])

  const latest = useRef({ events, onSelect, reducedMotion })
  useEffect(() => {
    latest.current = { events, onSelect, reducedMotion }
  })
  useEffect(() => {
    onReady?.({
      map,
      openEvent: (id) => {
        const { events: evs, onSelect: select, reducedMotion: still } = latest.current
        const e = evs.find((x) => x.id === id)
        if (!e) return
        select?.(id)
        const open = (tries = 0) => {
          const m = markerRefs.current.get(id)
          if (m) m.openPopup()
          else if (tries < 12) setTimeout(() => open(tries + 1), 60)
        }
        const target = L.latLng(e.venue.lat, e.venue.lng)
        const z = Math.max(map.getZoom(), 14)
        if (still) {
          map.setView(target, z, { animate: false })
          open()
        } else {
          map.flyTo(target, z, { duration: 0.6 })
          map.once('moveend', () => open())
        }
      },
    })
  }, [map, onReady])

  return (
    <>
      {layout.map((item) => {
        if (item.kind === 'cluster') {
          const titles = item.events.map((e) => e.title)
          return (
            <Marker
              key={`c-${item.events.map((e) => e.id).join('|')}`}
              position={[item.lat, item.lng]}
              icon={clusterIcon(item.events.length)}
              title={`${item.events.length} events here: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '…' : ''}. Press Enter to zoom in.`}
              keyboard
              eventHandlers={{
                click: () => {
                  const pts = item.events.map((e) => L.latLng(e.venue.lat, e.venue.lng))
                  const b = L.latLngBounds(pts)
                  const same = b.getNorthEast().distanceTo(b.getSouthWest()) < 30
                  if (same) map.setView(b.getCenter(), Math.max(15, map.getZoom() + 2), { animate: !reducedMotion })
                  else map.fitBounds(b.pad(0.35), { maxZoom: Math.min(18, map.getZoom() + 3), animate: !reducedMotion })
                },
              }}
            />
          )
        }
        const { event } = item
        const selected = event.id === selectedId
        const full = spotsLeft(db, event) === 0
        return (
          <Fragment key={event.id}>
            {event.venue.approximate && (
              <Circle center={[event.venue.lat, event.venue.lng]} radius={450} interactive={false} pathOptions={{ color: '#C8102E', weight: 1, dashArray: '4 4', fillOpacity: 0.06 }} />
            )}
            <Marker
              position={[item.lat, item.lng]}
              icon={eventMarkerIcon(event.categoryId, selected, full)}
              title={`${event.title} — ${CATEGORIES[event.categoryId].label}, ${event.venue.quadrant} Calgary${full ? ', full' : ''}. Press Enter for a preview.`}
              keyboard
              zIndexOffset={selected ? 1000 : 0}
              ref={(m) => {
                if (m) markerRefs.current.set(event.id, m)
                else markerRefs.current.delete(event.id)
              }}
              eventHandlers={{
                click: () => onSelect?.(event.id),
                popupclose: () => onSelect?.(null),
              }}
            >
              <Popup autoPanPadding={[24, 24]} maxWidth={300} minWidth={280}>
                <EventPopupCard event={event} />
              </Popup>
            </Marker>
          </Fragment>
        )
      })}
    </>
  )
}

export function EventPopupCard({ event }: { event: CalgaryEvent }) {
  const { db, now } = useApp()
  const left = spotsLeft(db, event)
  return (
    <div className="overflow-hidden rounded-[14px] font-sans">
      <CategoryCover categoryId={event.categoryId} variant={event.coverVariant} iconSize="sm" className="h-20" />
      <div className="space-y-2 p-3.5">
        <p className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
          <CategoryIcon id={event.categoryId} className="size-3.5" /> {CATEGORIES[event.categoryId].label}
        </p>
        <p className="text-base leading-snug font-bold text-ink">{event.title}</p>
        <ul className="space-y-1 text-[0.8125rem] text-ink-soft">
          <li className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-3.5" /> {formatEventWhen(event.startsAt, now)}
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin aria-hidden className="size-3.5" /> {event.venue.approximate ? `${event.venue.area} (approximate)` : event.venue.name} · {event.venue.quadrant}
          </li>
          <li className="flex items-center gap-1.5">
            <Users aria-hidden className="size-3.5" /> {left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'} left`} · <strong className="text-ink">{formatPrice(event.price)}</strong>
          </li>
        </ul>
        <div className="flex items-center gap-2 pt-1">
          <JoinButton event={event} size="sm" className="flex-1" />
          <Link to={`/events/${event.id}`} className="inline-flex h-9 items-center rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-mist">
            Details
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CalgaryMap({
  events,
  selectedId,
  onSelect,
  highlightQuadrants = [],
  showQuadrants = true,
  muted = true,
  onMapReady,
  className,
  interactive = true,
  label = 'Interactive map of Calgary events',
}: {
  events: CalgaryEvent[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  highlightQuadrants?: Quadrant[]
  showQuadrants?: boolean
  muted?: boolean
  onMapReady?: (api: CalgaryMapApi) => void
  className?: string
  interactive?: boolean
  label?: string
}) {
  const signature = events.map((e) => e.id).sort().join('|')

  return (
    <div role="region" aria-label={label} className={className}>
      <MapContainer
        center={[CITY_CENTRE.lat, CITY_CENTRE.lng]}
        zoom={11}
        minZoom={9}
        maxZoom={18}
        scrollWheelZoom={interactive}
        dragging={interactive}
        className={`h-full w-full ${muted ? 'map-muted' : ''}`}
        attributionControl
      >
        <TileLayer url={OSM_URL} attribution={OSM_ATTR} maxZoom={19} />
        <FitToEvents events={events} signature={signature} />
        {showQuadrants && (
          <>
            {highlightQuadrants.map((q) => (
              <Polygon key={q} positions={QUADRANT_POLYGONS[q]} interactive={false} pathOptions={{ color: '#C8102E', weight: 0, fillOpacity: 0.07 }} />
            ))}
            {QUADRANT_LINES.map((line, i) => (
              <Polyline key={i} positions={line} interactive={false} pathOptions={{ color: '#202124', weight: 2, opacity: 0.5, dashArray: '6 8' }} />
            ))}
            {QUADRANTS.map((q) => (
              <Marker
                key={q}
                position={[QUADRANT_INFO[q].labelAt.lat, QUADRANT_INFO[q].labelAt.lng]}
                icon={quadrantLabelIcon(q)}
                interactive={false}
                keyboard={false}
              />
            ))}
          </>
        )}
        <EventMarkers events={events} selectedId={selectedId} onSelect={onSelect} onReady={onMapReady} />
      </MapContainer>
    </div>
  )
}
