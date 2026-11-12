import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, ShieldCheck,
  Truck, Server, FileCheck, Clock, Hourglass, Download, Lock
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import StatusBadge from '../components/StatusBadge'
import ApprovalTimeline from '../components/ApprovalTimeline'
import MovementFormView from '../components/MovementFormView'
import RequestAuditHistory from '../components/RequestAuditHistory'
import { calculateStageDurations } from '../utils/slaAnalytics'

export default function RequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sheet') // 'sheet' | 'audit' | 'workflow'
  const [actionLoading, setActionLoading] = useState(false)
  const [remarks, setRemarks] = useState('')

  const load = async () => {
    try {
      const res = await api.get(`/requests/${id}`)
      const data = res.data?.data || res.data
      setRequest(data)
    } catch {
      toast.error('Failed to load request.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-slate-500">Request not found.</p>
        <button onClick={() => navigate('/requests')} className="btn-secondary mt-3">
          Back to Requests
        </button>
      </div>
    )
  }

  // Role & Pool Identification
  const role = user?.role
  const userDept = user?.department || ''
  const isAmaPool = role === 'ama_officer' || role === 'ama_head' || role === 'admin' || userDept.includes('Asset') || userDept.includes('Archive') || userDept.includes('AMA')
  const isTransportPool = role === 'transport_head' || role === 'transport_officer' || role === 'admin' || userDept.includes('Transport') || userDept.includes('Logistics') || userDept.includes('Fleet')

  // Pool Actions Eligibility
  const canApproveHead = (role === 'department_head' || role === 'admin') && request.status === 'pending_head'
  const canApproveAmaPool = isAmaPool && request.status === 'head_approved'
  const canCloseAmaPool = isAmaPool && request.status === 'transport_completed'
  const canAct = canApproveHead || canApproveAmaPool || canCloseAmaPool

  const handleApprove = async () => {
    setActionLoading(true)
    let approved = false
    try {
      await api.post(`/requests/${id}/approve`, { remarks })
      approved = true
      toast.success('Action submitted successfully')
      setRemarks('')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Approval failed.')
    } finally {
      setActionLoading(false)
    }

    if (approved) {
      try {
        await load()
      } catch (loadErr) {
        console.warn('Failed to reload request detail:', loadErr)
      }
    }
  }

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error('Please specify rejection reasons in remarks.')
      return
    }
    setActionLoading(true)
    let rejected = false
    try {
      await api.post(`/requests/${id}/reject`, { remarks })
      rejected = true
      toast.success('Request rejected.')
      setRemarks('')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Rejection failed.')
    } finally {
      setActionLoading(false)
    }

    if (rejected) {
      try {
        await load()
      } catch (loadErr) {
        console.warn('Failed to reload request detail:', loadErr)
      }
    }
  }

  const handleClose = async () => {
    setActionLoading(true)
    let closed = false
    try {
      await api.post(`/requests/${id}/close`, { remarks })
      closed = true
      toast.success('Fixed Asset Register updated and request closed!')
      setRemarks('')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Closure failed.')
    } finally {
      setActionLoading(false)
    }

    if (closed) {
      try {
        await load()
      } catch (loadErr) {
        console.warn('Failed to reload request detail:', loadErr)
      }
    }
  }

  const analytics = calculateStageDurations(request)

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <button
            onClick={() => navigate('/requests')}
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Requests
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-mono">
              {request.reference_no}
            </h1>
            <StatusBadge status={request.status} fulfillmentType={request.fulfillment_type || request.transport_task?.fulfillment_type} />
            {analytics?.currentStagePendingFormatted && !analytics.isClosed && (
              <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/70 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                Pended: {analytics.currentStagePendingFormatted}
              </span>
            )}
            {analytics?.isClosed && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Turnaround: {analytics.totalDurationFormatted}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('sheet')
                    const prevTitle = document.title
                    document.title = `Official_Fixed_Asset_Movement_Form_${request.reference_no || 'Document'}`
                    setTimeout(() => {
                      window.print()
                      setTimeout(() => { document.title = prevTitle }, 1500)
                    }, 150)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shadow-xs transition"
                  title="Download Completed Official Movement Form as PDF"
                >
                  <Download className="w-3 h-3 text-emerald-100" />
                  <span>Download Official Form (PDF)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Toggle: Sheet | Audit Log & Stage Durations | Workflow & Assets */}
        <div className="flex items-center p-1 bg-blue-50/70 rounded-xl border border-blue-200 text-xs">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition ${
              activeTab === 'sheet'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-900 hover:text-blue-950'
            }`}
          >
            Official Sheet
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-900 hover:text-blue-950'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Audit &amp; Stage Durations</span>
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition ${
              activeTab === 'workflow'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-900 hover:text-blue-950'
            }`}
          >
            Workflow &amp; Assets
          </button>
        </div>
      </div>

      {/* Reviewer Action Callout */}
      {canAct && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm space-y-3 print:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
                  <span>
                    {canApproveHead && 'Department Head Action Required'}
                    {(canApproveAmaPool || canCloseAmaPool) && 'Asset Management \& Archives Department Pool Action'}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase font-sans">
                    {canApproveHead ? 'Unit Review' : 'AMA Pool Member'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Acting Officer: <strong className="text-blue-900">{user?.name}</strong> &bull; {user?.job_title || user?.department || user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/70">
            {canApproveHead && 'Review the present location, destination, and asset schedule before giving departmental approval.'}
            {canApproveAmaPool && (request.fulfillment_type === 'it'
              ? 'As a member of the Asset Management \& Archives Department Pool, verify asset codes and tags, then authorize movement dispatch to the IT Infrastructure & Systems Pool.'
              : 'As a member of the Asset Management \& Archives Department Pool, verify asset codes and tags, then authorize movement dispatch to the Transport & Logistics Pool.')}
            {canCloseAmaPool && 'Logistics fulfillment has confirmed physical delivery. As a member of the Asset Management \& Archives Department Pool, verify and update the Fixed Asset Register records to formally close this request.'}
          </p>

          <div>
            <label className="label">Verification Notes / Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Asset codes verified against register. Approved for relocation."
              className="input-field text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            {!canCloseAmaPool && (
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="btn-danger"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            )}

            {canCloseAmaPool ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={actionLoading}
                className="btn-primary"
              >
                <FileCheck className="w-4 h-4" />
                {actionLoading ? 'Closing...' : 'Confirm Register Update & Close Request'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn-primary"
              >
                <CheckCircle2 className="w-4 h-4" />
                {actionLoading
                  ? 'Processing...'
                  : canApproveAmaPool
                  ? (request.fulfillment_type === 'it'
                      ? 'Verify & Authorize (Dispatch to IT Pool)'
                      : 'Verify & Authorize (Dispatch to Transport Pool)')
                  : 'Approve & Forward'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Logistics Active Notification */}
      {request.transport_task && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0 shadow-sm ${
              request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
                ? 'bg-indigo-600 shadow-indigo-500/20'
                : 'bg-blue-600 shadow-blue-500/20'
            }`}>
              {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
                ? <Server className="w-5 h-5" />
                : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-950">
                {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
                  ? `IT Logistics Task #${request.transport_task.id} • IT Infrastructure Fulfillment`
                  : `Logistics Task #${request.transport_task.id} • Transport & Logistics Fulfillment`}
              </p>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Status: <span className="font-semibold text-blue-900">{request.transport_task.status.replace(/_/g, ' ')}</span>
                {request.transport_task.assigned_officer_name && ` • ${request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'IT Officer' : 'Officer'}: ${request.transport_task.assigned_officer_name}`}
                {request.transport_task.driver_name && ` • ${request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'Escort' : 'Driver'}: ${request.transport_task.driver_name}`}
                {request.transport_task.vehicle_details && ` • ${request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'Carrier' : 'Vehicle'}: ${request.transport_task.vehicle_details}`}
              </p>
            </div>
          </div>
          <Link
            to={request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
              ? `/it-logistics/${request.transport_task.id}`
              : `/transport/${request.transport_task.id}`}
            className="btn-secondary py-1.5 px-3 text-xs shrink-0"
          >
            {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
              ? 'Open IT Task →'
              : 'Open Logistics Task →'}
          </Link>
        </div>
      )}

      {/* Tab Content: Official Movement Sheet */}
      {activeTab === 'sheet' && (
        <MovementFormView request={request} />
      )}

      {/* Tab Content: Audit History & Stage Durations (SLA Tracking) */}
      {activeTab === 'audit' && (
        <div className="print:hidden">
          <RequestAuditHistory request={request} auditLog={request.audit_log} />
        </div>
      )}

      {/* Tab Content: Workflow & Audit Trail */}
      {activeTab === 'workflow' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:hidden">
          <div className="md:col-span-7 space-y-6">
            {/* Asset Items Summary */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Asset Items Schedule ({request.items?.length || 0} items)
              </h3>
              <div className="border border-blue-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-blue-50/70 border-b border-blue-100 text-blue-900 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5 text-center w-12">No.</th>
                      <th className="px-4 py-2.5 text-left">Asset Name</th>
                      <th className="px-4 py-2.5 text-left w-44">Asset Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {request.items?.map((it, i) => (
                      <tr key={i} className="hover:bg-blue-50/40 transition">
                        <td className="px-4 py-2 text-center text-slate-400 font-medium">{it.item_no}</td>
                        <td className="px-4 py-2 text-slate-900 font-medium">{it.name_of_asset}</td>
                        <td className="px-4 py-2 font-mono text-blue-700">{it.asset_code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Audit Trail
              </h3>
              <div className="space-y-2">
                {request.audit_log?.map((log, i) => (
                  <div key={i} className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/70 text-xs flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500 text-[11px]"> by {log.performed_by_name || 'System'}</span>
                      {log.remarks && (
                        <p className="text-slate-600 mt-0.5 text-[11px] italic">"{log.remarks}"</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <div className="md:col-span-5">
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Approval Lifecycle
              </h3>
              <ApprovalTimeline request={request} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
