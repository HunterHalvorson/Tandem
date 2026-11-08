import { mkdtempSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, SYNC_OFF } from './cdp.mjs'
/** axe-core audit (WCAG 2.0/2.1/2.2 A + AA + best practices) of every main page. Dev server must be running: npm run a11y */
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const b = await launch({ profile: mkdtempSync(join(tmpdir(), 'tandem-a11y-')), init: SYNC_OFF })
const pages = ['/', '/discover', '/map', '/events/evt-sunrise-run-next', '/groups', '/groups/grp-sunrise-runners', '/leaderboard', '/explore-like-a-local', '/impact', '/login', '/signup', '/about']
const authed = ['/dashboard', '/profile', '/settings', '/events/new', '/events/evt-study-hall/chat']
const summary = {}
async function audit(path) {
  await b.goto(path, path === '/map' || path === '/' ? 2500 : 1200)
  await b.eval(AXE + ';true')
  const r = await b.eval(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] }, rules: { 'region': { enabled: false } } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0,2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary||'').split('\\n').slice(1,2).join(' ')) })))`)
  summary[path] = r
}
for (const p of pages) await audit(p)
await b.eval(`localStorage.setItem('tandem.session','usr-alex'); sessionStorage.setItem('tandem.session','usr-alex'); true`)
for (const p of authed) await audit(p)
await b.eval(`const db = JSON.parse(localStorage.getItem('tandem.db.v1')); db.users.find(user => user.id === 'usr-alex').onboardingComplete = false; localStorage.setItem('tandem.db.v1', JSON.stringify(db)); true`)
await audit('/onboarding')
for (const [p, vs] of Object.entries(summary)) {
  console.log(`\n${p}: ${vs.length ? vs.length + ' rule(s)' : 'no violations'}`)
  for (const v of vs) console.log(`  [${v.impact}] ${v.id} ×${v.n} — ${v.help}\n     ${v.sample.join('\n     ')}`)
}
const total = Object.values(summary).reduce((s, v) => s + v.length, 0)
console.log(`\n${Object.keys(summary).length} pages audited, ${total} rule violation(s)`)
await b.close()
process.exit(total ? 1 : 0)
