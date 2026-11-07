/**
 * Tandem logo: a tandem bicycle carried by two smiling riders — the back rider reaches forward,
 * a small gesture of moving together. Used in the nav, favicon (public/favicon.svg) and splash.
 */
import { BRAND } from '../../lib/brand'
import { cn } from '../../lib/cn'

type Tone = 'brand' | 'inverse' | 'mono'

export function LogoMark({
  className,
  tone = 'brand',
  title,
  motion = false,
  x,
  y,
  width,
  height,
}: {
  className?: string
  tone?: Tone
  title?: string
  motion?: boolean
  /** Position when nested inside another SVG (e.g. the landing illustration). */
  x?: number
  y?: number
  width?: number
  height?: number
}) {
  const bike = tone === 'brand' ? '#202124' : tone === 'inverse' ? '#FFFFFF' : 'currentColor'
  const rider = tone === 'brand' ? '#C8102E' : tone === 'inverse' ? '#FFFFFF' : 'currentColor'
  const face = tone === 'inverse' ? '#C8102E' : '#FFFFFF'
  return (
    <svg viewBox="0 0 64 40" x={x} y={y} width={width} height={height} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {motion && <path d="M1.5 24h3.5M0.5 28.5h3" stroke={rider} strokeWidth="1.6" opacity=".55" />}
        <circle cx="13" cy="29" r="8.6" stroke={bike} strokeWidth="2.6" />
        <circle cx="51" cy="29" r="8.6" stroke={bike} strokeWidth="2.6" />
        <path
          d="M13 29 L24 29 L39 29 M13 29 L20.5 17.5 L37.5 17.5 L46.5 16.5 M24 29 L20.5 17.5 M39 29 L37.5 17.5 M39 29 L46.5 16.5 M46.5 16.5 L51 29 M46.5 16.5 L45.6 12.6 M43.6 12.4 H48.2 M18.4 16.6 H22.8 M35.4 16.6 H39.8"
          stroke={bike}
          strokeWidth="2.4"
        />
        <path d="M20.8 15.2 L24.6 9.6 L34.2 13.4 M37.8 15.2 L41.6 9.6 L45.4 12.4" stroke={rider} strokeWidth="2.6" />
      </g>
      <circle cx="25.6" cy="5.4" r="4.1" fill={rider} />
      <circle cx="42.6" cy="5.4" r="4.1" fill={rider} />
      <g fill={face}>
        <circle cx="24.3" cy="4.7" r=".62" />
        <circle cx="26.9" cy="4.7" r=".62" />
        <circle cx="41.3" cy="4.7" r=".62" />
        <circle cx="43.9" cy="4.7" r=".62" />
      </g>
      <path d="M23.9 6.3 Q25.6 8.3 27.3 6.3 M40.9 6.3 Q42.6 8.3 44.3 6.3" fill="none" stroke={face} strokeWidth=".85" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, tone = 'brand', size = 'md' }: { className?: string; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark tone={tone} className={size === 'lg' ? 'h-12 w-auto' : size === 'sm' ? 'h-6 w-auto' : 'h-8 w-auto'} />
      <span
        className={cn(
          'font-extrabold tracking-[-0.04em]',
          size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-[1.4rem]',
          tone === 'inverse' ? 'text-white' : 'text-ink',
        )}
      >
        {BRAND.name}
      </span>
    </span>
  )
}
