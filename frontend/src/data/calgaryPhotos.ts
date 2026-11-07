import { VENUES } from './calgary'
import type { EventVenue } from '../types'

const LICENSES = {
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'Public domain': null,
} as const

interface Photo {
  place: string
  file: string
  author: string
  license: keyof typeof LICENSES
}

const PHOTOS = {
  calgary: {
    place: 'Downtown Calgary skyline',
    file: 'Downtown Calgary skyline.jpg',
    author: 'Quintin Soloviev',
    license: 'CC BY 4.0',
  },
  inglewood: {
    place: '9 Avenue SE in Inglewood',
    file: 'InglewoodCalgary.JPG',
    author: 'Greenwood714',
    license: 'CC BY-SA 3.0',
  },
  'princes-island': {
    place: 'Peace Bridge on the Bow River',
    file: "Peace on Calgary's Earth.jpg",
    author: 'Yolanda Lie (Likeliehood)',
    license: 'CC BY-SA 4.0',
  },
  'central-library': {
    place: 'Calgary Central Library',
    file: 'Central Library - Calgary Public Library.jpg',
    author: 'Calgary Public Library',
    license: 'CC0 1.0',
  },
  'fish-creek': {
    place: 'Fish Creek Provincial Park',
    file: 'Fish Creek Provincial Park. Calgary (9426404094).jpg',
    author: 'Bernard Spragg. NZ',
    license: 'CC0 1.0',
  },
  'nose-hill': {
    place: 'Nose Hill Park',
    file: 'Nose Hill Park.JPG',
    author: 'Borbrav',
    license: 'Public domain',
  },
  'bowness-park': {
    place: 'Bowness Park lagoon',
    file: 'Bowness Park lagoon.jpg',
    author: 'Qyd',
    license: 'CC BY-SA 3.0',
  },
  'confederation-park': {
    place: 'Confederation Park entrance',
    file: 'Calgary - Confederation Park.jpg',
    author: 'Mule hollandaise',
    license: 'CC0 1.0',
  },
  kensington: {
    place: 'Sunnyside station in Kensington',
    file: 'Kensington Calgary July 13th 2014 (14462070298).jpg',
    author: 'Thank you for visiting my page (davebloggs007)',
    license: 'CC BY 2.0',
  },
  bridgeland: {
    place: 'Bridgeland/Memorial station and Calgary skyline',
    file: 'Exterior of Bridgeland-Memorial CTrain Station and Calgary Skyline.jpg',
    author: 'CnekYT',
    license: 'CC BY-SA 4.0',
  },
  'memorial-park': {
    place: 'Memorial Park Library',
    file: 'Memorial Park Library - Calgary Public Library.jpg',
    author: 'Dean T Mullin of the Calgary Public Library',
    license: 'CC0 1.0',
  },
  ucalgary: {
    place: 'MacEwan Hall at the University of Calgary',
    file: 'MacEwan Hall - University of Calgary - DSC00132.JPG',
    author: 'Daderot',
    license: 'CC0 1.0',
  },
} satisfies Record<string, Photo>

type PhotoId = keyof typeof PHOTOS
type PhotoMatch = { photo: PhotoId; kind: 'Venue photo' | 'Area photo' }

const VENUE_PHOTOS: Partial<Record<string, PhotoMatch>> = {
  inglewood: { photo: 'inglewood', kind: 'Area photo' },
  'princes-island': { photo: 'princes-island', kind: 'Area photo' },
  'central-library': { photo: 'central-library', kind: 'Venue photo' },
  'fish-creek': { photo: 'fish-creek', kind: 'Area photo' },
  'nose-hill': { photo: 'nose-hill', kind: 'Venue photo' },
  'bowness-park': { photo: 'bowness-park', kind: 'Venue photo' },
  'confederation-park': { photo: 'confederation-park', kind: 'Venue photo' },
  kensington: { photo: 'kensington', kind: 'Area photo' },
  bridgeland: { photo: 'bridgeland', kind: 'Area photo' },
  'tom-campbells-hill': { photo: 'bridgeland', kind: 'Area photo' },
  'memorial-park': { photo: 'memorial-park', kind: 'Venue photo' },
  ucalgary: { photo: 'ucalgary', kind: 'Venue photo' },
}

export function eventPhoto(venue: EventVenue) {
  const publicPlace = venue.approximate ? undefined : VENUES.find(
    (place) => place.name === venue.name && place.lat === venue.lat && place.lng === venue.lng,
  )
  const match = publicPlace ? VENUE_PHOTOS[publicPlace.id] : undefined
  return describePhoto(match?.photo ?? 'calgary', match?.kind ?? 'Calgary photo')
}

const GROUP_AREA_PHOTOS = new Map<string, PhotoId>([
  ['Downtown & the Bow River pathways', 'princes-island'],
  ['Kensington / Hillhurst', 'kensington'],
  ['Beltline', 'memorial-park'],
  ['City parks & river valleys', 'fish-creek'],
  ['University District', 'ucalgary'],
  ['Inglewood', 'inglewood'],
  ['Nose Hill & viewpoints', 'nose-hill'],
  ['Bridgeland & Northeast Calgary', 'bridgeland'],
  ['Bridgeland & Downtown', 'bridgeland'],
  ['Central Library', 'central-library'],
])

export function groupPhoto(area: string) {
  const id = GROUP_AREA_PHOTOS.get(area)
  return describePhoto(id ?? 'calgary', id ? 'Area photo' : 'Calgary photo')
}

function describePhoto(id: PhotoId, kind: PhotoMatch['kind'] | 'Calgary photo') {
  const photo = PHOTOS[id]
  return {
    ...photo,
    src: `/images/events/calgary/${id}.webp`,
    kind,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file.replaceAll(' ', '_'))}`,
    licenseUrl: LICENSES[photo.license],
  }
}
