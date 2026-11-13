/**
 * Supabase client. Configured only through build-time environment variables
 * (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY), e.g. in Vercel's project
 * settings or frontend/.env.local for local development.
 */
import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const supabaseConfigured = Boolean(url.startsWith('http') && anonKey)

export function isSupabaseConfigured() {
  return supabaseConfigured
}

let client = null

export function getSupabase() {
  if (!supabaseConfigured) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  }
  return client
}

// Older versions stored a Supabase URL/key in the browser. They are no longer
// used; remove them so they cannot override the deployed configuration.
try {
  localStorage.removeItem('FAM_SUPABASE_URL')
  localStorage.removeItem('FAM_SUPABASE_ANON_KEY')
} catch {
  /* storage unavailable */
}
