import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMatch } from 'react-router'
import { createSeedDatabase, DB_VERSION, DEFAULT_PRIVACY } from '../data/seed'
import { AppError, DEMO_VERIFICATION_DELAY_MS, getEvent, getUser } from '../services/db'
import { cancelEvent, createEvent, updateEvent, type EventDraft } from '../services/events'
import { checkIn, joinEvent, leaveEvent, toggleSavedEvent } from '../services/registrations'
import { reportContent, sendMessage } from '../services/chat'
import { joinGroup, leaveGroup } from '../services/groups'
import { submitReview, type ReviewInput } from '../services/reviews'
import {
  createAccount,
  deleteAccount,
  exportUserData,
  requestVerification,
  resetVerification,
  signInWithGoogle,
  sharedUser,
  updateUser,
  type GoogleProfile,
  type SignupInput,
} from '../services/users'
import { displayName } from '../lib/format'
import { googleDisableAutoSelect } from '../lib/googleIdentity'
import { loadOrSeed, loadSessionUserId, saveSessionUserId, sharedPreferencesAdapter, type StorageAdapter } from '../services/storage'
import { defaultBrowserAdapter } from '../services/liveSync'
import { sharedRpc, supabase } from '../services/supabase'
import type { CalgaryEvent, CategoryId, Database, GroupMessage, Quadrant, Report, ReportReason, User, Verification } from '../types'
import { useToast } from './toast'
import { useSharedWorkspace } from './useSharedWorkspace'

interface AppContextValue {
  db: Database
  now: Date
  user: User | undefined
  actions: Actions
  shared: boolean
  sharedOffline: boolean
  groupMessages: GroupMessage[]
}

type UserPatch = Parameters<typeof updateUser>[2]

export interface Actions {
  signIn(userId: string): boolean
  signOut(): Promise<boolean>
  signUp(input: SignupInput): User | null
  /** Real Google sign-in (ID token already parsed): finds, links or creates the profile and starts a session. */
  signInWithGoogle(profile: GoogleProfile): { user: User; isNew: boolean; linked: boolean } | null
  updateProfile(patch: UserPatch): Promise<boolean>
  setEaseIntoIt(on: boolean): void
  joinEvent(eventId: string): Promise<boolean>
  leaveEvent(eventId: string): Promise<boolean>
  checkIn(eventId: string): Promise<boolean>
  toggleSaved(eventId: string): boolean | null
  createEvent(draft: EventDraft): Promise<CalgaryEvent | null>
  updateEvent(eventId: string, draft: EventDraft): Promise<boolean>
  cancelEvent(eventId: string, reason: string): Promise<boolean>
  sendMessage(eventId: string, body: string, announcement?: boolean): Promise<boolean>
  report(targetType: Report['targetType'], targetId: string, reason: ReportReason, details: string): boolean
  submitReview(eventId: string, input: ReviewInput): Promise<boolean>
  joinGroup(groupId: string): Promise<boolean>
  leaveGroup(groupId: string): Promise<boolean>
  createGroup(input: { name: string; description: string; category: CategoryId; quadrant: Quadrant }): Promise<string | null>
  postToGroup(groupId: string, body: string): Promise<boolean>
  requestVerification(documentType: Verification['documentType']): boolean
  resetVerification(): void
  resetDemo(): void
  deleteMyAccount(): Promise<boolean>
  exportMyData(): (ReturnType<typeof exportUserData> & { groupMessages?: GroupMessage[] }) | null
}

const AppContext = createContext<AppContextValue | null>(null)

const shared = !!supabase

