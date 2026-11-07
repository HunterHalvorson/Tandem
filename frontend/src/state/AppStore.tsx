/**
 * App store: holds the Database + simulated session and exposes actions that wrap the pure services.
 * Every mutation goes: service(db) → storage adapter save → React state. Other tabs receive the
 * change through the `storage` event, which is what makes cross-tab chat "live" in the demo.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeedDatabase } from '../data/seed'
import { AppError, DEMO_VERIFICATION_DELAY_MS, getUser } from '../services/db'
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
  updateUser,
  type GoogleProfile,
  type SignupInput,
} from '../services/users'
import { googleDisableAutoSelect } from '../lib/googleIdentity'
import { loadOrSeed, loadSessionUserId, localStorageAdapter, saveSessionUserId, type StorageAdapter } from '../services/storage'
import type { CalgaryEvent, Database, Report, ReportReason, User, Verification } from '../types'
import { useToast } from './toast'

interface AppContextValue {
  db: Database
  now: Date
  user: User | undefined
  actions: Actions
}

type UserPatch = Parameters<typeof updateUser>[2]

export interface Actions {
  signIn(userId: string): boolean
  signOut(): void
  signUp(input: SignupInput): User | null
  /** Real Google sign-in (ID token already parsed): finds, links or creates the profile and starts a session. */
  signInWithGoogle(profile: GoogleProfile): { user: User; isNew: boolean; linked: boolean } | null
  updateProfile(patch: UserPatch): boolean
  setEaseIntoIt(on: boolean): void
  joinEvent(eventId: string): boolean
  leaveEvent(eventId: string): boolean
  checkIn(eventId: string): boolean
  toggleSaved(eventId: string): boolean | null
  createEvent(draft: EventDraft): CalgaryEvent | null
  updateEvent(eventId: string, draft: EventDraft): boolean
  cancelEvent(eventId: string, reason: string): boolean
  sendMessage(eventId: string, body: string, announcement?: boolean): boolean
  report(targetType: Report['targetType'], targetId: string, reason: ReportReason, details: string): boolean
  submitReview(eventId: string, input: ReviewInput): boolean
  joinGroup(groupId: string): boolean
  leaveGroup(groupId: string): boolean
  requestVerification(documentType: Verification['documentType']): boolean
  resetVerification(): void
  resetDemo(): void
  deleteMyAccount(): void
  exportMyData(): ReturnType<typeof exportUserData> | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppStoreProvider({ children, adapter = localStorageAdapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const { toast } = useToast()
  const [db, setDb] = useState<Database>(() => loadOrSeed(adapter))
  const [sessionId, setSessionId] = useState<string | null>(loadSessionUserId)
  const [now, setNow] = useState(() => new Date())
  const dbRef = useRef(db)
  const sessionRef = useRef(sessionId)

  // Time-dependent UI (upcoming vs past, "starts in…") refreshes every 30 seconds.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Cross-tab sync within this browser.
  useEffect(
    () =>
      adapter.subscribe((next) => {
        if (next) {
          dbRef.current = next
          setDb(next)
          setNow(new Date())
        }
      }),
    [adapter],
  )

  const commit = useCallback(
    (next: Database) => {
      dbRef.current = next
      const saved = adapter.save(next)
      if (!saved.ok) toast(saved.error, { tone: 'error' })
      setDb(next)
      setNow(new Date())
    },
    [adapter, toast],
  )

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
    return {
      signIn(userId) {
        if (!getUser(dbRef.current, userId)) {
          toast('That account doesn’t exist in this browser.', { tone: 'error' })
          return false
        }
        saveSessionUserId(userId)
        sessionRef.current = userId
        setSessionId(userId)
        return true
      },
      signOut() {
        googleDisableAutoSelect()
        saveSessionUserId(null)
        sessionRef.current = null
        setSessionId(null)
      },
      signInWithGoogle(profile) {
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
      updateProfile: (patch) => ok(run((d) => ({ db: updateUser(d, requireSession(), patch), result: null }))),
      setEaseIntoIt(on) {
        run((d) => {
          const id = requireSession()
          const u = getUser(d, id)!
          return { db: updateUser(d, id, { comfort: { ...u.comfort, easeIntoIt: on } }), result: null }
        })
      },
      joinEvent: (eventId) => ok(run((d, at) => ({ db: joinEvent(d, eventId, requireSession(), at), result: null }))),
      leaveEvent: (eventId) => ok(run((d, at) => ({ db: leaveEvent(d, eventId, requireSession(), at), result: null }))),
      checkIn: (eventId) => ok(run((d, at) => ({ db: checkIn(d, eventId, requireSession(), at), result: null }))),
      toggleSaved(eventId) {
        const r = run((d) => {
          const res = toggleSavedEvent(d, requireSession(), eventId)
          return { db: res.db, result: res.saved }
        })
        return r.ok ? r.result : null
      },
      createEvent(draft) {
        const r = run((d, at) => {
          const res = createEvent(d, draft, requireSession(), at)
          return { db: res.db, result: res.event }
        })
        return r.ok ? r.result : null
      },
      updateEvent: (eventId, draft) => ok(run((d, at) => ({ db: updateEvent(d, eventId, draft, requireSession(), at), result: null }))),
      cancelEvent: (eventId, reason) => ok(run((d, at) => ({ db: cancelEvent(d, eventId, requireSession(), reason, at), result: null }))),
      sendMessage: (eventId, body, announcement) =>
        ok(run((d, at) => ({ db: sendMessage(d, { eventId, userId: requireSession(), body, announcement }, at), result: null }))),
      report: (targetType, targetId, reason, details) =>
        ok(run((d, at) => ({ db: reportContent(d, { targetType, targetId, reporterId: requireSession(), reason, details }, at), result: null }))),
      submitReview: (eventId, input) => ok(run((d, at) => ({ db: submitReview(d, eventId, requireSession(), input, at), result: null }))),
      joinGroup: (groupId) => ok(run((d, at) => ({ db: joinGroup(d, groupId, requireSession(), at), result: null }))),
      leaveGroup: (groupId) => ok(run((d) => ({ db: leaveGroup(d, groupId, requireSession()), result: null }))),
      requestVerification(documentType) {
        const r = run((d, at) => ({ db: requestVerification(d, requireSession(), documentType, at), result: null }))
        if (r.ok) setTimeout(() => setNow(new Date()), DEMO_VERIFICATION_DELAY_MS + 150)
        return r.ok
      },
      resetVerification() {
        run((d) => ({ db: resetVerification(d, requireSession()), result: null }))
      },
      resetDemo() {
        adapter.clear()
        const fresh = createSeedDatabase(new Date())
        commit(fresh)
        saveSessionUserId(null)
        sessionRef.current = null
        setSessionId(null)
      },
      deleteMyAccount() {
        const r = run((d) => ({ db: deleteAccount(d, requireSession()), result: null }))
        if (r.ok) {
          googleDisableAutoSelect()
          saveSessionUserId(null)
          sessionRef.current = null
          setSessionId(null)
        }
      },
      exportMyData() {
        try {
          return exportUserData(dbRef.current, requireSession())
        } catch (e) {
          if (e instanceof AppError) toast(e.message, { tone: 'error' })
          return null
        }
      },
    }
  }, [adapter, commit, requireSession, run, toast])

  const user = getUser(db, sessionId)
  const value = useMemo<AppContextValue>(() => ({ db, now, user, actions }), [db, now, user, actions])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider')
  return ctx
}
