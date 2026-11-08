/**
 * Tandem Live: optional multi-device sync for the browser demo.
 *
 * The app's default storage is this browser's localStorage. When the Tandem Live server (server/live-server.mjs)
 * is reachable, this adapter mirrors every change to it as small entity-level operations and applies changes
 * from other devices as they arrive (Server-Sent Events). When the server is missing or goes down, the app keeps
 * working locally; on reconnect, changes made meanwhile are pushed and the shared world is adopted.
 *
 * Sync URL: localStorage "tandem.sync" ('off' or a URL) → VITE_SYNC_URL ('off' or a URL) → same origin when the
 * app is served by Tandem Live → http://<this host>:8787.
 */
import { useSyncExternalStore } from 'react'
import type { Database } from '../types'
import { isDatabase, loadSessionUserId, localStorageAdapter, type StorageAdapter } from './storage'

/* ------------------------------------------------------------------ entity-level ops (mirrored in server/live-server.mjs) */

type Entity = { id: string | number } & Record<string, unknown>
export type LiveOp =
  | { t: 'put'; c: string; v: Entity }
  | { t: 'del'; c: string; id: string | number }
  | { t: 'set'; k: string; v: unknown }

const isEntityList = (v: unknown): v is Entity[] =>
  Array.isArray(v) && v.every((x) => !!x && typeof x === 'object' && 'id' in (x as object))

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** The smallest set of ops that turns `prev` into `next` (unchanged entities are skipped by reference first). */
export function diffDatabases(prev: Database, next: Database): LiveOp[] {
  const ops: LiveOp[] = []
  const a = prev as unknown as Record<string, unknown>
  const b = next as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const before = a[key]
    const after = b[key]
    if (before === after) continue
    if (isEntityList(before) && isEntityList(after)) {
      const old = new Map(before.map((x) => [x.id, x]))
      const seen = new Set<string | number>()
      for (const item of after) {
        seen.add(item.id)
        const was = old.get(item.id)
        if (!was || (was !== item && !same(was, item))) ops.push({ t: 'put', c: key, v: item })
      }
      for (const item of before) if (!seen.has(item.id)) ops.push({ t: 'del', c: key, id: item.id })
    } else if (!same(before, after)) {
      ops.push({ t: 'set', k: key, v: after === undefined ? null : after })
    }
  }
  return ops
}

/** Apply ops immutably. Idempotent: applying the same ops twice gives the same result. */
export function applyLiveOps(db: Database, ops: LiveOp[]): Database {
  const next = { ...(db as unknown as Record<string, unknown>) }
  const copied = new Set<string>()
  const list = (c: string): Entity[] => {
    if (!copied.has(c)) {
      next[c] = Array.isArray(next[c]) ? [...(next[c] as Entity[])] : []
      copied.add(c)
    }
    return next[c] as Entity[]
  }
  for (const op of ops) {
    if (op.t === 'set') {
      next[op.k] = op.v
      copied.delete(op.k)
    } else if (op.t === 'put') {
      const items = list(op.c)
      const i = items.findIndex((x) => x && x.id === op.v.id)
      if (i === -1) items.push(op.v)
      else items[i] = op.v
    } else {
      const items = list(op.c)
      const i = items.findIndex((x) => x && x.id === op.id)
      if (i !== -1) items.splice(i, 1)
    }
  }
  return next as unknown as Database
}

const OWNER_FIELDS = ['userId', 'hostId', 'reporterId', 'organizerId', 'authorId'] as const

/** Ops that add `userId`'s profile and records (registrations, messages, hosted events…) missing from `server`. */
export function ownMissingEntities(mine: Database, server: Database, userId: string | null): LiveOp[] {
  if (!userId) return []
  const a = mine as unknown as Record<string, unknown>
  const b = server as unknown as Record<string, unknown>
  const ops: LiveOp[] = []
  for (const key of Object.keys(a)) {
    const items = a[key]
    if (!isEntityList(items)) continue
    const known = new Set(isEntityList(b[key]) ? (b[key] as Entity[]).map((x) => x.id) : [])
    for (const item of items) {
      const owned = key === 'users' ? item.id === userId : OWNER_FIELDS.some((f) => item[f] === userId)
      if (owned && !known.has(item.id)) ops.push({ t: 'put', c: key, v: item })
    }
  }
  return ops
}

