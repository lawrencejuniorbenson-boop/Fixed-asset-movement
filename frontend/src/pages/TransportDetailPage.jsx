import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { ArrowLeft, CalendarCheck, PackageCheck, Truck, Hourglass, ChevronRight } from 'lucide-react'
import api from '../api/client'
import { useAuth, errorText } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import StatusBadge from '../components/StatusBadge'
import { Route } from '../components/RequestList'
import { CardSkeleton } from '../components/LoadingSkeleton'
import { formatDate, formatDateTime, todayISO } from '../lib/format'
import { canWorkTask } from '../lib/workflow'

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || '—'}</dd>
    </div>
  )
}

function AssignForm({ task, user, onDone }) {
  const toast = useToast()
  const itTask = task.fulfillment_type === 'it'
  const [officers, setOfficers] = useState([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    assigned_officer_id: task.assigned_officer_id ? String(task.assigned_officer_id) : '',
    vehicle_details: task.vehicle_details || '',
    driver_name: task.driver_name || '',
    scheduled_date: task.scheduled_date || todayISO(),
    assessment_notes: task.assessment_notes || ''
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    api.get(itTask ? '/it-logistics/officers?type=it' : '/transport/officers')
      .then((res) => {
        const list = res.data?.data || []
        setOfficers(list)
        setForm((f) => {
          if (f.assigned_officer_id) return f
          const me = list.find((o) => String(o.id) === String(user?.id))
          return { ...f, assigned_officer_id: me ? String(me.id) : '' }
        })
      })
      .catch(() => setOfficers([]))
  }, [itTask, user?.id])

  const submit = async (e) => {
    e.preventDefault()
    const officer = officers.find((o) => String(o.id) === form.assigned_officer_id)
    if (!officer) return toast.error('Choose the officer who will do the move.')
    if (!form.vehicle_details.trim()) return toast.error(itTask ? 'Describe how the equipment will be carried.' : 'Enter the vehicle details.')
    setBusy(true)
    try {
      await api.post(`/transport/${task.id}/assign`, {
        ...form,
        assigned_officer_id: officer.id,
        assigned_officer_name: officer.name,
        driver_type: form.driver_name.trim() ? 'assigned' : 'vendor'
      })
      toast.success('Move scheduled.')
      await onDone()
    } catch (err) {
      toast.error(errorText(err, 'Could not save the assignment.'))
    } finally {
      setBusy(false)
    }
  }

  const rescheduling = task.status === 'officer_assigned'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="officer">Officer</label>
          <select id="officer" className="input-field" value={form.assigned_officer_id} onChange={set('assigned_officer_id')} required>
            <option value="">Choose an officer…</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{String(o.id) === String(user?.id) ? ' (me)' : ''}</option>
            ))}
          </select>
          {officers.length === 0 && <p className="hint">No {itTask ? 'IT' : 'transport'} officers found. An admin can add them on the Users page.</p>}
        </div>
        <div>
          <label className="label" htmlFor="date">Move date</label>
          <input id="date" type="date" className="input-field" value={form.scheduled_date} onChange={set('scheduled_date')} required />
        </div>
        <div>
          <label className="label" htmlFor="vehicle">{itTask ? 'Carrier / vehicle' : 'Vehicle'}</label>
          <input id="vehicle" className="input-field" value={form.vehicle_details} onChange={set('vehicle_details')} placeholder={itTask ? 'e.g. IT van GT-4410-22' : 'e.g. Isuzu NPR GR-2231-21'} required />
        </div>
        <div>
          <label className="label" htmlFor="driver">Driver or contractor <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="driver" className="input-field" value={form.driver_name} onChange={set('driver_name')} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Handling notes <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea id="notes" rows={2} className="input-field" value={form.assessment_notes} onChange={set('assessment_notes')} placeholder="Padding, porters, access times…" />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : rescheduling ? 'Update schedule' : 'Schedule move'}
        </button>
      </div>
    </form>
  )
}

