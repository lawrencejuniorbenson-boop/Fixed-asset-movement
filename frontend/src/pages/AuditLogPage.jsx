import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Calendar, Search, Filter, Clock, CheckCircle2,
  AlertCircle, ArrowRight, FileSpreadsheet, RefreshCw, Building2,
  Truck, Server, User, Activity, AlertTriangle, ChevronRight, Layers,
  ExternalLink, ArrowUpRight, ShieldAlert
} from 'lucide-react'
import api from '../api/client'
import StatusBadge from '../components/StatusBadge'
import LoadingSkeleton from '../components/LoadingSkeleton'
import AdminAuditExportModal from '../components/AdminAuditExportModal'
import { useAuth } from '../context/AuthContext'
import { calculateStageDurations, formatDuration } from '../utils/slaAnalytics'
import { exportPeriodicAuditToExcel } from '../utils/excelExporter'

export default function AuditLogPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Time Horizon: Default 2 Years (730 days) as requested by the user
  const todayStr = new Date().toISOString().split('T')[0]
  const twoYearsAgoStr = new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const oneYearAgoStr = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const sixMonthsAgoStr = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const ninetyDaysAgoStr = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]

  const [datePreset, setDatePreset] = useState('2years') // '2years' | '1year' | '6months' | '90days' | '30days' | 'custom'
  const [startDate, setStartDate] = useState(twoYearsAgoStr)
  const [endDate, setEndDate] = useState(todayStr)

  // Filters
  const [search, setSearch] = useState('')
  const [poolFilter, setPoolFilter] = useState('all') // 'all' | 'ama' | 'transport' | 'dept'
  const [actionFilter, setActionFilter] = useState('all')
  const [slaFilter, setSlaFilter] = useState('all') // 'all' | 'compliant' | 'breached'

  const loadData = async () => {
    try {
      setRefreshing(true)
      const res = await api.get('/requests')
      const list = res.data?.data || res.data || []
      setRequests(list)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Handle Preset Changes
  const handlePresetChange = (preset) => {
    setDatePreset(preset)
    if (preset === '2years') {
      setStartDate(twoYearsAgoStr)
      setEndDate(todayStr)
    } else if (preset === '1year') {
      setStartDate(oneYearAgoStr)
      setEndDate(todayStr)
    } else if (preset === '6months') {
      setStartDate(sixMonthsAgoStr)
      setEndDate(todayStr)
    } else if (preset === '90days') {
      setStartDate(ninetyDaysAgoStr)
      setEndDate(todayStr)
    } else if (preset === '30days') {
      setStartDate(thirtyDaysAgoStr)
      setEndDate(todayStr)
    }
  }

  // Flatten and enrich all audit log events with parent request details & SLA calculation
  const allAuditEvents = useMemo(() => {
    const events = []

    requests.forEach(req => {
      const analytics = calculateStageDurations(req, req.audit_log || [])
      let rawLogs = (req.audit_log || []).slice().sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )

      // Fallback: If rawLogs is empty, ensure baseline milestone events exist
      if (rawLogs.length === 0) {
        rawLogs = [
          {
            id: `sub-${req.id}`,
            action: 'REQUEST_SUBMITTED',
            created_at: req.created_at || new Date().toISOString(),
            performed_by_name: `${req.requester_name || 'Requesting Officer'} (Requesting Officer)`,
            remarks: `Movement request submitted by ${req.requester_name || 'Requesting Officer'}`
          }
        ]
        if (req.head_approved_at || req.status !== 'pending_head') {
          rawLogs.push({
            id: `appr-${req.id}`,
            action: 'HEAD_APPROVED',
            created_at: req.head_approved_at || req.created_at,
            performed_by_name: `${req.head_approver_name || 'Unit Head'} (Unit Head)`,
            remarks: req.head_remarks || `Departmental endorsement granted.`
          })
        }
        if (req.ama_officer_approved_at || (!['pending_head', 'head_approved'].includes(req.status))) {
          rawLogs.push({
            id: `ama-${req.id}`,
            action: 'ASSET_VERIFIED_BY_AMA_POOL',
            created_at: req.ama_officer_approved_at || req.created_at,
            performed_by_name: `${req.ama_officer_name || 'Asset Management & Archives Officer'} (Asset Management & Archives Pool)`,
            remarks: `Asset items verified and cross-checked.`
          })
        }
        if (req.transport_task) {
          const isItReq = req.fulfillment_type === 'it' || req.transport_task?.fulfillment_type === 'it'
          rawLogs.push({
            id: `trans-${req.id}`,
            action: isItReq ? 'IT_EQUIPMENT_ALLOCATED' : 'OFFICER_ASSIGNED',
            created_at: req.transport_task.created_at || req.created_at,
            performed_by_name: `${req.transport_task.assigned_officer_name || (isItReq ? 'IT Logistics Officer' : 'Transport Pool Officer')} (${isItReq ? 'IT Infrastructure Pool' : 'Transport & Logistics Pool'})`,
            remarks: `Vehicle / Carrier: ${req.transport_task.vehicle_details || (isItReq ? 'IT Designated Carrier' : 'Assigned Fleet Vehicle')}`
          })
        }
      }

      rawLogs.forEach((log, idx) => {
        let elapsedFromPrev = null
        let elapsedMs = 0
        if (idx > 0) {
          const prevTime = new Date(rawLogs[idx - 1].created_at).getTime()
          const currTime = new Date(log.created_at).getTime()
          elapsedMs = Math.max(0, currTime - prevTime)
          elapsedFromPrev = formatDuration(elapsedMs)
        } else {
          elapsedFromPrev = 'Initial Submission'
        }

        // Determine department pool attribution
        let pool = 'Requesting Unit'
        const pName = (log.performed_by_name || '').toLowerCase()
        const actionStr = (log.action || '').toLowerCase()
        const isItReq = req.fulfillment_type === 'it'

        if (pName.includes('ama') || pName.includes('asset') || pName.includes('archive') || actionStr.includes('ama') || actionStr.includes('register')) {
          pool = 'Asset Management & Archives Pool'
        } else if (isItReq || pName.includes('it ') || pName.includes('infrastructure') || actionStr.includes('it_')) {
          pool = 'IT Infrastructure & Systems Pool'
        } else if (pName.includes('transport') || pName.includes('logistics') || pName.includes('fleet') || actionStr.includes('transport') || actionStr.includes('officer_assigned') || actionStr.includes('dispatched')) {
          pool = 'Transport & Logistics Pool'
        } else if (actionStr.includes('head_approved') || pName.includes('head')) {
          pool = 'Requesting Unit Head'
        }

        // Determine SLA status (e.g. stage target 24h/48h)
        const isBreached = elapsedMs > (48 * 3600 * 1000) && idx > 0

        events.push({
          ...log,
          eventId: `${req.id}-${log.id || idx}`,
          requestId: req.id,
          referenceNo: req.reference_no,
          fulfillmentType: req.fulfillment_type || 'transport',
          presentLocation: req.present_location,
          newLocation: req.new_location,
          purpose: req.purpose,
          requesterName: req.requester_name,
          requesterDepartment: req.requester_department,
          requestStatus: req.status,
          itemCount: (req.items || []).length,
          itemsSummary: (req.items || []).map(i => `${i.name_of_asset} (${i.asset_code})`).join(', '),
          elapsedFromPrev,
          elapsedMs,
          pool,
          isBreached,
          requestAnalytics: analytics
        })
      })
    })

    // Sort descending by timestamp (newest events first)
    return events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [requests])

  // Filtered Events based on 2-Year Date Range, Search & Dropdowns
  const filteredEvents = useMemo(() => {
    return allAuditEvents.filter(ev => {
      // 1. Date Range Filter
      if (ev.created_at) {
        const evTime = new Date(ev.created_at).getTime()
        if (startDate) {
          const sTime = new Date(`${startDate}T00:00:00Z`).getTime()
          if (evTime < sTime) return false
        }
        if (endDate) {
          const eTime = new Date(`${endDate}T23:59:59Z`).getTime()
          if (evTime > eTime) return false
        }
      }

      // 2. Pool Filter
      if (poolFilter !== 'all') {
        if (poolFilter === 'ama' && ev.pool !== 'Asset Management & Archives Pool') return false
        if (poolFilter === 'it' && ev.pool !== 'IT Infrastructure & Systems Pool') return false
        if (poolFilter === 'transport' && ev.pool !== 'Transport & Logistics Pool') return false
        if (poolFilter === 'dept' && ev.pool !== 'Requesting Unit' && ev.pool !== 'Requesting Unit Head') return false
      }

      // 3. Action Filter
      if (actionFilter !== 'all') {
        const act = (ev.action || '').toUpperCase()
        if (actionFilter === 'SUBMITTED' && !act.includes('SUBMIT')) return false
        if (actionFilter === 'APPROVED' && !act.includes('APPROV')) return false
        if (actionFilter === 'TRANSPORT' && !act.includes('TRANSPORT') && !act.includes('ASSIGN') && !act.includes('IT_')) return false
        if (actionFilter === 'CLOSED' && !act.includes('CLOSE') && !act.includes('REGISTER')) return false
        if (actionFilter === 'REJECTED' && !act.includes('REJECT')) return false
      }

      // 4. SLA Filter
      if (slaFilter === 'compliant' && ev.isBreached) return false
      if (slaFilter === 'breached' && !ev.isBreached) return false

      // 5. Search Query
      if (search) {
        const q = search.toLowerCase()
        const text = `${ev.referenceNo} ${ev.action} ${ev.performed_by_name} ${ev.remarks} ${ev.presentLocation} ${ev.newLocation} ${ev.itemsSummary} ${ev.requesterName}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      return true
    })
  }, [allAuditEvents, startDate, endDate, poolFilter, actionFilter, slaFilter, search])

  // Filtered Requests based on date range, pool, and search query
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // 1. Date Range
      if (r.created_at) {
        const rTime = new Date(r.created_at).getTime()
        if (startDate) {
          const sTime = new Date(`${startDate}T00:00:00Z`).getTime()
          if (rTime < sTime) return false
        }
        if (endDate) {
          const eTime = new Date(`${endDate}T23:59:59Z`).getTime()
          if (rTime > eTime) return false
        }
      }

      // 2. Search Query
      if (search) {
        const q = search.toLowerCase()
        const itemsStr = (r.items || []).map(i => `${i.name_of_asset} ${i.asset_code}`).join(' ')
        const text = `${r.reference_no} ${r.requester_name} ${r.present_location} ${r.new_location} ${r.purpose} ${itemsStr}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      // 3. Pool Filter
      if (poolFilter === 'ama' && !['head_approved', 'ama_officer_approved', 'closed'].includes(r.status)) {
        return false
      }
      if (poolFilter === 'it' && (r.fulfillment_type !== 'it' || !['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(r.status))) {
        return false
      }
      if (poolFilter === 'transport' && (r.fulfillment_type === 'it' || !['fully_approved', 'in_transport', 'transport_completed', 'closed'].includes(r.status))) {
        return false
      }
      if (poolFilter === 'dept' && r.status !== 'pending_head') {
        return false
      }

      // 4. Status Filter
      if (actionFilter !== 'all' && r.status !== actionFilter) {
        return false
      }

      // 5. SLA Filter
      if (slaFilter !== 'all') {
        const durations = calculateStageDurations(r, r.audit_log || [])
        const activeStage = durations?.stages?.find(s => s.state === 'currently_pending')
        const isBreached = activeStage && activeStage.durationMs > (activeStage.targetHours * 3600 * 1000)
        if (slaFilter === 'breached' && !isBreached) return false
        if (slaFilter === 'compliant' && isBreached) return false
      }

      return true
    })
  }, [requests, startDate, endDate, search, poolFilter, actionFilter, slaFilter])

  // Summary Metrics for Auditors
  const auditMetrics = useMemo(() => {
    const totalUniqueReqs = filteredRequests.length
    let breachedCount = 0
    let amaPoolCount = 0
    let transportPoolCount = 0
    let itPoolCount = 0

    filteredRequests.forEach(r => {
      const durations = calculateStageDurations(r, r.audit_log || [])
      const activeStage = durations?.stages?.find(s => s.state === 'currently_pending')
      if (activeStage && activeStage.durationMs > (activeStage.targetHours * 3600 * 1000)) {
        breachedCount++
      }
      if (['head_approved', 'ama_officer_approved', 'closed'].includes(r.status)) amaPoolCount++
      if (['fully_approved', 'in_transport', 'transport_completed'].includes(r.status)) {
        if (r.fulfillment_type === 'it') {
          itPoolCount++
        } else {
          transportPoolCount++
        }
      }
    })

    const compliantRate = totalUniqueReqs > 0 ? Math.round(((totalUniqueReqs - breachedCount) / totalUniqueReqs) * 100) : 100

    return {
      totalUniqueReqs,
      breachedCount,
      compliantRate,
      amaPoolCount,
      transportPoolCount,
      itPoolCount
    }
  }, [filteredRequests])

  // Quick Direct Export Handler for Auditors
  const handleDirectExcelExport = () => {
    exportPeriodicAuditToExcel(
      filteredRequests,
      filteredEvents,
      { startDate, endDate, pool: poolFilter, status: 'all' },
      user || { name: 'Internal Auditor', role: 'auditor', email: 'auditor@bank.internal' }
    )
  }

  // Authorization guard: System Admin and Internal Auditor only
  const isAuthorized = user?.role === 'admin' || user?.role === 'auditor'

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4 shadow-sm font-sans">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-rose-600 font-semibold uppercase tracking-wider">
            System Admin &amp; Auditor Role Access Only
          </p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The institutional 2-year audit log and compliance ledger is restricted to users holding the <strong>System Administrator</strong> or <strong>Internal Auditor</strong> roles. Your current role is <span className="font-semibold text-slate-800">{user?.role || 'Guest'}</span>.
        </p>
        <div className="pt-2">
          <Link to="/dashboard" className="btn-primary inline-flex items-center justify-center w-full text-xs py-2.5">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* 1. AUDIT HEADER & ACTION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Movement Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail capturing asset movement lifecycle events and stage duration tracking
          </p>
        </div>

        {/* Action Buttons: Refresh, Filter & Export Features */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition"
            title="Refresh live audit events"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleDirectExcelExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            title="Export filtered audit logs to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Export Audit to Excel (.xlsx)</span>
          </button>

          {(user?.role === 'admin' || user?.role === 'auditor') && (
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200 shadow-xs transition"
            >
              <span>Filter &amp; Export Options</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. AUDIT COMPLIANCE & PERFORMANCE METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Requests in Ledger</span>
          <span className="text-xl sm:text-2xl font-black text-blue-950 mt-1 block font-mono">
            {auditMetrics.totalUniqueReqs}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Filtered movement requests</span>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SLA Compliance</span>
          <span className={`text-xl sm:text-2xl font-black mt-1 block font-mono ${
            auditMetrics.compliantRate >= 90 ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {auditMetrics.compliantRate}%
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {auditMetrics.breachedCount} delay warnings
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Asset &amp; Archives Pool</span>
          <span className="text-xl sm:text-2xl font-black text-blue-900 mt-1 block font-mono">
            {auditMetrics.amaPoolCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Verifications &amp; Closures</span>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center gap-1">
            <Truck className="w-3 h-3 text-blue-600" />
            Transport Pool
          </span>
          <span className="text-xl sm:text-2xl font-black text-blue-900 mt-1 block font-mono">
            {auditMetrics.transportPoolCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Vehicle Logistics Move</span>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center gap-1">
            <Server className="w-3 h-3 text-indigo-600" />
            IT Logistics Pool
          </span>
          <span className="text-xl sm:text-2xl font-black text-indigo-950 mt-1 block font-mono">
            {auditMetrics.itPoolCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Server &amp; Hardware Relocations</span>
        </div>
      </div>

      {/* 3. TIME HORIZON & FILTER CONTROL CARD */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 space-y-4">
        {/* Preset Time Buttons (Focusing on Up to 2 Years) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-blue-50">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Audit Time Window:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: '2years', label: 'Past 2 Years (730d)' },
              { id: '1year', label: 'Past 1 Year (365d)' },
              { id: '6months', label: 'Past 6 Months' },
              { id: '90days', label: 'Past 90 Days' },
              { id: '30days', label: 'Past 30 Days' },
              { id: 'custom', label: 'Custom Range' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Inputs if Custom is selected */}
        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/40 rounded-xl border border-blue-100">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Start Date (From)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">End Date (To)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs bg-white"
              />
            </div>
          </div>
        )}

        {/* Live Search & Filter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, asset, officer, staff ID..."
              className="input-field pl-9 text-xs w-full"
            />
          </div>

          {/* Department Pool Filter */}
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={poolFilter}
              onChange={(e) => setPoolFilter(e.target.value)}
              className="input-field pl-9 text-xs w-full cursor-pointer"
            >
              <option value="all">All Department Pools</option>
              <option value="ama">Asset &amp; Archives Department Pool</option>
              <option value="transport">Transport Logistics Pool</option>
              <option value="it">IT Infrastructure Pool</option>
              <option value="dept">Requesting Unit / Dept Head</option>
            </select>
          </div>

          {/* Request Status Filter */}
          <div className="relative">
            <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="input-field pl-9 text-xs w-full cursor-pointer"
            >
              <option value="all">All Request Statuses</option>
              <option value="pending_head">Pending Department Head</option>
              <option value="head_approved">Asset Verification (AMA)</option>
              <option value="ama_officer_approved">Movement Authorization (AMA)</option>
              <option value="fully_approved">Pending Logistics / IT</option>
              <option value="in_transport">In Transit</option>
              <option value="transport_completed">Pending Closure</option>
              <option value="closed">Closed / Archived</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* SLA Compliance Filter */}
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="input-field pl-9 text-xs w-full cursor-pointer"
            >
              <option value="all">All SLA Conditions</option>
              <option value="compliant">Within Target SLA</option>
              <option value="breached">SLA Delayed (&gt; 48h)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. REQUEST LIFECYCLE LEDGER */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        {/* Ledger Header */}
        <div className="px-6 py-4 bg-blue-50/40 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                Request Lifecycle Ledger ({filteredRequests.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Complete movement request lifecycle records, SLA status, and turnaround times.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing records between <strong className="text-slate-900">{startDate}</strong> and <strong className="text-slate-900">{endDate}</strong>
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <LoadingSkeleton rows={5} cols={5} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-blue-950">No movement requests found in selected period</p>
            <p className="text-xs text-slate-400">
              Adjust the time range, department pool, or search filter to inspect more history.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[850px]">
              <thead className="bg-slate-50/80 border-b border-blue-100 text-blue-950 font-semibold">
                <tr>
                  <th className="text-left px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Reference</th>
                  <th className="text-left px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Fulfillment Track</th>
                  <th className="text-left px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Assets &amp; Route</th>
                  <th className="text-left px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Requester</th>
                  <th className="text-left px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Current Status</th>
                  <th className="text-left px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Total Turnaround (TAT)</th>
                  <th className="text-right px-5 py-3.5 font-semibold uppercase text-[10px] tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 bg-white">
                {filteredRequests.map((req) => {
                  const analytics = calculateStageDurations(req, req.audit_log || [])
                  const isItReq = req.fulfillment_type === 'it'
                  return (
                    <tr key={req.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-950 whitespace-nowrap">
                        {req.reference_no}
                        <span className="block text-[10px] font-normal text-slate-400">
                          Created: {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isItReq ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Server className="w-3 h-3 text-indigo-600" />
                            IT Infrastructure
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Truck className="w-3 h-3 text-blue-600" />
                            Transport Logistics
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-900 block truncate max-w-xs">
                          {req.items && req.items.length > 0 ? req.items[0].name_of_asset : 'Asset'}
                          {req.items?.length > 1 && (
                            <span className="text-blue-600 font-normal ml-1">
                              (+{req.items.length - 1} more)
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate max-w-xs">
                          {req.present_location} &rarr; {req.new_location}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-900 block">{req.requester_name}</span>
                        <span className="text-[10px] text-slate-400 block">{req.requester_department}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={req.status} fulfillmentType={req.fulfillment_type || req.transport_task?.fulfillment_type} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono">
                        <span className="font-bold text-slate-900 block">
                          {analytics.totalDurationFormatted || '< 1 min'}
                        </span>
                        <span className="text-[10px] text-blue-600 block">
                          {analytics.completedCount} of {analytics.totalStages} stages completed
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Link
                          to={`/requests/${req.id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                        >
                          <span>Inspect Trail &rarr;</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL EXPORT TRIGGER */}
      {(user?.role === 'admin' || user?.role === 'auditor') && (
        <AdminAuditExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          requests={filteredRequests}
          user={user}
        />
      )}
    </div>
  )
}

