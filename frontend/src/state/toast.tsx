/** Accessible toasts: polite live region for info/success, assertive for errors. Pause on hover/focus. */
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../lib/cn'

type Tone = 'success' | 'error' | 'info'
interface ToastAction {
  label: string
  to?: string
  onClick?: () => void
}
interface ToastItem {
  id: number
  message: string
  tone: Tone
  action?: ToastAction
}

interface ToastContextValue {
  toast: (message: string, opts?: { tone?: Tone; action?: ToastAction; duration?: number }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((t) => t.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const schedule = useCallback(
    (id: number, ms: number) => {
      clearTimeout(timers.current.get(id))
      timers.current.set(id, setTimeout(() => dismiss(id), ms))
    },
    [dismiss],
  )

  const toast = useCallback<ToastContextValue['toast']>(
    (message, opts = {}) => {
      const id = nextId.current++
      const item: ToastItem = { id, message, tone: opts.tone ?? 'success', action: opts.action }
      setItems((xs) => [...xs.slice(-2), item])
      schedule(id, opts.duration ?? (item.tone === 'error' ? 7000 : 5000))
    },
    [schedule],
  )

  const value = useMemo(() => ({ toast }), [toast])
  const icon = { success: CheckCircle2, error: TriangleAlert, info: Info }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1100] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
        <div role="status" aria-live="polite" className="contents">
          {items
            .filter((t) => t.tone !== 'error')
            .map((t) => (
              <ToastCard key={t.id} item={t} Icon={icon[t.tone]} onDismiss={dismiss} onPause={() => clearTimeout(timers.current.get(t.id))} onResume={() => schedule(t.id, 3000)} />
            ))}
        </div>
        <div role="alert" aria-live="assertive" className="contents">
          {items
            .filter((t) => t.tone === 'error')
            .map((t) => (
              <ToastCard key={t.id} item={t} Icon={icon.error} onDismiss={dismiss} onPause={() => clearTimeout(timers.current.get(t.id))} onResume={() => schedule(t.id, 4000)} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({
  item,
  Icon,
  onDismiss,
  onPause,
  onResume,
}: {
  item: ToastItem
  Icon: typeof Info
  onDismiss: (id: number) => void
  onPause: () => void
  onResume: () => void
}) {
  return (
    <div
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-white p-3.5 pr-2 shadow-lift animate-slide-up',
        item.tone === 'error' ? 'border-brand/40' : 'border-line',
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', item.tone === 'error' ? 'text-brand' : item.tone === 'success' ? 'text-success' : 'text-info')} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-ink">{item.message}</p>
        {item.action &&
          (item.action.to ? (
            <Link to={item.action.to} onClick={() => onDismiss(item.id)} className="mt-1 inline-block font-semibold text-brand underline-offset-2 hover:underline">
              {item.action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick?.()
                onDismiss(item.id)
              }}
              className="mt-1 font-semibold text-brand underline-offset-2 hover:underline"
            >
              {item.action.label}
            </button>
          ))}
      </div>
      <button type="button" onClick={() => onDismiss(item.id)} className="rounded-md p-1 text-muted hover:bg-mist hover:text-ink" aria-label="Dismiss notification">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