export default function TransportDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const toast = useToast()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/transport/${id}`)
      setTask(res.data?.data || null)
      setError('')
    } catch (err) {
      setError(errorText(err, 'Could not load this move.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { setLoading(true); load() }, [load, user?.id])

  const listPath = location.pathname.startsWith('/it-logistics') ? '/it-logistics' : '/transport'

  if (loading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>
  if (error || !task) {
    return (
      <div className="card text-center">
        <p className="text-sm text-slate-600">{error || 'This move does not exist, or you do not have access to it.'}</p>
        <Link to={listPath} className="btn-secondary mt-4">Back</Link>
      </div>
    )
  }

  const itTask = task.fulfillment_type === 'it'
  const canWork = canWorkTask(task, user)
  const req = task.request || {}

  const step = async (path, body, message) => {
    setBusy(true)
    try {
      await api.post(`/transport/${task.id}/${path}`, body)
      toast.success(message)
      setNotes('')
      await load()
    } catch (err) {
      toast.error(errorText(err, 'The update could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  let panel = null
  if (task.status === 'completed') {
    panel = (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Delivered{task.transport_completed_name ? ` by ${task.transport_completed_name}` : ''} on {formatDateTime(task.completed_at)}.
          The AMA pool will now update the register and close the request.
        </p>
      </div>
    )
  } else if (!canWork) {
    panel = (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p>This move is handled by the {itTask ? 'IT' : 'Transport'} pool.</p>
      </div>
    )
  } else if (task.status === 'pending_assignment' || editing) {
    panel = (
      <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm ring-4 ring-blue-50">
        <h2 className="section-title">{editing ? 'Change the schedule' : 'Schedule this move'}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">Choose who will move the assets, with what, and when.</p>
        <AssignForm task={task} user={user} onDone={async () => { setEditing(false); await load() }} />
      </section>
    )
  } else if (task.status === 'officer_assigned') {
    panel = (
      <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm ring-4 ring-blue-50">
        <h2 className="section-title">Record the pickup</h2>
        <p className="mt-1 text-sm text-slate-600">When the assets leave {req.present_location || 'the current location'}, mark them as in transit.</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary">Change schedule</button>
          <button type="button" disabled={busy} onClick={() => step('start', undefined, 'Marked as in transit.')} className="btn-primary">
            <Truck className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : 'Assets picked up'}
          </button>
        </div>
      </section>
    )
  } else if (task.status === 'in_progress') {
    panel = (
      <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm ring-4 ring-blue-50">
        <h2 className="section-title">Confirm delivery</h2>
        <p className="mt-1 text-sm text-slate-600">
          Confirm once everything has arrived at {req.new_location || 'the destination'}{itTask ? ' and is installed' : ''}. The AMA pool is then asked to update the register.
        </p>
        <div className="mt-4">
          <label className="label" htmlFor="delivery-notes">Delivery notes <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="delivery-notes" rows={2} className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who received it, condition on arrival…" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={busy} onClick={() => step('complete', { completion_notes: notes }, 'Delivery confirmed.')} className="btn-primary">
            <PackageCheck className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : 'Confirm delivery'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={listPath} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {itTask ? 'IT' : 'Transport'}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold text-slate-900 sm:text-2xl">{req.reference_no || `Move ${task.id}`}</h1>
          <StatusBadge status={task.status} />
          <span className="badge badge-gray">{itTask ? 'IT' : 'Transport'}</span>
        </div>
        <p className="page-subtitle"><Route from={req.present_location} to={req.new_location} /></p>
      </div>

      {panel}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card-flat min-w-0 overflow-hidden lg:col-span-3">
          <h2 className="section-title px-5 pt-5">Assets ({(task.items || []).length})</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th scope="col" className="w-12 px-5 py-2 font-medium">#</th>
                  <th scope="col" className="px-3 py-2 font-medium">Asset</th>
                  <th scope="col" className="px-5 py-2 font-medium">Asset code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(task.items || []).map((it, i) => (
                  <tr key={it.id || i}>
                    <td className="px-5 py-2.5 text-slate-400">{it.item_no || i + 1}</td>
                    <td className="px-3 py-2.5 text-slate-900">{it.name_of_asset}</td>
                    <td className="px-5 py-2.5 font-mono text-[13px] text-slate-700">{it.asset_code || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="section-title">Schedule</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Officer">{task.assigned_officer_name}</Field>
              <Field label="Date">{task.scheduled_date ? formatDate(task.scheduled_date) : null}</Field>
              <Field label={itTask ? 'Carrier' : 'Vehicle'}>{task.vehicle_details}</Field>
              <Field label="Driver / contractor">{task.driver_name || task.vendor_name}</Field>
              {task.assessment_notes && <div className="col-span-2"><Field label="Handling notes">{task.assessment_notes}</Field></div>}
              {task.transport_started_name && <Field label="Picked up by">{task.transport_started_name}</Field>}
              {task.completion_notes && <div className="col-span-2"><Field label="Delivery notes">{task.completion_notes}</Field></div>}
            </dl>
          </section>

          {req.id && (
            <Link to={`/requests/${req.id}`} className="card flex items-center justify-between gap-3 transition-colors hover:border-slate-300">
              <div>
                <p className="text-sm font-medium text-slate-900">Movement request</p>
                <p className="text-sm text-slate-500">Purpose, approvals and activity</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

