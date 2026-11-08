// node --test server/   (or: npm run test:live)
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

const PORT = 18000 + Math.floor(Math.random() * 1000)
const BASE = `http://127.0.0.1:${PORT}`
const DATA_DIR = mkdtempSync(join(tmpdir(), 'tandem-live-test-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let proc

async function start() {
  proc = spawn(process.execPath, [join(import.meta.dirname, 'live-server.mjs')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, QUIET: '1', STATIC_DIR: join(DATA_DIR, 'no-dist') }, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return } catch { /* not up yet */ }
    await sleep(100)
  }
  throw new Error('server did not start')
}
async function stop() {
  if (!proc) return
  const exited = new Promise((r) => proc.once('exit', r))
  proc.kill('SIGTERM')
  await exited
  proc = null
}
after(stop)

/** Minimal SSE client over fetch: collects { event, data } messages. */
function listen(clientId) {
  const ctrl = new AbortController()
  const events = []
  const ready = (async () => {
    const res = await fetch(`${BASE}/api/stream?clientId=${clientId}`, { signal: ctrl.signal })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const event = /^event: (.*)$/m.exec(block)?.[1]
            const data = /^data: (.*)$/m.exec(block)?.[1]
            if (event && data) events.push({ event, data: JSON.parse(data) })
          }
        }
      } catch { /* aborted */ }
    })()
  })()
  const next = async (event, timeout = 2000) => {
    const t0 = Date.now()
    for (;;) {
      const i = events.findIndex((e) => e.event === event)
      if (i !== -1) return events.splice(i, 1)[0].data
      if (Date.now() - t0 > timeout) return null
      await sleep(20)
    }
  }
  return { ready, next, events, close: () => ctrl.abort() }
}
const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const world = () => ({ version: 1, seededAt: '2026-11-07T00:00:00.000Z', users: [{ id: 'usr-a', firstName: 'A' }], events: [{ id: 'evt-1', title: 'Run' }], registrations: [], groups: [], memberships: [], reviews: [], messages: [], reports: [] })

test('two devices sync through the server, and data survives a restart', async () => {
  await start()
  const health = await (await fetch(`${BASE}/api/health`)).json()
  assert.equal(health.name, 'tandem-live')
  assert.equal(health.hasData, false)

  const a = listen('A')
  const b = listen('B')
  await Promise.all([a.ready, b.ready])
  assert.equal((await a.next('snapshot')).db, null)
  assert.equal((await b.next('snapshot')).db, null)

  // Device A shares its world; B receives it, A does not get its own echo.
  assert.equal((await post('/api/replace', { clientId: 'A', db: world() })).status, 200)
  const snap = await b.next('snapshot')
  assert.equal(snap.db.events[0].title, 'Run')
  assert.equal(await a.next('snapshot', 300), null)

  // A chat message from A reaches B as a small op.
  const msg = { id: 'msg-1', eventId: 'evt-1', userId: 'usr-a', kind: 'message', body: 'Hi!', createdAt: '2026-11-07T10:00:00.000Z', isDemo: false }
  assert.equal((await post('/api/ops', { clientId: 'A', ops: [{ t: 'put', c: 'messages', v: msg }] })).status, 200)
  const ops = await b.next('ops')
  assert.deepEqual(ops.ops, [{ t: 'put', c: 'messages', v: msg }])
  assert.equal(ops.clientId, 'A')
  assert.equal(await a.next('ops', 300), null)

  // Bad input is rejected without affecting the world.
  assert.equal((await post('/api/ops', { clientId: 'A', ops: [{ t: 'put', c: '__proto__', v: { id: 'x' } }] })).status, 400)
  assert.equal((await post('/api/ops', { clientId: 'A', ops: [{ t: 'drop' }] })).status, 400)
  assert.equal((await post('/api/ops', '{not json')).status, 400)
  assert.equal((await post('/api/replace', { db: { nope: true } })).status, 400)
  assert.equal((await fetch(`${BASE}/api/health`)).status, 200, 'server still up after bad requests')

  a.close()
  b.close()
  await sleep(400) // debounced save
  const saved = JSON.parse(readFileSync(join(DATA_DIR, 'tandem-live.json'), 'utf8'))
  assert.equal(saved.db.messages[0].body, 'Hi!')

  await stop()
  await start()
  const c = listen('C')
  await c.ready
  const again = await c.next('snapshot')
  assert.equal(again.db.messages[0].body, 'Hi!')
  assert.equal(again.revision, saved.revision)
  c.close()
})
