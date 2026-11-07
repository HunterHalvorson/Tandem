import {
  Accessibility,
  ArrowRight,
  BadgeCheck,
  Bike,
  CalendarDays,
  Camera,
  Coffee,
  Compass,
  Footprints,
  HeartHandshake,
  Map as MapIcon,
  MapPin,
  Mic,
  Mountain,
  Plane,
  Search,
  ShieldCheck,
  ThumbsDown,
  Users,
  UsersRound,
  Volume2,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { LogoMark } from '../components/brand/Logo'
import { EventCard } from '../components/events/EventCard'
import { CategoryCover, CategoryIcon } from '../components/events/visuals'
import { LazyCalgaryMap } from '../components/map/lazy'
import { Badge, ButtonLink, Card, Container } from '../components/ui/primitives'
import { CATEGORIES } from '../data/categories'
import { QUADRANT_INFO, QUADRANTS } from '../data/calgary'
import { GUEST_USER } from '../data/guest'
import { BRAND, MILES_NAME } from '../lib/brand'
import { addDays, formatEventWhen, formatTime, nextWeekday, toDateInput } from '../lib/dates'
import { formatPrice } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { getEvent, registeredCount, spotsLeft } from '../services/db'
import { discoverableEvents } from '../services/filters'
import { planItinerary } from '../services/itinerary'
import { useApp } from '../state/AppStore'
import type { CalgaryEvent, CategoryId, User } from '../types'

const POPULAR: CategoryId[] = ['running', 'reading', 'hiking', 'music', 'food', 'volunteering', 'tech', 'games']

export default function LandingPage() {
  usePageTitle('')
  const { db, now, user } = useApp()
  const upcoming = useMemo(() => discoverableEvents(db, now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [db, now])
  const heroA = getEvent(db, 'evt-sunrise-run-next') ?? upcoming[0]
  const heroB = getEvent(db, 'evt-book-club-next') ?? upcoming[1]
  const featured = upcoming.filter((e) => spotsLeft(db, e) > 0).slice(0, 6)
  const countBy = (c: CategoryId) => upcoming.filter((e) => e.categoryId === c).length
  const sampleTrip = useMemo(() => {
    const visitor: User = {
      ...GUEST_USER,
      id: 'landing-sample',
      interests: ['hiking', 'food', 'photography', 'culture'],
      comfort: { ...GUEST_USER.comfort, beginnerFriendly: true },
    }
    const fri = nextWeekday(addDays(now, 1), 5)
    return planItinerary(db, visitor, { arrival: toDateInput(fri), departure: toDateInput(addDays(fri, 2)), interests: visitor.interests, budgetPerEvent: 40, quadrants: [], beginner: true, travellerOnly: true, perDay: 2, easeIntoIt: false }, now)
  }, [db, now])

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="overflow-hidden border-b border-line bg-white">
        <Container className="grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold tracking-wide text-ink-soft uppercase">
              <span className="size-2 rounded-full bg-brand" aria-hidden /> {BRAND.tagline}
            </p>
            <h1 className="text-5xl leading-[1.02] font-extrabold tracking-[-0.035em] text-ink sm:text-6xl xl:text-7xl">
              Find your people. <span className="text-brand">Find your Calgary.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft sm:text-xl">{BRAND.heroSubheading}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/discover" size="lg">
                <Compass aria-hidden /> Explore Events
              </ButtonLink>
              <ButtonLink to="/map" size="lg" variant="secondary">
                <MapIcon aria-hidden /> Explore Calgary Map
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-1.5"><UsersRound aria-hidden className="size-4 text-brand" /> No followers, no likes</li>
              <li className="flex items-center gap-1.5"><Accessibility aria-hidden className="size-4 text-brand" /> Accessible by design</li>
              <li className="flex items-center gap-1.5"><MapPin aria-hidden className="size-4 text-brand" /> All four quadrants</li>
            </ul>
          </div>
          <HeroScene a={heroA} b={heroB} />
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 1. discover community */}
      <section aria-labelledby="discover-community" className="py-16">
        <Container>
          <SectionTitle id="discover-community" eyebrow="Discover your community" title="What do you love doing?" lead={BRAND.valueProp} />
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {POPULAR.map((c) => (
              <li key={c}>
                <Link to={`/discover?cat=${c}`} className="group block overflow-hidden rounded-card border border-line bg-white shadow-card transition-shadow hover:shadow-lift">
                  <CategoryCover categoryId={c} variant={1} iconSize="sm" className="aspect-[16/9] transition-transform duration-300 group-hover:scale-[1.03]" />
                  <span className="block p-3.5">
                    <span className="block font-bold text-ink">{CATEGORIES[c].eventLabel}</span>
                    <span className="text-sm text-muted">{countBy(c)} upcoming</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 2. how it works */}
      <section aria-labelledby="how" className="border-y border-line bg-white py-16">
        <Container>
          <SectionTitle id="how" eyebrow={`How ${BRAND.name} works`} title="Three steps from scrolling to showing up" />
          <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              { icon: Search, t: 'Find your interests', d: 'Tell us what you enjoy and what makes you comfortable. Smart search understands “free hiking this weekend in NW”.' },
              { icon: CalendarDays, t: 'Join an activity', d: 'One tap to join. See exactly what to expect, who to look for, and whether it’s accessible — before you go.' },
              { icon: Users, t: 'Make real connections', d: 'Chat with your group, show up, and keep going together. Groups outlast any single event.' },
            ].map((s, i) => (
              <li key={s.t}>
                <Card className="h-full p-6">
                  <span className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-brand text-white">
                      <s.icon aria-hidden className="size-5" />
                    </span>
                    <span className="text-sm font-bold text-muted">Step {i + 1}</span>
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-ink">{s.t}</h3>
                  <p className="mt-2 text-ink-soft">{s.d}</p>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 3. explore calgary map */}
      <section aria-labelledby="explore-calgary" className="py-16">
        <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionTitle id="explore-calgary" eyebrow="Calgary-native discovery" title="Explore Calgary, quadrant by quadrant" lead="Every activity sits on a real map of the city — the Bow River, Nose Hill, Fish Creek and everything in between." left />
            <ul className="mb-6 grid grid-cols-2 gap-3">
              {QUADRANTS.map((q) => (
                <li key={q}>
                  <Link to={`/map?quad=${q}`} className="block rounded-xl border border-line bg-white p-3 hover:border-brand/50 hover:shadow-card">
                    <span className="flex items-center justify-between">
                      <span className="font-extrabold text-ink">{q}</span>
                      <span className="text-sm text-muted">{upcoming.filter((e) => e.venue.quadrant === q).length} events</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{QUADRANT_INFO[q].blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ButtonLink to="/map" size="lg">
              <MapIcon aria-hidden /> Open the full map
            </ButtonLink>
          </div>
          <div className="relative h-[380px] overflow-hidden rounded-card border border-line shadow-card sm:h-[440px]">
            <LazyCalgaryMap events={upcoming} label="Preview map of upcoming Calgary events" className="absolute inset-0" />
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 4. explore like a local */}
      <section aria-labelledby="like-a-local" className="bg-ink py-16 text-white">
        <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand-soft uppercase">
              <Plane aria-hidden className="size-4" /> Explore Like a Local
            </p>
            <h2 id="like-a-local" className="text-3xl font-extrabold sm:text-4xl">
              Visiting? Skip the tour bus. Join the locals.
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Enter your dates, interests and budget. {BRAND.name} builds a weekend plan from real community activities hosted by Calgarians — and you can join before you land.
            </p>
            <ButtonLink to="/explore-like-a-local" size="lg" className="mt-6">
              Plan my visit <ArrowRight aria-hidden />
            </ButtonLink>
          </div>
          <Card className="p-5 text-ink">
            <p className="text-xs font-bold tracking-wider text-muted uppercase">Sample weekend · hiking, food & photography · up to $40</p>
            <ol className="mt-3 space-y-4">
              {sampleTrip.days
                .filter((d) => d.items.length)
                .slice(0, 3)
                .map((d) => (
                  <li key={d.date}>
                    <p className="text-sm font-bold text-ink">{d.label}</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {d.items.map(({ rec }) => (
                        <li key={rec.event.id} className="flex items-center gap-3 text-sm">
                          <span className="w-16 shrink-0 font-semibold text-muted">{formatTime(new Date(rec.event.startsAt))}</span>
                          <CategoryIcon id={rec.event.categoryId} className="size-4 shrink-0 text-brand" />
                          <Link to={`/events/${rec.event.id}`} className="min-w-0 truncate font-medium hover:text-brand hover:underline">
                            {rec.event.title}
                          </Link>
                          <span className="ml-auto shrink-0 text-muted">{formatPrice(rec.event.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              {!sampleTrip.days.some((d) => d.items.length) && <li className="text-sm text-muted">Open the planner to build a weekend from this week’s events.</li>}
            </ol>
          </Card>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 5. community without competition */}
      <section aria-labelledby="no-competition" className="py-16">
        <Container>
          <SectionTitle id="no-competition" eyebrow="Community without competition" title="We’re not another social network" lead={`Most apps ask “Who should I follow?” ${BRAND.name} asks “What can we do together?”`} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card className="p-6">
              <p className="mb-4 flex items-center gap-2 font-bold text-muted">
                <ThumbsDown aria-hidden className="size-5" /> Typical social apps
              </p>
              <ul className="space-y-3 text-ink-soft">
                {['Follower counts and popularity contests', 'Endless feeds designed to keep you scrolling', 'People rated and ranked against each other', 'Events scattered across a dozen apps'].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="text-muted">✕</span> {t}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="border-brand/30 p-6">
              <p className="mb-4 flex items-center gap-2 font-bold text-brand-deep">
                <LogoMark className="h-5 w-auto" /> {BRAND.name}
              </p>
              <ul className="space-y-3 text-ink">
                {[
                  'The activity and the group come first — not the profile',
                  'Less scrolling, more doing: one tap from discovery to joining',
                  `Events are reviewed, never people. ${MILES_NAME} celebrate showing up`,
                  'One Calgary map, organised by quadrant',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="font-bold text-brand">✓</span> {t}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 6. accessible by design */}
      <section aria-labelledby="accessible" className="border-y border-line bg-white py-16">
        <Container>
          <SectionTitle id="accessible" eyebrow="Accessible by design" title="Built so everyone can find a way in" lead="Accessibility isn’t a filter we bolted on — it shapes how events are described, recommended and read." />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: HeartHandshake, t: 'Ease Into It', d: 'One switch puts smaller, beginner-friendly, low-pressure events with clear arrival details first. Based only on what you choose.' },
              { icon: Accessibility, t: 'Comfort & Access', d: 'Step-free, quiet, sensory-friendly, virtual… say what matters, mark must-haves, and we never assume a venue is accessible.' },
              { icon: BadgeCheck, t: 'First-Time Friendly', d: 'What to expect, what to bring, and exactly how to find the group when you arrive.' },
              { icon: Volume2, t: 'Read aloud', d: 'Any event page can be read out loud with one tap.' },
              { icon: Mic, t: 'Search by voice', d: 'Say “quiet book club this weekend” and the filters set themselves (supported browsers).' },
              { icon: ShieldCheck, t: 'Privacy first', d: 'No addresses, no required health disclosures, private-by-default preferences, and a transparent, simulated ID check.' },
            ].map((f) => (
              <li key={f.t}>
                <div className="h-full rounded-card border border-line p-5">
                  <f.icon aria-hidden className="size-6 text-brand" />
                  <h3 className="mt-3 text-lg font-bold text-ink">{f.t}</h3>
                  <p className="mt-1.5 text-sm text-ink-soft">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">
            Text size, high contrast, reduced motion and a highly legible font are one tap away in the <Accessibility aria-hidden className="inline size-4 align-[-3px]" /> menu at the top of every page.
          </p>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- 7. featured events */}
      <section aria-labelledby="featured" className="py-16">
        <Container>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <SectionTitle id="featured" eyebrow="Happening soon" title="Featured Calgary events" left className="mb-0" />
            <ButtonLink to="/discover" variant="secondary">
              See all events <ArrowRight aria-hidden />
            </ButtonLink>
          </div>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((e) => (
              <li key={e.id} className="flex min-w-0">
                <EventCard event={e} className="w-full" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- closing CTA */}
      <section aria-labelledby="cta" className="pb-8">
        <Container>
          <div className="relative overflow-hidden rounded-[1.5rem] bg-brand px-6 py-14 text-center text-white sm:px-12">
            <LogoMark tone="inverse" className="mx-auto h-14 w-auto" />
            <h2 id="cta" className="mx-auto mt-6 max-w-3xl text-3xl leading-tight font-extrabold sm:text-4xl">
              {BRAND.name} {BRAND.closingLine}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">{BRAND.mission}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink to={user ? '/dashboard' : '/signup'} size="lg" variant="secondary" className="border-white">
                {user ? 'Go to your dashboard' : 'Create your free account'}
              </ButtonLink>
              <ButtonLink to="/discover" size="lg" className="bg-brand-deep hover:bg-ink">
                Explore events <ArrowRight aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

function SectionTitle({ id, eyebrow, title, lead, left, className }: { id: string; eyebrow: string; title: string; lead?: string; left?: boolean; className?: string }) {
  return (
    <div className={`${left ? '' : 'mx-auto text-center'} mb-10 max-w-2xl ${className ?? ''}`}>
      <p className="mb-2 text-xs font-bold tracking-wider text-brand uppercase">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-extrabold text-ink sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-3 text-lg text-muted">{lead}</p>}
    </div>
  )
}

/** Calgary illustration: Rockies, the skyline and Calgary Tower, the Bow River — and a tandem riding the pathway. */
function HeroScene({ a, b }: { a?: CalgaryEvent; b?: CalgaryEvent }) {
  const { db, now } = useApp()
  const pins: Array<{ x: number; y: number; Icon: typeof Bike; label: string }> = [
    { x: 118, y: 150, Icon: Mountain, label: 'Hiking' },
    { x: 470, y: 128, Icon: Camera, label: 'Photography' },
    { x: 214, y: 236, Icon: Coffee, label: 'Coffee' },
    { x: 540, y: 300, Icon: Footprints, label: 'Running' },
  ]
  const buildings = [
    [178, 46, 58], [226, 30, 92], [258, 40, 70], [302, 26, 118], [330, 44, 84], [376, 30, 104], [408, 40, 64], [450, 34, 86], [486, 46, 52],
  ]
  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <svg viewBox="0 0 600 420" className="w-full rounded-[1.75rem] border border-line bg-[#F6F3EE]" role="img" aria-label="Illustration: Calgary's skyline and the Rocky Mountains, with a tandem bicycle riding along the Bow River">
        <circle cx="470" cy="92" r="46" fill="#FBEAED" />
        <polygon points="0,265 70,175 125,228 190,140 250,205 312,150 372,214 432,132 498,200 552,160 600,205 600,300 0,300" fill="#DDE3EA" />
        <polygon points="190,140 208,162 196,160 183,170 172,163" fill="#fff" opacity=".9" />
        <polygon points="432,132 452,158 438,154 426,165 414,156" fill="#fff" opacity=".9" />
        <polygon points="312,150 328,170 316,167 305,175 296,168" fill="#fff" opacity=".9" />
        {buildings.map(([x, w, h], i) => (
          <rect key={i} x={x} y={300 - h} width={w} height={h} rx="3" fill={i % 2 ? '#3C4043' : '#5F6368'} />
        ))}
        {/* Calgary Tower */}
        <rect x="355" y="118" width="9" height="182" fill="#202124" />
        <ellipse cx="359.5" cy="120" rx="20" ry="9" fill="#C8102E" />
        <rect x="357.5" y="96" width="4" height="18" fill="#202124" />
        <rect x="0" y="298" width="600" height="20" fill="#E8E2D8" />
        <path d="M0 330 C 120 308, 230 352, 340 330 S 520 304, 600 322 L600 420 L0 420 Z" fill="#CFE0F1" />
        <path d="M30 360 C 140 345, 220 378, 330 358 S 500 338, 590 352" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        <path d="M0 322 C 120 300, 230 344, 340 322 S 520 296, 600 314" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        <LogoMark x={250} y={262} width={88} height={55} />
        {pins.map((p) => (
          <g key={p.label} transform={`translate(${p.x} ${p.y})`}>
            <path d="M0 0 C -14 0 -20 -10 -20 -20 a20 20 0 1 1 40 0 C 20 -10 14 0 0 0 Z" transform="translate(0 6) scale(.9)" fill="#fff" stroke="#C8102E" strokeWidth="3" />
            <p.Icon x={-9} y={-25} width={18} height={18} color="#202124" strokeWidth={2.2} />
          </g>
        ))}
      </svg>
      {a && <FloatingCard event={a} className="absolute -top-4 -left-2 sm:-left-8" going={registeredCount(db, a)} now={now} />}
      {b && <FloatingCard event={b} className="absolute -right-2 -bottom-6 sm:-right-6" going={registeredCount(db, b)} now={now} />}
    </div>
  )
}

function FloatingCard({ event, className, going, now }: { event: CalgaryEvent; className: string; going: number; now: Date }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className={`${className} flex w-[min(17rem,70vw)] items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lift backdrop-blur transition-transform hover:-translate-y-0.5`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-deep">
        <CategoryIcon id={event.categoryId} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink">{event.title}</span>
        <span className="block text-xs text-muted">{formatEventWhen(event.startsAt, now)}</span>
        <span className="mt-1 flex gap-1">
          <Badge tone={event.price === 0 ? 'success' : 'neutral'}>{formatPrice(event.price)}</Badge>
          <Badge tone="outline">{going} going</Badge>
        </span>
      </span>
    </Link>
  )
}
