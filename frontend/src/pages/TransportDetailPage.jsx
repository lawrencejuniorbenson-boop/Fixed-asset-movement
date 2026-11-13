import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Truck, CheckCircle2, Play, Bell, Calendar, MapPin,
  Users, UserCheck, Shield, ExternalLink, Info, User, Server
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import StatusBadge from '../components/StatusBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'

export default function TransportDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [officers, setOfficers] = useState([])
  const [actionLoading, setActionLoading] = useState(false)

  // Assignment form (Transport Unit Head provides officer, date, vehicle, and driver)
  const [assignForm, setAssignForm] = useState({
    assigned_officer_id: '',
    assigned_officer_name: '',
    vehicle_details: '',
    driver_name: '', // Provided directly by Transport Head
    scheduled_date: new Date().toISOString().split('T')[0],
    assessment_notes: '',
    assignment_notes: ''
  })

  // Completion form (Transport Officer)
  const [completionNotes, setCompletionNotes] = useState('')

  const load = async () => {
    try {
      const res = await api.get(`/transport/${id}`)
      const data = res.data?.data || res.data
      setTask(data)

      if (data?.assigned_officer_id) {
        setAssignForm(prev => ({
          ...prev,
          assigned_officer_id: data.assigned_officer_id,
          assigned_officer_name: data.assigned_officer_name || '',
          vehicle_details: data.vehicle_details || '',
          driver_name: data.driver_name || data.vendor_name || '',
          scheduled_date: data.scheduled_date || '',
          assessment_notes: data.assessment_notes || '',
          assignment_notes: data.assignment_notes || ''
        }))
      }
    } catch {
      toast.error('Failed to load transport task.')
    } finally {
      setLoading(false)
    }
  }

  const role = user?.role
  const userDept = user?.department || ''
  const isItTask = task?.fulfillment_type === 'it'
  const isItPool = role === 'it_head' || role === 'it_officer' || role === 'admin' || userDept.includes('IT') || userDept.includes('Information')
  const isTransportPool = role === 'transport_head' || role === 'transport_officer' || role === 'admin' || userDept.includes('Transport') || userDept.includes('Logistics') || userDept.includes('Fleet')
  const isFulfillmentEligible = isItTask ? isItPool : isTransportPool

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    if (!task) return
    const isIt = task.fulfillment_type === 'it'

    if (isFulfillmentEligible || role === 'admin') {
      api.get(`/transport/officers${isIt ? '?type=it' : ''}`)
        .then(res => {
          const list = res.data?.data || res.data || []
          const normalized = list.map((o, idx) => ({
            ...o,
            id: o.id !== undefined && o.id !== null ? o.id : (o.staff_id || `off-${idx + 1}`)
          }))
          setOfficers(normalized)
          if (normalized.length > 0 && !assignForm.assigned_officer_name) {
            setAssignForm(prev => ({
              ...prev,
              assigned_officer_id: prev.assigned_officer_id || normalized[0].id,
              assigned_officer_name: prev.assigned_officer_name || normalized[0].name
            }))
          }
        })
        .catch(() => {
          setOfficers([])
        })
    }
  }, [task?.id, task?.fulfillment_type, role, isFulfillmentEligible])

  const handleAssign = async (e) => {
    e.preventDefault()
    const selectedOfficerObj = officers.find(o =>
      (assignForm.assigned_officer_id && (String(o.id) === String(assignForm.assigned_officer_id) || String(o.staff_id) === String(assignForm.assigned_officer_id))) ||
      (assignForm.assigned_officer_name && o.name === assignForm.assigned_officer_name)
    )
    const officerName = assignForm.assigned_officer_name?.trim() || selectedOfficerObj?.name || ''
    const officerId = selectedOfficerObj?.id || assignForm.assigned_officer_id || null

    if (!officerName) {
      toast.error(isItTask ? 'Please select or enter the assigned IT specialist / officer.' : 'Please select or enter the assigned transport officer.')
      return
    }

    const vehicleDetails = assignForm.vehicle_details?.trim() || (isItTask ? 'IT Equipment Transport Van (Anti-Static & Shock Padded)' : '')
    const scheduledDate = assignForm.scheduled_date || new Date().toISOString().split('T')[0]

    if (!vehicleDetails) {
      toast.error(isItTask ? 'Please specify the IT transit carrier, van, or escort arrangement.' : 'Please enter the transport vehicle details.')
      return
    }
    if (!scheduledDate) {
      toast.error('Please specify the scheduled movement date.')
      return
    }

    const driverName = assignForm.driver_name?.trim() || null

    const payload = {
      ...assignForm,
      assigned_officer_id: officerId,
      assigned_officer_name: officerName,
      transport_handler_name: user?.name || (isItTask ? 'IT Systems Specialist' : 'Transport Officer'),
      vehicle_details: vehicleDetails,
      driver_type: driverName ? 'assigned' : 'vendor',
      driver_name: driverName,
      scheduled_date: scheduledDate
    }

    setActionLoading(true)
    try {
      await api.post(`/transport/${id}/assign`, payload)
      toast.success(isItTask ? 'IT Officer and transit protocol confirmed successfully' : 'Officer, vehicle, and driver details confirmed successfully')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Assignment failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStart = async () => {
    setActionLoading(true)
    try {
      await api.post(`/transport/${id}/start`)
      toast.success('Physical movement started. Status updated to In Transit.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to start move.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleComplete = async () => {
    setActionLoading(true)
    try {
      await api.post(`/transport/${id}/complete`, { completion_notes: completionNotes })
      toast.success('Movement complete. AMA Department formally notified.')
      setCompletionNotes('')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to complete move.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto font-sans p-4">
        <LoadingSkeleton rows={4} cols={2} />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white rounded-2xl border border-blue-100 shadow-sm font-sans mt-8">
        <p className="text-sm font-semibold text-slate-800">Relocation task not found or unauthorized.</p>
        <button
          onClick={() => navigate(isItPool ? '/it-logistics' : '/transport')}
          className="btn-secondary mt-3 text-xs inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Logistics List
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(isItTask ? '/it-logistics' : '/transport')}
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {isItTask ? 'IT Logistics' : 'Transport Logistics'}
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-mono">
              Task #{task.id} &bull; <span className="text-blue-700">{task.request?.reference_no}</span>
            </h1>
            <StatusBadge status={task.status} fulfillmentType={task.fulfillment_type} />
          </div>
        </div>

        {task.request && (
          <Link
            to={`/requests/${task.movement_request_id}`}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            View Official Movement Request &rarr;
          </Link>
        )}
      </div>

      {/* Completion Banner */}
      {task.status === 'completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-xs space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Physical Relocation Completed &bull; AMA Department Notified
          </div>
          <p className="text-emerald-800">
            Assets physically delivered to <strong className="text-emerald-950">{task.request?.new_location}</strong>. The Asset Monitoring &amp; Archives Department has been formally notified to update the bank's Fixed Asset Register.
          </p>
          {task.completion_notes && (
            <p className="text-emerald-950 font-medium italic pt-1 border-t border-emerald-200/60 mt-2">
              Delivery Notes: "{task.completion_notes}"
            </p>
          )}
        </div>
      )}

      {/* Relocation Specification Card */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          Relocation Route &amp; Asset Specification
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100/80">
            <span className="text-[10px] font-semibold uppercase text-blue-700 block">Pick-up Location (From)</span>
            <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{task.request?.present_location}</span>
          </div>
          <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100/80">
            <span className="text-[10px] font-semibold uppercase text-blue-700 block">Destination (To)</span>
            <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{task.request?.new_location}</span>
          </div>
        </div>

        {/* Assets List */}
        <div>
          <span className="text-xs font-semibold text-slate-800 block mb-2">
            Asset Items Scheduled for Movement ({task.items?.length || 0})
          </span>
          <div className="border border-blue-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-blue-50/70 border-b border-blue-100 text-blue-900 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5 text-center w-12">No.</th>
                  <th className="px-4 py-2.5 text-left">Asset Description</th>
                  <th className="px-4 py-2.5 text-left w-48">Asset Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {task.items?.map((it, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition">
                    <td className="px-4 py-2 text-center text-slate-400 font-medium">{it.item_no}</td>
                    <td className="px-4 py-2 font-medium text-slate-900 uppercase">{it.name_of_asset}</td>
                    <td className="px-4 py-2 font-mono text-blue-700 font-medium">{it.asset_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fulfillment Assignment Box (Transport or IT Infrastructure Pool) */}
      {task.status === 'pending_assignment' && isFulfillmentEligible && (
        <form onSubmit={handleAssign} className="bg-white rounded-2xl border-2 border-blue-200 p-6 space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
                {isItTask ? (
                  <>
                    <Server className="w-4 h-4 text-indigo-600" />
                    <span>IT Officer &amp; Transit Assignment (IT Infrastructure Pool)</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Vehicle &amp; Officer Assignment (Transport &amp; Logistics Pool)</span>
                  </>
                )}
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase font-sans ${
                isItTask ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                {isItTask ? 'IT Infrastructure Pool' : 'Transport Pool'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Acting Specialist: <strong className="text-blue-900">{user?.name}</strong> &bull; {
                isItTask
                  ? 'Any officer in the IT Infrastructure & Systems Department Pool can assign specialists, specify transit packaging, and schedule movement.'
                  : 'Any officer in the Transport & Logistics Department Pool can specify vehicle, driver, and move date.'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">
                  {isItTask ? 'IT Officer' : 'Transport Officer'} <span className="text-rose-500">*</span>
                </label>
                {user?.name && (
                  <button
                    type="button"
                    onClick={() => setAssignForm(p => ({
                      ...p,
                      assigned_officer_id: user.id || user.staff_id || '',
                      assigned_officer_name: user.name
                    }))}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold underline decoration-dotted"
                  >
                    Assign Myself
                  </button>
                )}
              </div>

              {officers.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={assignForm.assigned_officer_id || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value
                      if (selectedId === '__manual__') {
                        setAssignForm(p => ({ ...p, assigned_officer_id: '', assigned_officer_name: '' }))
                      } else {
                        const sel = officers.find(o => String(o.id) === String(selectedId) || String(o.staff_id) === String(selectedId))
                        setAssignForm(p => ({
                          ...p,
                          assigned_officer_id: selectedId,
                          assigned_officer_name: sel?.name || ''
                        }))
                      }
                    }}
                    className="input-field cursor-pointer"
                  >
                    <option value="">-- Select Registered Officer --</option>
                    {officers.map(o => (
                      <option key={o.id || o.staff_id} value={o.id || o.staff_id}>
                        {o.name} {o.staff_id ? `• ${o.staff_id}` : ''} {o.department ? `(${o.department})` : ''}
                      </option>
                    ))}
                    <option value="__manual__">+ Type Officer Name Manually</option>
                  </select>
                  <input
                    type="text"
                    value={assignForm.assigned_officer_name}
                    onChange={(e) => setAssignForm(p => ({ ...p, assigned_officer_name: e.target.value }))}
                    placeholder={isItTask ? "e.g. IT Officer Name" : "e.g. Transport Officer Name"}
                    className="input-field"
                    required
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={assignForm.assigned_officer_name}
                  onChange={(e) => setAssignForm(p => ({ ...p, assigned_officer_name: e.target.value }))}
                  placeholder={isItTask ? "e.g. IT Officer Name" : "e.g. Transport Officer Name"}
                  className="input-field"
                  required
                />
              )}
            </div>

            <div>
              <label className="label">
                Scheduled Movement Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={assignForm.scheduled_date}
                onChange={(e) => setAssignForm(p => ({ ...p, scheduled_date: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">
                {isItTask ? 'Secure Transit Method / Carrier Details' : 'Transport Vehicle Details'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={assignForm.vehicle_details}
                onChange={(e) => setAssignForm(p => ({ ...p, vehicle_details: e.target.value }))}
                placeholder={isItTask ? 'e.g. IT Equipment Transport Van (Anti-Static & Shock Padded), Padded Server Caddy' : 'e.g. Toyota Hilux (GE-1904-22), Sprinter Van, or Haulage Truck'}
                className="input-field"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isItTask
                  ? 'Specify dedicated transport van, server flight cases, anti-static shock packaging, or carrier.'
                  : 'Enter vehicle make, model, registration number, or carrier specification.'
                }
              </p>
            </div>

            <div>
              <label className="label">
                {isItTask ? 'Technical Escort / Dispatcher' : 'Driver / Contractor Details'} <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={assignForm.driver_name}
                onChange={(e) => setAssignForm(p => ({ ...p, driver_name: e.target.value }))}
                placeholder={isItTask ? 'e.g. Dedicated Technical Courier or IT Escort' : 'e.g. Assigned Driver or Moving Contractor'}
                className="input-field"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isItTask
                  ? 'Enter technical personnel escorting the hardware, driver name & contact, or leave blank.'
                  : 'Enter driver name & contact number, moving vendor company, or leave blank.'
                }
              </p>
            </div>
          </div>

          <div>
            <label className="label">
              {isItTask ? 'De-rack, Anti-Static Packaging & Cabling Protocol' : 'Assessment & Special Handling Notes'}
            </label>
            <textarea
              rows={2}
              value={assignForm.assessment_notes}
              onChange={(e) => setAssignForm(p => ({ ...p, assessment_notes: e.target.value }))}
              placeholder={isItTask ? 'Specify anti-static bubble wrapping, rail kit disassembly, RAID drive labeling, power sequence...' : 'State any protective padding, porters, or loading requirements...'}
              className="input-field"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-primary"
            >
              <Calendar className="w-4 h-4" />
              {actionLoading ? 'Assigning...' : (isItTask ? 'Confirm IT Specialist & Schedule Relocation' : 'Confirm Assignment & Schedule Move')}
            </button>
          </div>
        </form>
      )}

      {/* Fulfillment Assignment Overview (Shown once assigned) */}
      {task.status !== 'pending_assignment' && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-blue-100 pb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                {isItTask ? 'IT Equipment & Hardware Logistics Assignment' : 'Fulfillment & Logistics Assignment'}
              </h3>
            </div>
            <StatusBadge status={task.status} fulfillmentType={task.fulfillment_type} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">
                {isItTask ? 'IT Officer (In Charge)' : 'Transport Officer (In Charge)'}
              </span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                {task.assigned_officer_name || (isItTask ? 'IT Officer' : 'Transport Officer')}
              </span>
              <span className="text-[10px] text-blue-600 mt-0.5 block">
                {isItTask ? 'IT Infrastructure Pool • Data Centre Ops' : 'Logistics Supervisor • Internal Unit'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">
                {isItTask ? 'Transit Method & Packaging' : 'Vehicle / Carrier'}
              </span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate" title={task.vehicle_details}>
                {task.vehicle_details || (isItTask ? 'Pending Handling Details' : 'Pending Vehicle')}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Scheduled: {task.scheduled_date || '—'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">
                {isItTask ? 'Technical Escort / Specialist' : 'Allocated Driver'}
              </span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                {task.driver_name || (isItTask ? 'IT Technical Personnel' : 'Officer Managed / Vendor')}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {isItTask ? 'Data Centre & Systems Support' : 'Driver / Moving Contractor'}
              </span>
            </div>
          </div>

          {task.assessment_notes && (
            <div className="text-xs p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
              <strong className="text-blue-950 font-semibold block mb-0.5">
                {isItTask ? 'Technical De-rack & Handling Protocol:' : 'Handling & Protective Notes:'}
              </strong>
              <span>{task.assessment_notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Start Move Action */}
      {task.status === 'officer_assigned' && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                {isItTask ? 'Ready for IT Equipment Pickup (IT Infrastructure Pool)' : 'Ready for Transit (Transport & Logistics Pool)'}
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                Pool Active
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Designated Officer: <strong className="text-blue-900">{task.assigned_officer_name}</strong> &bull; {isItTask ? 'Transit Carrier/Method:' : 'Vehicle:'} {task.vehicle_details}
              {task.driver_name && ` • ${isItTask ? 'Escort/Specialist' : 'Driver'}: ${task.driver_name}`}
            </p>
          </div>

          {isFulfillmentEligible && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="btn-primary"
            >
              <Play className="w-3.5 h-3.5" />
              {actionLoading ? 'Starting...' : (isItTask ? 'Start IT Equipment Pickup & Transit (IT Pool)' : 'Start Physical Movement (Transport Pool)')}
            </button>
          )}
        </div>
      )}

      {/* Confirm Delivery Action */}
      {task.status === 'in_progress' && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                  {isItTask ? 'IT Equipment in Transit • Confirm Relocation' : 'Movement in Progress • Confirm Relocation'}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {isItTask ? 'IT Pool' : 'Transport Pool'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isItTask
                  ? `Confirm when servers and IT hardware have been safely received, mounted, and verified at ${task.request?.new_location}. The Asset Management & Archives Department will be formally notified.`
                  : `Confirm when the assets have reached ${task.request?.new_location}. The system will notify the Asset Management & Archives Department Pool to update the register.`
                }
              </p>
            </div>
          </div>

          {isFulfillmentEligible && (
            <div className="space-y-3">
              <div>
                <label className="label">
                  {isItTask ? 'Technical Handover & Relocation Notes' : 'Delivery Confirmation Remarks'}
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder={isItTask ? 'e.g. Servers de-racked, transported, re-racked in server room, powered on and network connectivity verified.' : 'e.g. Assets safely delivered in good condition and handed over to recipient supervisor.'}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  <Bell className="w-4 h-4" />
                  {actionLoading ? 'Confirming...' : (isItTask ? 'Confirm Relocation & Notify AMA Pool' : 'Confirm Delivery & Notify AMA Pool')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
