// Renders demo.html frame by frame (deterministic timeline) into an H.264 MP4 with ffmpeg.
//   node demo-video/render.mjs                   → demo-video/tandem-demo.mp4 (1920x1080, 60 fps, silent)
//   node demo-video/render.mjs --stills 1,9.5    → demo-video/frames/still-<t>.png (quick visual checks)
//   node demo-video/render.mjs --fps 30          → lighter file
// Needs: shots/ from capture.mjs, Google Chrome, ffmpeg.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from '../frontend/scripts/e2e/cdp.mjs'

const HERE = import.meta.dirname
const ROOT = resolve(HERE, '..')
const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i === -1 ? dflt : args[i + 1] }
const FPS = Number(opt('fps', 60))
const OUT = resolve(opt('out', join(HERE, 'tandem-demo.mp4')))
const STILLS = opt('stills', null)

/* ---------------------------------------------------------------- data.js: capture metadata, lucide icons, logo */
const { meta } = JSON.parse(readFileSync(join(HERE, 'shots', 'rects.json'), 'utf8'))
const ICON_NAMES = ['shield-check', 'lock', 'sparkles', 'heart-handshake', 'mic', 'sliders-horizontal', 'map', 'layers', 'map-pin', 'badge-check', 'calendar-check',
  'radio', 'container', 'wifi-off', 'trophy', 'users', 'plane', 'eye', 'audio-lines', 'accessibility', 'ear', 'code-xml', 'zap', 'database', 'check', 'globe',
  'a-large-small', 'type', 'contrast', 'volume-2', 'message-circle', 'star']
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
const PAGE = `http://127.0.0.1:${server.address().port}/demo-video/demo.html`

const b = await launch({ port: 9655, width: 1920, height: 1080, profile: mkdtempSync(join(tmpdir(), 'tandem-render-')) })
process.on('exit', () => { try { b.close() } catch {} })
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await b.goto(PAGE, 500)
for (let i = 0; i < 600 && !(await b.eval('window.READY === true')); i++) await b.sleep(100)
if (!(await b.eval('window.READY === true'))) throw new Error('demo page did not become ready')
const DURATION = await b.eval('window.DURATION')
const frame = async (t) => {
  await b.eval(`seek(${t}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`)
  const { data } = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 }, optimizeForSpeed: true })
  return Buffer.from(data, 'base64')
}

if (STILLS) {
  mkdirSync(join(HERE, 'frames'), { recursive: true })
  for (const t of STILLS.split(',').map(Number)) {
    writeFileSync(join(HERE, 'frames', `still-${t.toFixed(2)}.png`), await frame(t))
    console.log('still', t)
  }
} else {
  const total = Math.round(DURATION * FPS)
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), OUT], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((r, j) => ff.on('exit', (code) => (code === 0 ? r() : j(new Error('ffmpeg exited ' + code)))))
  const t0 = Date.now()
  for (let i = 0; i < total; i++) {
    const png = await frame(i / FPS)
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % FPS === 0) process.stdout.write(`\r${(i / FPS).toFixed(0)}s / ${DURATION}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`)
  }
  ff.stdin.end()
  await done
  console.log(`\nwrote ${OUT}`)
}
console.log('LOGS:', b.logs.join('\n') || '(none)')
await b.close()
server.close()
