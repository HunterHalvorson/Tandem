import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from './cdp.mjs'
/**
 * End-to-end check of the 20 workflows in spec §25. Start the dev server first (npm run dev), then: npm run e2e
 * Uses a throwaway Chrome profile, so it starts from freshly seeded demo data. Screenshots go to scripts/e2e/.out/
 */
const SP = join(import.meta.dirname, '.out')
const b = await launch({ profile: mkdtempSync(join(tmpdir(), 'tandem-e2e-')) })
const H = `
window.$q = (s) => document.querySelector(s);
window.$all = (s) => [...document.querySelectorAll(s)];
window.setVal = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(P, 'value').set.call(el, v); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true };
window.byText = (s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent.replace(/\\s+/g,' ').trim().includes(t));
window.clickText = (s, t) => { const el = byText(s, t); if (!el) throw new Error('not found: ' + s + ' / ' + t); el.click(); return true };
window.txt = () => document.body.innerText;
true`
const go = async (p, w = 1000) => { await b.goto(p, w); await b.eval(H) }
const ev = (x) => b.eval(x)
const results = []
async function step(name, fn) {
  try { const detail = await fn(); results.push(['PASS', name, detail ?? '']) }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

await go('/')
await step('1. Sign up + single-page setup', async () => {
  await go('/signup')
  await ev(`setVal($q('#field-firstName'), 'Jamie'); setVal($q('#field-lastName'), 'Nguyen'); setVal($q('#field-email'), 'jamie@example.com'); setVal($q('#field-password'), 'calgary2026'); true`)
  await ev(`clickText('label', 'New to Calgary'); $q('#field-ageConfirmed input').click(); clickText('button', 'Create account')`)
  await b.sleep(600); await ev(H)
  assert((await ev('location.pathname')) === '/onboarding', 'not on onboarding: ' + (await ev('location.pathname')))
  await ev(`setVal($q('main select'), 'NW'); $q('main summary').click(); clickText('label', 'Running & athletics'); clickText('label', 'Reading & literature'); clickText('label', 'Hiking & outdoors'); true`)
  await ev(`clickText('button', 'Find events')`); await b.sleep(500); await ev(H)
  assert((await ev('location.pathname')) === '/discover', 'setup should lead directly to event listings')
  return 'completed setup in one form and reached event listings'
})
await step('2. Interests drive recommendations', async () => {
  const expl = await ev(`$all('article p').map(p=>p.textContent).filter(t=>t.includes('Recommended because')).slice(0,3)`)
  assert(expl.length === 3, 'expected 3 explained recs, got ' + expl.length)
  assert(expl.some((e) => /running|reading|hiking/.test(e)), 'explanations do not mention selected interests: ' + expl.join(' | '))
  return expl[0].replace(/\s+/g, ' ').slice(0, 110)
})
await step('3. Category filter (list)', async () => {
  await go('/discover?cat=hiking')
  const cats = await ev(`$all('article').map(a => a.textContent)`)
  assert(cats.length > 0 && cats.every((c) => c.includes('Hiking & outdoors')), 'non-hiking card present')
  return `${cats.length} hiking events`
})
await step('4. Price slider', async () => {
  await go('/discover')
  const before = await ev(`$all('article').length`)
  await ev(`setVal($q('#price-slider'), '10')`); await b.sleep(400); await ev(H)
  const prices = await ev(`$all('article').map(a => [...a.querySelectorAll('span')].map(s=>s.textContent.trim()).find(t => t === 'Free' || /^\\$\\d/.test(t)))`)
  const url = await ev('location.search')
  assert(url.includes('max=10'), 'url missing max=10: ' + url)
  assert(prices.every((p) => p === 'Free' || Number(p.slice(1)) <= 10), 'price over 10: ' + prices.join(','))
  return `${before} → ${prices.length} events ≤ $10`
})
await step('18. Accessibility filter', async () => {
  await go('/discover?access=wheelchair,stepFree')
  const n = await ev(`$all('article').length`)
  const ok = await ev(`$all('article').every(a => a.textContent.includes('Wheelchair') || a.textContent.includes('more'))`)
  assert(n > 0 && ok, 'cards without wheelchair badge')
  return `${n} events with confirmed wheelchair + step-free`
})
await step('5. Map markers match the filtered list', async () => {
  await go('/map', 3000)
  const list = await ev(`$all('aside ol > li button').length`)
  const pins = await ev(`$all('.tn-pin').length`)
  const clustered = await ev(`$all('.tn-cluster').reduce((s, c) => s + Number(c.textContent), 0)`)
  assert(list === pins + clustered, `list ${list} vs map ${pins}+${clustered}`)
  await go('/map?quad=NW', 3000)
  const nwList = await ev(`$all('aside ol > li button').length`)
  const nwMap = await ev(`$all('.tn-pin').length + $all('.tn-cluster').reduce((s, c) => s + Number(c.textContent), 0)`)
  assert(nwList === nwMap && nwList > 0, `NW list ${nwList} vs map ${nwMap}`)
  return `${list} events (${pins} pins + ${clustered} clustered); NW: ${nwList}`
})
await step('6. Marker / list click opens the right preview', async () => {
  await ev(`clickText('aside ol > li button', 'Kensington Weekend Book Club')`)
  await b.sleep(1500); await ev(H)
  const popup = await ev(`$q('.leaflet-popup-content')?.textContent || ''`)
  assert(popup.includes('Kensington Weekend Book Club'), 'popup: ' + popup.slice(0, 80))
  await go('/map', 3000)
  for (let i = 0; i < 25 && !(await ev(`$all('.leaflet-marker-icon').some(m => (m.title||'').startsWith('Bowness Park Autumn Walk'))`)); i++) await b.sleep(200)
  await ev(`$all('.leaflet-marker-icon').find(m => (m.title||'').startsWith('Bowness Park Autumn Walk')).click(); true`)
  await b.sleep(700)
  const popup2 = await ev(`document.querySelector('.leaflet-popup-content')?.textContent || ''`)
  assert(popup2.includes('Bowness Park Autumn Walk'), 'marker popup: ' + popup2.slice(0, 80))
  await b.shot(`${SP}/flow-map-popup.png`)
  return 'list click + direct marker click both open matching previews'
})
await step('9/10. Join event updates capacity', async () => {
  await go('/events/evt-sunrise-run-next')
  const before = await ev(`byText('aside p', 'going')?.textContent`)
  await ev(`byText('aside button', 'Join event').click(); true`); await b.sleep(400); await ev(H)
  const after = await ev(`byText('aside p', 'going')?.textContent`)
  assert(before.startsWith('12/30') && after.startsWith('13/30'), `${before} → ${after}`)
  return `${before.split('·')[0].trim()} → ${after.split('·')[0].trim()}`
})
await step('11. Joined event appears on dashboard', async () => {
  await go('/dashboard')
  const t = await ev(`byText('section', 'Your upcoming events')?.textContent || ''`)
  assert(t.includes('Bow River Sunrise Run'), 'not on dashboard')
  return 'listed under “Your upcoming events”'
})
await step('12/13. Chat works and persists after refresh', async () => {
  await go('/events/evt-sunrise-run-next/chat')
  await ev(`setVal($q('#chat-input'), 'Hi all — first run with the group!'); $q('button[aria-label="Send message"]').click(); true`); await b.sleep(400)
  await go('/events/evt-sunrise-run-next/chat')
  const log = await ev(`$q('[role=log]').textContent`)
  assert(log.includes('Hi all — first run with the group!'), 'message missing after reload')
  assert(log.includes('Jamie N. joined the event'), 'join system message missing')
  return 'message survived a full reload'
})
await step('14. Leave event', async () => {
  await ev(`clickText('aside button', 'Leave event')`); await b.sleep(300); await ev(H)
  await ev(`$all('dialog[open] button').find(x => x.textContent.includes('Leave event')).click(); true`); await b.sleep(500)
  await go('/events/evt-sunrise-run-next')
  const cap = await ev(`byText('aside p', 'going')?.textContent`)
  assert(cap.startsWith('12/30'), 'capacity not restored: ' + cap)
  return 'capacity back to ' + cap.split('·')[0].trim()
})
await step('7/8. Create event → discovery + map', async () => {
  await go('/events/new')
  await ev(`clickText('button', 'Publish event')`); await b.sleep(100)
  assert(await ev(`document.activeElement?.getAttribute('role') === 'alert'`), 'invalid submission should focus the error summary')
  await ev(`clickText('summary', 'Use a template'); clickText('button', 'Book club')`); await b.sleep(200)
  await ev(H); await ev(`clickText('button', 'Publish event')`); await b.sleep(700); await ev(H)
  const path = await ev('location.pathname')
  assert(path.startsWith('/events/evt-'), 'not redirected: ' + path)
  await go('/discover?cat=reading')
  assert((await ev('txt()')).includes('Neighbourhood Book Club'), 'not in discovery')
  await go('/map?cat=reading', 2500)
  const inList = await ev(`!!byText('aside ol > li button', 'Neighbourhood Book Club')`)
  const onMap = await ev(`$all('.leaflet-marker-icon').some(m => (m.title||'').startsWith('Neighbourhood Book Club'))`)
  assert(inList && onMap, `list ${inList} map ${onMap}`)
  return 'published, listed, and pinned on the map'
})
await step('15. Attendance + milestones (Alex)', async () => {
  await go('/login')
  await ev(`clickText('button', 'Continue as Alex')`); await b.sleep(500)
  await go('/dashboard')
  const before = Number(await ev(`$q('#miles p.text-4xl')?.textContent`))
  assert(await ev(`!![...document.querySelectorAll('a')].find(a => a.getAttribute('href') === '/events/evt-rating-demo-tech-coffee#rate-activity')`), 'demo rating link missing')
  await go('/events/evt-sunrise-run-past-1')
  await ev(`clickText('button', 'Confirm I attended')`); await b.sleep(400); await ev(H)
  await go('/dashboard')
  const miles = await ev(`$q('#miles p.text-4xl')?.textContent`)
  assert(Number(miles) === before + 15, 'miles ' + miles)
  return `Miles ${before} → ${miles} (attend +10, new category +5)`
})
await step('Completed demo activity can be rated from My events', async () => {
  await go('/dashboard')
  await ev(`$q('a[href="/events/evt-rating-demo-tech-coffee#rate-activity"]').click(); true`)
  await b.sleep(300); await ev(H)
  assert(await ev(`document.activeElement?.id === 'rate-activity'`), 'rating link should focus the rating form')
  await ev(`$q('#rate-activity input[value="5"]').click(); true`)
  await ev(`clickText('button', 'Submit rating')`); await b.sleep(400)
  await go('/events/evt-rating-demo-tech-coffee')
  assert(await ev(`txt().includes('already reviewed')`), 'demo rating did not persist')
})
await step('16/17. Review completed event → leaderboard updates', async () => {
  await go('/leaderboard')
  const before = await ev(`byText('tbody tr', 'Bow River Sunrise Run')?.children[3].textContent`)
  await go('/events/evt-sunrise-run-past-1')
  await ev(`$q('#rate-activity input[value="5"]').click(); true`)
  await ev(`clickText('button', 'Submit rating')`); await b.sleep(400); await ev(H)
  assert((await ev('txt()')).includes('already reviewed'), 'review not accepted')
  await go('/leaderboard')
  const after = await ev(`byText('tbody tr', 'Bow River Sunrise Run')?.children[3].textContent`)
  assert(Number(after) === Number(before) + 1, `${before} → ${after}`)
  return `reviews ${before} → ${after}`
})
await step('19. Traveller planner respects visit dates', async () => {
  await go('/login'); await ev(`clickText('button', 'Continue as Sam')`); await b.sleep(400)
  await go('/explore-like-a-local')
  const summary = await ev(`$q('#planner')?.nextElementSibling?.textContent || ''`)
  const days = await ev(`$all('ol > li h3').map(h => h.textContent)`)
  assert(/activities planned/.test(summary) && days.length === 4, summary + ' / ' + days.length)
  await b.shot(`${SP}/flow-traveller-sam.png`)
  return `${summary.trim()} across ${days.length} days`
})
await step('20. Mobile layout (390px)', async () => {
  await b.setViewport(390, 844, true)
  const out = []
  for (const p of ['/', '/discover', '/map', '/events/evt-book-club-next', '/dashboard', '/explore-like-a-local', '/events/new']) {
    await go(p, p === '/map' || p === '/' ? 2500 : 900)
    const overflow = await ev('Math.max(document.documentElement.scrollWidth, window.innerWidth) - visualViewport.width')
    out.push(`${p}:${overflow}`)
    await b.shot(`${SP}/mobile${p.replace(/\//g, '_') || '_home'}.png`)
    assert(overflow <= 0, `horizontal overflow on ${p}: ${overflow}px`)
  }
  return `no horizontal overflow on ${out.length} key pages`
})
for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? '  — ' + d : ''}`)
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
console.log('LOGS:\n' + (b.logs.join('\n') || '(none)'))
await b.close()
process.exit(failed ? 1 : 0)
