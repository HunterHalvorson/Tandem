// Minimal Chrome DevTools Protocol driver (uses Node 22's global WebSocket) for E2E flows, a11y audits and screenshots.
// No Playwright/Puppeteer download needed — it drives your installed Google Chrome in headless mode.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

// Configure with env vars: CHROME_PATH (defaults to macOS Chrome) and BASE_URL (defaults to the Vite dev server).
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ port = 9333, width = 1440, height = 1000, profile, mobile = false } = {}) {
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' })
  let targets
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break } catch {}
    await sleep(200)
  }
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    else if (msg.method) listeners.forEach((l) => l(msg))
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id
    pending.set(i, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)))
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  const logs = []
  listeners.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(`[console.${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
  })
  await send('Page.enable'); await send('Runtime.enable')
  const setViewport = (w, h, isMobile = false) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: isMobile })
  await setViewport(width, height, mobile)
  const api = {
    send, logs, setViewport,
    async goto(path, wait = 900) {
      const loaded = new Promise((r) => { const l = (m) => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r() } }; listeners.push(l) })
      await send('Page.navigate', { url: path.startsWith('http') ? path : BASE + path })
      await loaded; await sleep(wait)
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    },
    async shot(file, { full = false } = {}) {
      mkdirSync(file.split('/').slice(0, -1).join('/'), { recursive: true })
      let params = { format: 'png' }
      if (full) {
        const m = await send('Page.getLayoutMetrics')
        const h = Math.min(Math.ceil(m.cssContentSize.height), 6000)
        params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: h, scale: 1 } }
      }
      const { data } = await send('Page.captureScreenshot', params)
      writeFileSync(file, Buffer.from(data, 'base64'))
    },
    sleep,
    async close() { ws.close(); proc.kill('SIGKILL') },
  }
  return api
}
