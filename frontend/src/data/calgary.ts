import { pointInPolygon, type LatLng } from '../lib/geo'
import type { Quadrant } from '../types'

/**
 * Calgary geography used by the map, the event form and "closest to" sorting.
 * Coordinates are approximate public-place centroids (good to ~100–300 m) — they are not street addresses.
 * Quadrant dividing lines are a simplified approximation of Centre St / Macleod Tr (east–west) and the
 * Bow River / Memorial Dr (north–south). The authoritative quadrant for an event is stored on the event itself.
 */

export const CITY_CENTRE: LatLng = { lat: 51.0447, lng: -114.0719 }
export const CITY_BOUNDS: [[number, number], [number, number]] = [
  [50.842, -114.315],
  [51.215, -113.86],
]

export const QUADRANTS: Quadrant[] = ['NW', 'NE', 'SW', 'SE']

export const QUADRANT_INFO: Record<Quadrant, { name: string; centroid: LatLng; labelAt: LatLng; blurb: string }> = {
  NW: {
    name: 'Northwest',
    centroid: { lat: 51.095, lng: -114.14 },
    labelAt: { lat: 51.097, lng: -114.16 },
    blurb: 'Kensington, Nose Hill, the University and Bowness',
  },
  NE: {
    name: 'Northeast',
    centroid: { lat: 51.085, lng: -113.985 },
    labelAt: { lat: 51.097, lng: -113.985 },
    blurb: 'Bridgeland, Marlborough, Falconridge and Saddle Ridge',
  },
  SW: {
    name: 'Southwest',
    centroid: { lat: 51.0, lng: -114.13 },
    labelAt: { lat: 50.99, lng: -114.16 },
    blurb: 'Downtown, the Beltline, Marda Loop and Glenmore',
  },
  SE: {
    name: 'Southeast',
    centroid: { lat: 50.97, lng: -114.01 },
    labelAt: { lat: 50.99, lng: -113.985 },
    blurb: 'East Village, Inglewood, Ramsay and Fish Creek',
  },
}

/* ------------------------------------------------------------------ quadrant geometry */

const C: [number, number] = [51.054, -114.0626] // Centre St bridge over the Bow River

/** Centre St N, from C northward to the city edge. */
const LINE_NORTH: Array<[number, number]> = [C, [51.07, -114.0626], [51.1, -114.063], [51.14, -114.064], [51.18, -114.066], [51.215, -114.066]]
/** Centre St S → Macleod Tr, from C southward. */
const LINE_SOUTH: Array<[number, number]> = [C, [51.046, -114.0626], [51.038, -114.0622], [51.02, -114.0615], [51.0, -114.066], [50.98, -114.07], [50.95, -114.07], [50.92, -114.066], [50.88, -114.062], [50.842, -114.06]]
/** Bow River, from C upstream (west) to the city edge. */
const LINE_WEST: Array<[number, number]> = [C, [51.0558, -114.07], [51.051, -114.088], [51.0525, -114.096], [51.0555, -114.106], [51.06, -114.123], [51.068, -114.155], [51.074, -114.168], [51.08, -114.182], [51.0885, -114.2], [51.0905, -114.219], [51.096, -114.25], [51.1, -114.315]]
/** Bow River / Memorial Dr, from C eastward to the city edge. */
const LINE_EAST: Array<[number, number]> = [C, [51.0518, -114.05], [51.049, -114.04], [51.047, -114.033], [51.0465, -114.02], [51.047, -113.95], [51.047, -113.86]]

/** Dashed divider polylines drawn on the map. */
export const QUADRANT_LINES: Array<Array<[number, number]>> = [
  [...LINE_NORTH].reverse().concat(LINE_SOUTH.slice(1)),
  [...LINE_WEST].reverse().concat(LINE_EAST.slice(1)),
]

const [[S, W], [N, E]] = CITY_BOUNDS
const westEnd = LINE_WEST[LINE_WEST.length - 1]
const eastEnd = LINE_EAST[LINE_EAST.length - 1]
const northEnd = LINE_NORTH[LINE_NORTH.length - 1]
const southEnd = LINE_SOUTH[LINE_SOUTH.length - 1]

