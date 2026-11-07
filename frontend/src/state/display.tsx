/** Display & accessibility preferences (text size, motion, contrast, readable font). Work signed-in or not. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_DISPLAY, loadDisplayPrefs, saveDisplayPrefs, type DisplayPrefs } from '../services/storage'

interface DisplayContextValue {
  prefs: DisplayPrefs
  update: (patch: Partial<DisplayPrefs>) => void
  reset: () => void
  /** True when the user or their OS asks for reduced motion. */
  reducedMotion: boolean
}

const DisplayContext = createContext<DisplayContextValue | null>(null)

function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function DisplayProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadDisplayPrefs)
  const systemReduced = useSystemReducedMotion()

  useEffect(() => {
    const html = document.documentElement
    html.style.setProperty('--text-scale', String(prefs.textScale))
    html.dataset.motion = prefs.reduceMotion ? 'reduce' : 'auto'
    html.dataset.contrast = prefs.highContrast ? 'high' : 'normal'
    html.dataset.font = prefs.readableFont ? 'readable' : 'default'
    html.dataset.underline = prefs.underlineLinks ? 'true' : 'false'
    saveDisplayPrefs(prefs)
  }, [prefs])

  const value = useMemo<DisplayContextValue>(
    () => ({
      prefs,
      update: (patch) => setPrefs((p) => ({ ...p, ...patch })),
      reset: () => setPrefs(DEFAULT_DISPLAY),
      reducedMotion: prefs.reduceMotion || systemReduced,
    }),
    [prefs, systemReduced],
  )
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>
}

export function useDisplay(): DisplayContextValue {
  const ctx = useContext(DisplayContext)
  if (!ctx) throw new Error('useDisplay must be used inside DisplayProvider')
  return ctx
}
