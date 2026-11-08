// Captures real Tandem screens for the demo video (persona: Riley, visiting Calgary, prefers quiet small groups).
// 1. Start a dev server:  cd frontend && npm run dev      (or any port; set BASE_URL)
// 2. node demo-video/capture.mjs
// Writes demo-video/shots/*.png (1280x800 CSS px at 2x) and demo-video/shots/rects.json (element boxes, CSS px, page coords).
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from '../frontend/scripts/e2e/cdp.mjs'

const OUT = join(import.meta.dirname, 'shots')
mkdirSync(OUT, { recursive: true })
const W = 1280, H = 800, DPR = 2

// A throwaway Tandem Live server, so the chat is captured syncing between two real browsers.
const LIVE_PORT = 8790
const LIVE = `http://localhost:${LIVE_PORT}`
const live = spawn(process.execPath, [join(import.meta.dirname, '..', 'server', 'live-server.mjs')], { env: { ...process.env, PORT: String(LIVE_PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'tandem-video-live-')), QUIET: '1' }, stdio: 'ignore' })
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${LIVE}/api/health`)).ok) break } catch {} await new Promise((r) => setTimeout(r, 100)) }
const syncInit = `try { localStorage.setItem('tandem.sync', '${LIVE}'); localStorage.setItem('tandem.banner.dismissed', '1') } catch {}`

const b = await launch({ port: 9444, width: W, height: H, profile: mkdtempSync(join(tmpdir(), 'tandem-video-')), init: syncInit })
let ben = null
process.on('exit', () => { try { b.close(); ben?.close(); live.kill() } catch {} })
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
true`
const ev = (x) => b.eval(x)
const go = async (p, wait = 1200) => { await b.goto(p, wait); await ev(HELP) }
const rects = {}
const meta = {}

async function settle() {
  // Load lazy images, hide toasts, drop focus rings and the caret.
  await ev(`(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager' });
    await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000) })));
    let st = document.getElementById('__video_css');
    if (!st) { st = document.createElement('style'); st.id = '__video_css'; document.head.appendChild(st) }
    st.textContent = '.fixed.inset-x-0.bottom-20 { display: none !important } * { caret-color: transparent !important }';
    document.activeElement?.blur?.();
    return true })()`)
}