/** Approximate quadrant polygons (used for highlighting and to suggest a quadrant for a dropped pin). */
export const QUADRANT_POLYGONS: Record<Quadrant, Array<[number, number]>> = {
  NW: [...[...LINE_WEST].reverse(), ...LINE_NORTH.slice(1), [N, W], [westEnd[0], W]],
  NE: [...LINE_EAST, [eastEnd[0], E], [N, E], [northEnd[0], northEnd[1]], ...[...LINE_NORTH].reverse().slice(1)],
  SW: [...[...LINE_WEST].reverse(), ...LINE_SOUTH.slice(1), [S, W], [westEnd[0], W]],
  SE: [...LINE_EAST, [eastEnd[0], E], [S, E], [southEnd[0], southEnd[1]], ...[...LINE_SOUTH].reverse().slice(1)],
}

export function guessQuadrant(point: LatLng): Quadrant {
  for (const q of QUADRANTS) {
    if (pointInPolygon(point, QUADRANT_POLYGONS[q])) return q
  }
  const north = point.lat >= C[0]
  const east = point.lng >= C[1]
  return north ? (east ? 'NE' : 'NW') : east ? 'SE' : 'SW'
}

/* ------------------------------------------------------------------ neighbourhoods */

export interface Neighbourhood {
  name: string
  quadrant: Quadrant
  lat: number
  lng: number
}

export const NEIGHBOURHOODS: Neighbourhood[] = [
  // NW
  { name: 'Kensington / Hillhurst', quadrant: 'NW', lat: 51.053, lng: -114.087 },
  { name: 'Sunnyside', quadrant: 'NW', lat: 51.0565, lng: -114.078 },
  { name: 'Crescent Heights', quadrant: 'NW', lat: 51.064, lng: -114.066 },
  { name: 'Mount Pleasant', quadrant: 'NW', lat: 51.071, lng: -114.075 },
  { name: 'Capitol Hill', quadrant: 'NW', lat: 51.07, lng: -114.095 },
  { name: 'Banff Trail', quadrant: 'NW', lat: 51.075, lng: -114.113 },
  { name: 'University District / Varsity', quadrant: 'NW', lat: 51.088, lng: -114.143 },
  { name: 'Brentwood', quadrant: 'NW', lat: 51.087, lng: -114.129 },
  { name: 'Dalhousie', quadrant: 'NW', lat: 51.103, lng: -114.16 },
  { name: 'Montgomery', quadrant: 'NW', lat: 51.077, lng: -114.159 },
  { name: 'Bowness', quadrant: 'NW', lat: 51.089, lng: -114.188 },
  { name: 'Tuscany', quadrant: 'NW', lat: 51.123, lng: -114.24 },
  { name: 'Royal Oak', quadrant: 'NW', lat: 51.144, lng: -114.205 },
  // NE
  { name: 'Bridgeland-Riverside', quadrant: 'NE', lat: 51.054, lng: -114.041 },
  { name: 'Renfrew', quadrant: 'NE', lat: 51.065, lng: -114.035 },
  { name: 'Tuxedo Park', quadrant: 'NE', lat: 51.077, lng: -114.056 },
  { name: 'Mayland Heights', quadrant: 'NE', lat: 51.062, lng: -114.005 },
  { name: 'Marlborough', quadrant: 'NE', lat: 51.057, lng: -113.973 },
  { name: 'Rundle', quadrant: 'NE', lat: 51.077, lng: -113.969 },
  { name: 'Falconridge', quadrant: 'NE', lat: 51.115, lng: -113.944 },
  { name: 'Saddle Ridge', quadrant: 'NE', lat: 51.13, lng: -113.95 },
  // SW
  { name: 'Downtown / Eau Claire', quadrant: 'SW', lat: 51.05, lng: -114.07 },
  { name: 'Beltline', quadrant: 'SW', lat: 51.04, lng: -114.073 },
  { name: 'Mission', quadrant: 'SW', lat: 51.032, lng: -114.07 },
  { name: 'Mount Royal', quadrant: 'SW', lat: 51.03, lng: -114.088 },
  { name: 'Marda Loop / Altadore', quadrant: 'SW', lat: 51.022, lng: -114.102 },
  { name: 'Killarney', quadrant: 'SW', lat: 51.035, lng: -114.127 },
  { name: 'Signal Hill', quadrant: 'SW', lat: 51.017, lng: -114.17 },
  { name: 'Lakeview', quadrant: 'SW', lat: 50.993, lng: -114.127 },
  { name: 'Woodbine', quadrant: 'SW', lat: 50.946, lng: -114.134 },
  // SE
  { name: 'East Village', quadrant: 'SE', lat: 51.047, lng: -114.05 },
  { name: 'Victoria Park', quadrant: 'SE', lat: 51.039, lng: -114.058 },
  { name: 'Inglewood', quadrant: 'SE', lat: 51.038, lng: -114.028 },
  { name: 'Ramsay', quadrant: 'SE', lat: 51.033, lng: -114.041 },
  { name: 'Forest Lawn', quadrant: 'SE', lat: 51.039, lng: -113.975 },
  { name: 'Acadia', quadrant: 'SE', lat: 50.97, lng: -114.056 },
  { name: 'McKenzie Towne', quadrant: 'SE', lat: 50.913, lng: -113.962 },
  { name: 'Mahogany', quadrant: 'SE', lat: 50.896, lng: -113.93 },
  { name: 'Seton', quadrant: 'SE', lat: 50.876, lng: -113.951 },
]

