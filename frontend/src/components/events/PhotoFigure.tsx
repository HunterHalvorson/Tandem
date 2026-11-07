import type { eventPhoto } from '../../data/calgaryPhotos'
import { cn } from '../../lib/cn'

export function PhotoFigure({ photo, className }: { photo: ReturnType<typeof eventPhoto>; className: string }) {
  return (
    <figure>
      <img src={photo.src} alt={photo.place} className={cn('w-full rounded-control border border-line bg-mist object-cover', className)} />
      <figcaption className="mt-2 text-xs text-muted">
        {photo.kind} · {photo.place} · <a href={photo.sourceUrl} className="underline underline-offset-2">{photo.author}</a>
        {' · '}
        {photo.licenseUrl
          ? <a href={photo.licenseUrl} className="underline underline-offset-2">{photo.license}</a>
          : photo.license}
        {' · Resized and cropped for display'}
      </figcaption>
    </figure>
  )
}
