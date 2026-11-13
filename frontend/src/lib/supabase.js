/**
 * Supabase client. Uses build-time environment variables (VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY, or the NEXT_PUBLIC_* names) when set, otherwise the
 * public defaults in ./publicConfig.js.
 */
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './publicConfig'

const env = import.meta.env
const first = (...values) => values.map((v) => (v || '').trim()).find(Boolean) || ''

const rawUrl = first(env.VITE_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL)
const url = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
const anonKey = first(
  env.VITE_SUPABASE_ANON_KEY,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_ANON_KEY
)

// For the "not configured" screen: what this build actually received.
export const configCheck = {
  urlFound: Boolean(url),
  urlValid: /^https?:\/\//.test(url),
  keyFound: Boolean(anonKey),
  // The service-role key must never be in a browser build.
  keyIsServiceRole: (() => {
    try { return JSON.parse(atob(anonKey.split('.')[1] || '')).role === 'service_role' } catch { return anonKey.startsWith('sb_secret_') }
  })()
}

export const supabaseConfigured = configCheck.urlValid && configCheck.keyFound && !configCheck.keyIsServiceRole

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
