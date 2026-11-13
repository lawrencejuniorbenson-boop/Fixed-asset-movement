import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { isSupabaseConfigured, getSupabase } from '../lib/supabase'

const AuthContext = createContext(null)
const USER_CACHE_KEY = 'FAM_ACTIVE_USER'

function toAppUser(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    department: profile.department || '',
    staff_id: profile.staff_id || `EMP-${String(profile.id).padStart(4, '0')}`,
    label: profile.name
  }
}

// Load the staff profile (and role) linked to a Supabase Auth user.
// The role always comes from the database, never from the browser.
async function fetchProfile(supabase, authUserId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, department, staff_id')
    .eq('auth_id', authUserId)
    .maybeSingle()
  if (error) throw error
  return data ? toAppUser(data) : null
}

function cacheUser(u) {
  // Cache is for display/routing only. Authorization is enforced by the
  // database (RLS) for Supabase, and by the JWT for the local backend.
  if (u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_CACHE_KEY)
}

export function AuthProvider({ children }) {
  const supabaseMode = isSupabaseConfigured()

  const [user, setUser] = useState(() => {
    // Local backend mode: restore the cached user only if a JWT exists.
    if (supabaseMode || !localStorage.getItem('token')) return null
    try {
      const parsed = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null')
      return parsed?.email ? parsed : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  // In Supabase mode we must wait for the stored session to be verified.
  const [loading, setLoading] = useState(supabaseMode)

  const applyUser = useCallback((u) => {
    setUser(u)
    cacheUser(u)
  }, [])

  // Supabase session restore + live auth state
  useEffect(() => {
    if (!supabaseMode) return
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true

    const syncFromSession = async (session) => {
      try {
        const profile = session?.user ? await fetchProfile(supabase, session.user.id) : null
        if (active) applyUser(profile)
      } catch (err) {
        console.error('[Auth] Failed to load profile', err)
        if (active) applyUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => syncFromSession(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        applyUser(null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Defer: calling Supabase inside this callback can deadlock the client.
        setTimeout(() => syncFromSession(session), 0)
      }
    })

    return () => {
      active = false
      sub?.subscription?.unsubscribe()
    }
  }, [supabaseMode, applyUser])

  const login = async (email, password) => {
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (!trimmedEmail) throw new Error('Corporate email is required.')
    if (!password) throw new Error('Password is required.')

    if (supabaseMode) {
      const supabase = getSupabase()
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      if (error) {
        if (/confirm/i.test(error.message)) {
          throw new Error('Please confirm your email address first (check your inbox), then sign in.')
        }
        throw new Error('Invalid email or password.')
      }
      const profile = await fetchProfile(supabase, data.user.id)
      if (!profile) {
        await supabase.auth.signOut()
        throw new Error('Your account is not activated. Ask an administrator to register your email.')
      }
      applyUser(profile)
      return profile
    }

    // Local Express backend (development only): bcrypt + JWT on the server.
    let res
    try {
      res = await api.post('/auth/login', { email: trimmedEmail, password })
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Sign-in failed. Is the local backend running?')
    }
    const payload = res.data?.data || res.data
    if (!payload?.user || !payload?.token) throw new Error('Invalid email or password.')
    localStorage.setItem('token', payload.token)
    setToken(payload.token)
    const authenticatedUser = toAppUser(payload.user)
    applyUser(authenticatedUser)
    return authenticatedUser
  }

  // Self-registration. Every new account starts as a Requesting Officer;
  // only an administrator can grant other roles.
  // Returns { user } when signed in, or { needsConfirmation: true }.
  const register = async ({ name, email, password, department, staff_id }) => {
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (!trimmedEmail || !password || !name) {
      throw new Error('Name, email, and password are required.')
    }
    if (!supabaseMode) {
      throw new Error('Self-registration requires Supabase. Ask an administrator to create your account.')
    }

    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { name: name.trim(), department: (department || '').trim(), staff_id: (staff_id || '').trim() },
        emailRedirectTo: window.location.origin
      }
    })
    if (error) throw new Error(error.message || 'Registration failed.')

    if (!data.session) {
      return { needsConfirmation: true }
    }
    const profile = await fetchProfile(supabase, data.user.id)
    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('Account created, but it is not activated yet. Please contact an administrator.')
    }
    applyUser(profile)
    return { user: profile }
  }

  const logout = async () => {
    if (supabaseMode) {
      try {
        await getSupabase()?.auth.signOut()
      } catch (err) {
        console.warn('[Auth] signOut failed', err)
      }
    }
    applyUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
