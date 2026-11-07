import { CheckCircle2, CircleSlash, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { LogoMark } from '../components/brand/Logo'
import { ButtonLink, Card, Container } from '../components/ui/primitives'
import { BRAND, MILES_NAME } from '../lib/brand'
import { usePageTitle } from '../lib/hooks'
import { useApp } from '../state/AppStore'

export default function AboutPage() {
  usePageTitle('About Tandem')
  const { shared } = useApp()
  return (
    <Container className="max-w-4xl py-10">
      <LogoMark className="h-12 w-auto" motion />
      <h1 className="mt-4 text-4xl font-extrabold text-ink">About {BRAND.name}</h1>
      <p className="mt-3 text-lg text-ink-soft">
        {BRAND.name} is named after the tandem bicycle: people moving together toward a shared destination. It’s a Calgary-first platform for finding people to do things with, built as a
        hackathon prototype for <strong>Code the Change</strong>, answering the prompt: <em>how can technology promote health, social connection and well-being in our communities?</em>
      </p>
      <p className="mt-3 text-ink-soft">
        Our mission: {BRAND.mission}
      </p>

      <Section title="What’s real and what’s simulated" id="limitations">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-success">
              <CheckCircle2 aria-hidden className="size-5" /> Fully working
            </h3>
            <List
              items={[
                'Discovery with combinable filters, sorting and plain-language/voice search',
                'Interactive Calgary map (OpenStreetMap) sharing the exact same filters as the list',
                'Creating, editing, cancelling and joining events with capacity rules',
                shared ? 'Shared events, attendance, event chats and group discussions sync through Supabase' : 'Per-event group chats, announcements and reporting',
                'Transparent recommendations, Ease Into It and the Weekend Planner',
                `Event reviews, the fair leaderboard and ${MILES_NAME}`,
                'Profiles with privacy controls, data download and deletion',
              ]}
            />
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-warning">
              <CircleSlash aria-hidden className="size-5" /> Simulated for the demo
            </h3>
            <List
              items={[
                ...(shared ? ['Reviews, reports and most profile preferences stay in this browser'] : [
                  'Demo accounts and email sign-in are simulated. Google sign-in is available when configured',
                  'Demo data and live chat sync between tabs in this browser',
                  'Seeded events, members, reviews and messages are fictional',
                ]),
                'ID verification: a clearly labelled “Demo verified” badge; no documents are collected',
                'Attendance confirmation is self-reported (production: host-confirmed QR check-in)',
              ]}
            />
          </Card>
        </div>
      </Section>

      <Section title="Privacy & data" id="privacy">
        <List
          items={[
            'We never ask for or store a home address, passwords, government IDs or medical information.',
            'Comfort & Access preferences are practical (e.g. “quiet”, “step-free”) and private unless you choose to show them.',
            'Private or residential events show only an approximate area publicly; exact details go to registered attendees.',
            'You can preview your public profile, download everything stored about you, or delete your account in Settings.',
            'Reports of events or messages are confidential.',
          ]}
        />
      </Section>

      <Section title="Accessibility" id="accessibility">
        <p className="text-ink-soft">
          We aim for WCAG 2.2 AA: semantic structure, full keyboard support, visible focus, screen-reader labels, accessible forms and dialogs, sufficient contrast, reduced-motion
          support, text scaling and no colour-only information. Map content is always also available as a list. Display options are in the accessibility menu at the top of every page.
        </p>
      </Section>

      <Section title="What production would add" id="production">
        <List
          items={[
            'Certified third-party identity verification',
            'Moderation tools, host-confirmed QR check-in and anti-abuse rate limits',
            'Partnerships with Calgary community associations, libraries and newcomer organisations',
            'Live event data imports and push/email reminders',
          ]}
        />
      </Section>

      {!shared && <Card className="mt-10 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <Info aria-hidden className="size-6 shrink-0 text-info" />
        <p className="flex-1 text-sm text-ink-soft">Presenting a demo? Reset the demo data on the morning of the presentation so every seeded date lines up with today.</p>
        <ButtonLink to="/settings#data" variant="secondary">
          Reset demo data
        </ButtonLink>
      </Card>}
    </Container>
  )
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section className="mt-10 scroll-mt-24" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="mb-4 text-2xl font-bold text-ink">
        {title}
      </h2>
      {children}
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-ink-soft">
      {items.map((i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-brand">•</span>
          {i}
        </li>
      ))}
    </ul>
  )
}
