/** Map helpers: spread markers that share the exact same venue so every event stays clickable. */
import type { CalgaryEvent } from '../types'

export interface MapPoint {
  event: CalgaryEvent
  lat: number
  lng: number
}

/** Events at identical coordinates are fanned out in a small circle (~40 m) around the venue. */
export function layoutMarkers(events: CalgaryEvent[]): MapPoint[] {
  const groups = new Map<string, CalgaryEvent[]>()
  for (const e of events) {
    const key = `${e.venue.lat.toFixed(5)},${e.venue.lng.toFixed(5)}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const points: MapPoint[] = []
  for (const list of groups.values()) {
    if (list.length === 1) {
      points.push({ event: list[0], lat: list[0].venue.lat, lng: list[0].venue.lng })
      continue
    }
    const sorted = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const r = 0.00035 + 0.00005 * sorted.length
    sorted.forEach((e, i) => {
      const angle = (2 * Math.PI * i) / sorted.length - Math.PI / 2
      points.push({ event: e, lat: e.venue.lat + r * Math.sin(angle), lng: e.venue.lng + (r * Math.cos(angle)) / Math.cos((e.venue.lat * Math.PI) / 180) })
    })
  }
  return points
}
