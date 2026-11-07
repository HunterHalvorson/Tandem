/** The discovery filter panel — identical on the list and the map (shared state + shared logic). */
import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CATEGORIES, CATEGORY_IDS } from '../../data/categories'
import { QUADRANTS, QUADRANT_INFO } from '../../data/calgary'
import { cn } from '../../lib/cn'
import { toDateInput } from '../../lib/dates'
import { SIZE_LABEL } from '../../services/events'
import {
  ACCESS_FILTERS,
  accessFilterLabel,
  activeFilterCount,
  DATE_PRESET_LABEL,
  DEFAULT_FILTERS,
  PRICE_MAX,
  SIZES,
  type DatePreset,
  type EventFilters,
} from '../../services/filters'
import { useApp } from '../../state/AppStore'
import { CategoryIcon, accessIcon } from '../events/visuals'
import { Button, Checkbox, Chip, Input, Segmented, Switch } from '../ui/primitives'

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <fieldset className="border-b border-line py-4 last:border-0">
      <legend id={id} className="float-left mb-3 w-full text-sm font-bold text-ink">
        {title}
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  )
}

export function FilterPanel({ filters, onChange, className }: { filters: EventFilters; onChange: (f: EventFilters) => void; className?: string }) {
  const { now } = useApp()
  const [showAllCats, setShowAllCats] = useState(false)
  const set = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch })
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const pct = (filters.maxPrice / PRICE_MAX) * 100
  const cats = showAllCats ? CATEGORY_IDS : CATEGORY_IDS.filter((c, i) => i < 8 || filters.categories.includes(c))
  const count = activeFilterCount(filters)

  return (
    <div className={className}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-lg font-bold text-ink">
          Filters {count > 0 && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">{count}</span>}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })} disabled={count === 0 && !filters.q}>
          <RotateCcw aria-hidden /> Reset filters
        </Button>
      </div>

      <Section title="Price" id="f-price">
        <label htmlFor="price-slider" className="mb-1 flex items-baseline justify-between text-sm">
          <span className="text-muted">Maximum cost</span>
          <span className="font-bold text-ink">{filters.freeOnly ? 'Free only' : filters.maxPrice >= PRICE_MAX ? 'Any price' : filters.maxPrice === 0 ? 'Free' : `Up to $${filters.maxPrice}`}</span>
        </label>
        <input
          id="price-slider"
          type="range"
          className="range"
          min={0}
          max={PRICE_MAX}
          step={5}
          value={filters.freeOnly ? 0 : filters.maxPrice}
          disabled={filters.freeOnly}
          style={{ ['--fill' as string]: `${filters.freeOnly ? 0 : pct}%` }}
          aria-valuetext={filters.maxPrice >= PRICE_MAX ? 'Any price' : `Up to ${filters.maxPrice} dollars`}
          onChange={(e) => set({ maxPrice: Number(e.target.value) })}
        />
        <div aria-hidden className="mt-0.5 flex justify-between text-xs text-muted">
          <span>$0</span>
          <span>$75</span>
          <span>$150+</span>
        </div>
        <Switch className="mt-3" checked={filters.freeOnly} onChange={(v) => set({ freeOnly: v })} label="Free only" />
      </Section>

      <Section title="Category" id="f-cat">
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <Chip key={c} selected={filters.categories.includes(c)} onToggle={() => set({ categories: toggle(filters.categories, c) })} icon={<CategoryIcon id={c} />}>
              {CATEGORIES[c].label}
            </Chip>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm font-semibold text-brand hover:underline" onClick={() => setShowAllCats((s) => !s)} aria-expanded={showAllCats}>
          {showAllCats ? 'Show fewer categories' : `Show all ${CATEGORY_IDS.length} categories`}
        </button>
      </Section>

      <Section title="Calgary quadrant" id="f-quad">
        <div className="flex flex-wrap gap-2">
          <Chip selected={filters.quadrants.length === 0} onToggle={() => set({ quadrants: [] })}>
            All Calgary
          </Chip>
          {QUADRANTS.map((q) => (
            <Chip key={q} selected={filters.quadrants.includes(q)} onToggle={() => set({ quadrants: toggle(filters.quadrants, q) })}>
              <span aria-hidden>{q}</span>
              <span className="sr-only">{QUADRANT_INFO[q].name}</span>
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Date" id="f-date">
        <div role="radiogroup" aria-labelledby="f-date" className="grid grid-cols-2 gap-2">
          {(Object.keys(DATE_PRESET_LABEL) as DatePreset[]).map((d) => (
            <label
              key={d}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand',
                filters.date === d ? 'border-brand bg-brand-tint text-brand-deep' : 'border-line-strong bg-white hover:bg-mist',
              )}
            >
              <input type="radio" name="date-preset" className="sr-only" checked={filters.date === d} onChange={() => set({ date: d, ...(d !== 'custom' ? { from: '', to: '' } : {}) })} />
              {DATE_PRESET_LABEL[d]}
            </label>
          ))}
        </div>
        {filters.date === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="f-from" className="mb-1 block text-xs font-semibold text-muted">From</label>
              <Input id="f-from" type="date" min={toDateInput(now)} value={filters.from} onChange={(e) => set({ from: e.target.value })} />
            </div>
            <div>
              <label htmlFor="f-to" className="mb-1 block text-xs font-semibold text-muted">To</label>
              <Input id="f-to" type="date" min={filters.from || toDateInput(now)} value={filters.to} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Group size" id="f-size">
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <Chip key={s} selected={filters.sizes.includes(s)} onToggle={() => set({ sizes: toggle(filters.sizes, s) })}>
              {SIZE_LABEL[s]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Accessibility & comfort" id="f-access">
        <p className="mb-3 text-xs text-muted">Only shows events where the organizer has confirmed the feature.</p>
        <ul className="space-y-1">
          {ACCESS_FILTERS.map((a) => {
            const Icon = accessIcon(a)
            const checked = filters.access.includes(a)
            return (
              <li key={a}>
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-mist', checked && 'bg-brand-tint/60')}>
                  <input type="checkbox" className="size-4.5" checked={checked} onChange={() => set({ access: toggle(filters.access, a) })} />
                  <Icon aria-hidden className="size-4.5 text-ink-soft" />
                  <span className="font-medium text-ink">{accessFilterLabel(a)}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="More options" id="f-other">
        <div className="space-y-3">
          <Checkbox checked={filters.availableOnly} onChange={(v) => set({ availableOnly: v })} label="Spaces available" />
          <Checkbox checked={filters.verifiedHost} onChange={(v) => set({ verifiedHost: v })} label="Demo-verified host" description="Host completed the simulated verification flow." />
          <Checkbox checked={filters.travellerFriendly} onChange={(v) => set({ travellerFriendly: v })} label="Traveller-friendly" />
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink" id="setting-label">Setting</p>
            <Segmented
              label="Indoor or outdoor"
              className="w-full"
              value={filters.setting}
              onChange={(v) => set({ setting: v })}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'indoor', label: 'Indoor' },
                { value: 'outdoor', label: 'Outdoor' },
              ]}
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
