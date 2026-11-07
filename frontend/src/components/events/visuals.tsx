/** Category + accessibility iconography and generated category cover art (no stock photos needed). */
import {
  Accessibility,
  BookOpen,
  Camera,
  Clapperboard,
  Coffee,
  Dices,
  Dumbbell,
  Ear,
  Footprints,
  GraduationCap,
  Guitar,
  HandHeart,
  Handshake,
  Landmark,
  Languages,
  Laptop,
  Mountain,
  Palette,
  Bike,
  Sprout,
  Toilet,
  Video,
  Volleyball,
  Volume1,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'
import { CATEGORIES, TONES } from '../../data/categories'
import { cn } from '../../lib/cn'
import type { AccessFeature, CategoryId } from '../../types'
import type { AccessFilter } from '../../services/filters'

export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  running: Footprints,
  fitness: Dumbbell,
  cycling: Bike,
  hiking: Mountain,
  reading: BookOpen,
  movies: Clapperboard,
  music: Guitar,
  art: Palette,
  tech: Laptop,
  games: Dices,
  food: Coffee,
  volunteering: HandHeart,
  photography: Camera,
  language: Languages,
  culture: Landmark,
  study: GraduationCap,
  sports: Volleyball,
  meetups: Handshake,
}

export const ACCESS_ICON: Record<AccessFeature | 'beginner', LucideIcon> = {
  wheelchair: Accessibility,
  stepFree: Footprints,
  accessibleWashroom: Toilet,
  quiet: Volume1,
  sensoryFriendly: Ear,
  virtual: Video,
  beginner: Sprout,
}

export function accessIcon(f: AccessFilter): LucideIcon {
  return ACCESS_ICON[f]
}

export function CategoryIcon({ id, className }: { id: CategoryId; className?: string }) {
  const Icon = CATEGORY_ICON[id]
  return <Icon aria-hidden className={className} />
}

const OUTDOOR: CategoryId[] = ['running', 'cycling', 'hiking', 'photography', 'sports']
const URBAN: CategoryId[] = ['culture', 'meetups', 'food', 'music', 'movies', 'tech', 'study', 'language']

/** Decorative cover illustration: tinted pattern + Calgary skyline or Rockies silhouette + category icon. */
export function CategoryCover({ categoryId, variant = 0, className, iconSize = 'md' }: { categoryId: CategoryId; variant?: number; className?: string; iconSize?: 'sm' | 'md' | 'lg' }) {
  const tone = TONES[CATEGORIES[categoryId].tone]
  const pid = useId().replace(/:/g, '')
  const Icon = CATEGORY_ICON[categoryId]
  const v = ((variant % 3) + 3) % 3
  return (
    <div aria-hidden className={cn('overflow-hidden', /\b(absolute|fixed)\b/.test(className ?? '') ? '' : 'relative', className)} style={{ background: tone.bg }}>
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id={`dots-${pid}`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2" fill={tone.soft} />
          </pattern>
          <pattern id={`lines-${pid}`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <rect width="5" height="16" fill={tone.soft} opacity=".75" />
          </pattern>
        </defs>
        {v === 0 &&
          [40, 72, 104, 136, 168].map((r) => <ellipse key={r} cx="330" cy="40" rx={r * 1.5} ry={r} fill="none" stroke={tone.soft} strokeWidth="6" />)}
        {v === 1 && <rect width="400" height="225" fill={`url(#dots-${pid})`} />}
        {v === 2 && <rect x="210" width="190" height="225" fill={`url(#lines-${pid})`} />}
        {OUTDOOR.includes(categoryId) && (
          <path d="M0 225 L0 170 L55 120 L95 150 L150 92 L205 146 L250 112 L300 160 L345 118 L400 158 L400 225 Z" fill={tone.ink} opacity=".14" />
        )}
        {URBAN.includes(categoryId) && (
          <g fill={tone.ink} opacity=".14">
            <path d="M0 225 V190 H28 V170 H52 V196 H70 V150 H96 V184 H112 V160 H140 V200 H160 V140 H186 V180 H204 V125 H226 V172 H244 V188 H268 V158 H292 V194 H318 V168 H346 V200 H372 V178 H400 V225 Z" />
            {/* Calgary Tower */}
            <path d="M286 225 V96 H290 V82 h-6 a8 6 0 0 1 16 0 h-6 V96 H298 V225 Z" />
          </g>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={cn(
            'grid place-items-center rounded-2xl bg-white/95 shadow-[0_6px_18px_-8px_rgb(16_24_40/0.35)]',
            iconSize === 'lg' ? 'size-24' : iconSize === 'sm' ? 'size-10' : 'size-16',
          )}
          style={{ color: tone.ink }}
        >
          <Icon className={iconSize === 'lg' ? 'size-12' : iconSize === 'sm' ? 'size-5' : 'size-8'} strokeWidth={1.75} />
        </span>
      </div>
    </div>
  )
}
