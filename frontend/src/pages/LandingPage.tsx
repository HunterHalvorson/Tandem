import { Link } from 'react-router'
import { EventCard } from '../components/events/EventCard'
import { ButtonLink, Container } from '../components/ui/primitives'
import { usePageTitle } from '../lib/hooks'
import { spotsLeft } from '../services/db'
import { discoverableEvents } from '../services/filters'
import { useApp } from '../state/AppStore'

export default function LandingPage() {
  usePageTitle('')
  const { db, now } = useApp()
  const upcoming = discoverableEvents(db, now)
    .filter((event) => spotsLeft(db, event) > 0)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3)

  return (
    <Container className="py-10 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find things to do in Calgary</h1>
        <p className="mt-3 text-lg text-ink-soft">Join a local event or meet up with a group that shares your interests.</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <ButtonLink to="/discover">Browse events</ButtonLink>
          <Link to="/groups" className="font-semibold text-brand underline-offset-4 hover:underline">Find a group</Link>
        </div>
      </header>
      <section aria-labelledby="upcoming-events" className="mt-10 border-t border-line pt-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="upcoming-events" className="text-xl font-bold">Coming up</h2>
          <Link to="/map" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">View map</Link>
        </div>
        {upcoming.length ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <li key={event.id} className="flex min-w-0">
                <EventCard event={event} headingLevel={3} className="w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">No upcoming events with open spots. <Link to="/events/new" className="font-semibold text-brand underline">Host an event</Link></p>
        )}
      </section>
    </Container>
  )
}
