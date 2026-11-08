import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from './cdp.mjs'
/**
 * Two real browsers (Alex and Sam) synced through the Tandem Live server, including the fallback:
 * the server is stopped mid-session, the app keeps working locally, and changes sync once it is back.
 * Dev server must be running (npm run dev). Starts its own Tandem Live server on a test port: npm run e2e:live
 */
const LIVE_PORT = 8899
const LIVE = `http://localhost:${LIVE_PORT}`
const DATA_DIR = mkdtempSync(join(tmpdir(), 'tandem-live-e2e-'))
const SERVER = join(import.meta.dirname, '..', '..', '..', 'server', 'live-server.mjs')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let server = null
async function startServer() {
  server = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT: String(LIVE_PORT), DATA_DIR, QUIET: '1' }, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${LIVE}/api/health`)).ok) return } catch { /* starting */ }
    await sleep(100)
  }
  throw new Error('Tandem Live did not start')
}
async function stopServer() {
  if (!server) return
  const exited = new Promise((r) => server.once('exit', r))
  server.kill('SIGTERM')
  await exited
  server = null
}

const H = `
window.$q = (s) => document.querySelector(s);
window.$all = (s) => [...document.querySelectorAll(s)];
window.setVal = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true };
window.byText = (s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent.replace(/\\s+/g,' ').trim().includes(t));
window.clickText = (s, t) => { const el = byText(s, t); if (!el) throw new Error('not found: ' + s + ' / ' + t); el.click(); return true };
true`
const init = `try { localStorage.setItem('tandem.sync', '${LIVE}'); localStorage.setItem('tandem.banner.dismissed', '1') } catch {}`

await startServer()
const A = await launch({ port: 9561, profile: mkdtempSync(join(tmpdir(), 'tandem-live-a-')), init })
const B = await launch({ port: 9562, profile: mkdtempSync(join(tmpdir(), 'tandem-live-b-')), init })
const go = async (b, p, w = 1200) => { await b.goto(p, w); await b.eval(H) }
/** Wait until `expr` is truthy in browser `b` (no reloads: proves the change arrived live). */
async function until(b, expr, ms = 8000) {
  const t0 = Date.now()
  for (;;) {
    if (await b.eval(`!!(${expr})`)) return Date.now() - t0
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for: ${expr}`)
    await sleep(100)
  }
}
const results = []
async function step(name, fn) {
  try { results.push(['PASS', name, (await fn()) ?? '']) } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]) }
}

const EVENT = '/events/evt-coffee-newcomers'
const badge = (b) => b.eval(`byText('main span', 'Live')?.textContent.trim() ?? ''`)

await step('Both browsers connect and share one world', async () => {
  await go(A, '/login'); await A.eval(`clickText('button', 'Continue as Alex')`); await sleep(500)
  await go(B, '/login'); await B.eval(`clickText('button', 'Continue as Sam')`); await sleep(500)
  await go(A, '/settings', 1500); await go(B, '/settings', 1500)
  await until(A, `document.body.textContent.includes('synced to the local Tandem Live server')`)
  await until(B, `document.body.textContent.includes('synced to the local Tandem Live server')`)
  const health = await (await fetch(`${LIVE}/api/health`)).json()
  if (health.devices < 2) throw new Error('server sees ' + health.devices + ' device(s)')
  return `server sees ${health.devices} devices, revision ${health.revision}`
})

await step('RSVP on one device updates the other without a reload', async () => {
  await go(A, EVENT); await go(B, EVENT)
  const before = await B.eval(`byText('aside p', 'going')?.textContent.split('·')[0].trim()`)
  await A.eval(`byText('aside button', 'Join event').click(); true`)
  const ms = await until(B, `byText('aside p', 'going')?.textContent.split('·')[0].trim() !== ${JSON.stringify(before)}`)
  const after = await B.eval(`byText('aside p', 'going')?.textContent.split('·')[0].trim()`)
  return `${before} → ${after} on Sam's screen in ${ms} ms`
})

await step('Chat message arrives live on the other device', async () => {
  await B.eval(`byText('aside button', 'Join event').click(); true`); await sleep(400)
  await go(A, `${EVENT}/chat`, 1200); await go(B, `${EVENT}/chat`, 1200)
  await until(A, `byText('main span', 'Live ·')?.textContent.includes('2 devices')`)
  await until(B, `byText('main span', 'Live ·')?.textContent.includes('2 devices')`)
  await A.eval(`setVal($q('#chat-input'), 'Hello from Alex’s laptop'); $q('button[aria-label="Send message"]').click(); true`)
  const ms = await until(B, `$q('[role=log]')?.textContent.includes('Hello from Alex’s laptop')`)
  await B.eval(`setVal($q('#chat-input'), 'Hi Alex, Sam here on my phone'); $q('button[aria-label="Send message"]').click(); true`)
  const back = await until(A, `$q('[role=log]')?.textContent.includes('Sam here on my phone')`)
  return `A→B ${ms} ms, B→A ${back} ms`
})

await step('Server stops: the app falls back to browser-only mode and keeps working', async () => {
  await stopServer()
  await until(A, `byText('main span', 'Live in this browser')`)
  await A.eval(`setVal($q('#chat-input'), 'Sent while the server was down'); $q('button[aria-label="Send message"]').click(); true`)
  await until(A, `$q('[role=log]')?.textContent.includes('Sent while the server was down')`, 2000)
  return `badge: "${await badge(A)}", message saved locally`
})

await step('Server returns: devices reconnect and the offline message syncs', async () => {
  await startServer()
  const ms = await until(B, `$q('[role=log]')?.textContent.includes('Sent while the server was down')`, 30000)
  await until(A, `byText('main span', 'Live ·')`, 30000)
  return `delivered to Sam ${ms} ms after restart`
})

await step('A fresh page load reads the shared world from the server', async () => {
  await go(B, `${EVENT}/chat`, 2500)
  await until(B, `$q('[role=log]')?.textContent.includes('Hello from Alex’s laptop')`)
  return 'chat history intact after reload'
})

for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? '  — ' + d : ''}`)
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
const logs = [...A.logs, ...B.logs]
console.log('LOGS:\n' + (logs.join('\n') || '(none)'))
await A.close(); await B.close(); await stopServer()
process.exit(failed ? 1 : 0)
