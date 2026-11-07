import { useEffect, useRef, type RefObject } from 'react'
import { BRAND } from './brand'

/** Sets the document title ("Discover · Tandem") — screen readers announce it on navigation. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.heroHeadline}`
  }, [title])
}

/** Close popovers on outside click or Escape; returns focus to the trigger on Escape. */
export function useDismiss(open: boolean, onClose: () => void, refs: Array<RefObject<HTMLElement | null>>, trigger?: RefObject<HTMLElement | null>): void {
  const cb = useRef(onClose)
  useEffect(() => {
    cb.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return
      cb.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cb.current()
        trigger?.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
