import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabaseConfigured, getSupabase } from '../lib/supabase'
import { setApiUser } from '../api/client'

/**
 * Two access modes, chosen in the database (private.settings.access_mode):
 *  - 'login': staff sign in with Supabase Auth.
 *  - 'open' : no login page. The browser gets an anonymous Supabase session and
 *             picks which staff profile to act as. The database still enforces
 *             every workflow rule for that profile.
 */

const AuthContext = createContext(null)
const ACTING_KEY = 'FAM_ACTING_USER_ID'

const storage = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* ignore */ } }
}

// Turn any thrown value (Error, Supabase error, Vercel error object) into
// readable text, so the UI never shows "[object Object]".
export function errorText(err, fallback = 'Something went wrong. Please try again.') {
  const candidates = [err?.response?.data?.error, err?.response?.data?.message, err?.message, err]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
    if (c && typeof c === 'object' && typeof c.message === 'string' && c.message.trim()) return c.message
  }
  return fallback
}

function toAppUser(p) {
  if (!p) return null
  return {
    id: Number(p.id),
    name: p.name,
    email: p.email,
    role: p.role,
    department: p.department || '',
    staff_id: p.staff_id || ''
  }
}

async function loadMyProfile(supabase) {
  const { data, error } = await supabase.rpc('my_profile')
  if (error) throw error
  return toAppUser(Array.isArray(data) ? data[0] : data)
}

function pickDefault(staff) {
  const saved = Number(storage.get(ACTING_KEY))
  return (
    staff.find((s) => Number(s.id) === saved) ||
    staff.find((s) => s.role === 'admin') ||
    staff[0] ||
    null
  )
}

export function AuthProvider({ children }) {
  const [mode, setMode] = useState(supabaseConfigured ? 'loading' : 'unconfigured')
  const [user, setUser] = useState(null)
  const [staff, setStaff] = useState([])
  const [setupError, setSetupError] = useState('')

  const supabase = getSupabase()
  // Assigned during render (not in an effect) so pages loading data in their
  // own effects already see the current user.
  setApiUser(user)

  const actAs = useCallback(async (id) => {
    const { error } = await supabase.rpc('open_access_act_as', { p_user_id: Number(id) })
    if (error) throw error
    const profile = await loadMyProfile(supabase)
    storage.set(ACTING_KEY, String(id))
    setUser(profile)
    return profile
  }, [supabase])

  const loadStaff = useCallback(async () => {
    const { data, error } = await supabase.rpc('open_access_staff')
    if (error) throw error
    const list = (data || []).map(toAppUser)
    setStaff(list)
    return list
  }, [supabase])

  const startOpenMode = useCallback(async () => {
    let { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        throw new Error(
          `Could not start a session (${errorText(error)}). In Supabase, enable ` +
          'Authentication → Sign In / Providers → "Allow anonymous sign-ins".'
        )
      }
      session = data.session
    }
    // A real staff account that is already signed in keeps its own identity.
    if (!session.user?.is_anonymous) {
      const profile = await loadMyProfile(supabase)
      if (profile) {
        setUser(profile)
        await loadStaff().catch(() => setStaff([]))
        return
      }
    }
    const list = await loadStaff()
    const choice = pickDefault(list)
    if (choice) await actAs(choice.id)
    else setUser(null) // no staff yet: the app shows first-time setup
  }, [supabase, actAs, loadStaff])

  const startLoginMode = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user && !session.user.is_anonymous) {
      setUser(await loadMyProfile(supabase))
    } else {
      if (session?.user?.is_anonymous) await supabase.auth.signOut()
      setUser(null)
    }
  }, [supabase])

  const boot = useCallback(async () => {
    if (!supabase) return
    setSetupError('')
    try {
      const { data, error } = await supabase.rpc('app_mode')
      if (error) {
        throw new Error(
          /app_mode|function/i.test(error.message || '')
            ? 'The database is not set up yet. Run supabase_schema.sql in the Supabase SQL Editor.'
            : errorText(error)
        )
      }
      const m = data === 'open' ? 'open' : 'login'
      if (m === 'open') await startOpenMode()
      else await startLoginMode()
      setMode(m)
    } catch (err) {
      console.error('[Auth] start-up failed', err)
      setSetupError(errorText(err))
      setMode('error')
    }
  }, [supabase, startOpenMode, startLoginMode])

  useEffect(() => { boot() }, [boot])

  // Keep login mode in sync with sign-in / sign-out in other tabs.
  useEffect(() => {
    if (!supabase || mode !== 'login') return
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null)
    })
    return () => sub?.subscription?.unsubscribe()
  }, [supabase, mode])

  // ── Open mode ──────────────────────────────────────────────────────────────
  const switchUser = async (id) => actAs(id)

  const bootstrapAdmin = async ({ name, email }) => {
    const { data, error } = await supabase.rpc('open_access_bootstrap_admin', { p_name: name, p_email: email })
    if (error) throw error
    await loadStaff()
    return actAs(data)
  }

  // ── Login mode ─────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (!trimmedEmail || !password) throw new Error('Email and password are required.')
    const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
    if (error) {
      if (/confirm/i.test(error.message)) throw new Error('Please confirm your email address first, then sign in.')
      throw new Error('Invalid email or password.')
    }
    const profile = await loadMyProfile(supabase)
    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('Your account is not activated. Ask an administrator to register your email.')
    }
    setUser(profile)
    return profile
  }

  // Self sign-up always creates a Requesting Officer; admins assign other roles.
  const register = async ({ name, email, password, department, staff_id }) => {
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (!trimmedEmail || !password || !name) throw new Error('Name, email and password are required.')
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { name: name.trim(), department: (department || '').trim(), staff_id: (staff_id || '').trim() },
        emailRedirectTo: window.location.origin
      }
    })
    if (error) throw new Error(errorText(error, 'Registration failed.'))
    if (!data.session) return { needsConfirmation: true }
    const profile = await loadMyProfile(supabase)
    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('Account created, but it is not activated yet. Please contact an administrator.')
    }
    setUser(profile)
    return { user: profile }
  }

  const logout = async () => {
    try { await supabase?.auth.signOut() } catch { /* ignore */ }
    setUser(null)
  }

  const value = {
    mode,
    user,
    loading: mode === 'loading',
    setupError,
    staff,
    retry: boot,
    switchUser,
    bootstrapAdmin,
    reloadStaff: loadStaff,
    login,
    register,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
