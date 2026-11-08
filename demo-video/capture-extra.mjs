// Captures the extra real screens used by the Devpost cut (submission.html): match breakdown (shown before joining), the chat on a laptop and
// a phone (two real browsers synced by Tandem Live, including a server outage), Explore Like a Local, attendance +
// Tandem Miles, the leaderboard and privacy & data settings.
// 1. Start a dev server:  cd frontend && npm run dev      (or any port; set BASE_URL)
// 2. node demo-video/capture-extra.mjs
// Adds PNGs to demo-video/shots/ and merges their sizes/boxes into shots/rects.json. Shots from capture.mjs are untouched.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from '../frontend/scripts/e2e/cdp.mjs'

const OUT = join(import.meta.dirname, 'shots')
mkdirSync(OUT, { recursive: true })
const W = 1280, H = 800, DPR = 2
const PW = 390, PH = 844, PDPR = 3

// A throwaway Tandem Live server. It is stopped and restarted (same data dir) to capture the offline fallback.
const LIVE_PORT = 8790
const LIVE = `http://localhost:${LIVE_PORT}`
const LIVE_DIR = mkdtempSync(join(tmpdir(), 'tandem-video-live-'))
let live = null
async function startLive() {
  live = spawn(process.execPath, [join(import.meta.dirname, '..', 'server', 'live-server.mjs')], { env: { ...process.env, PORT: String(LIVE_PORT), DATA_DIR: LIVE_DIR, QUIET: '1' }, stdio: 'ignore' })
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${LIVE}/api/health`)).ok) return } catch {} await new Promise((r) => setTimeout(r, 100)) }
  throw new Error('live server did not start')
}
async function stopLive() {
  const p = live
  live = null
  if (p) await new Promise((r) => { p.once('exit', r); p.kill('SIGTERM') })
}
await startLive()
const syncInit = `try { localStorage.setItem('tandem.sync', '${LIVE}'); localStorage.setItem('tandem.banner.dismissed', '1') } catch {}`

const b = await launch({ port: 9454, width: W, height: H, profile: mkdtempSync(join(tmpdir(), 'tandem-video-x-')), init: syncInit })
let ben = null
process.on('exit', () => { try { b.close(); ben?.close(); live?.kill() } catch {} })
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false })

const HELP = `
window.$q = (s) => document.querySelector(s);
window.$all = (s) => [...document.querySelectorAll(s)];
window.setVal = (el, v) => { if (!el) throw new Error('setVal: no element'); const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P, 'value').set.call(el, v); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true };
window.norm = (s) => s.replace(/\\s+/g, ' ').trim();
window.byText = (s, t) => [...document.querySelectorAll(s)].find((e) => norm(e.textContent).includes(t));
window.clickText = (s, t) => { const el = byText(s, t); if (!el) throw new Error('not found: ' + s + ' / ' + t); el.click(); return true };
window.box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height } };
window.deep = (s, t) => [...document.querySelectorAll(s)].filter((e) => norm(e.textContent).includes(t)).pop();
window.comfortCard = () => $q('#comfort').closest('section');
window.comfortLabel = (t) => [...comfortCard().querySelectorAll('label')].find((l) => norm(l.textContent).startsWith(t));
window.whyCard = () => [...document.querySelectorAll('main details')].find((d) => d.textContent.includes('% match'));
window.bubble = (t) => $all('[role=log] *').filter((e) => norm(e.textContent).startsWith(t)).pop();
true`
// Load lazy images, hide toasts, drop focus rings and the caret.
const SETTLE = `(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager' });
  await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000) })));
  let st = document.getElementById('__video_css');
  if (!st) { st = document.createElement('style'); st.id = '__video_css'; document.head.appendChild(st) }
  st.textContent = '.fixed.inset-x-0.bottom-20 { display: none !important } * { caret-color: transparent !important }';
  document.activeElement?.blur?.();
  return true })()`

const ev = (x) => b.eval(x)
const go = async (p, wait = 1200) => { await b.goto(p, wait); await ev(HELP) }
const until = async (fn, ms, what) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await b.sleep(100) }
  throw new Error(`timed out waiting for ${what}`)
}
const existing = existsSync(join(OUT, 'rects.json')) ? JSON.parse(readFileSync(join(OUT, 'rects.json'), 'utf8')) : { meta: {}, rects: {} }
const rects = {}
const meta = {}

/** Laptop screenshot (1280x800 CSS at 2x). full=true captures the whole page from the top (the video scrolls it). */
async function shot(name, { full = false, maxH = 3600 } = {}) {
  await ev(SETTLE)
  if (full) await ev(`window.scrollTo(0, 0); true`)
  await b.sleep(350)
  let params = { format: 'png' }
  let height = H
  if (full) {
    const m = await b.send('Page.getLayoutMetrics')
    height = Math.min(Math.ceil(m.cssContentSize.height), maxH)
    params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height, scale: 1 } }
  }
  const { data } = await b.send('Page.captureScreenshot', params)
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
  meta[name] = { w: W, h: height, dpr: DPR, headerH: await ev(`Math.round(document.querySelector('header')?.getBoundingClientRect().height ?? 0)`) }
  console.log('shot', name, `${W}x${height}`)
}
/** Element box (page coordinates). Call after shot() so the page is scrolled to the top. */
async function rect(name, key, expr) {
  const r = await ev(`box(${expr})`)
  if (!r) console.warn('  ! missing rect', name, key)
  ;(rects[name] ??= {})[key] = r
}

/* ---------------------------------------------------------------- Riley: sign up, interests, comfort (as capture.mjs) */
await go('/')
await go('/signup', 1500)
await ev(`setVal($q('#field-firstName'), 'Riley'); setVal($q('#field-lastName'), 'Morgan'); setVal($q('#field-email'), 'riley@example.com'); setVal($q('#field-password'), 'calgary2026'); true`)
await ev(`clickText('label', 'Visiting Calgary'); $q('#field-ageConfirmed input').click(); true`)
await ev(`clickText('button', 'Create account')`)
await b.sleep(900); await ev(HELP)
const rileyId = await ev(`sessionStorage.getItem('tandem.session') ?? localStorage.getItem('tandem.session')`)
console.log('riley id', rileyId, await ev('location.pathname'))
await ev(`$q('main summary')?.click(); true`)
for (const t of ['Reading & literature', 'Food & coffee', 'Hiking & outdoors', 'Traveller & local meetups']) await ev(`clickText('main label', '${t}')`)
await ev(`clickText('button', 'Find events')`)
await b.sleep(900)
await go('/settings', 1500)
for (const t of ['Small groups', 'Beginner-friendly', 'Quiet environment', 'Sensory-friendly']) {
  await ev(`comfortLabel('${t}').click(); true`); await b.sleep(150); await ev(HELP)
}
await ev(`byText('section div.rounded-xl', 'Ease Into It').querySelector('[role=switch], button').click(); true`)
await b.sleep(600)

/* ---------------------------------------------------------------- voice-search button on Discover (box only) */
await go('/discover', 1500)
await rect('discover-0', 'mic', `$q('button[aria-label="Search by voice"]')`)

/* ---------------------------------------------------------------- event: join, then open "See how this was scored" */
const EID = 'evt-coffee-newcomers'
await go(`/events/${EID}`, 1500)
await ev(`whyCard().open = true; true`)
await b.sleep(400)
await shot('event-why', { full: true })
await rect('event-why', 'why', `whyCard()`)
await rect('event-why', 'whySummary', `whyCard()?.querySelector('summary')`)
await rect('event-why', 'factors', `whyCard()?.querySelector('div.mt-4')`)
await rect('event-why', 'firstTime', `byText('main h2', 'First-Time Friendly')?.parentElement ?? null`)
await rect('event-why', 'access', `byText('main h2', 'Comfort & Access')?.parentElement ?? null`)
await rect('event-why', 'title', `$q('main h1')`)
await rect('event-why', 'asideCard', `byText('aside button', 'Join event')?.closest('.rounded-card') ?? $q('aside .rounded-card')`)
await rect('event-why', 'join', `byText('aside button', 'Join event')`)
await ev(`byText('aside button', 'Join event').click(); true`)
await b.sleep(900); await ev(HELP)

/* ---------------------------------------------------------------- chat: Riley's laptop + the host's phone */
ben = await launch({ port: 9456, width: PW, height: PH, mobile: true, profile: mkdtempSync(join(tmpdir(), 'tandem-video-ben-')), init: `${syncInit}; try { localStorage.setItem('tandem.session', 'usr-ben') } catch {}` })
await ben.send('Emulation.setDeviceMetricsOverride', { width: PW, height: PH, deviceScaleFactor: PDPR, mobile: true })
await ben.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }).catch(() => {})
const bev = (x) => ben.eval(x)
async function phoneShot(name) {
  await bev(HELP); await bev(SETTLE)
  await ben.sleep(350)
  const { data } = await ben.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
  meta[name] = { w: PW, h: PH, dpr: PDPR, headerH: 0 }
  console.log('phone', name, `${PW}x${PH}`)
}
async function prect(name, key, expr) {
  const r = await bev(`box(${expr})`)
  if (!r) console.warn('  ! missing rect', name, key)
  ;(rects[name] ??= {})[key] = r
}
const send = async (who, text) => {
  const js = `setVal($q('#chat-input'), ${JSON.stringify(text)}); $q('button[aria-label="Send message"]').click(); true`
  return who === 'ben' ? bev(js) : ev(js)
}

await ben.goto(`/events/${EID}/chat`, 2500); await bev(HELP)
await go(`/events/${EID}/chat`, 1500)
await until(() => ev(`!!byText('main span', 'Live ·')?.textContent.includes('2 devices')`), 10000, 'two devices')
await shot('chat2-0')
await rect('chat2-0', 'input', `$q('#chat-input')`)
await rect('chat2-0', 'send', `$q('button[aria-label="Send message"]')`)
await rect('chat2-0', 'live', `byText('main span', 'Live ·')`)
await rect('chat2-0', 'note', `deep('aside p, aside div', 'Synced through')`)
await phoneShot('phone-0')
await prect('phone-0', 'input', `$q('#chat-input')`)
await prect('phone-0', 'log', `$q('[role=log]')`)

const M1 = 'Hi! Visiting from Vancouver and a little nervous. Is it OK if I mostly listen at first?'
await send('riley', M1)
await b.sleep(700); await ev(HELP)
await shot('chat2-1')
await rect('chat2-1', 'mine', `bubble('Hi! Visiting')`)
const d1 = await until(() => bev(`!!document.querySelector('[role=log]')?.textContent.includes('little nervous')`), 10000, 'message on the phone')
console.log('message reached the phone after ~', d1, 'ms (poll)')
await phoneShot('phone-1')
await prect('phone-1', 'msg', `bubble('Hi! Visiting')`)
await prect('phone-1', 'input', `$q('#chat-input')`)

const M2 = 'Absolutely! Most people come alone. Look for the small red bike sign, I’ll save you a seat ☕'
await bev(`setVal($q('#chat-input'), ${JSON.stringify(M2)}); true`)
await phoneShot('phone-1t')
await bev(`$q('button[aria-label="Send message"]').click(); true`)
await until(() => ev(`!!$q('[role=log]')?.textContent.includes('save you a seat')`), 10000, 'reply on the laptop')
await b.sleep(600); await ev(HELP)
await shot('chat2-2')
await rect('chat2-2', 'reply', `bubble('Absolutely')`)
await rect('chat2-2', 'mine', `bubble('Hi! Visiting')`)
await rect('chat2-2', 'live', `byText('main span', 'Live ·')`)
await phoneShot('phone-2')
await prect('phone-2', 'reply', `bubble('Absolutely')`)

/* ---------------------------------------------------------------- the server goes down, Riley keeps chatting */
await stopLive()
await until(() => ev(`!!byText('main span', 'Live in this browser')`), 20000, 'offline badge')
await b.sleep(400); await ev(HELP)
await shot('chat2-off-0')
await rect('chat2-off-0', 'live', `byText('main span', 'Live in this browser')`)
await rect('chat2-off-0', 'note', `deep('aside p, aside div', 'Browser-only mode')`)
await rect('chat2-off-0', 'input', `$q('#chat-input')`)
const M3 = 'Running 5 minutes late, see you soon!'
await send('riley', M3)
await b.sleep(700); await ev(HELP)
await shot('chat2-off-1')
await rect('chat2-off-1', 'mine', `bubble('Running 5 minutes')`)
await phoneShot('phone-off')
console.log('phone has the late message while offline?', await bev(`document.querySelector('[role=log]')?.textContent.includes('5 minutes late')`))

const tRestart = Date.now()
await startLive()
await until(() => bev(`!!document.querySelector('[role=log]')?.textContent.includes('5 minutes late')`), 90000, 'late message after restart')
console.log('late message delivered', Date.now() - tRestart, 'ms after the server restarted')
await until(() => ev(`!!byText('main span', 'Live ·')?.textContent.includes('2 devices')`), 30000, 'live again')
await b.sleep(600); await ev(HELP)
await shot('chat2-on')
await rect('chat2-on', 'live', `byText('main span', 'Live ·')`)
await rect('chat2-on', 'note', `deep('aside p, aside div', 'Synced through')`)
await rect('chat2-on', 'mine', `bubble('Running 5 minutes')`)
await phoneShot('phone-3')
await prect('phone-3', 'msg', `bubble('Running 5 minutes')`)
await ben.close(); ben = null

/* ---------------------------------------------------------------- Explore Like a Local: plan a weekend, join all */
await go('/explore-like-a-local', 1800)
await shot('traveller-0', { full: true, maxH: 2800 })
await rect('traveller-0', 'heading', `$q('#planner')`)
await rect('traveller-0', 'joinAll', `byText('main button', 'Join all')`)
await rect('traveller-0', 'plan', `$q('#planner')?.closest('section')?.querySelector('ol')`)
await rect('traveller-0', 'day0', `$q('#planner')?.closest('section')?.querySelector('ol > li')`)
await rect('traveller-0', 'prefs', `$q('#planner')?.closest('section')?.previousElementSibling`)
await rect('traveller-0', 'summary', `$q('#planner')?.parentElement?.querySelector('p')`)
console.log('plan', await ev(`norm($q('#planner').closest('section').innerText).slice(0, 500)`))
await ev(`clickText('main button', 'Join all')`)
await b.sleep(1500); await ev(HELP)
await shot('traveller-1', { full: true, maxH: 2800 })
await rect('traveller-1', 'joinAll', `byText('main button', 'Join all')`)
await rect('traveller-1', 'plan', `$q('#planner')?.closest('section')?.querySelector('ol')`)
await rect('traveller-1', 'day0', `$q('#planner')?.closest('section')?.querySelector('ol > li')`)

/* ---------------------------------------------------------------- privacy & data */
await go('/settings', 1500)
await shot('settings-priv', { full: true, maxH: 5200 })
await rect('settings-priv', 'privacy', `$q('#privacy').closest('section')`)
await rect('settings-priv', 'privacyFields', `$q('#privacy').closest('section').querySelector('fieldset')`)
await rect('settings-priv', 'verification', `$q('#verification').closest('section')`)
await rect('settings-priv', 'data', `$q('#data').closest('section')`)
await rect('settings-priv', 'neverStored', `byText('main p', 'Passwords, government IDs')`)
await rect('settings-priv', 'download', `byText('main button', 'Download my data')`)
await rect('settings-priv', 'delete', `byText('main button', 'Delete my account')`)

/* ---------------------------------------------------------------- after the book club: confirm attendance, earn Miles */
// Fixture: Riley went to last week's book club (registered, not yet confirmed), so the dashboard asks "Did you make it?".
await ev(`(() => {
  const db = JSON.parse(localStorage.getItem('tandem.db.v1'));
  const e = db.events.find((x) => x.id === 'evt-book-club-past');
  const start = new Date(e.startsAt).getTime();
  db.registrations.push({ id: 'reg-book-club-past-riley', eventId: e.id, userId: '${rileyId}', status: 'going', joinedAt: new Date(start - 3 * 864e5).toISOString(), isDemo: true });
  localStorage.setItem('tandem.db.v1', JSON.stringify(db)); return true })()`)
await go('/dashboard', 2000)
await until(() => ev(`!!byText('main li', 'Did you make it')`), 8000, 'attendance card')
const milesText = () => ev(`norm([...document.querySelectorAll('main .bg-ink')].find((e) => e.textContent.includes('Tandem Miles'))?.innerText ?? '')`)
console.log('miles before', await milesText())
await shot('dashboard-0', { full: true, maxH: 3400 })
await rect('dashboard-0', 'confirmCard', `byText('main li', 'Did you make it')`)
await rect('dashboard-0', 'confirm', `byText('main li button', 'Confirm')`)
await rect('dashboard-0', 'miles', `[...document.querySelectorAll('main .bg-ink')].find((e) => e.textContent.includes('Tandem Miles'))`)
await rect('dashboard-0', 'milesCard', `[...document.querySelectorAll('main .bg-ink')].find((e) => e.textContent.includes('Tandem Miles'))?.parentElement`)
await ev(`byText('main li button', 'Confirm').click(); true`)
await b.sleep(1300); await ev(HELP)
console.log('miles after', await milesText())
await shot('dashboard-1', { full: true, maxH: 3400 })
await rect('dashboard-1', 'reviewCard', `byText('main li', 'How was')`)
await rect('dashboard-1', 'rate', `byText('main li a, main li button', 'Rate')`)
await rect('dashboard-1', 'miles', `[...document.querySelectorAll('main .bg-ink')].find((e) => e.textContent.includes('Tandem Miles'))`)
await rect('dashboard-1', 'milesCard', `[...document.querySelectorAll('main .bg-ink')].find((e) => e.textContent.includes('Tandem Miles'))?.parentElement`)

/* ---------------------------------------------------------------- rate it (the video reuses rate-0/rate), then the leaderboard */
await go('/events/evt-book-club-past', 1500)
await ev(`$q('#rate-activity input[value="5"]').click(); true`)
await b.sleep(300)
await ev(`clickText('button', 'Submit rating')`)
await b.sleep(900)
await go('/leaderboard', 1800)
await shot('leaderboard2', { full: true, maxH: 3200 })
await rect('leaderboard2', 'bayes', `byText('main li, main p', 'Bayesian-adjusted')`)
await rect('leaderboard2', 'how', `byText('main li, main p', 'Bayesian-adjusted')?.closest('div, section')`)
await rect('leaderboard2', 'table', `$q('main table')`)
await rect('leaderboard2', 'row0', `$q('main table tbody tr')`)
await rect('leaderboard2', 'bookRow', `byText('main tr', 'Kensington Weekend Book Club')`)
await rect('leaderboard2', 'newHead', `byText('main h2, main h3, main p', 'New — not enough reviews')`)
await rect('leaderboard2', 'newBadge', `[...document.querySelectorAll('main span')].find((s) => norm(s.textContent) === 'New')`)
console.log('leaderboard', await ev(`norm(document.querySelector('main').innerText).slice(0, 900)`))
// Same page with "How rankings work" open, so the Bayesian explanation is on screen.
await ev(`[...document.querySelectorAll('main details')].find((d) => d.textContent.includes('How rankings work')).open = true; true`)
await b.sleep(400)
await shot('leaderboard3', { full: true, maxH: 3400 })
await rect('leaderboard3', 'how', `[...document.querySelectorAll('main details')].find((d) => d.textContent.includes('How rankings work'))`)
await rect('leaderboard3', 'bayes', `byText('main li, main p', 'Bayesian-adjusted')`)
await rect('leaderboard3', 'table', `$q('main table')`)
await rect('leaderboard3', 'row0', `$q('main table tbody tr')`)
await rect('leaderboard3', 'bookRow', `byText('main tr', 'Kensington Weekend Book Club')`)
await rect('leaderboard3', 'newHead', `byText('main h2, main h3, main p', 'New — not enough reviews')`)
await rect('leaderboard3', 'newBadge', `[...document.querySelectorAll('main span')].find((s) => norm(s.textContent) === 'New')`)

/* ---------------------------------------------------------------- merge into rects.json */
for (const [k, v] of Object.entries(meta)) existing.meta[k] = v
for (const [k, v] of Object.entries(rects)) existing.rects[k] = { ...(existing.rects[k] ?? {}), ...v }
writeFileSync(join(OUT, 'rects.json'), JSON.stringify(existing, null, 2))
console.log('LOGS:\n' + (b.logs.join('\n') || '(none)'))
await b.close()
await stopLive()
