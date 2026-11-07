import { LogoMark } from '../components/brand/Logo'
import { ButtonLink, Container } from '../components/ui/primitives'
import { usePageTitle } from '../lib/hooks'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <Container className="flex max-w-xl flex-col items-center py-20 text-center">
      <LogoMark className="h-16 w-auto" motion />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">This path doesn’t lead anywhere</h1>
      <p className="mt-3 text-muted">The page you’re looking for doesn’t exist — but there’s plenty happening in Calgary.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/discover">Discover events</ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </Container>
  )
}
