import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { CATEGORY_ICON } from '../events/visuals'
import type { CategoryId } from '../../types'

const cache = new Map<string, L.DivIcon>()

/** Pin with the category icon inside — categories are never communicated by colour alone. */
export function eventMarkerIcon(categoryId: CategoryId, selected = false, full = false): L.DivIcon {
  const key = `${categoryId}|${selected}|${full}`
  const hit = cache.get(key)
  if (hit) return hit
  const Icon = CATEGORY_ICON[categoryId]
  const svg = renderToStaticMarkup(<Icon aria-hidden="true" strokeWidth={2.25} />)
  const icon = L.divIcon({
    className: 'tn-marker',
    html: `<span class="tn-pin" data-selected="${selected}" data-full="${full}">${svg}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  })
  cache.set(key, icon)
  return icon
}

export function quadrantLabelIcon(text: string): L.DivIcon {
  return L.divIcon({ className: 'tn-quad-label', html: text, iconSize: [60, 34], iconAnchor: [30, 17] })
}

const clusterCache = new Map<number, L.DivIcon>()

/** Numbered cluster bubble for events too close together to tell apart at this zoom. */
export function clusterIcon(count: number): L.DivIcon {
  const hit = clusterCache.get(count)
  if (hit) return hit
  const icon = L.divIcon({
    className: 'tn-marker',
    html: `<span class="tn-cluster"><span aria-hidden="true">${count}</span></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
  clusterCache.set(count, icon)
  return icon
}
