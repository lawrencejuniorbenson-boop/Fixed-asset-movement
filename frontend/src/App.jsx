import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Boxes, Settings2, CircleAlert, RotateCw } from 'lucide-react'
import { useAuth, errorText } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewRequestPage from './pages/NewRequestPage'
import RequestDetailPage from './pages/RequestDetailPage'
import RequestsPage from './pages/RequestsPage'
import TransportPage from './pages/TransportPage'
import TransportDetailPage from './pages/TransportDetailPage'
import UsersPage from './pages/UsersPage'
import AuditLogPage from './pages/AuditLogPage'

function CenteredCard({ icon: Icon, tone = 'blue', title, children }) {
  const toneCls = tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="card w-full max-w-lg">
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${toneCls}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <div className="mt-2 space-y-3 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  )
}

function NotConfigured() {
  return (
    <CenteredCard icon={Settings2} title="Supabase is not configured">
      <p>This site was built without its database connection settings.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>In Vercel, open the project, then <strong>Settings → Environment Variables</strong>.</li>
        <li>Add <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> (Supabase → Project Settings → API; use the anon/publishable key).</li>
        <li>Redeploy. The values are built into the page, so a redeploy is required.</li>
      </ol>
    </CenteredCard>
  )
}

function StartupError() {
  const { setupError, retry } = useAuth()
  return (
    <CenteredCard icon={CircleAlert} tone="red" title="The app could not start">
      <p className="rounded-lg bg-red-50 p-3 text-red-800">{setupError}</p>
      <button type="button" onClick={retry} className="btn-secondary">
        <RotateCw className="h-4 w-4" /> Try again
      </button>
    </CenteredCard>
  )
}

function FirstRun() {
  const { bootstrapAdmin } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await bootstrapAdmin({ name, email })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenteredCard icon={Boxes} title="Set up the first administrator">
      <p>There are no staff profiles yet. Create the administrator profile; you can add everyone else from the Users page.</p>
      <form onSubmit={submit} className="space-y-4 pt-2">
        <div>
          <label className="label" htmlFor="fr-name">Full name</label>
          <input id="fr-name" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="fr-email">Work email</label>
          <input id="fr-email" type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Creating…' : 'Create administrator'}</button>
      </form>
    </CenteredCard>
  )
}

export default function App() {
  const { user, mode } = useAuth()

  if (mode === 'unconfigured') return <NotConfigured />
  if (mode === 'loading') return <Loading />
  if (mode === 'error') return <StartupError />
  if (mode === 'open' && !user) return <FirstRun />

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/requests/new" element={<NewRequestPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route path="/transport" element={<TransportPage />} />
        <Route path="/transport/:id" element={<TransportDetailPage />} />
        <Route path="/it-logistics" element={<TransportPage />} />
        <Route path="/it-logistics/:id" element={<TransportDetailPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}
