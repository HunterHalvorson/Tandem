/**
 * Smart search: turns plain language (typed or spoken) into filters.
 * "free hiking this weekend in the northwest" → Hiking · NW · This weekend · Free.
 * Entirely rule-based and local; leftover meaningful words become a text search.
 */
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import type { CategoryId, Quadrant } from '../types'
import type { AccessFilter, DatePreset, EventFilters, SettingFilter } from './filters'
import type { SizeBucket } from './events'

export interface ParsedQuery {
  categories: CategoryId[]
  quadrants: Quadrant[]
  date?: DatePreset
  freeOnly?: boolean
  maxPrice?: number
  access: AccessFilter[]
  sizes: SizeBucket[]
  setting?: SettingFilter
  travellerFriendly?: boolean
  text: string
  /** Human-readable list of what was understood. */
  understood: string[]
}

const QUADRANT_WORDS: Array<[RegExp, Quadrant]> = [
  [/\b(north\s?west|nw)\b/, 'NW'],
  [/\b(north\s?east|ne)\b/, 'NE'],
  [/\b(south\s?west|sw)\b/, 'SW'],
  [/\b(south\s?east|se)\b/, 'SE'],
]

const ACCESS_WORDS: Array<[RegExp, AccessFilter, string]> = [
  [/\b(accessible\s+)?(washrooms?|toilets?|bathrooms?)\b/, 'accessibleWashroom', 'Accessible washroom'],
  [/\bwheel\s?chair(\s+accessible)?\b|\baccessible\b/, 'wheelchair', 'Wheelchair accessible'],
  [/\bstep[-\s]?free\b|\bno stairs\b/, 'stepFree', 'Step-free'],
  [/\bquiet\b|\bcalm\b/, 'quiet', 'Quiet'],
  [/\bsensory\b/, 'sensoryFriendly', 'Sensory-friendly'],
  [/\bvirtual\b|\bonline\b|\bremote\b|\bfrom home\b/, 'virtual', 'Virtual option'],
  [/\bbeginners?\b|\bfirst[-\s]time\b|\bnewbies?\b|\bno experience\b/, 'beginner', 'Beginner-friendly'],
]

const STOPWORDS = new Set(
  'a an the and or for to in on at of near around with without me my i im i\'m we us want wanna would like looking look find show give get any some something things thing stuff events event activities activity happening going go do to-do please can could you are is there what whats what\'s where when who group groups club clubs calgary yyc fun cool nice good great new people meet meeting today tonight tomorrow weekend week this next days day under below less than cheap dollars dollar bucks or free price prices cost costs small big large indoor indoors outdoor outdoors inside outside travellers traveller travelers traveler tourist tourists visiting visitor visitors'.split(
    /\s+/,
  ),
)

export function parseQuery(input: string): ParsedQuery {
  let s = ` ${input.toLowerCase().replace(/[“”"!?.,]/g, ' ')} `
  const out: ParsedQuery = { categories: [], quadrants: [], access: [], sizes: [], text: '', understood: [] }
  const take = (re: RegExp) => {
    const hit = re.test(s)
    if (hit) s = s.replace(new RegExp(re.source, 'g'), ' ')
    return hit
  }

  // Price first ("under $20") so numbers don't leak into the text search.
  const under = /\b(?:under|below|less than|max|up to|cheaper than)\s*\$?\s*(\d{1,3})\b|\$(\d{1,3})\s*(?:or less|max)?/.exec(s)
  if (under) {
    out.maxPrice = Number(under[1] ?? under[2])
    out.understood.push(`Up to $${out.maxPrice}`)
    s = s.replace(under[0], ' ')
  }
  if (take(/\bfree\b|\bno cost\b/)) {
    out.freeOnly = true
    out.understood.push('Free')
  } else if (take(/\bcheap\b|\baffordable\b|\bbudget\b/) && out.maxPrice === undefined) {
    out.maxPrice = 20
    out.understood.push('Up to $20')
  }

  if (take(/\btonight\b|\btoday\b/)) out.date = 'today'
  else if (take(/\btomorrow\b/)) out.date = 'tomorrow'
  else if (take(/\b(this\s+)?weekend\b|\bsaturday\b|\bsunday\b/)) out.date = 'weekend'
  else if (take(/\b(this|next)\s+week\b|\bnext\s+7\s+days\b|\bthis\s+week\b/)) out.date = 'week'
  if (out.date) out.understood.push({ today: 'Today', tomorrow: 'Tomorrow', weekend: 'This weekend', week: 'Next 7 days', any: '', custom: '' }[out.date])

  for (const [re, q] of QUADRANT_WORDS) {
    if (take(re)) {
      out.quadrants.push(q)
      out.understood.push(`${q} Calgary`)
    }
  }
  for (const [re, a, label] of ACCESS_WORDS) {
    if (take(re)) {
      out.access.push(a)
      out.understood.push(label)
    }
  }
  if (take(/\bsmall(?:er)?\s+groups?\b|\bsmall\b|\bintimate\b/)) {
    out.sizes.push('small')
    out.understood.push('Small groups')
  }
  if (take(/\blarge\s+groups?\b|\bbig\b/)) {
    out.sizes.push('large')
    out.understood.push('Large groups')
  }
  if (take(/\bindoors?\b|\binside\b/)) {
    out.setting = 'indoor'
    out.understood.push('Indoor')
  } else if (take(/\boutdoors?\b|\boutside\b/)) {
    out.setting = 'outdoor'
    out.understood.push('Outdoor')
  }
  if (take(/\btravell?ers?\b|\btourists?\b|\bvisiting\b|\bvisitors?\b/)) {
    out.travellerFriendly = true
    out.understood.push('Traveller-friendly')
  }

  // Categories: longest keywords first so "board games" beats "games".
  const keywordPairs = CATEGORY_IDS.flatMap((id) => CATEGORIES[id].keywords.map((k) => [k, id] as const)).sort((a, b) => b[0].length - a[0].length)
  for (const [kw, id] of keywordPairs) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (re.test(s)) {
      s = s.replace(new RegExp(re.source, 'g'), ' ')
      if (!out.categories.includes(id)) {
        out.categories.push(id)
        out.understood.push(CATEGORIES[id].label)
      }
    }
  }

  out.text = s
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .join(' ')
  return out
}

/** Merge a parsed query into filters (parsed values replace the matching filter groups). */
export function applyParsedQuery(f: EventFilters, p: ParsedQuery): EventFilters {
  return {
    ...f,
    q: p.text,
    categories: p.categories.length ? p.categories : f.categories,
    quadrants: p.quadrants.length ? p.quadrants : f.quadrants,
    date: p.date ?? f.date,
    freeOnly: p.freeOnly ?? f.freeOnly,
    maxPrice: p.maxPrice ?? f.maxPrice,
    access: p.access.length ? [...new Set([...f.access, ...p.access])] : f.access,
    sizes: p.sizes.length ? p.sizes : f.sizes,
    setting: p.setting ?? f.setting,
    travellerFriendly: p.travellerFriendly ?? f.travellerFriendly,
  }
}
