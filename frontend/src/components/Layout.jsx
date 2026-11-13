import React, { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FilePlus2, FileText, Truck, Server, Users, ShieldCheck,
  Menu, X, LogOut, Boxes, UserRound, TriangleAlert
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  ROLES, roleLabel, canCreateRequest, canSeeAudit, canManageUsers,
  isAdmin, isTransport, isIt, isRequester
} from '../lib/workflow'

function navFor(user) {
  const items = [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }]
  if (canCreateRequest(user)) items.push({ to: '/requests/new', icon: FilePlus2, label: 'New request' })
  items.push({ to: '/requests', icon: FileText, label: isRequester(user) ? 'My requests' : 'Requests', match: (p) => p.startsWith('/requests') && !p.startsWith('/requests/new') })
  if (isAdmin(user) || isTransport(user)) items.push({ to: '/transport', icon: Truck, label: 'Transport', match: (p) => p.startsWith('/transport') })
  if (isAdmin(user) || isIt(user)) items.push({ to: '/it-logistics', icon: Server, label: 'IT', match: (p) => p.startsWith('/it-logistics') })
  if (canSeeAudit(user)) items.push({ to: '/audit', icon: ShieldCheck, label: 'Audit trail' })
  if (canManageUsers(user)) items.push({ to: '/admin/users', icon: Users, label: 'Users' })
  return items
}

function ActingAsSwitcher({ compact = false }) {
  const { user, staff, switchUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const onChange = async (e) => {
    setBusy(true)
    try {
      const u = await switchUser(e.target.value)
      toast.success(`Now acting as ${u.name} (${roleLabel(u.role)})`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Could not switch user.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="block">
      {!compact && <span className="mb-1 block text-xs font-medium text-slate-500">Acting as</span>}
      <select
        value={user?.id ?? ''}
        onChange={onChange}
        disabled={busy}
        aria-label="Acting as"
        className="input-field py-1.5 pr-8 text-[13px]"
      >
        {ROLES.map((r) => {
          const people = staff.filter((s) => s.role === r.value)
          if (!people.length) return null
          return (
            <optgroup key={r.value} label={r.label}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}

export default function Layout({ children }) {
  const { user, mode, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items = navFor(user)
  const openMode = mode === 'open'

  useEffect(() => setOpen(false), [location.pathname])

  const isActive = (item) => (item.match ? item.match(location.pathname) : location.pathname === item.to)

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Boxes className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Asset Movement</p>
          <p className="text-xs text-slate-500">Fixed asset register</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {items.map((item) => {
          const active = isActive(item)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        {openMode ? (
          <ActingAsSwitcher />
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {user?.name?.charAt(0) || <UserRound className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{roleLabel(user?.role)}</p>
            </div>
            <button
              type="button"
              onClick={async () => { await logout(); navigate('/login') }}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col print:block">
      {openMode && (
        <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 print:hidden">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Open access: no sign-in required. Anyone with this link can act as any user.</span>
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block print:hidden">
          <div className="sticky top-0 h-screen">{sidebar}</div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden print:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden print:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{roleLabel(user?.role)}</p>
            </div>
            {openMode && (
              <div className="w-40 shrink-0">
                <ActingAsSwitcher compact />
              </div>
            )}
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