export function AppStoreProvider({ children, adapter = shared ? sharedPreferencesAdapter : defaultBrowserAdapter() }: { children: ReactNode; adapter?: StorageAdapter }) {
  const { toast } = useToast()
  const eventRoute = useMatch('/events/:id/*')
  const linkedEvent = eventRoute?.params.id === 'new' ? null : eventRoute?.params.id ?? null
  const { account, snapshot, refresh, failed, loading } = useSharedWorkspace(linkedEvent)
  const [local, setDb] = useState<Database>(() => shared
    ? adapter.load() ?? { version: DB_VERSION, seededAt: new Date().toISOString(), users: [], events: [], registrations: [], groups: [], memberships: [], reviews: [], messages: [], reports: [] }
    : loadOrSeed(adapter))
  const [sessionId, setSessionId] = useState<string | null>(() => shared ? null : loadSessionUserId())
  const [now, setNow] = useState(() => new Date())
  const localRef = useRef(local)
  const currentId = shared ? account?.id ?? null : sessionId
  const sessionRef = useRef(currentId)
  const db = useMemo<Database>(() => {
    if (!shared) return local
    const own = getUser(local, currentId)
    const profiles = (snapshot?.profiles ?? []).filter((p) => p.id !== currentId).map((p) =>
      sharedUser(local, {
        id: p.id, firstName: p.displayName, email: '',
        privacy: { ...DEFAULT_PRIVACY, showAttendance: p.showAttendance },
      }),
    )
    return {
      ...local,
      users: own ? [...profiles, own] : profiles,
      events: snapshot?.events ?? [],
      eventCounts: snapshot?.eventCounts,
      groups: snapshot?.groups ?? [],
      registrations: snapshot?.registrations ?? [],
      memberships: snapshot?.memberships ?? [],
      messages: snapshot?.messages ?? [],
      reviews: [
        ...(snapshot?.reviews ?? []),
        ...local.reviews.filter((review) => review.userId === currentId && !snapshot?.reviews?.some(
          (sharedReview) => sharedReview.eventId === review.eventId && sharedReview.userId === currentId,
        )),
      ],
      reports: local.reports.filter((report) => report.reporterId === currentId),
    }
  }, [local, currentId, snapshot])
  const dbRef = useRef(db)
  useLayoutEffect(() => {
    dbRef.current = db
    sessionRef.current = currentId
  }, [db, currentId])

  // Time-dependent UI (upcoming vs past, "starts in…") refreshes every 30 seconds.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Cross-tab sync within this browser, and across devices when the Tandem Live server is reachable.
  useEffect(
    () =>
      adapter.subscribe((next) => {
        if (next) {
          localRef.current = next
          if (!shared) dbRef.current = next
          setDb(next)
          setNow(new Date())
        }
      }),
    [adapter],
  )

  const commit = useCallback(
    (next: Database) => {
      dbRef.current = next
      const preferences = shared ? {
        ...localRef.current,
        users: [...localRef.current.users.filter((u) => u.id !== sessionRef.current), ...next.users.filter((u) => u.id === sessionRef.current)],
        reviews: localRef.current.reviews.filter((review) => review.userId !== sessionRef.current || getUser(next, review.userId)),
        reports: [...localRef.current.reports.filter((r) => r.reporterId !== sessionRef.current), ...next.reports],
      } : next
      localRef.current = preferences
      const saved = adapter.save(preferences)
      if (!saved.ok) toast(saved.error, { tone: 'error' })
      setDb(preferences)
      setNow(new Date())
    },
    [adapter, toast],
  )

  useEffect(() => {
    if (!account || getUser(localRef.current, account.id)) return
    const metadata = account.user_metadata
    const [given, ...family] = String(metadata.full_name ?? metadata.name ?? '').trim().split(/\s+/)
    const user = sharedUser(localRef.current, {
      id: account.id,
      email: account.email ?? '',
      firstName: String(metadata.given_name || given || 'Friend').slice(0, 40),
      lastName: String(metadata.family_name || family.join(' ')).slice(0, 40),
      authProvider: 'google',
    })
    commit({ ...dbRef.current, users: [...dbRef.current.users, user] })
  }, [account, commit])

  const remote = useCallback(async <T,>(work: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await work()
      await refresh()
      return result
    } catch (error) {
      toast(error instanceof AppError ? error.message : 'Something went wrong. Please try again.', { tone: 'error' })
      return null
    }
  }, [refresh, toast])

  /** Run a mutation; domain errors become an error toast and a falsy return. */
  const run = useCallback(
    <T,>(fn: (current: Database, at: Date) => { db: Database; result: T }): { ok: true; result: T } | { ok: false } => {
      try {
        const out = fn(dbRef.current, new Date())
        commit(out.db)
        return { ok: true, result: out.result }
      } catch (e) {
        if (e instanceof AppError) {
          toast(e.message, { tone: 'error' })
          return { ok: false }
        }
        throw e
      }
    },
    [commit, toast],
  )

  const requireSession = useCallback((): string => {
    const id = sessionRef.current
    if (!id || !getUser(dbRef.current, id)) throw new AppError('Please sign in first.')
    return id
  }, [])

  const actions = useMemo<Actions>(() => {
    const ok = (r: { ok: boolean }) => r.ok
    const write = async (name: string, params: Record<string, unknown>) =>
      (await remote(async () => { await sharedRpc(name, params); return true })) === true
    return {
      signIn(userId) {
        if (shared) return false
        if (!getUser(dbRef.current, userId)) {
          toast('That account doesn’t exist in this browser.', { tone: 'error' })
          return false
        }
        saveSessionUserId(userId)
        sessionRef.current = userId
        setSessionId(userId)
        return true
      },
      async signOut() {
        if (supabase) {
          const { error } = await supabase.auth.signOut({ scope: 'local' })
          if (error) {
            toast('Couldn’t sign out. Please try again.', { tone: 'error' })
            return false
          }
          return true
        }
        googleDisableAutoSelect()
        saveSessionUserId(null)
        sessionRef.current = null
        setSessionId(null)
        return true
      },
      signInWithGoogle(profile) {
        if (shared) return null
        const r = run((d, at) => {
          const res = signInWithGoogle(d, profile, at)
          return { db: res.db, result: res }
        })
        if (!r.ok) return null
        saveSessionUserId(r.result.user.id)
        sessionRef.current = r.result.user.id
        setSessionId(r.result.user.id)
        return { user: r.result.user, isNew: r.result.isNew, linked: r.result.linked }
      },
      signUp(input) {
        if (shared) return null
        const r = run((d, at) => {
          const res = createAccount(d, input, at)
          return { db: res.db, result: res.user }
        })
        if (!r.ok) return null
        saveSessionUserId(r.result.id)
        sessionRef.current = r.result.id
        setSessionId(r.result.id)
        return r.result
      },
      async updateProfile(patch) {
        if (shared && (patch.firstName !== undefined || patch.lastName !== undefined || patch.privacy)) {
          const updated = await remote(async () => {
            const id = requireSession()
            const profile = getUser(updateUser(dbRef.current, id, patch), id)!
            await sharedRpc('profile', { name: displayName(profile), show_attendance: profile.privacy.showAttendance })
            return id
          })
          if (!updated || sessionRef.current !== updated) return false
        }
        return ok(run((d) => ({ db: updateUser(d, requireSession(), patch), result: null })))
      },
      setEaseIntoIt(on) {
        run((d) => {
          const id = requireSession()
          const u = getUser(d, id)!
          return { db: updateUser(d, id, { comfort: { ...u.comfort, easeIntoIt: on } }), result: null }
        })
      },
      joinEvent: async (eventId) => shared ? write('event', { action: 'join', event_key: eventId }) : ok(run((d, at) => ({ db: joinEvent(d, eventId, requireSession(), at), result: null }))),
      leaveEvent: async (eventId) => shared ? write('event', { action: 'leave', event_key: eventId }) : ok(run((d, at) => ({ db: leaveEvent(d, eventId, requireSession(), at), result: null }))),
      checkIn: async (eventId) => shared ? write('event', { action: 'check_in', event_key: eventId }) : ok(run((d, at) => ({ db: checkIn(d, eventId, requireSession(), at), result: null }))),
      toggleSaved(eventId) {
        const r = run((d) => {
          const res = toggleSavedEvent(d, requireSession(), eventId)
          return { db: res.db, result: res.saved }
        })
        return r.ok ? r.result : null
      },
      async createEvent(draft) {
        if (shared) return remote(async () => {
          const validated = createEvent(dbRef.current, draft, requireSession(), new Date()).event
          const event = { ...validated, id: crypto.randomUUID() }
          await sharedRpc('event', { action: 'create', event_key: event.id, details: event })
          return event
        })
        const r = run((d, at) => {
          const res = createEvent(d, draft, requireSession(), at)
          return { db: res.db, result: res.event }
        })
        return r.ok ? r.result : null
      },
      async updateEvent(eventId, draft) {
        if (shared) return (await remote(async () => {
          const next = updateEvent(dbRef.current, eventId, draft, requireSession(), new Date())
          await sharedRpc('event', { action: 'edit', event_key: eventId, details: getEvent(next, eventId) })
          return true
        })) === true
        return ok(run((d, at) => ({ db: updateEvent(d, eventId, draft, requireSession(), at), result: null })))
      },
      cancelEvent: async (eventId, reason) => shared
        ? write('event', { action: 'cancel', event_key: eventId, details: { reason } })
        : ok(run((d, at) => ({ db: cancelEvent(d, eventId, requireSession(), reason, at), result: null }))),
      sendMessage: async (eventId, body, announcement = false) => shared
        ? write('post', { message_key: crypto.randomUUID(), event_key: eventId, group_key: null, content: body, announcement })
        : ok(run((d, at) => ({ db: sendMessage(d, { eventId, userId: requireSession(), body, announcement }, at), result: null }))),
      report: (targetType, targetId, reason, details) =>
        ok(run((d, at) => ({ db: reportContent(d, { targetType, targetId, reporterId: requireSession(), reason, details }, at), result: null }))),
      submitReview: async (eventId, input) => shared
        ? write('rate_event', {
          event_key: eventId,
          overall: input.overall,
          organization: input.organization,
          accuracy: input.accuracy,
          accessibility_accuracy: input.accessibilityAccuracy,
          would_return: input.wouldReturn,
          comment: input.comment,
        })
        : ok(run((d, at) => ({ db: submitReview(d, eventId, requireSession(), input, at), result: null }))),
      joinGroup: async (groupId) => shared ? write('membership', { group_key: groupId, joining: true }) : ok(run((d, at) => ({ db: joinGroup(d, groupId, requireSession(), at), result: null }))),
      leaveGroup: async (groupId) => shared ? write('membership', { group_key: groupId, joining: false }) : ok(run((d) => ({ db: leaveGroup(d, groupId, requireSession()), result: null }))),
      createGroup: (input) => remote(() => sharedRpc<string>('create_group', input)),
      postToGroup: (groupId, body) =>
        write('post', { message_key: crypto.randomUUID(), event_key: null, group_key: groupId, content: body }),
      requestVerification(documentType) {
        const r = run((d, at) => ({ db: requestVerification(d, requireSession(), documentType, at), result: null }))
        if (r.ok) setTimeout(() => setNow(new Date()), DEMO_VERIFICATION_DELAY_MS + 150)
        return r.ok
      },
      resetVerification() {
        run((d) => ({ db: resetVerification(d, requireSession()), result: null }))
      },
      resetDemo() {
        if (shared) return
        adapter.clear()
        const fresh = createSeedDatabase(new Date())
        commit(fresh)
        saveSessionUserId(null)
        sessionRef.current = null
        setSessionId(null)
      },
      async deleteMyAccount() {
        if (shared && !await write('delete_account', {})) return false
        const r = run((d) => ({ db: deleteAccount(d, requireSession()), result: null }))
        if (r.ok) {
          if (supabase) await supabase.auth.signOut({ scope: 'local' })
          googleDisableAutoSelect()
          saveSessionUserId(null)
          sessionRef.current = null
          setSessionId(null)
        }
        return r.ok
      },
      exportMyData() {
        try {
          const id = requireSession()
          const data = exportUserData(dbRef.current, id)
          return shared ? {
            ...data,
            note: 'Includes browser preferences and shared records visible in this session. Chat exports include messages from the currently visible history.',
            groupMessages: snapshot?.groupMessages.filter((message) => message.userId === id) ?? [],
          } : data
        } catch (e) {
          if (e instanceof AppError) toast(e.message, { tone: 'error' })
          return null
        }
      },
    }
  }, [adapter, commit, remote, requireSession, run, snapshot, toast])

  const user = getUser(db, currentId)
  const value = useMemo<AppContextValue>(() => ({
    db, now, user, actions, shared, sharedOffline: failed, groupMessages: snapshot?.groupMessages ?? [],
  }), [db, now, user, actions, failed, snapshot])
  if (loading || (account && !user)) return (
    <main className="mx-auto max-w-xl p-8">
      {failed ? (
        <>
          <p role="alert">Tandem’s shared workspace couldn’t load.</p>
          <button className="mt-2 underline" type="button" onClick={() => void refresh()}>Try again</button>
        </>
      ) : <p role="status">Loading Tandem’s shared workspace…</p>}
    </main>
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider')
  return ctx
}
