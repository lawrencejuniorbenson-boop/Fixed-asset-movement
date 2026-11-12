/**
 * frontend/src/lib/supabase.js
 * Supabase client configuration and dynamic connection manager.
 * Supports environment variables (VITE_SUPABASE_URL) as well as
 * runtime configuration saved in localStorage.
 */

import { createClient } from '@supabase/supabase-js'

const STORAGE_URL_KEY = 'FAM_SUPABASE_URL'
const STORAGE_KEY_KEY = 'FAM_SUPABASE_ANON_KEY'

export function sanitizeSupabaseUrl(url) {
  if (!url) return ''
  return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
}

export function getStoredSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const localUrl = localStorage.getItem(STORAGE_URL_KEY)
  const localKey = localStorage.getItem(STORAGE_KEY_KEY)

  return {
    url: sanitizeSupabaseUrl(localUrl || envUrl || ''),
    anonKey: (localKey || envKey || '').trim()
  }
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getStoredSupabaseConfig()
  return Boolean(url && anonKey && url.startsWith('http'))
}

let cachedClient = null
let lastUrl = null
let lastKey = null

export function getSupabase() {
  const { url, anonKey } = getStoredSupabaseConfig()
  if (!url || !anonKey) return null

  if (cachedClient && lastUrl === url && lastKey === anonKey) {
    return cachedClient
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
    lastUrl = url
    lastKey = anonKey
    return cachedClient
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err)
    return null
  }
}

export function saveSupabaseConfig(url, anonKey) {
  const cleanUrl = sanitizeSupabaseUrl(url)
  const cleanKey = (anonKey || '').trim()

  if (cleanUrl && cleanKey) {
    localStorage.setItem(STORAGE_URL_KEY, cleanUrl)
    localStorage.setItem(STORAGE_KEY_KEY, cleanKey)
  } else {
    localStorage.removeItem(STORAGE_URL_KEY)
    localStorage.removeItem(STORAGE_KEY_KEY)
  }
  cachedClient = null
  lastUrl = null
  lastKey = null
  return getSupabase()
}
