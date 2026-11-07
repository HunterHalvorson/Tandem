import type { User as AuthUser } from '@supabase/supabase-js'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sharedRpc, supabase, type SharedSnapshot } from '../services/supabase'

export function useSharedWorkspace(linkedEvent: string | null) {
  const [account, setAccount] = useState<AuthUser | null | undefined>(supabase ? undefined : null)
  const [view, setView] = useState<{ actor: string | undefined; linkedEvent: string | null; data: SharedSnapshot }>()
  const [failed, setFailed] = useState(false)
  const request = useRef(0)
  const actor = account?.id
  const authReady = account !== undefined
  const context = useRef({ actor, authReady, linkedEvent })
  useLayoutEffect(() => {
    context.current = { actor, authReady, linkedEvent }
  }, [actor, authReady, linkedEvent])

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    const { actor, authReady, linkedEvent } = context.current
    if (!supabase || !authReady) return
    const sequence = ++request.current
    const isCurrent = () => sequence === request.current
      && actor === context.current.actor && linkedEvent === context.current.linkedEvent
    try {
      const data = await sharedRpc<SharedSnapshot>('snapshot', { linked_event: linkedEvent })
      if (isCurrent()) {
        setView({ actor, linkedEvent, data })
        setFailed(false)
      }
    } catch {
      if (isCurrent()) setFailed(true)
    }
  }, [])

  const invalidate = useCallback(() => { request.current++ }, [])

  useEffect(() => {
    if (!supabase || !authReady) return
    const client = supabase
    const channel = client.channel(`tandem-collaboration:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tandem_revision' }, () => void refresh())
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh() })
    // Recover if a socket is unavailable or a device sleeps through a notification.
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      invalidate()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      void client.removeChannel(channel)
    }
  }, [actor, authReady, invalidate, refresh])

  useEffect(() => {
    queueMicrotask(refresh)
  }, [actor, authReady, linkedEvent, refresh])

  const snapshot = authReady && view?.actor === actor ? view?.data : undefined
  const loading = !!supabase && (!snapshot || (!!linkedEvent && linkedEvent !== view?.linkedEvent && !snapshot.events.some((event) => event.id === linkedEvent)))
  return { account, snapshot, refresh, loading, failed }
}
