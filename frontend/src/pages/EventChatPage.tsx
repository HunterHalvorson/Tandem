import { ArrowLeft, CalendarDays, DoorOpen, Flag, Lock, MapPin, Megaphone, Radio, Send } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router'
import { JoinButton } from '../components/events/EventBits'
import { ReportDialog } from '../components/events/ReportDialog'
import { CategoryIcon } from '../components/events/visuals'
import { Dialog } from '../components/ui/Dialog'
import { Avatar, Badge, Button, ButtonLink, Card, Checkbox, Container, EmptyState } from '../components/ui/primitives'
import { cn } from '../lib/cn'
import { formatEventRange, formatRelative } from '../lib/dates'
import { displayName, pluralize } from '../lib/format'
import { usePageTitle } from '../lib/hooks'
import { announcements, canAccessChat, eventMessages, eventParticipants, hasReported, MAX_MESSAGE_LENGTH } from '../services/chat'
import { eventPhase, getEvent, getRegistration, getUser } from '../services/db'
import { useApp } from '../state/AppStore'
import { useDisplay } from '../state/display'
import { useToast } from '../state/toast'
import type { CalgaryEvent, ChatMessage } from '../types'

export default function EventChatPage() {
  const { id } = useParams()
  const { db, user } = useApp()
  const event = getEvent(db, id)
  usePageTitle(event ? `Chat · ${event.title}` : 'Chat')
  if (!event)
    return (
      <Container className="py-16">
        <EmptyState title="Chat not found" actions={<ButtonLink to="/dashboard">Go to dashboard</ButtonLink>} />
      </Container>
    )
  if (!canAccessChat(db, event, user?.id))
    return (
      <Container className="py-16">
        <EmptyState icon={<Lock aria-hidden />} title="This group chat is for attendees" actions={<JoinButton event={event} />}>
          Join <strong>{event.title}</strong> to chat with the host and other attendees. Chats are private to each event — there’s no public messaging directory.
        </EmptyState>
      </Container>
    )
  return <Chat event={event} />
}

