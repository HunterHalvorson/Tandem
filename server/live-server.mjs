#!/usr/bin/env node
/**
 * Tandem Live — a small, zero-dependency sync server that makes chat, RSVPs, ratings and new events
 * update live across devices (laptops and phones on the same network).
 *
 *   npm run live            (from the repo root)  → http://localhost:8787
 *   docker compose up       (builds the app and serves it with live sync on port 8787)
 *
 * The browser app connects automatically. If this server is not running or stops, the app keeps working
 * in its default browser-only mode and reconnects (pushing any changes made meanwhile) when it comes back.
 *
 * Protocol (JSON, CORS-enabled):
 *   GET  /api/health                     → { ok, revision, devices, hasData }
 *   GET  /api/stream?clientId=…          → Server-Sent Events: snapshot | ops | presence
 *   POST /api/ops     { clientId, ops }  → apply entity-level changes, broadcast to other devices
 *   POST /api/replace { clientId, db }   → replace the whole demo world (first device / "Reset demo data")
 * Anything else is served from frontend/dist when it exists (single-page app fallback).
 *
 * This is a demo server for a trusted network: there is no authentication, like the app's simulated sign-in.
 */
import { createServer } from 'node:http'
import { createReadStream, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { networkInterfaces } from 'node:os'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(import.meta.dirname, 'data'))
const DATA_FILE = join(DATA_DIR, 'tandem-live.json')
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? join(import.meta.dirname, '..', 'frontend', 'dist'))
const MAX_BODY = 12 * 1024 * 1024
const MAX_OPS = 5000
const QUIET = process.env.QUIET === '1'
const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a) }

/* ------------------------------------------------------------------ state + persistence */

let state = { revision: 0, db: null }
try {
  const saved = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  if (saved && Number.isInteger(saved.revision) && (saved.db === null || isDb(saved.db))) state = saved
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.warn(`Could not read ${DATA_FILE} (${e.message}). Starting with an empty world; the file was kept as .corrupt.`)
    try { renameSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`) } catch { /* ignore */ }
  }
}

let saveTimer = null
function persistSoon() {
  if (saveTimer) return
  saveTimer = setTimeout(flush, 250)
}
function flush() {
  clearTimeout(saveTimer)
  saveTimer = null
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    const tmp = `${DATA_FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(state))
    renameSync(tmp, DATA_FILE) // atomic: a crash mid-write never corrupts the saved world
  } catch (e) {
    console.error('Could not save to disk (data is still served from memory):', e.message)
  }
}

function isDb(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.users) && Array.isArray(v.events)
}

/* ------------------------------------------------------------------ entity-level ops (mirrors frontend/src/services/liveSync.ts) */

const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,48}$/
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
const okKey = (k) => typeof k === 'string' && SAFE_KEY.test(k) && !FORBIDDEN.has(k)
const okId = (id) => (typeof id === 'string' && id.length > 0 && id.length <= 200) || Number.isFinite(id)

function validOp(op) {
  if (!op || typeof op !== 'object') return false
  if (op.t === 'put') return okKey(op.c) && !!op.v && typeof op.v === 'object' && !Array.isArray(op.v) && okId(op.v.id)
  if (op.t === 'del') return okKey(op.c) && okId(op.id)
  if (op.t === 'set') return okKey(op.k)
  return false
}

function applyOps(db, ops) {
  const next = { ...db }
  const copied = new Set()
  const list = (c) => {
    if (!copied.has(c)) {
      next[c] = Array.isArray(next[c]) ? [...next[c]] : []
      copied.add(c)
    }
    return next[c]
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
    } else if (op.t === 'del') {
      const items = list(op.c)
      const i = items.findIndex((x) => x && x.id === op.id)
      if (i !== -1) items.splice(i, 1)
    }
  }
  return next
}

/* ------------------------------------------------------------------ live connections (SSE) */

const clients = new Map() // response → clientId

function send(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  } catch {
    clients.delete(res)
  }
}
const devices = () => new Set(clients.values()).size
function broadcast(event, data, exceptClientId) {
  for (const [res, id] of clients) if (id !== exceptClientId) send(res, event, data)
}
const presence = () => broadcast('presence', { devices: devices() })

setInterval(() => {
  for (const res of clients.keys()) {
    try { res.write(': ping\n\n') } catch { clients.delete(res) }
  }
}, 20_000).unref()

/* ------------------------------------------------------------------ http */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'))
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json',
}