/* ------------------------------------------------------------------ connection status (for the UI) */

export type LiveStatus = 'off' | 'connecting' | 'live' | 'offline'
export interface LiveState {
  status: LiveStatus
  /** Devices (browser tabs) connected to the server, including this one. */
  devices: number
  url: string | null
}

let liveState: LiveState = { status: 'off', devices: 0, url: null }
const statusListeners = new Set<() => void>()
function setLiveState(patch: Partial<LiveState>) {
  const next = { ...liveState, ...patch }
  if (next.status === liveState.status && next.devices === liveState.devices && next.url === liveState.url) return
  liveState = next
  statusListeners.forEach((l) => l())
}

/** Live sync status: 'live' means changes reach other devices right now. */
export function useLiveSync(): LiveState {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => statusListeners.delete(l)
    },
    () => liveState,
    () => liveState,
  )
}

/* ------------------------------------------------------------------ sync URL */

export function resolveSyncUrl(): string | null {
  if (typeof window === 'undefined' || typeof location === 'undefined') return null
  try {
    const override = localStorage.getItem('tandem.sync')
    if (override === 'off') return null
    if (override && /^https?:\/\//.test(override)) return override.replace(/\/+$/, '')
  } catch {
    /* storage blocked */
  }
  const env = import.meta.env.VITE_SYNC_URL as string | undefined
  if (env === 'off') return null
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/+$/, '')
  if (document.querySelector('meta[name="tandem-live-sync"]')) return location.origin
  if (!/^https?:$/.test(location.protocol)) return null
  return `${location.protocol}//${location.hostname}:8787`
}

/* ------------------------------------------------------------------ adapter */

const RETRY_MS = [2000, 5000, 10000, 20000, 30000]
const REPLACE_THRESHOLD = 400

/**
 * Wraps the browser adapter. Local storage is always written first, so nothing is lost when the server is down.
 */
