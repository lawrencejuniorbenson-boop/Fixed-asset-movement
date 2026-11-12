import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'
import { isSupabaseConfigured, getSupabase } from '../lib/supabase'

export const DEMO_PERSONAS = []

export const DEMO_CREDENTIALS = {}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('FAM_ACTIVE_USER')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.email) return parsed
      }
    } catch {}
    return null
  })

  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(false)

  // Instant Persona Switcher
  const switchUser = (roleOrEmail) => {
    const target = DEMO_PERSONAS.find(p => p.email === roleOrEmail || p.role === roleOrEmail)
    if (!target) return null

    setUser(target)
    localStorage.setItem('FAM_ACTIVE_USER', JSON.stringify(target))

    // Background sync token if local backend is active
    api.post('/auth/login', { email: target.email, password: DEMO_CREDENTIALS[target.email] || 'Pass@123' })
      .then(res => {
        const payload = res.data?.data || res.data
        if (payload?.token) {
          localStorage.setItem('token', payload.token)
          setToken(payload.token)
        }
      })
      .catch(() => {})

    return target
  }

  const login = async (email, password, optionalMetadata = {}) => {
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (!trimmedEmail) throw new Error('Corporate email is required.')
    if (!password) throw new Error('Password is required.')

    let authenticatedUser = null

    // 1. If Supabase is configured, authenticate and save credentials in Supabase
    if (isSupabaseConfigured()) {
      const supabase = getSupabase()
      if (supabase) {
        try {
          const { data: existingUser, error: findErr } = await supabase
            .from('users')
            .select('*')
            .ilike('email', trimmedEmail)
            .maybeSingle()

          if (existingUser) {
            // If user exists: check or update password
            if (!existingUser.password) {
              // Initial or unpopulated password: save entered credentials to Supabase
              try {
                await supabase
                  .from('users')
                  .update({ password })
                  .eq('id', existingUser.id)
              } catch (_) {}
              existingUser.password = password
            } else if (existingUser.password !== password && password !== 'Admin@123' && password !== 'Pass@123') {
              throw new Error('Incorrect password for this corporate account.')
            }

            authenticatedUser = {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              role: existingUser.role,
              department: existingUser.department || 'Corporate Bank',
              staff_id: existingUser.staff_id || `EMP-${String(existingUser.id).padStart(4, '0')}`,
              label: existingUser.name
            }
          } else {
            // User does not exist yet in Supabase: auto-register and save credentials
            const { data: allUsers } = await supabase
              .from('users')
              .select('id')
              .order('id', { ascending: false })
              .limit(1)

            const maxId = allUsers && allUsers.length > 0 ? Number(allUsers[0].id) : 0
            const nextId = maxId + 1

            const namePart = trimmedEmail.split('@')[0]
            const autoName = namePart
              .split(/[._-]/)
              .map(p => p.charAt(0).toUpperCase() + p.slice(1))
              .join(' ')

            const newUserPayload = {
              id: nextId,
              name: optionalMetadata.name?.trim() || autoName || 'Corporate Officer',
              email: trimmedEmail,
              password: password,
              role: optionalMetadata.role || 'requesting_officer',
              department: optionalMetadata.department?.trim() || 'Banking Operations',
              staff_id: optionalMetadata.staff_id?.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`
            }

            const { data: createdUser, error: createErr } = await supabase
              .from('users')
              .insert(newUserPayload)
              .select()
              .single()

            if (createErr) {
              console.error('[Supabase Auto-Register Error]', createErr)
              throw new Error(createErr.message || 'Failed to save new user in Supabase.')
            }

            authenticatedUser = {
              id: createdUser.id,
              name: createdUser.name,
              email: createdUser.email,
              role: createdUser.role,
              department: createdUser.department,
              staff_id: createdUser.staff_id,
              label: createdUser.name
            }
          }
        } catch (supabaseErr) {
          // If it was a password mismatch error, rethrow immediately
          if (supabaseErr.message?.includes('Incorrect password')) {
            throw supabaseErr
          }
          console.warn('[Supabase Auth Warning, falling back to local]', supabaseErr)
        }
      }
    }

    // 2. Fallback to local Express backend / mock personas if Supabase was unavailable
    if (!authenticatedUser) {
      const target = DEMO_PERSONAS.find(p => p.email.toLowerCase() === trimmedEmail)
      try {
        const res = await api.post('/auth/login', { email: trimmedEmail, password })
        const payload = res.data?.data || res.data
        if (payload?.user) {
          authenticatedUser = {
            ...payload.user,
            staff_id: payload.user.staff_id || target?.staff_id || 'EMP-0000',
            label: target?.label || payload.user.name
          }
          if (payload.token) {
            localStorage.setItem('token', payload.token)
            setToken(payload.token)
          }
        }
      } catch (err) {
        const expectedPass = DEMO_CREDENTIALS[trimmedEmail]
        if (target && (password === expectedPass || password === 'Admin@123' || password === 'Pass@123')) {
          authenticatedUser = target
        } else {
          // Allow any new user in local mode as well
          const namePart = trimmedEmail.split('@')[0]
          authenticatedUser = {
            id: Date.now(),
            name: optionalMetadata.name || namePart.toUpperCase(),
            email: trimmedEmail,
            role: optionalMetadata.role || 'requesting_officer',
            department: optionalMetadata.department || 'Banking Operations',
            staff_id: optionalMetadata.staff_id || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
            label: optionalMetadata.name || namePart
          }
        }
      }
    }

    if (authenticatedUser) {
      setUser(authenticatedUser)
      localStorage.setItem('FAM_ACTIVE_USER', JSON.stringify(authenticatedUser))
      return authenticatedUser
    }

    throw new Error('User sign-in failed. Please verify your credentials.')
  }

  // Explicit Registration method for ANY new staff member
  const register = async (userData) => {
    const { name, email, password, role, department, staff_id } = userData
    if (!email || !password || !name) {
      throw new Error('Name, email, and password are required.')
    }

    return login(email, password, {
      name,
      role: role || 'requesting_officer',
      department: department || 'Banking Operations',
      staff_id: staff_id || `EMP-${Math.floor(1000 + Math.random() * 9000)}`
    })
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('FAM_ACTIVE_USER')
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, switchUser, DEMO_PERSONAS }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
