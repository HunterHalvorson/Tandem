import { describe, expect, it } from 'vitest'
import { createSeedDatabase } from '../data/seed'
import { applyLiveOps, diffDatabases, ownMissingEntities } from '../services/liveSync'
import { sendMessage } from '../services/chat'
import { joinEvent, leaveEvent } from '../services/registrations'
import type { Database } from '../types'

const NOW = new Date('2026-11-07T18:00:00Z')
const seed = () => createSeedDatabase(NOW)
const strip = (db: Database) => JSON.parse(JSON.stringify(db))

describe('Tandem Live ops', () => {
  it('produces no ops for an unchanged database', () => {
    const db = seed()
    expect(diffDatabases(db, db)).toEqual([])
    expect(diffDatabases(db, strip(db))).toEqual([])
  })

  it('round-trips real service changes as small entity-level ops', () => {
    const a = seed()
    const event = a.events.find((e) => e.id === 'evt-coffee-newcomers')!
    const joined = joinEvent(a, event.id, 'usr-alex', NOW)
    const chatted = sendMessage(joined, { eventId: event.id, userId: 'usr-alex', body: 'See you there!' }, NOW)
    const ops = diffDatabases(a, chatted)
    expect(ops.length).toBeGreaterThan(0)
    expect(ops.length).toBeLessThan(6)
    expect(ops.every((op) => op.t === 'put')).toBe(true)
    expect(strip(applyLiveOps(a, ops))).toEqual(strip(chatted))
  })

  it('handles updates, deletions and top-level fields, and is idempotent', () => {
    const a = seed()
    const joined = joinEvent(a, 'evt-coffee-newcomers', 'usr-alex', NOW)
    const left = leaveEvent(joined, 'evt-coffee-newcomers', 'usr-alex', NOW)
    const b: Database = { ...left, users: left.users.filter((u) => u.id !== 'usr-sam'), seededAt: '2026-11-08T00:00:00.000Z' }
    const ops = diffDatabases(joined, b)
    expect(ops).toContainEqual({ t: 'del', c: 'users', id: 'usr-sam' })
    expect(ops).toContainEqual({ t: 'set', k: 'seededAt', v: '2026-11-08T00:00:00.000Z' })
    const once = applyLiveOps(joined, ops)
    expect(strip(once)).toEqual(strip(b))
    expect(strip(applyLiveOps(once, ops))).toEqual(strip(b))
  })

  it('merges concurrent changes from two devices without losing either', () => {
    const server = seed()
    const fromA = diffDatabases(server, sendMessage(joinEvent(server, 'evt-coffee-newcomers', 'usr-alex', NOW), { eventId: 'evt-coffee-newcomers', userId: 'usr-alex', body: 'Hi from A' }, NOW))
    const fromB = diffDatabases(server, joinEvent(server, 'evt-book-club-next', 'usr-sam', NOW))
    const merged = applyLiveOps(applyLiveOps(server, fromA), fromB)
    expect(merged.messages.some((m) => m.body === 'Hi from A')).toBe(true)
    expect(merged.registrations.some((r) => r.userId === 'usr-sam' && r.eventId === 'evt-book-club-next' && r.status === 'going')).toBe(true)
    expect(merged.registrations.some((r) => r.userId === 'usr-alex' && r.eventId === 'evt-coffee-newcomers' && r.status === 'going')).toBe(true)
  })

  it('brings a device’s own new profile and records into an existing shared world', () => {
    const server = seed()
    const mine = seed()
    const me = { ...mine.users[0], id: 'usr-new-device', email: 'new@example.com' }
    const withMe: Database = { ...mine, users: [...mine.users, me] }
    const joined = joinEvent(withMe, 'evt-coffee-newcomers', me.id, NOW)
    const ops = ownMissingEntities(joined, server, me.id)
    expect(ops.map((op) => (op.t === 'put' ? op.c : ''))).toEqual(expect.arrayContaining(['users', 'registrations']))
    expect(ops.every((op) => op.t === 'put' && (op.c === 'users' ? op.v.id === me.id : op.v.userId === me.id || op.c === 'messages'))).toBe(true)
    expect(ownMissingEntities(joined, server, null)).toEqual([])
  })
})
