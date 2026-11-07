import { describe, expect, it } from 'vitest'
import { createSeedDatabase } from '../data/seed'
import { buildIcs } from '../lib/ics'

describe('calendar export', () => {
  it('escapes RFC 5545 special characters', () => {
    const event = { ...createSeedDatabase(new Date(2026, 10, 8, 9)).events[0], title: 'Run; coffee, chat\\more', description: 'Line 1\nLine 2' }
    const ics = buildIcs(event, 'Tandem')
    expect(ics).toContain(String.raw`SUMMARY:Run\; coffee\, chat\\more`)
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
  })
})
