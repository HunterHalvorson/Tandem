import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { filtersFromParams, filtersToParams, type EventFilters } from '../../services/filters'

/** Filters live in the URL query string, so list ↔ map views (and shared links) stay in sync. */
export function useEventFilters(): [EventFilters, (next: EventFilters | ((f: EventFilters) => EventFilters)) => void] {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(params), [params])
  const setFilters = useCallback(
    (next: EventFilters | ((f: EventFilters) => EventFilters)) => {
      setParams(
        (prev) => {
          const current = filtersFromParams(prev)
          const value = typeof next === 'function' ? next(current) : next
          const out = filtersToParams(value)
          // Preserve non-filter params (e.g. selected event on the map).
          for (const [k, v] of prev) if (!['q', 'cat', 'quad', 'max', 'free', 'date', 'from', 'to', 'size', 'access', 'open', 'verified', 'travel', 'setting', 'sort'].includes(k)) out.set(k, v)
          return out
        },
        { replace: true },
      )
    },
    [setParams],
  )
  return [filters, setFilters]
}
