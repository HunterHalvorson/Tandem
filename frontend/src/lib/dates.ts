import type { AvailabilitySlot } from '../types'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MINUTE)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Whole calendar days from a to b (local time). */
export function calendarDayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local `YYYY-MM-DD` (for <input type="date">). */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local `HH:MM` (for <input type="time">). */
export function toTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse `YYYY-MM-DD` as local midnight. Returns null for empty/invalid input. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Combine `YYYY-MM-DD` + `HH:MM` into a local Date. */
export function combineDateTime(date: string, time: string): Date | null {
  const d = parseDateInput(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return null
  d.setHours(Number(t[1]), Number(t[2]), 0, 0)
  return d
}

/** The current (if today is Sat/Sun) or upcoming weekend: Saturday 00:00 → Sunday 23:59. */
export function weekendRange(now: Date): { start: Date; end: Date } {
  const day = now.getDay() // 0 Sun … 6 Sat
  if (day === 0) return { start: startOfDay(addDays(now, -1)), end: endOfDay(now) }
  const saturday = addDays(now, 6 - day)
  return { start: startOfDay(saturday), end: endOfDay(addDays(saturday, 1)) }
}

/** Next occurrence (today counts) of a weekday: 0 = Sunday … 6 = Saturday. */
export function nextWeekday(from: Date, weekday: number): Date {
  const diff = (weekday - from.getDay() + 7) % 7
  return startOfDay(addDays(from, diff))
}

export function timeSlot(d: Date): AvailabilitySlot {
  const day = d.getDay()
  if (day === 0 || day === 6) return 'weekend'
  return d.getHours() >= 17 ? 'weekdayEvening' : 'weekdayDaytime'
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const longDayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const monthDayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatTime(d: Date): string {
  return timeFmt.format(d)
}

export function formatMonthDay(d: Date): string {
  return monthDayFmt.format(d)
}

/** "Today", "Tomorrow", "Yesterday" or "Sat, Nov 14". */
export function formatDayLabel(d: Date, now: Date): string {
  const diff = calendarDayDiff(now, d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return dayFmt.format(d)
}

export function formatLongDay(d: Date): string {
  return longDayFmt.format(d)
}

/** "Tomorrow · 7:30 AM" */
export function formatEventWhen(startIso: string, now: Date): string {
  const s = new Date(startIso)
  return `${formatDayLabel(s, now)} · ${formatTime(s)}`
}

/** "Sat, Nov 14 · 7:30 – 9:00 AM" style range. */
export function formatEventRange(startIso: string, endIso: string, now: Date): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const sameDay = isSameDay(s, e)
  return sameDay
    ? `${formatDayLabel(s, now)} · ${formatTime(s)} – ${formatTime(e)}`
    : `${formatDayLabel(s, now)} ${formatTime(s)} – ${formatDayLabel(e, now)} ${formatTime(e)}`
}

/** Chat-style relative timestamps. */
export function formatRelative(iso: string, now: Date): string {
  const d = new Date(iso)
  const diff = now.getTime() - d.getTime()
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  if (isSameDay(d, now)) return formatTime(d)
  if (calendarDayDiff(d, now) === 1) return `Yesterday ${formatTime(d)}`
  return `${dayFmt.format(d)}, ${formatTime(d)}`
}

export function formatDateRange(from: string | null, to: string | null): string {
  const a = parseDateInput(from)
  const b = parseDateInput(to)
  if (a && b) return `${formatMonthDay(a)} – ${formatMonthDay(b)}`
  if (a) return `From ${formatMonthDay(a)}`
  if (b) return `Until ${formatMonthDay(b)}`
  return 'Any dates'
}