export function neighbourhood(name: string | null | undefined): Neighbourhood | undefined {
  return name ? NEIGHBOURHOODS.find((n) => n.name === name) : undefined
}

/* ------------------------------------------------------------------ venues */

export interface Venue {
  id: string
  name: string
  area: string
  quadrant: Quadrant
  lat: number
  lng: number
}

/** Recognisable public places. Seeded (fictional) demo events are placed here; hosts can pick them too. */
export const VENUES: Venue[] = [
  // NW
  { id: 'kensington', name: 'Kensington Village', area: 'Kensington / Hillhurst', quadrant: 'NW', lat: 51.0526, lng: -114.0868 },
  { id: 'riley-park', name: 'Riley Park', area: 'Hillhurst', quadrant: 'NW', lat: 51.058, lng: -114.0905 },
  { id: 'crescent-heights', name: 'Crescent Heights Lookout (McHugh Bluff)', area: 'Crescent Heights', quadrant: 'NW', lat: 51.0585, lng: -114.073 },
  { id: 'confederation-park', name: 'Confederation Park', area: 'Capitol Hill', quadrant: 'NW', lat: 51.0745, lng: -114.0925 },
  { id: 'nose-hill', name: 'Nose Hill Park', area: 'Nose Hill', quadrant: 'NW', lat: 51.112, lng: -114.106 },
  { id: 'ucalgary', name: 'University of Calgary — MacEwan Hall', area: 'University District', quadrant: 'NW', lat: 51.0786, lng: -114.1305 },
  { id: 'bowness-park', name: 'Bowness Park', area: 'Bowness', quadrant: 'NW', lat: 51.0937, lng: -114.22 },
  // NE
  { id: 'bridgeland', name: 'Bridgeland (1 Avenue NE)', area: 'Bridgeland-Riverside', quadrant: 'NE', lat: 51.053, lng: -114.042 },
  { id: 'tom-campbells-hill', name: "Tom Campbell's Hill Natural Park", area: 'Bridgeland-Riverside', quadrant: 'NE', lat: 51.05, lng: -114.031 },
  { id: 'village-square', name: 'Village Square Leisure Centre', area: 'Pineridge', quadrant: 'NE', lat: 51.0755, lng: -113.9444 },
  { id: 'prairie-winds', name: 'Prairie Winds Park', area: 'Castleridge', quadrant: 'NE', lat: 51.1015, lng: -113.9655 },
  { id: 'genesis-centre', name: 'Genesis Centre', area: 'Falconridge', quadrant: 'NE', lat: 51.1188, lng: -113.9532 },
  // SW
  { id: 'princes-island', name: "Prince's Island Park", area: 'Eau Claire', quadrant: 'SW', lat: 51.0546, lng: -114.0697 },
  { id: 'stephen-ave', name: 'Stephen Avenue Walk', area: 'Downtown', quadrant: 'SW', lat: 51.0456, lng: -114.068 },
  { id: 'calgary-tower', name: 'Calgary Tower', area: 'Downtown', quadrant: 'SW', lat: 51.0443, lng: -114.0631 },
  { id: 'memorial-park', name: 'Memorial Park Library', area: 'Beltline', quadrant: 'SW', lat: 51.0418, lng: -114.0716 },
  { id: 'beltline-aquatic', name: 'Beltline Aquatic & Fitness Centre', area: 'Beltline', quadrant: 'SW', lat: 51.0415, lng: -114.0682 },
  { id: 'seventeenth-ave', name: '17th Avenue SW (the "Red Mile")', area: 'Beltline', quadrant: 'SW', lat: 51.0378, lng: -114.079 },
  { id: 'marda-loop', name: 'Marda Loop', area: 'Altadore', quadrant: 'SW', lat: 51.023, lng: -114.103 },
  { id: 'edworthy', name: 'Edworthy Park', area: 'Edworthy', quadrant: 'SW', lat: 51.0629, lng: -114.156 },
  { id: 'glenmore', name: 'North Glenmore Park', area: 'Lakeview', quadrant: 'SW', lat: 50.996, lng: -114.125 },
  { id: 'mru', name: 'Mount Royal University', area: 'Lincoln Park', quadrant: 'SW', lat: 50.991, lng: -114.1295 },
  // SE
  { id: 'central-library', name: 'Calgary Central Library', area: 'East Village', quadrant: 'SE', lat: 51.0455, lng: -114.0557 },
  { id: 'olympic-plaza', name: 'Olympic Plaza', area: 'Downtown East', quadrant: 'SE', lat: 51.0459, lng: -114.06 },
  { id: 'riverwalk', name: 'East Village RiverWalk', area: 'East Village', quadrant: 'SE', lat: 51.048, lng: -114.0505 },
  { id: 'fort-calgary', name: 'Fort Calgary (The Confluence)', area: 'East Village', quadrant: 'SE', lat: 51.0453, lng: -114.0453 },
  { id: 'inglewood', name: 'Inglewood (9 Avenue SE)', area: 'Inglewood', quadrant: 'SE', lat: 51.0386, lng: -114.0285 },
  { id: 'bird-sanctuary', name: 'Inglewood Bird Sanctuary', area: 'Inglewood', quadrant: 'SE', lat: 51.0395, lng: -114.006 },
  { id: 'stampede-park', name: 'Stampede Park', area: 'Victoria Park', quadrant: 'SE', lat: 51.0375, lng: -114.053 },
  { id: 'mnp-centre', name: 'MNP Community & Sport Centre', area: 'Lindsay Park', quadrant: 'SE', lat: 51.033, lng: -114.0615 },
  { id: 'fish-creek', name: 'Fish Creek Provincial Park — Bow Valley Ranch', area: 'Fish Creek', quadrant: 'SE', lat: 50.9215, lng: -114.0095 },
]

