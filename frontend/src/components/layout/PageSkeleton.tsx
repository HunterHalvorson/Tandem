import { Container, Skeleton } from '../ui/primitives'

/** Shown while a code-split page downloads (usually a few milliseconds). */
export function PageSkeleton() {
  return (
    <Container className="py-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading page…
      </p>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-2/3 max-w-lg" />
      <Skeleton className="mt-3 h-5 w-1/2 max-w-md" />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-card border border-line bg-white">
            <Skeleton className="aspect-[16/8] rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}
