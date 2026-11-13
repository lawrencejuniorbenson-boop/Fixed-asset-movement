import { useState, useEffect } from 'react'
import { Users, Plus, X, Eye, EyeOff, UserCheck, ShieldAlert, Trash2 } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import LoadingSkeleton from '../components/LoadingSkeleton'

const ROLES = [
  { value: 'requesting_officer', label: 'Requesting Officer' },
  { value: 'department_head', label: 'Requesting Department Head' },
  { value: 'ama_officer', label: 'AMA Officer (Asset Management & Archives Pool)' },
  { value: 'ama_head', label: 'AMA Head (Asset Management & Archives Pool)' },
  { value: 'transport_head', label: 'Transport Head (Transport & Logistics Pool)' },
  { value: 'transport_officer', label: 'Transport Officer (Transport & Logistics Pool)' },
  { value: 'it_head', label: 'IT Head (IT Infrastructure Pool)' },
  { value: 'it_officer', label: 'IT Officer (IT Infrastructure Pool)' },
  { value: 'auditor', label: 'Internal Auditor' },
  { value: 'admin', label: 'Administrator' }
]

const DEFAULT_FORM = { name: '', email: '', password: '', role: 'requesting_officer', department: '', staff_id: '' }

export default function UsersPage() {
  // With Supabase, passwords are owned by Supabase Auth: the admin pre-registers
  // the email + role, and the staff member signs up with that email to activate it.
  const supabaseMode = isSupabaseConfigured()
  const { user } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const load = async () => {
    if (user?.role !== 'admin') {
      setLoading(false)
      return
    }
    try {
      const res = await api.get('/users')
      const list = res.data?.data || res.data?.users || res.data || []
      setUsers(list)
    } catch {
      toast.error('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.role])

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-red-200 p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-sm text-slate-600 mb-4">
          The User Directory and Account Administration are strictly reserved for the System Administrator.
        </p>
      </div>
    )
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    if (!supabaseMode && (!form.password || form.password.length < 8)) e.password = 'Password must be at least 8 characters.'
    if (!form.role) e.role = 'Role is required.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setFormErrors(e2); return }
    setSubmitting(true)
    try {
      const { password, ...profile } = form
      await api.post('/users', supabaseMode ? profile : form)
      toast.success(supabaseMode
        ? `"${form.name}" pre-registered. They must now sign up with ${form.email.trim().toLowerCase()} and confirm the email to activate the account.`
        : `User "${form.name}" created.`)
      setShowModal(false)
      setForm(DEFAULT_FORM)
      setFormErrors({})
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setFormErrors((p) => ({ ...p, [name]: '' }))
  }

  const handleDeleteUser = async (u) => {
    if (String(u.id) === String(user?.id)) {
      toast.error('You cannot delete your own active administrator account.')
      return
    }
    if (!window.confirm(`Remove user "${u.name}" (${u.email}) from the directory?`)) return
    try {
      await api.delete(`/users/${u.id}`)
      toast.success(`User "${u.name}" removed.`)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to delete user.')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">User Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">{users.length} registered system users</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8"><LoadingSkeleton rows={6} cols={5} /></div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-blue-50/70 border-b border-blue-100 text-blue-900 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left px-6 py-3">User</th>
                  <th className="text-left px-6 py-3">Email</th>
                  <th className="text-left px-6 py-3">Role</th>
                  <th className="text-left px-6 py-3">Department</th>
                  <th className="text-right px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50/80">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-6 py-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[11px]">
                          {u.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block">{u.name}</span>
                          {u.staff_id && (
                            <span className="text-[10px] font-mono text-blue-600 block">{u.staff_id}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 font-mono text-[11px]">
                      {u.email}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-[11px] font-medium text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                        {ROLES.find((r) => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-[11px]">
                      {u.department || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {String(u.id) !== String(user?.id) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded hover:bg-rose-50 transition"
                          title="Delete user"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-blue-950/30 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-blue-200 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Add New User</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="label">Full Name <span className="text-rose-500">*</span></label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Enter full name"
                />
                {formErrors.name && <p className="mt-1 text-[11px] text-rose-500">{formErrors.name}</p>}
              </div>

              <div>
                <label className="label">Email Address <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="user@company.com"
                />
                {formErrors.email && <p className="mt-1 text-[11px] text-rose-500">{formErrors.email}</p>}
              </div>

              {supabaseMode ? (
                <p className="text-[11px] text-slate-500 bg-blue-50 border border-blue-100 rounded-lg p-2.5 leading-relaxed">
                  No password is set here. After you save, ask this person to use <strong>Create Account</strong> on the
                  sign-in page with this exact email. Once they confirm their email, they get the role you choose below.
                </p>
              ) : (
              <div>
                <label className="label">Password <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="input-field pr-9"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formErrors.password && <p className="mt-1 text-[11px] text-rose-500">{formErrors.password}</p>}
              </div>
              )}

              <div>
                <label className="label">Role <span className="text-rose-500">*</span></label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="input-field cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Department</label>
                  <input
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g. IT / Operations"
                  />
                </div>
                <div>
                  <label className="label">Staff ID</label>
                  <input
                    name="staff_id"
                    value={form.staff_id}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Saving...' : (supabaseMode ? 'Pre-register User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