/** Screenshot. full=true captures the whole page height from the top (the video scrolls it). */
async function shot(name, { full = false, maxH = 3600 } = {}) {
  await settle()
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
/** Record an element box (page coordinates) — call after shot() so the page is scrolled to the top. */
async function rect(name, key, expr) {
  const r = await ev(`box(${expr})`)
  if (!r) console.warn('  ! missing rect', name, key)
  ;(rects[name] ??= {})[key] = r
}

await go('/')
await ev(`localStorage.setItem('tandem.banner.dismissed', '1'); true`)

/* ---------------------------------------------------------------- 1. sign up (email path; Google button visible) */
await go('/signup', 2500)
for (let i = 0; i < 30 && !(await ev(`!!$q('main iframe')`)); i++) await b.sleep(200)
await b.sleep(1500)
await ev(`setVal($q('#field-firstName'), 'Riley'); setVal($q('#field-lastName'), 'Morgan'); setVal($q('#field-email'), 'riley@example.com'); setVal($q('#field-password'), 'calgary2026'); true`)
await shot('signup-0', { full: true })
await ev(`clickText('label', 'Visiting Calgary'); $q('#field-ageConfirmed input').click(); true`)
await shot('signup', { full: true })
await rect('signup', 'google', `$q('main iframe') ?? null`)
await rect('signup', 'visiting', `byText('label', 'Visiting Calgary')`)
await rect('signup', 'residency', `$q('#field-residency')`)
await rect('signup', 'age', `$q('#field-ageConfirmed')`)
await rect('signup', 'create', `byText('button', 'Create account')`)
await ev(`clickText('button', 'Create account')`)
await b.sleep(900); await ev(HELP)
const rileyId = await ev(`sessionStorage.getItem('tandem.session') ?? localStorage.getItem('tandem.session')`)
console.log('riley id', rileyId, await ev('location.pathname'))

/* ---------------------------------------------------------------- 2. onboarding interests */
await ev(`$q('main summary').click(); true`)
await shot('onboarding-0', { full: true })
const INTERESTS = ['Reading & literature', 'Food & coffee', 'Hiking & outdoors', 'Traveller & local meetups']
for (const t of INTERESTS) await ev(`clickText('main label', '${t}')`)
await shot('onboarding', { full: true })
for (const [i, t] of INTERESTS.entries()) await rect('onboarding', `i${i}`, `byText('main label', '${t}')?.querySelector('input') ?? byText('main label', '${t}')`)
await rect('onboarding', 'interests', `$q('main fieldset')`)
await rect('onboarding', 'summary', `$q('main summary')`)
await rect('onboarding', 'find', `byText('button', 'Find events')`)
await ev(`clickText('button', 'Find events')`)
await b.sleep(900)

/* ---------------------------------------------------------------- 3. comfort & access (private, practical) */
await go('/settings', 1500)
await shot('settings-0', { full: true, maxH: 4400 })
for (const t of ['Small groups', 'Beginner-friendly', 'Quiet environment', 'Sensory-friendly']) {
  await ev(`comfortLabel('${t}').click(); true`); await b.sleep(150); await ev(HELP)
}
await ev(`byText('section div.rounded-xl', 'Ease Into It').querySelector('[role=switch], button').click(); true`)
await b.sleep(600); await ev(HELP)
await shot('settings', { full: true, maxH: 4400 })
await rect('settings', 'comfortCard', `comfortCard()`)
await rect('settings', 'privateNote', `comfortCard().querySelector('p.rounded-lg')`)
await rect('settings', 'smallGroups', `comfortLabel('Small groups')?.querySelector('input') ?? comfortLabel('Small groups')`)
await rect('settings', 'beginner', `comfortLabel('Beginner-friendly')?.querySelector('input') ?? comfortLabel('Beginner-friendly')`)
await rect('settings', 'comfortable', `comfortCard().querySelector('fieldset')`)
await rect('settings', 'quiet', `[...comfortCard().querySelectorAll('li')].find(l => l.textContent.includes('Quiet environment'))`)
await rect('settings', 'sensory', `[...comfortCard().querySelectorAll('li')].find(l => l.textContent.includes('Sensory-friendly'))`)
await rect('settings', 'easeIntoIt', `byText('section div.rounded-xl', 'Ease Into It')`)
await rect('settings', 'easeSwitch', `byText('section div.rounded-xl', 'Ease Into It').querySelector('[role=switch], button')`)
await rect('settings', 'travelCard', `$q('#travel').closest('section')`)

/* ---------------------------------------------------------------- 4. discover: plain-language search + access filters */
await go('/discover', 1500)
await shot('discover-0', { full: true, maxH: 2200 })
await rect('discover-0', 'search', `$q('main form[role=search] input') ?? $q('main input')`)
await rect('discover-0', 'searchBtn', `byText('main form[role=search] button', 'Search')`)
await rect('discover-0', 'ease', `deep('main div', 'Prioritise smaller')?.closest('[class*="rounded"]') ?? null`)
const QUERY = 'quiet small group for visitors'
await ev(`setVal($q('main form[role=search] input'), '${QUERY}'); true`)
await b.sleep(200)
await ev(`clickText('main form[role=search] button', 'Search')`)
await b.sleep(900); await ev(HELP)
console.log('search url', await ev('location.search'))
// Scroll the sticky filter panel so its "Accessibility & comfort" section is in view.
await ev(`(() => { const sec = $q('#f-access'); const panel = sec.closest('.overflow-y-auto'); panel.scrollTop = sec.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 12; return true })()`)
await b.sleep(300)
await shot('discover', { full: true, maxH: 2200 })
await rect('discover', 'search', `$q('main form[role=search]')`)
await rect('discover', 'understood', `byText('main p, main div', 'Understood') ?? null`)
await rect('discover', 'chips', `byText('main button', 'Quiet environment')?.parentElement ?? null`)
await rect('discover', 'count', `byText('main p, main h2', 'match your filters') ?? null`)
await rect('discover', 'accessSection', `$q('#f-access')?.parentElement ?? null`)
await rect('discover', 'panel', `$q('#f-access')?.closest('.overflow-y-auto') ?? null`)
await rect('discover', 'card0', `$q('main article')`)
await rect('discover', 'card0tags', `deep('main article div', 'Traveller-friendly') ?? null`)
await rect('discover', 'ease', `deep('main div', 'Prioritise smaller')?.closest('[class*="rounded"]') ?? null`)
await rect('discover', 'card0why', `byText('main article p', 'Recommended because')`)
console.log('discover results', await ev(`$all('main article h3').map(h => h.textContent)`))
console.log('discover text', await ev(`norm(document.querySelector('main').innerText).slice(0, 700)`))

/* ---------------------------------------------------------------- 5. map */
await go('/map', 3500)
await shot('map-0')
await rect('map-0', 'chips', `byText('main button', 'NW')?.parentElement ?? null`)
await go('/map?access=quiet', 3500)
await ev(`clickText('aside ol > li button', 'Coffee & Conversation')`)
await b.sleep(2600); await ev(HELP)
await ev(`$q('.leaflet-popup-close-button')?.click(); true`)
await b.sleep(500)
await shot('map-1')
await rect('map-1', 'list', `$q('aside')`)
await rect('map-1', 'item', `byText('aside ol > li button', 'Coffee & Conversation')`)
await rect('map-1', 'marker', `$all('.leaflet-marker-icon').find(m => (m.title || '').startsWith('Coffee & Conversation'))`)
await ev(`$all('.leaflet-marker-icon').find(m => (m.title || '').startsWith('Coffee & Conversation')).click(); true`)
await b.sleep(900)
await shot('map')
await rect('map', 'popup', `$q('.leaflet-popup-content-wrapper')`)
await rect('map', 'marker', `$all('.leaflet-marker-icon').find(m => (m.title || '').startsWith('Coffee & Conversation'))`)
await rect('map', 'filters', `byText('aside button', 'Filters')`)

/* ---------------------------------------------------------------- 6. event detail + join */
const EID = 'evt-coffee-newcomers'
await go(`/events/${EID}`, 1500)
await shot('event-0', { full: true })
await rect('event-0', 'join', `byText('aside button', 'Join event')`)
await rect('event-0', 'match', `deep('main div, main p', '% match')`)
await rect('event-0', 'title', `$q('main h1')`)
await rect('event-0', 'asideCard', `byText('aside button', 'Join event')?.closest('.rounded-card') ?? null`)
await ev(`byText('aside button', 'Join event').click(); true`)
await b.sleep(900); await ev(HELP)
await shot('event', { full: true })
await rect('event', 'asideCard', `byText('aside button', 'Open group chat')?.closest('.rounded-card') ?? $q('aside .rounded-card')`)
await rect('event', 'going', `byText('aside p', 'going')`)
await rect('event', 'chatBtn', `byText('aside a, aside button', 'Open group chat')`)
await rect('event', 'title', `$q('main h1')`)

await rect('event', 'firstTime', `byText('main h2', 'First-Time Friendly')?.parentElement ?? null`)
await rect('event', 'access', `byText('main h2', 'Comfort & Access')?.parentElement ?? null`)
await rect('event', 'readAloud', `byText('aside button', 'Read aloud')`)


/* ---------------------------------------------------------------- 7. chat (two real browsers, synced by Tandem Live) */
ben = await launch({ port: 9446, width: W, height: H, profile: mkdtempSync(join(tmpdir(), 'tandem-video-ben-')), init: `${syncInit}; try { localStorage.setItem('tandem.session', 'usr-ben') } catch {}` })
await ben.goto(`/events/${EID}/chat`, 2500); await ben.eval(HELP)
await go(`/events/${EID}/chat`, 1500)
for (let i = 0; i < 60 && !(await ev(`!!byText('main span', 'Live ·')?.textContent.includes('2 devices')`)); i++) await b.sleep(100)
console.log('chat badge', await ev(`byText('main span', 'Live')?.textContent`))
await shot('chat-0')
await rect('chat-0', 'input', `$q('#chat-input')`)
await rect('chat-0', 'send', `$q('button[aria-label="Send message"]')`)
await rect('chat-0', 'live', `byText('main span', 'Live ·')`)
await ev(`setVal($q('#chat-input'), 'Hi! Visiting from Vancouver and a little nervous. Is it OK if I mostly listen at first?'); $q('button[aria-label="Send message"]').click(); true`)
await b.sleep(700)
await shot('chat-1')
await rect('chat-1', 'mine', `$all('[role=log] *').filter(e => norm(e.textContent).startsWith('Hi! Visiting')).pop()`)
// The host replies from the other browser; Riley's page receives it live (no reload).
for (let i = 0; i < 40 && !(await ben.eval(`!!document.querySelector('[role=log]')?.textContent.includes('little nervous')`)); i++) await b.sleep(100)
await ben.eval(`setVal($q('#chat-input'), 'Absolutely! Most people come alone. Look for the small red bike sign, I’ll save you a seat ☕'); $q('button[aria-label="Send message"]').click(); true`)
for (let i = 0; i < 40 && !(await ev(`!!$q('[role=log]')?.textContent.includes('save you a seat')`)); i++) await b.sleep(100)
await b.sleep(600)
await shot('chat')
await rect('chat', 'reply', `$all('[role=log] *').filter(e => norm(e.textContent).startsWith('Absolutely')).pop()`)
await rect('chat', 'mine', `$all('[role=log] *').filter(e => norm(e.textContent).startsWith('Hi! Visiting')).pop()`)
await rect('chat', 'live', `byText('main span', 'Live ·')`)
await rect('chat', 'announcement', `deep('main div, main p', 'Host announcement')`)
await ben.close(); ben = null

/* ---------------------------------------------------------------- 8. rate a past event */
// Fixture: Riley attended last week's book club (same shape as seeded attendance), so the rating form unlocks.
console.log('book club keys', await ev(`Object.keys(JSON.parse(localStorage.getItem('tandem.db.v1')).events.find(x => x.id === 'evt-book-club-past')).join(',')`))
await ev(`(() => {
  const db = JSON.parse(localStorage.getItem('tandem.db.v1'));
  const e = db.events.find(x => x.id === 'evt-book-club-past');
  const start = new Date(e.startsAt ?? e.start ?? e.startAt).getTime();
  db.registrations.push({ id: 'reg-book-club-past-riley', eventId: e.id, userId: '${rileyId}', status: 'going', joinedAt: new Date(start - 3 * 864e5).toISOString(), checkedInAt: new Date(start + 6e5).toISOString(), isDemo: true });
  localStorage.setItem('tandem.db.v1', JSON.stringify(db)); return true })()`)
await go('/events/evt-book-club-past', 1500)
await shot('rate-0', { full: true })
await ev(`$q('#rate-activity input[value="5"]').click(); true`)
await b.sleep(400)
await shot('rate', { full: true })
await rect('rate', 'form', `$q('#rate-activity')`)
await rect('rate', 'star1', `$q('#rate-activity input[value="1"]')?.closest('label') ?? null`)
await rect('rate', 'star5', `$q('#rate-activity input[value="5"]')?.closest('label') ?? null`)
await rect('rate', 'submit', `byText('#rate-activity button', 'Submit rating')`)
await ev(`clickText('button', 'Submit rating')`)
await b.sleep(800)
await go('/leaderboard', 1500)
await shot('leaderboard', { full: true, maxH: 2400 })

/* ---------------------------------------------------------------- 9. traveller planner */
await go('/explore-like-a-local', 1500)
await shot('traveller', { full: true, maxH: 2400 })

/* ---------------------------------------------------------------- 10. adaptive display */
const setDisplay = async (p) => { await ev(`localStorage.setItem('tandem.display', JSON.stringify(${JSON.stringify(p)})); true`) }
const base = { textScale: 1, reduceMotion: false, highContrast: false, readableFont: false, underlineLinks: false }
const STATES = [base, { ...base, textScale: 1.25 }, { ...base, textScale: 1.25, readableFont: true }, { ...base, textScale: 1.25, readableFont: true, highContrast: true }]
for (const [i, p] of STATES.entries()) {
  await setDisplay(p)
  await go(`/events/${EID}`, 1500)
  await shot(`a11y-${i}`)
  await rect(`a11y-${i}`, 'trigger', `$q('button[aria-controls="display-menu"]')`)
  await rect(`a11y-${i}`, 'readAloud', `byText('aside button', 'Read aloud')`)
  await ev(`$q('button[aria-controls="display-menu"]').click(); true`)
  await b.sleep(700); await ev(HELP)
  await shot(`a11y-${i}m`)
  await rect(`a11y-${i}m`, 'menu', `$q('#display-menu')`)
  await rect(`a11y-${i}m`, 'aPlus2', `[...document.querySelectorAll('#display-menu label')].find((l) => norm(l.textContent) === 'A++')`)
  await rect(`a11y-${i}m`, 'readable', `[...document.querySelectorAll('#display-menu [role=switch]')].find((b) => b.parentElement.textContent.includes('Readable font'))`)
  await rect(`a11y-${i}m`, 'contrast', `[...document.querySelectorAll('#display-menu [role=switch]')].find((b) => b.parentElement.textContent.includes('High contrast'))`)
}
await setDisplay(base)

// The real logo SVG from the header, so the video uses the exact brand mark.
await go('/', 1500)
writeFileSync(join(OUT, 'logo.svg'), await ev(`($q('header a svg') ?? $q('header svg')).outerHTML`))

writeFileSync(join(OUT, 'rects.json'), JSON.stringify({ meta, rects }, null, 2))
console.log('LOGS:\n' + (b.logs.join('\n') || '(none)'))
await b.close()
live.kill()
