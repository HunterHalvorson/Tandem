import type { CalgaryEvent } from '../types'

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** RFC 5545 text escaping: backslash, semicolon and comma get a backslash; newlines become \n. */
const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

/** Build an iCalendar file so attendees can add an event to any calendar app. */
export function buildIcs(event: CalgaryEvent, appName: string): string {
  const location = event.venue.approximate
    ? `${event.venue.area} (approximate area), Calgary, AB`
    : `${event.venue.name}, ${event.venue.area}, Calgary, AB`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${appName}//Calgary Events//EN`,
    'BEGIN:VEVENT',
    `UID:${event.id}@${appName.toLowerCase()}.demo`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description)}`,
    `LOCATION:${escape(location)}`,
    `GEO:${event.venue.lat};${event.venue.lng}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadFile(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
