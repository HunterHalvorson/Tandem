// Renders a timeline page frame by frame (deterministic seek(t)) into an H.264 MP4 with ffmpeg.
//   node demo-video/render.mjs                               → demo-video/tandem-demo.mp4 (60 s cut, 1920x1080, 60 fps, silent)
//   node demo-video/render.mjs --page submission.html        → demo-video/tandem-devpost.mp4 (Devpost cut)
//   node demo-video/render.mjs --stills 1,9.5                → demo-video/frames/still-<t>.png (quick visual checks)
//   --fps 30 (lighter file) · --workers 4 (parallel Chromes, joined losslessly) · --out path.mp4
// Needs: shots/ from capture.mjs (+ capture-extra.mjs for the Devpost cut), Google Chrome, ffmpeg.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from '../frontend/scripts/e2e/cdp.mjs'

const HERE = import.meta.dirname
const ROOT = resolve(HERE, '..')
const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i === -1 ? dflt : args[i + 1] }
const PAGE_FILE = opt('page', 'demo.html')
const FPS = Number(opt('fps', 60))
const WORKERS = Math.max(1, Number(opt('workers', 1)))
const OUT = resolve(opt('out', join(HERE, PAGE_FILE === 'demo.html' ? 'tandem-demo.mp4' : 'tandem-devpost.mp4')))
const STILLS = opt('stills', null)

/* ---------------------------------------------------------------- data.js: capture metadata, lucide icons, logo */
const { meta } = JSON.parse(readFileSync(join(HERE, 'shots', 'rects.json'), 'utf8'))
const ICON_NAMES = ['shield-check', 'lock', 'sparkles', 'heart-handshake', 'mic', 'sliders-horizontal', 'map', 'layers', 'map-pin', 'badge-check', 'calendar-check',
  'radio', 'container', 'wifi-off', 'trophy', 'users', 'plane', 'eye', 'audio-lines', 'accessibility', 'ear', 'code-xml', 'zap', 'database', 'check', 'globe',
  'a-large-small', 'type', 'contrast', 'volume-2', 'message-circle', 'star',
  'user-round', 'trending-up', 'eye-off', 'smartphone', 'laptop', 'save', 'bike', 'wifi', 'hard-drive', 'server', 'heart']
const icons = {}
for (const name of ICON_NAMES) {
  const mod = await import(pathToFileURL(join(ROOT, 'frontend/node_modules/lucide-react/dist/esm/icons', `${name}.mjs`)).href)
  icons[name] = mod.__iconData.node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
}
const logo = readFileSync(join(HERE, 'shots', 'logo.svg'), 'utf8').replace(/ class="[^"]*"/, '')
writeFileSync(join(HERE, 'data.js'), `window.SHOT_META = ${JSON.stringify(meta)};\nwindow.ICONS = ${JSON.stringify(icons)};\nwindow.LOGO = ${JSON.stringify(logo)};\n`)

/* ---------------------------------------------------------------- static server for the repo (fonts + shots) */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' }
const server = createServer((req, res) => {
  const file = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end() }
  try { statSync(file) } catch { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const PAGE = `http://127.0.0.1:${server.address().port}/demo-video/${PAGE_FILE}`

const browsers = []
process.on('exit', () => { for (const b of browsers) { try { b.close() } catch {} } })
async function openPage(port) {
  const b = await launch({ port, width: 1920, height: 1080, profile: mkdtempSync(join(tmpdir(), 'tandem-render-')) })
  browsers.push(b)
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await b.goto(PAGE, 500)
  for (let i = 0; i < 600 && !(await b.eval('window.READY === true')); i++) await b.sleep(100)
  if (!(await b.eval('window.READY === true'))) throw new Error('page did not become ready')
  return b
}
const frameOf = (b) => async (t) => {
  await b.eval(`seek(${t}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`)
  const { data } = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, optimizeForSpeed: true })
  return Buffer.from(data, 'base64')
}
const ffmpeg = (out) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] })
const exited = (p) => new Promise((r, j) => p.on('exit', (code) => (code === 0 ? r() : j(new Error('ffmpeg exited ' + code)))))

const first = await openPage(9655)
const DURATION = await first.eval('window.DURATION')

if (STILLS) {
  mkdirSync(join(HERE, 'frames'), { recursive: true })
  const frame = frameOf(first)
  for (const t of STILLS.split(',').map(Number)) {
    writeFileSync(join(HERE, 'frames', `still-${t.toFixed(2)}.png`), await frame(t))
    console.log('still', t)
  }
} else {
  const total = Math.round(DURATION * FPS)
  const per = Math.ceil(total / WORKERS)
  const work = mkdtempSync(join(tmpdir(), 'tandem-parts-'))
  const parts = []
  let done = 0
  const t0 = Date.now()
  const tick = setInterval(() => process.stdout.write(`\r${(done / FPS).toFixed(0)}s / ${DURATION.toFixed(1)}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`), 1000)
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, z = Math.min(total, a + per)
    if (a >= z) return
    const b = w === 0 ? first : await openPage(9655 + w)
    const frame = frameOf(b)
    const out = WORKERS === 1 ? OUT : join(work, `part-${String(w).padStart(2, '0')}.mp4`)
    parts[w] = out
    const ff = ffmpeg(out)
    const finished = exited(ff)
    for (let i = a; i < z; i++) {
      const png = await frame(i / FPS)
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
      done++
    }
    ff.stdin.end()
    await finished
  }))
  clearInterval(tick)
  if (WORKERS > 1) {
    const list = join(work, 'parts.txt')
    writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n') + '\n')
    await exited(spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' }))
    rmSync(work, { recursive: true, force: true })
  }
  console.log(`\nwrote ${OUT} (${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s)`)
}
console.log('LOGS:', browsers.map((b) => b.logs.join('\n')).filter(Boolean).join('\n') || '(none)')
for (const b of browsers) await b.close()
server.close()
