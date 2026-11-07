import { lazy, Suspense, type ComponentProps } from 'react'
import { Skeleton } from '../ui/primitives'

const CalgaryMapLazy = lazy(() => import('./CalgaryMap'))
const MiniMapLazy = lazy(() => import('./MiniMap'))
const LocationPickerLazy = lazy(() => import('./LocationPicker'))

/** Leaflet is code-split: map code only downloads when a map is on screen. */
export function LazyCalgaryMap(props: ComponentProps<typeof CalgaryMapLazy>) {
  return (
    <Suspense fallback={<div className={props.className}><Skeleton className="h-full w-full rounded-none" /><span className="sr-only">Loading map…</span></div>}>
      <CalgaryMapLazy {...props} />
    </Suspense>
  )
}

export function LazyMiniMap(props: ComponentProps<typeof MiniMapLazy>) {
  return (
    <Suspense fallback={<Skeleton className="h-56 w-full rounded-card" />}>
      <MiniMapLazy {...props} />
    </Suspense>
  )
}

export function LazyLocationPicker(props: ComponentProps<typeof LocationPickerLazy>) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-card" />}>
      <LocationPickerLazy {...props} />
    </Suspense>
  )
}
