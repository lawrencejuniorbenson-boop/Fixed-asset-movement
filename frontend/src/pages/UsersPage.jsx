import { useState, useEffect } from 'react'
import { Plus, Search, X, ShieldAlert, Users as UsersIcon, Pencil, Trash2 } from 'lucide-react'
import api from '../api/client'
import { useAuth, errorText } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { ROLES, roleLabel, canManageUsers } from '../lib/workflow'

const EMPTY = { name: '', email: '', role: 'requesting_officer', department: '', staff_id: '' }

function UserDialog({ initial, onClose, onSaved, openMode }) {
  const toast = useToast()
  const editing = !!initial?.id
  const [form, setForm] = useState(initial?.id ? { ...EMPTY, ...initial } : EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (editing) {
        await api.post(`/users/${initial.id}`, { name: form.name, role: form.role, department: form.department, staff_id: form.staff_id })
        toast.success(`${form.name} updated.`)
      } else {
        await api.post('/users', form)
        toast.success(openMode
          ? `${form.name} added. They can now be chosen under “Acting as”.`
          : `${form.name} added.`)
      }
      await onSaved()
      onClose()
    } catch (err) {
      toast.error(errorText(err, 'Could not save.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="user-dialog-title" className="section-title">{editing ? 'Edit user' : 'Add user'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="u-name">Full name</label>
            <input id="u-name" className="input-field" value={form.name} onChange={set('name')} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="u-email">Work email</label>
            <input id="u-email" type="email" className="input-field" value={form.email} onChange={set('email')} required disabled={editing} />
            {editing && <p className="hint">Email can't be changed here.</p>}
          </div>
          <div>
            <label className="label" htmlFor="u-role">Role</label>
            <select id="u-role" className="input-field" value={form.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="u-dept">Department</label>
              <input id="u-dept" className="input-field" value={form.department || ''} onChange={set('department')} />
            </div>
            <div>
              <label className="label" htmlFor="u-staff">Staff ID</label>
              <input id="u-staff" className="input-field" value={form.staff_id || ''} onChange={set('staff_id')} />
            </div>
          </div>
          {!editing && !openMode && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              This adds a staff profile (for names, roles and assignments). In this demo version only the administrator signs in.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add user'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { user, mode, reloadStaff } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null) // null | {} (add) | user (edit)
  const openMode = mode === 'open'

  const load = async () => {
    try {
      const res = await api.get('/users')
      setUsers(res.data?.data || [])
    } catch (err) {
      toast.error(errorText(err, 'Could not load users.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (canManageUsers(user)) load(); else setLoading(false) }, [user?.id])

  if (!canManageUsers(user)) {
    return (
      <div className="card text-center">
        <ShieldAlert className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-slate-600">Only administrators can manage users.</p>
      </div>
    )
  }

  const afterChange = async () => {
    await load()
    if (openMode) await reloadStaff().catch(() => {})
  }

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}?\n\nTheir past requests and audit entries stay, but will no longer be linked to a staff profile. To keep the history linked, change their role instead.`)) return
    try {
      await api.delete(`/users/${u.id}`)
      toast.success(`${u.name} removed.`)
      await afterChange()
    } catch (err) {
      toast.error(errorText(err, 'Could not remove this user.'))
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = users.filter((u) => !q || [u.name, u.email, u.department, u.staff_id, roleLabel(u.role)].join(' ').toLowerCase().includes(q))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{users.length} staff profile{users.length === 1 ? '' : 's'}. Roles decide what each person can approve.</p>
        </div>
        <button type="button" onClick={() => setDialog({})} className="btn-primary self-start">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add user
        </button>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, role, department…" className="input-field pl-9" aria-label="Search users" />
          </div>
        </div>
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <li key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600" aria-hidden="true">
                  {u.name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {u.name}{String(u.id) === String(user?.id) && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500"><span className="sm:hidden">{roleLabel(u.role)} · </span>{[u.email, u.department, u.staff_id].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="badge badge-gray hidden sm:inline-flex">{roleLabel(u.role)}</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setDialog(u)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit ${u.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  {String(u.id) !== String(user?.id) && (
                    <button type="button" onClick={() => remove(u)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${u.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && <UserDialog initial={dialog} openMode={openMode} onClose={() => setDialog(null)} onSaved={afterChange} />}
    </div>
  )
}