export function createLiveSyncAdapter(local: StorageAdapter, url: string): StorageAdapter {
  const clientId = `c-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
  const listeners = new Set<(db: Database | null) => void>()
  /** Latest database handed to (or received from) the app. Diffs are computed against it. */
  let current: Database | null = null
  /** Last state confirmed by the server (null until the first snapshot in this page). */
  let confirmed: Database | null = null
  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let running = false
  let outbox: Promise<unknown> = Promise.resolve()
  let unsubscribeLocal: (() => void) | null = null

  const latest = () => current ?? local.load()

  async function post(path: string, body: unknown): Promise<{ revision: number }> {
    const res = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`${path} ${res.status}`)
    return res.json()
  }

  /** Make `db` the app's state (from another device), without echoing it back to the server. */
  function adopt(db: Database) {
    current = db
    local.save(db)
    listeners.forEach((l) => l(db))
  }

  function send(kind: 'ops' | 'replace', payload: LiveOp[] | Database) {
    outbox = outbox
      .then(async () => {
        if (liveState.status !== 'live') return // reconciled on reconnect from `confirmed`
        if (kind === 'replace') {
          await post('/api/replace', { clientId, db: payload })
          confirmed = payload as Database
        } else {
          await post('/api/ops', { clientId, ops: payload })
          if (confirmed) confirmed = applyLiveOps(confirmed, payload as LiveOp[])
        }
      })
      .catch(() => goOffline())
  }

  function onSnapshot(data: { db: unknown; devices?: number }) {
    const mine = latest()
    if (!isDatabase(data.db)) {
      // Empty server (or one holding another app version): share this device's world.
      if (mine) {
        setLiveState({ status: 'live' })
        send('replace', mine)
      }
    } else {
      const server = data.db
      let pending: LiveOp[] = []
      if (confirmed && mine && mine.seededAt === server.seededAt) {
        pending = diffDatabases(confirmed, mine) // changes made while the server was unreachable
      } else if (mine) {
        // First contact in this page: bring this device's signed-in profile (and anything it created)
        // into the shared world if the server doesn't have it yet. Everything else follows the server.
        pending = ownMissingEntities(mine, server, loadSessionUserId())
      }
      confirmed = server
      adopt(pending.length ? applyLiveOps(server, pending) : server)
      setLiveState({ status: 'live' })
      if (pending.length) send('ops', pending)
    }
    attempt = 0
    if (typeof data.devices === 'number') setLiveState({ devices: data.devices })
  }

  function onOps(data: { clientId?: string; ops: LiveOp[] }) {
    if (data.clientId === clientId || !Array.isArray(data.ops)) return
    if (confirmed) confirmed = applyLiveOps(confirmed, data.ops)
    const base = latest()
    if (base) adopt(applyLiveOps(base, data.ops))
  }

  function goOffline() {
    source?.close()
    source = null
    if (!running) return
    setLiveState({ status: 'offline', devices: 0 })
    scheduleRetry()
  }

  function scheduleRetry() {
    if (retryTimer || !running) return
    const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]
    attempt += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void connect()
    }, delay)
  }

  async function connect() {
    if (!running || source) return
    if (liveState.status !== 'offline') setLiveState({ status: 'connecting', url })
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 2500)
      const res = await fetch(`${url}/api/health`, { signal: ctrl.signal, cache: 'no-store' })
      clearTimeout(timer)
      const health = await res.json()
      if (!res.ok || health?.name !== 'tandem-live') throw new Error('not a Tandem Live server')
    } catch {
      goOffline()
      return
    }
    if (!running || source) return
    const es = new EventSource(`${url}/api/stream?clientId=${encodeURIComponent(clientId)}`)
    source = es
    const parse = (e: Event) => {
      try {
        return JSON.parse((e as MessageEvent<string>).data)
      } catch {
        return null
      }
    }
    es.addEventListener('snapshot', (e) => { const d = parse(e); if (d) onSnapshot(d) })
    es.addEventListener('ops', (e) => { const d = parse(e); if (d) onOps(d) })
    es.addEventListener('presence', (e) => { const d = parse(e); if (d && typeof d.devices === 'number') setLiveState({ devices: d.devices }) })
    es.onerror = () => { if (source === es) goOffline() }
  }

  // Close the connection when the page is hidden for navigation (back/forward cache) and resync when it returns,
  // so the server's device count stays honest and frozen pages don't hold connections.
  const onPageHide = () => {
    source?.close()
    source = null
  }
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted && running) void connect()
  }

  function start() {
    running = true
    setLiveState({ status: 'connecting', url })
    unsubscribeLocal = local.subscribe((db) => {
      // Another tab in this browser saved: track it so our next diff only contains our own change.
      if (db) current = db
      listeners.forEach((l) => l(db))
    })
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    void connect()
  }

  function stop() {
    running = false
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    source?.close()
    source = null
    unsubscribeLocal?.()
    unsubscribeLocal = null
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
    setLiveState({ status: 'off', devices: 0 })
  }

  return {
    persistsInBrowser: local.persistsInBrowser,
    load() {
      const db = local.load()
      if (db) current = db
      return db
    },
    save(db) {
      const result = local.save(db)
      const before = current
      current = db
      if (liveState.status === 'live' && before && before !== db) {
        if (before.seededAt !== db.seededAt) send('replace', db)
        else {
          const ops = diffDatabases(before, db)
          if (ops.length > REPLACE_THRESHOLD) send('replace', db)
          else if (ops.length) send('ops', ops)
        }
      }
      return result
    },
    clear() {
      local.clear()
    },
    subscribe(onChange) {
      listeners.add(onChange)
      if (listeners.size === 1) start()
      return () => {
        listeners.delete(onChange)
        if (listeners.size === 0) stop()
      }
    },
  }
}

let browserDefault: StorageAdapter | null = null

/** The app's default storage: this browser, synced live through Tandem Live when that server is reachable. */
export function defaultBrowserAdapter(): StorageAdapter {
  if (!browserDefault) {
    const url = resolveSyncUrl()
    browserDefault = url ? createLiveSyncAdapter(localStorageAdapter, url) : localStorageAdapter
  }
  return browserDefault
}
