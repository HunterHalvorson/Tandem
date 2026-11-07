import { Sparkles } from 'lucide-react'
import { FACTOR_LABEL, type Recommendation } from '../../services/recommendations'

/** Transparent breakdown of the rule-based recommendation score. */
export function RecommendationWhy({ rec }: { rec: Recommendation }) {
  return (
    <details className="group rounded-card border border-brand/30 bg-brand-tint/40 p-4 open:bg-white">
      <summary className="flex cursor-pointer list-none items-start gap-2 text-sm text-brand-deep [&::-webkit-details-marker]:hidden">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>{Math.round(rec.score * 100)}% match.</strong> {rec.explanation}{' '}
          <span className="font-semibold underline underline-offset-2 group-open:hidden">See how this was scored</span>
        </span>
      </summary>
      <div className="mt-4 space-y-2.5">
        {rec.factors.map((f) => (
          <div key={f.id} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm">
            <span className="text-ink-soft">
              {FACTOR_LABEL[f.id]} <span className="text-xs text-muted">({Math.round(f.weight * 100)}%)</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-mist" aria-hidden>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round(f.value * 100)}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums text-ink">{Math.round(f.value * 100)}%</span>
          </div>
        ))}
        {rec.ease !== null && (
          <p className="pt-1 text-sm text-ink-soft">
            <strong className="text-ink">Ease Into It</strong> is on: comfort score {Math.round(rec.ease * 100)}% (small group, beginner-friendly, arrival details, calm setting, clear description) counts for 40% of the match.
          </p>
        )}
        <p className="pt-1 text-xs text-muted">Rule-based and transparent — no AI model, no tracking. Full events, past events and events missing your essential accessibility needs are never recommended.</p>
      </div>
    </details>
  )
}
