/** Reusable, accessible UI primitives. Consistent radii, 44px touch targets, visible focus. */
import { Check, Star } from 'lucide-react'
import { useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep active:bg-brand-deep shadow-card',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-mist hover:border-ink/30',
  ghost: 'text-ink hover:bg-mist',
  subtle: 'bg-brand-tint text-brand-deep hover:bg-brand-soft/70',
  danger: 'bg-white text-brand-deep border border-brand/40 hover:bg-brand-tint',
}
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[0.9375rem] gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string): string {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-[1.15em] [&_svg]:shrink-0',
    VARIANT[variant],
    SIZE[size],
    extra,
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link data-no-underline className={buttonClass(variant, size, className)} {...rest} />
}

export function IconButton({
  label,
  className,
  children,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-mist disabled:opacity-50 [&_svg]:size-5',
        size === 'sm' ? 'size-9' : 'size-11',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ chips, badges */

export function Chip({
  selected,
  onToggle,
  children,
  icon,
  className,
  disabled,
}: {
  selected: boolean
  onToggle: () => void
  children: ReactNode
  icon?: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 [&_svg]:size-4',
        selected ? 'border-brand bg-brand text-white hover:bg-brand-deep' : 'border-line-strong bg-white text-ink hover:border-ink/40 hover:bg-mist',
        className,
      )}
    >
      {selected ? <Check aria-hidden strokeWidth={3} /> : icon}
      {children}
    </button>
  )
}

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'outline'
const BADGE: Record<BadgeTone, string> = {
  neutral: 'bg-mist text-ink-soft',
  brand: 'bg-brand-tint text-brand-deep',
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  info: 'bg-info-tint text-info',
  outline: 'border border-line-strong bg-white text-ink-soft',
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5', BADGE[tone], className)}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ switch */

export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
  id,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  description?: ReactNode
  className?: string
  id?: string
}) {
  const autoId = useId()
  const labelId = `${id ?? autoId}-label`
  const descId = `${id ?? autoId}-desc`
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold text-ink">
          {label}
        </span>
        {description && (
          <span id={descId} className="mt-0.5 block text-sm text-muted">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors',
          checked ? 'border-brand bg-brand' : 'border-line-strong bg-mist',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-5 place-items-center rounded-full bg-white shadow transition-transform [&_svg]:size-3',
            checked ? 'translate-x-[1.35rem] text-brand' : 'translate-x-0.5 text-transparent',
          )}
        >
          <Check strokeWidth={4} />
        </span>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ form fields */

/** Base field styling — width/height are added per component so callers never fight class conflicts. */
export const inputClass =
  'block rounded-control border border-line-strong bg-white px-3 text-[0.9375rem] text-ink placeholder:text-muted/80 aria-[invalid=true]:border-brand aria-[invalid=true]:bg-brand-tint/30 disabled:bg-mist'

interface FieldRenderProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  required?: boolean
}

export function Field({
  label,
  hint,
  error,
  required,
  optional,
  children,
  className,
  id: idProp,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  optional?: boolean
  className?: string
  id?: string
  children: (props: FieldRenderProps) => ReactNode
}) {
  const auto = useId()
  const id = idProp ?? auto
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand" aria-hidden>*</span>}
        {required && <span className="sr-only">(required)</span>}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1 text-sm font-medium text-brand-deep">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, 'h-11 w-full', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'min-h-24 w-full py-2.5 leading-relaxed', className)} {...rest} />
}

export function Select({
  className,
  children,
  compact = false,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { compact?: boolean }) {
  return (
    <select className={cn(inputClass, compact ? 'h-9 w-auto pr-8 text-sm' : 'h-11 w-full pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  description?: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 rounded" aria-describedby={description ? `${id}-d` : undefined} />
      <label htmlFor={id} className="text-sm">
        <span className="font-semibold text-ink">{label}</span>
        {description && (
          <span id={`${id}-d`} className="mt-0.5 block text-muted">
            {description}
          </span>
        )}
      </label>
    </div>
  )
}

/** Radio group styled as a segmented control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-control border border-line-strong bg-mist p-1', className)}>
      {options.map((o) => {
        const id = `${name}-${o.value}`
        const checked = value === o.value
        return (
          <label
            key={o.value}
            htmlFor={id}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[0.45rem] px-3 font-semibold whitespace-nowrap transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand [&_svg]:size-4',
              size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm',
              checked ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            <input id={id} type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            {o.icon}
            {o.label}
          </label>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ display */

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={cn('rounded-card border border-line bg-white shadow-card', className)}>{children}</As>
}

export function Avatar({
  user,
  size = 'md',
  decorative = true,
  className,
}: {
  user: { firstName: string; lastName: string; avatar: { color: string; photo?: string } }
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  decorative?: boolean
  className?: string
}) {
  const dims = { xs: 'size-6 text-[0.6rem]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-xl', xl: 'size-24 text-3xl' }[size]
  const label = `${user.firstName} ${user.lastName}`
  if (user.avatar.photo)
    return <img src={user.avatar.photo} alt={decorative ? '' : label} className={cn('shrink-0 rounded-full object-cover', dims, className)} />
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold text-white', dims, className)}
      style={{ background: user.avatar.color }}
    >
      {`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()}
    </span>
  )
}

export function StarRating({ value, count, size = 'sm', className }: { value: number; count?: number; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold text-ink', size === 'md' ? 'text-base' : 'text-sm', className)}>
      <Star aria-hidden className={cn('fill-current text-[#B7791F]', size === 'md' ? 'size-5' : 'size-4')} />
      <span aria-hidden>{value.toFixed(1)}</span>
      {count !== undefined && <span aria-hidden className="font-normal text-muted">({count})</span>}
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5{count !== undefined ? ` from ${count} review${count === 1 ? '' : 's'}` : ''}
      </span>
    </span>
  )
}

export function StarInput({ value, onChange, label, allowNA }: { value: number | null; onChange: (v: number | null) => void; label: string; allowNA?: boolean }) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <Star aria-hidden className={cn('size-7 transition-colors', value !== null && n <= value ? 'fill-[#D69E2E] text-[#B7791F]' : 'text-line-strong')} />
            <span className="sr-only">
              {n} star{n > 1 ? 's' : ''}
            </span>
          </label>
        ))}
        {allowNA && (
          <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-sm has-[:checked]:border-ink has-[:checked]:bg-mist has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
            <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} className="sr-only" />
            Not applicable
          </label>
        )}
        <span className="ml-2 text-sm text-muted" aria-hidden>
          {value ? `${value}/5` : allowNA ? '' : 'Choose a rating'}
        </span>
      </div>
    </fieldset>
  )
}

export function ProgressBar({ value, max, label, className, tone = 'brand' }: { value: number; max: number; label: string; className?: string; tone?: 'brand' | 'ink' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn('h-2 w-full overflow-hidden rounded-full bg-mist', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone === 'brand' ? 'bg-brand' : 'bg-ink')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({ icon, title, children, actions, className }: { icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-line-strong bg-white px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-tint text-brand [&_svg]:size-6">{icon}</div>}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />
}

export function SectionHeading({ title, eyebrow, action, id, className }: { title: ReactNode; eyebrow?: ReactNode; action?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold tracking-wider text-brand uppercase">{eyebrow}</p>}
        <h2 id={id} className="text-xl font-bold text-ink sm:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, eyebrow, actions, className }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4 pb-6', className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-wider text-brand uppercase">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-base text-muted sm:text-lg">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Container({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', wide ? 'max-w-[1440px]' : 'max-w-7xl', className)}>{children}</div>
}
