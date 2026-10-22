import { createClient } from '@supabase/supabase-js'

// Publishable (public) values — safe to ship in the browser. Access is enforced by row-level security.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://pjujibzoscawmstarerz.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_5mK3Md5VCpXjHTSgVv68GQ_8kmPbg83'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rnb-auth' },
})

export const PHOTO_BUCKET = 'rnb-photos'

export type Role = 'admin' | 'worker'
export type Profile = {
  id: string
  display_name: string
  email: string
  phone: string | null
  role: Role
  active: boolean
  schedulable: boolean
}
export type Client = {
  id: string
  name: string
  phone: string | null
  address: string | null
  active: boolean
}
export type ClientTask = { id: string; client_id: string; title: string; position: number }
export type Status = 'pending' | 'in_progress' | 'submitted'
export type AssignmentTask = {
  id: string
  assignment_id: string
  kind: 'fixed' | 'extra'
  title: string
  position: number
  done: boolean
}
export type Photo = { id: string; assignment_id: string; path: string; uploaded_by: string | null; created_at: string }

export function errText(e: unknown): string {
  if (!e) return 'שגיאה'
  if (typeof e === 'string') return e
  const m = (e as { message?: string }).message
  return m || 'שגיאה'
}
