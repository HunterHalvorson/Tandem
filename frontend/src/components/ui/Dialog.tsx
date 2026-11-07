/**
 * Accessible modal built on the native <dialog> element: focus is trapped by the browser,
 * Escape closes it, the rest of the page is inert, and focus returns to the trigger on close.
 */
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from './primitives'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  variant = 'modal',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** "sheet" slides in from the side (mobile filters, menus). */
  variant?: 'modal' | 'sheet'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'bg-transparent p-0 text-ink backdrop:backdrop-blur-[1px]',
        variant === 'modal'
          ? cn('m-auto w-[calc(100%-2rem)]', size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-lg' : 'max-w-2xl')
          : 'mr-0 ml-auto h-dvh max-h-dvh w-full max-w-md',
      )}
    >
      {open && (
        <div
          className={cn(
            'flex flex-col bg-white',
            variant === 'modal' ? 'max-h-[min(90dvh,48rem)] animate-pop rounded-2xl shadow-lift' : 'h-full animate-slide-up',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Close dialog" onClick={onClose} size="sm" className="-mt-1 -mr-2">
              <X aria-hidden />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
