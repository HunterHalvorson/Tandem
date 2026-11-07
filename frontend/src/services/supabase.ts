import { createClient } from '@supabase/supabase-js'
import type { Database, EventCounts, GroupMessage } from '../types'
import { AppError } from './db'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null

export interface SharedSnapshot extends Pick<Database, 'events' | 'groups' | 'memberships' | 'registrations' | 'messages' | 'reviews'> {
  profiles: { id: string; displayName: string; showAttendance: boolean }[]
  eventCounts: Record<string, EventCounts>
  groupMessages: GroupMessage[]
}

export async function sharedRpc<T = void>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new AppError('Shared collaboration is unavailable.')
  const { data, error } = await supabase.rpc(`tandem_${name}`, args)
  if (error) {
    if (error.code === 'P0001') throw new AppError(error.message)
    throw new AppError('Couldn’t reach Tandem’s shared workspace. Please try again.')
  }
  return data as T
}
