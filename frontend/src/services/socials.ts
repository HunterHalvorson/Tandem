/** Social profile links (spec §5 step 4): users add URLs; we validate the domain. No OAuth. */
import type { SocialPlatform } from '../types'

export interface SocialDef {
  id: SocialPlatform
  label: string
  hosts: string[]
  placeholder: string
  /** Handle → URL builder for platforms where "@name" is common. */
  fromHandle?: (handle: string) => string
}

export const SOCIALS: SocialDef[] = [
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'], placeholder: 'https://instagram.com/yourname or @yourname', fromHandle: (h) => `https://www.instagram.com/${h}` },
  { id: 'strava', label: 'Strava', hosts: ['strava.com'], placeholder: 'https://www.strava.com/athletes/…' },
  { id: 'discord', label: 'Discord', hosts: ['discord.com', 'discord.gg'], placeholder: 'https://discord.gg/… or https://discord.com/users/…' },
  { id: 'alltrails', label: 'AllTrails', hosts: ['alltrails.com'], placeholder: 'https://www.alltrails.com/members/…' },
  { id: 'letterboxd', label: 'Letterboxd', hosts: ['letterboxd.com'], placeholder: 'https://letterboxd.com/yourname or @yourname', fromHandle: (h) => `https://letterboxd.com/${h}` },
  { id: 'spotify', label: 'Spotify', hosts: ['open.spotify.com', 'spotify.com'], placeholder: 'https://open.spotify.com/user/…' },
  { id: 'github', label: 'GitHub', hosts: ['github.com'], placeholder: 'https://github.com/yourname or @yourname', fromHandle: (h) => `https://github.com/${h}` },
  { id: 'website', label: 'Personal website', hosts: [], placeholder: 'https://your-site.ca' },
]

export type SocialCheck = { ok: true; url: string } | { ok: false; error: string }

export function validateSocial(platform: SocialPlatform, raw: string): SocialCheck {
  const def = SOCIALS.find((s) => s.id === platform)!
  const value = raw.trim()
  if (!value) return { ok: true, url: '' }
  const handle = /^@?([A-Za-z0-9._-]{2,40})$/.exec(value)
  if (handle && def.fromHandle && (value.startsWith('@') || !value.includes('.'))) return { ok: true, url: def.fromHandle(handle[1]) }
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return { ok: false, error: `That doesn't look like a valid ${def.label} link.` }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Links must start with https://' }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (!host.includes('.')) return { ok: false, error: 'Enter a full web address.' }
  if (def.hosts.length && !def.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
    return { ok: false, error: `${def.label} links should be on ${def.hosts.join(' or ')}.` }
  if (def.hosts.length && url.pathname.replace(/\/+$/, '') === '') return { ok: false, error: `Add your ${def.label} profile path, not just the home page.` }
  url.protocol = 'https:'
  return { ok: true, url: url.toString() }
}
