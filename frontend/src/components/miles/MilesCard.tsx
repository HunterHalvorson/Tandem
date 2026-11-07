import { Award, Bike, Info, Medal } from 'lucide-react'
import { MILES_NAME } from '../../lib/brand'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/dates'
import { MILES_RULES, computeMiles } from '../../services/miles'
import { useApp } from '../../state/AppStore'
import { Card, ProgressBar } from '../ui/primitives'

/** Tandem Miles: participation, not status. Shown only to the owner — never ranked between people. */
export function MilesCard({ userId, className, showActivity = true }: { userId: string; className?: string; showActivity?: boolean }) {
  const { db, now } = useApp()
  const m = computeMiles(db, userId, now)
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="bg-ink p-5 text-white">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-white/70 uppercase">
          <Bike aria-hidden className="size-4" /> {MILES_NAME}
        </p>
        <p className="mt-1 text-4xl font-extrabold">{m.total}</p>
        <p className="mt-1 text-sm text-white/75">Miles measure participation — not popularity, worth or trust.</p>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        <div className="p-3">
          <dt className="text-xs text-muted">Attended</dt>
          <dd className="text-lg font-bold">{m.attended}</dd>
        </div>
        <div className="p-3">
          <dt className="text-xs text-muted">Hosted</dt>
          <dd className="text-lg font-bold">{m.hosted}</dd>
        </div>
        <div className="p-3">
          <dt className="text-xs text-muted">Interests explored</dt>
          <dd className="text-lg font-bold">{m.categoriesExplored.length}</dd>
        </div>
      </dl>
      <div className="p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
          <Award aria-hidden className="size-4 text-brand" /> Milestones
        </h3>
        <ul className="space-y-3">
          {m.milestones.map((ms) => (
            <li key={ms.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn('flex items-center gap-1.5 font-semibold', ms.achieved ? 'text-success' : 'text-ink')}>
                  <Medal aria-hidden className={cn('size-4', ms.achieved ? 'text-success' : 'text-line-strong')} />
                  {ms.title}
                  {ms.achieved && <span className="sr-only">(achieved)</span>}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {ms.current}/{ms.target}
                </span>
              </div>
              <p className="mb-1 text-xs text-muted">{ms.description}</p>
              <ProgressBar value={ms.current} max={ms.target} label={`${ms.title} progress`} className="h-1.5" />
            </li>
          ))}
        </ul>
        {showActivity && m.entries.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-sm font-bold text-ink">Recent activity</h3>
            <ul className="space-y-1.5 text-sm">
              {m.entries.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3">
                  <span className="text-ink-soft">
                    {e.label}
                    <span className="block text-xs text-muted">{formatRelative(e.at, now)}</span>
                  </span>
                  <span className="shrink-0 font-bold text-success">+{e.miles}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <details className="mt-4 text-xs text-muted">
          <summary className="flex cursor-pointer items-center gap-1 font-semibold text-ink-soft">
            <Info aria-hidden className="size-3.5" /> How Miles work
          </summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            <li>Attend a confirmed event: +{MILES_RULES.attend}</li>
            <li>Host an event that takes place: +{MILES_RULES.hostCompleted}</li>
            <li>First event in a new interest: +{MILES_RULES.newCategory}</li>
            <li>Volunteer activity: +{MILES_RULES.volunteer} bonus</li>
            <li>Each event counts once — repeated check-ins earn nothing.</li>
          </ul>
        </details>
      </div>
    </Card>
  )
}
