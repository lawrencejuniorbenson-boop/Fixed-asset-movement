import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Truck,
  Users,
  Menu,
  Server,
  Building2,
  ShieldCheck,
  LogOut
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  requesting_officer: 'Requesting Officer',
  department_head: 'Requesting Department Head',
  ama_officer: 'Asset Management \& Archives Department',
  ama_head: 'Asset Management \& Archives Department',
  transport_head: 'Transport & Logistics Department',
  transport_officer: 'Transport & Logistics Department',
  it_head: 'IT Infrastructure Department',
  it_officer: 'IT Infrastructure Department',
  admin: 'Administrator',
  auditor: 'Internal Auditor'
}

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
            : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/70'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = user?.role
  const userDept = user?.department || ''
  const isAdmin = role === 'admin'
  const isAuditor = role === 'auditor'
  const isRequester = role === 'requesting_officer'
  const isDeptHead = role === 'department_head'
  const isAma = role === 'ama_officer' || role === 'ama_head' || userDept.includes('Asset') || userDept.includes('Archive') || userDept.includes('AMA')
  const isTransport = role === 'transport_head' || role === 'transport_officer' || userDept.includes('Transport') || userDept.includes('Logistics') || userDept.includes('Fleet')
  const isIt = role === 'it_head' || role === 'it_officer' || userDept.includes('IT') || userDept.includes('Information')

  const isAuditAuthorized = isAdmin || isAuditor

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isAdmin || isRequester ? [{ to: '/requests/new', icon: FilePlus, label: 'New Movement Request' }] : []),
    ...(isAdmin || isRequester || isDeptHead || isAma || isAuditor ? [{
      to: '/requests',
      icon: FileText,
      label: isRequester
        ? 'My Movement Requests'
        : isDeptHead
        ? 'Department Approvals'
        : isAma
        ? 'Asset Movement Requests'
        : isAuditor
        ? 'Movement Requests (Audit)'
        : 'Movement Requests'
    }] : []),
    ...(isAdmin || isTransport ? [{ to: '/transport', icon: Truck, label: 'Transport Logistics' }] : []),
    ...(isAdmin || isIt ? [{ to: '/it-logistics', icon: Server, label: 'IT Equipment Logistics' }] : []),
    ...(isAuditAuthorized ? [{ to: '/audit', icon: ShieldCheck, label: 'Audit Trail & Compliance' }] : []),
    ...(isAdmin ? [{ to: '/admin/users', icon: Users, label: 'User Directory' }] : [])
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-blue-100">
      {/* Brand Header */}
      <div className="p-5 border-b border-blue-100/80 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-blue-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-blue-950 tracking-tight">Fixed Asset Movement</h2>
            <p className="text-[10px] text-blue-600 font-medium">Enterprise Service</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
          Navigation Menu
        </p>
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
        ))}
      </div>

      {/* Current Active Persona Card */}
      <div className="p-3 border-t border-blue-100 bg-blue-50/40">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-blue-100 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs font-semibold text-blue-950 truncate">{user?.name}</p>
            </div>
            <p className="text-[10px] text-blue-600 font-medium truncate">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            title="Sign Out of Portal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50/70 font-sans antialiased text-slate-900 print:h-auto print:bg-white">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-blue-950/20 z-20 lg:hidden backdrop-blur-2xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white transition-transform duration-200 lg:hidden shadow-xl print:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 print:hidden">
        <SidebarContent />
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        {/* Top Header */}
        <header className="bg-white border-b border-blue-100 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-900">Fixed Asset Portal</span>
              <span className="text-blue-300">/</span>
              <span className="text-slate-600">Enterprise Service</span>
            </div>
          </div>

          {/* Quick Persona Switcher & Integrations */}
          <div className="flex items-center gap-2.5">
            {/* Logged In User & Role Badge */}
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-bold text-slate-700">
                {user?.name}
              </span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-full border border-blue-200">
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
              title="Sign Out of Portal"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0 print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  )
}