export function venue(id: string): Venue {
  const v = VENUES.find((x) => x.id === id)
  if (!v) throw new Error(`Unknown venue ${id}`)
  return v
}

/** Reference point for "closest to selected area". */
export function referencePoint(opts: {
  quadrants?: Quadrant[]
  neighbourhood?: string | null
  quadrant?: Quadrant | null
}): { point: LatLng; label: string } {
  if (opts.quadrants && opts.quadrants.length === 1) {
    const q = opts.quadrants[0]
    return { point: QUADRANT_INFO[q].centroid, label: `${QUADRANT_INFO[q].name} Calgary` }
  }
  const n = neighbourhood(opts.neighbourhood)
  if (n) return { point: { lat: n.lat, lng: n.lng }, label: n.name }
  if (opts.quadrant) return { point: QUADRANT_INFO[opts.quadrant].centroid, label: `${QUADRANT_INFO[opts.quadrant].name} Calgary` }
  return { point: CITY_CENTRE, label: 'Downtown Calgary' }
}

/** Adjacent quadrants share a dividing line; opposite ones (NW↔SE, NE↔SW) don't. */
export function quadrantAffinity(a: Quadrant, b: Quadrant): number {
  if (a === b) return 1
  const opposite = (a === 'NW' && b === 'SE') || (a === 'SE' && b === 'NW') || (a === 'NE' && b === 'SW') || (a === 'SW' && b === 'NE')
  return opposite ? 0.3 : 0.55
}
