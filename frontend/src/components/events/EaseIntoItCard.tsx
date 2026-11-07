import { HeartHandshake } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { cn } from '../../lib/cn'
import { useApp } from '../../state/AppStore'
import { useToast } from '../../state/toast'
import { Switch } from '../ui/primitives'

/** Social comfort mode (spec §15). Purely preference-based — never inferred from health data. */
export function EaseIntoItCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { user, actions } = useApp()
  const { toast } = useToast()
  const location = useLocation()
  const on = !!user?.comfort.easeIntoIt
  return (
    <div className={cn('flex items-start gap-3 rounded-card border p-4', on ? 'border-brand/40 bg-brand-tint/50' : 'border-line bg-white', className)}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', on ? 'bg-brand text-white' : 'bg-brand-tint text-brand')}>
        <HeartHandshake aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {user ? (
          <Switch
            checked={on}
            onChange={(v) => {
              actions.setEaseIntoIt(v)
              toast(
                v ? 'Ease Into It is on — smaller, beginner-friendly events with clear arrival details now come first.' : 'Ease Into It is off — showing your usual recommendations.',
                { tone: 'info' },
              )
            }}
            label="Ease Into It"
            description={
              compact
                ? 'Smaller, beginner-friendly, low-pressure events first.'
                : 'Prioritise smaller, beginner-friendly, low-pressure events with clear arrival details. Based only on what you choose — never on health information.'
            }
          />
        ) : (
          <div>
            <p className="text-sm font-semibold text-ink">Ease Into It</p>
            <p className="mt-0.5 text-sm text-muted">
              Feeling unsure about joining a new group? <Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} className="font-semibold text-brand hover:underline">Sign in</Link> to see smaller, beginner-friendly events with clear arrival details first.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