function Chat({ event }: { event: CalgaryEvent }) {
  const { db, user, now, actions } = useApp()
  const { reducedMotion } = useDisplay()
  const { toast } = useToast()
  const [body, setBody] = useState('')
  const [announce, setAnnounce] = useState(false)
  const [reporting, setReporting] = useState<ChatMessage | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const messages = eventMessages(db, event.id)
  const pinned = announcements(db, event.id)
  const people = eventParticipants(db, event)
  const isHost = user?.id === event.hostId
  const reg = getRegistration(db, event.id, user?.id)
  const phase = eventPhase(event, now)

  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [messages.length, reducedMotion])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const send = () => {
    if (!body.trim()) return
    if (actions.sendMessage(event.id, body, announce && isHost)) {
      setBody('')
      setAnnounce(false)
      stick.current = true
    }
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <Container wide className="py-4 sm:py-6">
      <Link to={`/events/${event.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Event details
      </Link>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex h-[calc(100dvh-var(--chrome-top,4rem)-10rem)] min-h-[460px] flex-col overflow-hidden lg:h-[calc(100dvh-var(--chrome-top,4rem)-6rem)]">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand-deep">
              <CategoryIcon id={event.categoryId} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-ink sm:text-lg">{event.title}</h1>
              <p className="truncate text-xs text-muted">
                {formatEventRange(event.startsAt, event.endsAt, now)} · {pluralize(people.members.length + people.anonymous + 1, 'person', 'people')}
              </p>
            </div>
            <Badge tone="success" className="max-sm:hidden" title="Messages sync live between tabs in this browser. They are stored locally — this is a single-browser demo.">
              <Radio aria-hidden /> Live in this browser
            </Badge>
          </div>

          {pinned.length > 0 && (
            <div className="border-b border-line bg-warning-tint/60 px-4 py-2.5 text-sm text-ink">
              <p className="flex items-start gap-2">
                <Megaphone aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  <strong>Host announcement:</strong> {pinned[pinned.length - 1].body}
                </span>
              </p>
            </div>
          )}

          <div
            ref={listRef}
            role="log"
            aria-label={`Messages in ${event.title}`}
            tabIndex={0}
            onScroll={(e) => {
              const el = e.currentTarget
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
            className="flex-1 space-y-3 overflow-y-auto bg-paper px-3 py-4 sm:px-5"
          >
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} event={event} onReport={setReporting} />
            ))}
            {messages.filter((m) => m.kind !== 'system').length === 0 && <p className="py-8 text-center text-sm text-muted">No messages yet — say hi 👋</p>}
          </div>

          <div className="border-t border-line bg-white p-3">
            {phase === 'ended' || event.status === 'cancelled' ? (
              <p className="py-2 text-center text-sm text-muted">This event has {event.status === 'cancelled' ? 'been cancelled' : 'ended'} — the chat is read-only.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <label htmlFor="chat-input" className="sr-only">
                  Message the group
                </label>
                <div className="flex items-end gap-2">
                  <textarea
                    id="chat-input"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={onKey}
                    rows={1}
                    maxLength={MAX_MESSAGE_LENGTH}
                    placeholder="Message the group…"
                    aria-describedby="chat-hint"
                    className="max-h-32 min-h-11 flex-1 resize-y rounded-control border border-line-strong bg-white px-3 py-2.5 text-[0.9375rem]"
                  />
                  <Button type="submit" disabled={!body.trim()} aria-label="Send message">
                    <Send aria-hidden /> <span className="max-sm:sr-only">Send</span>
                  </Button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  {isHost ? <Checkbox checked={announce} onChange={setAnnounce} label="Post as a host announcement" /> : <span />}
                  <p id="chat-hint" className="text-xs text-muted">
                    Enter to send · Shift+Enter for a new line · {body.length}/{MAX_MESSAGE_LENGTH}
                  </p>
                </div>
              </form>
            )}
          </div>
        </Card>

        <aside aria-label="Event information" className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-bold text-ink">Event details</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
              <li className="flex items-start gap-2">
                <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                {formatEventRange(event.startsAt, event.endsAt, now)}
              </li>
              <li className="flex items-start gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                {event.venue.name}, {event.venue.quadrant}
              </li>
            </ul>
            {event.venue.privateDetails && <p className="mt-3 rounded-lg bg-success-tint px-3 py-2 text-xs text-success">Attendees only: {event.venue.privateDetails}</p>}
            {event.firstTime?.howToFindUs && <p className="mt-3 text-xs text-ink-soft"><strong>Finding the group:</strong> {event.firstTime.howToFindUs}</p>}
          </Card>
          <Card className="p-4">
            <h2 className="text-sm font-bold text-ink">People ({people.members.length + people.anonymous + 1})</h2>
            <ul className="mt-3 space-y-2.5">
              {people.host && (
                <li className="flex items-center gap-2.5 text-sm">
                  <Avatar user={people.host} size="sm" />
                  <Link to={`/people/${people.host.id}`} className="font-semibold text-ink hover:underline">
                    {displayName(people.host)}
                  </Link>
                  <Badge tone="brand">Host</Badge>
                </li>
              )}
              {people.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar user={m} size="sm" />
                  <Link to={`/people/${m.id}`} className="text-ink hover:underline">
                    {displayName(m)}
                  </Link>
                  {m.id === user?.id && <span className="text-xs text-muted">(you)</span>}
                </li>
              ))}
            </ul>
            {people.anonymous > 0 && <p className="mt-3 text-xs text-muted">+ {people.anonymous} seeded demo participants (not real accounts)</p>}
          </Card>
          <div className="space-y-2">
            {reg?.status === 'going' && phase !== 'ended' && !reg.checkedInAt && (
              <Button variant="danger" className="w-full" onClick={() => setLeaveOpen(true)}>
                <DoorOpen aria-hidden /> Leave event
              </Button>
            )}
            <p className="px-1 text-xs text-muted">
              Single-browser demo: messages are saved in this browser’s storage. Open this chat in another tab signed in as a different demo account to see live updates.
            </p>
          </div>
        </aside>
      </div>

      {reporting && <ReportDialog open onClose={() => setReporting(null)} targetType="message" targetId={reporting.id} subject={`“${reporting.body.slice(0, 80)}${reporting.body.length > 80 ? '…' : ''}”`} />}
      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this event?"
        description="You’ll lose access to this group chat and your spot will open up."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              Stay
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (actions.leaveEvent(event.id)) {
                  setLeaveOpen(false)
                  toast(`You left ${event.title}.`, { tone: 'info' })
                }
              }}
            >
              Leave event
            </Button>
          </>
        }
      />
    </Container>
  )
}

function MessageRow({ message, event, onReport }: { message: ChatMessage; event: CalgaryEvent; onReport: (m: ChatMessage) => void }) {
  const { db, user, now } = useApp()
  const [reveal, setReveal] = useState(false)
  if (message.kind === 'system')
    return (
      <p className="text-center text-xs text-muted">
        {message.body} · {formatRelative(message.createdAt, now)}
      </p>
    )
  const author = getUser(db, message.userId)
  const mine = message.userId === user?.id
  const reported = hasReported(db, 'message', message.id, user?.id)
  const fromHost = message.userId === event.hostId
  return (
    <div className={cn('group flex items-end gap-2', mine && 'flex-row-reverse')}>
      {!mine && author && <Avatar user={author} size="sm" />}
      <div className={cn('max-w-[85%] sm:max-w-[70%]', mine && 'items-end text-right')}>
        <p className={cn('mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted', mine && 'justify-end')}>
          <span className="font-semibold text-ink-soft">{mine ? 'You' : author ? displayName(author) : 'Former member'}</span>
          {fromHost && <Badge tone="brand">Host</Badge>}
          <time dateTime={message.createdAt}>{formatRelative(message.createdAt, now)}</time>
          {message.isDemo && <Badge tone="outline" title="Seeded demonstration message — not from a real person.">Demo message</Badge>}
        </p>
        <div
          className={cn(
            'inline-block rounded-2xl px-3.5 py-2.5 text-left text-[0.9375rem] leading-relaxed whitespace-pre-wrap',
            message.kind === 'announcement'
              ? 'border border-warning/30 bg-warning-tint text-ink'
              : mine
                ? 'rounded-br-md bg-brand text-white'
                : 'rounded-bl-md border border-line bg-white text-ink',
          )}
        >
          {message.kind === 'announcement' && (
            <span className="mb-1 flex items-center gap-1 text-xs font-bold text-warning">
              <Megaphone aria-hidden className="size-3.5" /> Announcement
            </span>
          )}
          {reported && !reveal ? (
            <span className="text-sm text-muted italic">
              You reported this message.{' '}
              <button type="button" className="font-semibold underline" onClick={() => setReveal(true)}>
                Show anyway
              </button>
            </span>
          ) : (
            message.body
          )}
        </div>
        {!mine && !reported && user && (
          <button
            type="button"
            onClick={() => onReport(message)}
            className="mt-1 ml-1 inline-flex items-center gap-1 text-xs text-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-brand-deep focus-visible:opacity-100"
          >
            <Flag aria-hidden className="size-3" /> Report
          </button>
        )}
      </div>
    </div>
  )
}
