import {
  Accessibility,
  ChevronDown,
  Compass,
  Info,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Settings,
  User as UserIcon,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { FEATURED_DEMO_ACCOUNTS } from '../../data/seed'
import { BRAND, MILES_NAME } from '../../lib/brand'
import { cn } from '../../lib/cn'
import { formatMonthDay } from '../../lib/dates'
import { displayName } from '../../lib/format'
import { useDismiss } from '../../lib/hooks'
import { getUser, isSeedStale, verificationStatus } from '../../services/db'
import { computeMiles } from '../../services/miles'
import { dismissBanner, isBannerDismissed } from '../../services/storage'
import { useApp } from '../../state/AppStore'
import { useDisplay } from '../../state/display'
import { useToast } from '../../state/toast'
import { Logo } from '../brand/Logo'
import { VerificationBadge } from '../events/EventBits'
import { Dialog } from '../ui/Dialog'
import { Avatar, ButtonLink, Segmented, Switch } from '../ui/primitives'
import { PageSkeleton } from './PageSkeleton'
import { useLiveSync } from '../../services/liveSync'

const NAV = [
  { to: '/discover', label: 'Events', icon: Compass },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/groups', label: 'Groups', icon: UsersRound },
]

function usePrimaryLinks() {
  const { user } = useApp()
  return user ? [...NAV, { to: '/dashboard', label: 'My events', icon: LayoutDashboard }] : NAV
}

export function AppShell() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // On navigation: scroll to top and move focus to <main> so screen readers start at the new page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  // Expose the height of the banners + sticky header as --chrome-top so full-height views (map, chat) fit the viewport.
  useLayoutEffect(() => {
    const els = ['site-banners', 'site-header'].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    const update = () => document.documentElement.style.setProperty('--chrome-top', `${els.reduce((s, el) => s + el.offsetHeight, 0)}px`)
    update()
    const ro = new ResizeObserver(update)
    els.forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[2000] rounded-control bg-ink px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Banners />
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  )
}

/* ------------------------------------------------------------------ banners */

function Banners() {
  const live = useLiveSync()
  const { db, now, actions, shared, sharedOffline } = useApp()
  const { toast } = useToast()
  const [dismissed, setDismissed] = useState(isBannerDismissed)
  const stale = !shared && isSeedStale(db, now)
  return (
    <div id="site-banners">
      {sharedOffline && <p role="status" className="bg-warning-tint px-4 py-2 text-center text-sm text-warning">
        The shared workspace couldn’t refresh. Tandem will retry automatically.
      </p>}
      {stale && (
        <div className="bg-warning-tint px-4 py-2 text-center text-sm text-warning">
          <RefreshCw aria-hidden className="mr-1.5 inline size-4 align-[-3px]" />
          Demo events were generated on {formatMonthDay(new Date(db.seededAt))}, so some dates have passed.{' '}
          <button
            type="button"
            className="font-bold underline underline-offset-2"
            onClick={() => {
              actions.resetDemo()
              toast('Demo data refreshed — event dates now start from today. You were signed out.', { tone: 'info' })
            }}
          >
            Refresh demo data
          </button>
        </div>
      )}
      {!dismissed && (
        <div className="relative bg-ink px-10 py-2 text-center text-xs text-white/90 sm:text-sm">
          <Info aria-hidden className="mr-1.5 inline size-4 align-[-3px]" />
          {shared
            ? 'Shared workspace: events, attendance and discussions sync through Supabase. ID verification is simulated.'
            : <>Hackathon prototype: demo accounts and ID verification are <strong className="text-white">simulated</strong>, {live.status === 'live' ? 'data syncs between devices through the local Tandem Live server' : 'data lives only in this browser'}, and seeded events are fictional.</>}{' '}
          <Link to="/about" className="font-semibold text-white underline underline-offset-2">
            About this demo
          </Link>
          <button
            type="button"
            aria-label="Dismiss demo notice"
            onClick={() => {
              dismissBanner()
              setDismissed(true)
            }}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md hover:bg-white/10"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ header */

function Header() {
  const { user } = useApp()
  const links = usePrimaryLinks()
  return (
    <header id="site-header" className="sticky top-0 z-[1000] border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 w-full items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0 rounded-md" aria-label={`${BRAND.name} home`} data-no-underline>
          <Logo />
        </Link>
        <nav aria-label="Primary" className="ml-2 hidden min-w-0 flex-1 overflow-x-auto lg:block">
          <ul className="flex w-max items-center gap-1">
            {links.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      'relative inline-block whitespace-nowrap rounded-md px-2 py-2 text-sm font-semibold transition-colors xl:text-[0.9375rem]',
                      isActive ? 'text-brand after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:rounded-full after:bg-brand' : 'text-ink-soft hover:bg-mist hover:text-ink',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ButtonLink to="/events/new" size="sm" variant="secondary" className="max-lg:hidden">
            <Plus aria-hidden /> Create event
          </ButtonLink>
          <DisplayMenu />
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink to="/signup" variant="secondary" size="sm" className="max-sm:hidden">
                Sign up
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function DisplayMenu() {
  const { prefs, update, reset } = useDisplay()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useDismiss(open, () => setOpen(false), [panel, trigger], trigger)
  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="display-menu"
        onClick={() => setOpen((o) => !o)}
        className={cn('grid size-11 place-items-center rounded-control text-ink hover:bg-mist', open && 'bg-mist')}
        title="Display & accessibility"
      >
        <Accessibility aria-hidden className="size-6" />
        <span className="sr-only">Display and accessibility settings</span>
      </button>
      {open && (
        <div ref={panel} id="display-menu" className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-slide-up rounded-card border border-line bg-white p-4 shadow-lift">
          <p className="text-base font-bold text-ink">Display & accessibility</p>
          <p className="mb-3 text-sm text-muted">Saved in this browser. Works without an account.</p>
          <p id="text-size-label" className="mb-1.5 text-sm font-semibold">Text size</p>
          <Segmented
            label="Text size"
            className="mb-4 w-full"
            size="sm"
            value={String(prefs.textScale) as '1' | '1.125' | '1.25' | '1.375'}
            onChange={(v) => update({ textScale: Number(v) as 1 })}
            options={[
              { value: '1', label: 'A' },
              { value: '1.125', label: 'A+' },
              { value: '1.25', label: 'A++' },
              { value: '1.375', label: 'A+++' },
            ]}
          />
          <div className="space-y-3">
            <Switch checked={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" description="Turn off animations and map fly-overs." />
            <Switch checked={prefs.highContrast} onChange={(v) => update({ highContrast: v })} label="High contrast" description="Darker text, stronger borders and focus rings." />
            <Switch checked={prefs.readableFont} onChange={(v) => update({ readableFont: v })} label="Readable font" description="Atkinson Hyperlegible, designed for low vision." />
            <Switch checked={prefs.underlineLinks} onChange={(v) => update({ underlineLinks: v })} label="Underline links" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <button type="button" onClick={reset} className="text-sm font-semibold text-muted hover:text-ink">
              Reset
            </button>
            <Link to="/settings#comfort" onClick={() => setOpen(false)} className="text-sm font-semibold text-brand hover:underline">
              Comfort & Access preferences →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountMenu() {
  const { user, db, now, actions, shared } = useApp()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useDismiss(open, () => setOpen(false), [panel, trigger], trigger)
  if (!user) return null
  const miles = computeMiles(db, user.id, now).total
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-mist [&_svg]:size-4.5 [&_svg]:text-muted'
  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
        className={cn('flex items-center gap-1.5 rounded-full p-1 pr-2 hover:bg-mist', open && 'bg-mist')}
      >
        <Avatar user={user} size="sm" />
        <ChevronDown aria-hidden className="hidden size-4 text-muted sm:block" />
        <span className="sr-only">Account menu for {user.firstName}</span>
      </button>
      {open && (
        <div ref={panel} id="account-menu" className="absolute right-0 mt-2 w-72 animate-slide-up rounded-card border border-line bg-white p-2 shadow-lift">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar user={user} size="md" />
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{displayName({ ...user, privacy: { showFullName: true } })}</p>
              <p className="text-xs text-muted">
                {miles} {MILES_NAME}
              </p>
            </div>
          </div>
          <div className="mb-1 px-3">
            <VerificationBadge status={verificationStatus(user, now)} />
          </div>
          <hr className="my-1 border-line" />
          <Link to="/profile" className={item} onClick={() => setOpen(false)}>
            <UserIcon aria-hidden /> My profile
          </Link>
          <Link to="/settings" className={item} onClick={() => setOpen(false)}>
            <Settings aria-hidden /> Privacy & accessibility settings
          </Link>
          {!shared && (
            <button type="button" className={item} onClick={() => { setOpen(false); setSwitchOpen(true) }}>
              <Users aria-hidden /> Switch demo account
            </button>
          )}
          <hr className="my-1 border-line" />
          <button
            type="button"
            className={item}
            onClick={async () => {
              if (!await actions.signOut()) return
              setOpen(false)
              toast('Signed out.', { tone: 'info' })
              navigate('/')
            }}
          >
            <LogOut aria-hidden /> Sign out
          </button>
        </div>
      )}
      <SwitchAccountDialog open={switchOpen} onClose={() => setSwitchOpen(false)} />
    </div>
  )
}

export function SwitchAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, user, actions } = useApp()
  const { toast } = useToast()
  const navigate = useNavigate()
  return (
    <Dialog open={open} onClose={onClose} title="Switch demo account" description="Simulated sign-in: no passwords. Tip — use a different account in another tab to try live group chat.">
      <ul className="space-y-2">
        {FEATURED_DEMO_ACCOUNTS.map((a) => {
          const u = getUser(db, a.id)
          if (!u) return null
          const current = u.id === user?.id
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={current}
                onClick={() => {
                  actions.signIn(u.id)
                  onClose()
                  toast(`Signed in as ${u.firstName} (demo account).`, { tone: 'info' })
                  navigate('/dashboard')
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-ink/30 hover:bg-mist disabled:opacity-60"
              >
                <Avatar user={u} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {u.firstName} {u.lastName} {current && <span className="text-xs font-normal text-muted">(current)</span>}
                  </span>
                  <span className="block text-sm text-muted">{a.persona}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

function MobileBottomNav() {
  const links = usePrimaryLinks()
  const items = [...links, { to: '/events/new', label: 'Create', icon: Plus }]
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink to={item.to} className={({ isActive }) => cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 px-1 text-center text-xs leading-tight font-semibold',
              isActive ? 'border-brand text-brand-deep' : 'border-transparent text-ink-soft hover:bg-mist',
            )}>
              <item.icon aria-hidden className="size-5" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer() {
  const links = [
    { to: '/explore-like-a-local', label: 'Visitor planner' },
    { to: '/leaderboard', label: 'Event ratings' },
    { to: '/impact', label: 'Community impact' },
    { to: '/about', label: 'About Tandem' },
  ]
  return (
    <footer className="mt-10 border-t border-line bg-white pb-20 lg:pb-0">
      <nav aria-label="More from Tandem" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {links.map((link) => (
            <li key={link.to}><Link className="text-ink-soft hover:underline" to={link.to}>{link.label}</Link></li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-6 text-xs text-muted sm:px-6 lg:px-8">
          <p>
            {BRAND.name} is built in Mohkinstsis (Calgary). We acknowledge the traditional territories of the peoples of the Treaty 7 region: the Blackfoot Confederacy (Siksika, Piikani and Kainai),
            the Tsuut’ina First Nation and the Îyârhe Nakoda (Chiniki, Bearspaw and Goodstoney), and the Métis Nation within Alberta Districts 5 and 6.
          </p>
          <p>Prototype built for Code the Change · Map data © OpenStreetMap contributors · Seeded events are fictional listings at real public places.</p>
        </div>
      </div>
    </footer>
  )
}