function serveStatic(req, res, pathname) {
  let file = resolve(STATIC_DIR, `.${decodeURIComponent(pathname)}`)
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + sep)) return json(res, 403, { error: 'Forbidden' })
  let stat = null
  try { stat = statSync(file) } catch { /* not found */ }
  if (!stat || stat.isDirectory()) {
    if (extname(pathname)) return json(res, 404, { error: 'Not found' })
    file = join(STATIC_DIR, 'index.html') // single-page app route
    try { stat = statSync(file) } catch {
      return json(res, 404, { error: 'The app is not built. Run "npm run build", or use "npm run dev" for the dev server.' })
    }
  }
  if (file.endsWith('index.html')) {
    // Tell the app it is served by Tandem Live, so it syncs with this same origin (any host port mapping).
    const html = readFileSync(file, 'utf8').replace('</head>', '<meta name="tandem-live-sync" content="same-origin"></head>')
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })
    return res.end(html)
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  if (path === '/api/health' && req.method === 'GET') {
    return json(res, 200, { ok: true, name: 'tandem-live', revision: state.revision, devices: devices(), hasData: !!state.db })
  }

  if (path === '/api/stream' && req.method === 'GET') {
    const clientId = (url.searchParams.get('clientId') ?? '').slice(0, 64) || `anon-${Math.random().toString(36).slice(2)}`
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.write('retry: 3000\n\n')
    clients.set(res, clientId)
    send(res, 'snapshot', { revision: state.revision, db: state.db, devices: devices() })
    presence()
    log(`device connected (${devices()} online)`)
    req.on('close', () => {
      clients.delete(res)
      presence()
      log(`device disconnected (${devices()} online)`)
    })
    return
  }

  if (path === '/api/ops' && req.method === 'POST') {
    const body = await readBody(req)
    const ops = body?.ops
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > MAX_OPS || !ops.every(validOp)) return json(res, 400, { error: 'Invalid ops' })
    if (!state.db) return json(res, 409, { error: 'No shared world yet', revision: state.revision })
    state = { revision: state.revision + 1, db: applyOps(state.db, ops) }
    persistSoon()
    const clientId = String(body.clientId ?? '').slice(0, 64)
    broadcast('ops', { revision: state.revision, clientId, ops }, clientId)
    return json(res, 200, { ok: true, revision: state.revision })
  }

  if (path === '/api/replace' && req.method === 'POST') {
    const body = await readBody(req)
    if (!isDb(body?.db)) return json(res, 400, { error: 'Invalid database' })
    state = { revision: state.revision + 1, db: body.db }
    persistSoon()
    const clientId = String(body.clientId ?? '').slice(0, 64)
    broadcast('snapshot', { revision: state.revision, db: state.db, devices: devices() }, clientId)
    log(`world replaced by a device (revision ${state.revision})`)
    return json(res, 200, { ok: true, revision: state.revision })
  }

  if (path.startsWith('/api/')) return json(res, 404, { error: 'Not found' })
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' })
  return serveStatic(req, res, path)
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (!res.headersSent) json(res, e.status ?? 500, { error: e.status ? e.message : 'Server error' })
    else res.destroy()
    if (!e.status) console.error('Request failed:', e)
  })
})
server.on('clientError', (_err, socket) => socket.destroy())
server.keepAliveTimeout = 65_000

// Stay up no matter what a single request does; the app falls back to browser-only mode if we ever go away.
process.on('uncaughtException', (e) => console.error('Unexpected error (server keeps running):', e))
process.on('unhandledRejection', (e) => console.error('Unexpected rejection (server keeps running):', e))
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flush()
    for (const res of clients.keys()) { try { res.end() } catch { /* ignore */ } }
    server.close()
    process.exit(0)
  })
}

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Is Tandem Live already running? (Set PORT=… to use another port.)` : e)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  const lan = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address)
  console.log(`Tandem Live sync server on http://localhost:${PORT}`)
  for (const ip of lan) console.log(`  on your network:  http://${ip}:${PORT}`)
  console.log(`  data: ${DATA_FILE}${state.db ? ` (revision ${state.revision})` : ' (empty: the first device to connect shares its demo world)'}`)
  try { statSync(join(STATIC_DIR, 'index.html')); console.log(`  serving the built app from ${STATIC_DIR}`) } catch { console.log('  app: use "npm run dev" (or build it with "npm run build" to serve it from here)') }
})
