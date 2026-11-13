import { useState, useMemo } from 'react'
import {
  X, FileSpreadsheet, Calendar, Filter, ShieldCheck,
  Download, CheckCircle2, Clock, Building2, AlertTriangle
} from 'lucide-react'
import { exportPeriodicAuditToExcel } from '../utils/excelExporter'

export default function AdminAuditExportModal({ isOpen, onClose, requests = [], user }) {
  if (!isOpen) return null

  // Security guard: System Admin or Internal Auditor
  const isAuthorized = user?.role === 'admin' || user?.role === 'auditor'

  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const twoYearsAgoStr = new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString().split('T')[0]

  const [dateMode, setDateMode] = useState('2years') // '2years' | '30days' | 'month' | 'all' | 'custom'
  const [startDate, setStartDate] = useState(twoYearsAgoStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [poolFilter, setPoolFilter] = useState('all') // 'all' | 'ama' | 'transport'
  const [statusFilter, setStatusFilter] = useState('all')
  const [exporting, setExporting] = useState(false)

  // Handle Preset Changes
  const applyPreset = (preset) => {
    setDateMode(preset)
    if (preset === '2years') {
      setStartDate(twoYearsAgoStr)
      setEndDate(todayStr)
    } else if (preset === '30days') {
      setStartDate(thirtyDaysAgoStr)
      setEndDate(todayStr)
    } else if (preset === 'month') {
      setStartDate(firstOfMonthStr)
      setEndDate(todayStr)
    } else if (preset === 'all') {
      setStartDate('')
      setEndDate('')
    }
  }

  // Flatten all audit logs from requests
  const allAuditLogs = useMemo(() => {
    const logs = []
    requests.forEach(r => {
      if (Array.isArray(r.audit_log)) {
        r.audit_log.forEach(l => {
          logs.push({
            ...l,
            movement_request_id: r.id,
            reference_no: r.reference_no,
            present_location: r.present_location,
            new_location: r.new_location,
            request_status: r.status
          })
        })
      }
    })
    return logs
  }, [requests])

  // Count matches
  const matchingData = useMemo(() => {
    const filteredReqs = requests.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (startDate) {
        const rTime = new Date(r.created_at || r.movement_date).getTime()
        if (rTime < new Date(`${startDate}T00:00:00Z`).getTime()) return false
      }
      if (endDate) {
        const rTime = new Date(r.created_at || r.movement_date).getTime()
        if (rTime > new Date(`${endDate}T23:59:59Z`).getTime()) return false
      }
      return true
    })

    const filteredLogs = allAuditLogs.filter(log => {
      if (!log.created_at) return true
      const logTime = new Date(log.created_at).getTime()
      if (startDate && logTime < new Date(`${startDate}T00:00:00Z`).getTime()) return false
      if (endDate && logTime > new Date(`${endDate}T23:59:59Z`).getTime()) return false
      if (poolFilter !== 'all') {
        const pName = (log.performed_by_name || '').toLowerCase()
        const action = (log.action || '').toLowerCase()
        if (poolFilter === 'ama' && !pName.includes('ama') && !pName.includes('archive') && !pName.includes('asset') && !action.includes('ama') && !action.includes('register')) {
          return false
        }
        if (poolFilter === 'it' && !pName.includes('it ') && !pName.includes('infrastructure') && !action.includes('it_')) {
          return false
        }
        if (poolFilter === 'transport' && !pName.includes('transport') && !pName.includes('fleet') && !action.includes('transport') && !action.includes('relocation')) {
          return false
        }
      }
      return true
    })

    return {
      requestsCount: filteredReqs.length,
      logsCount: filteredLogs.length,
      filteredReqs,
      filteredLogs
    }
  }, [requests, allAuditLogs, startDate, endDate, poolFilter, statusFilter])

  const handleExport = () => {
    if (!isAdmin) return
    setExporting(true)
    try {
      exportPeriodicAuditToExcel(
        matchingData.filteredReqs,
        matchingData.filteredLogs,
        {
          startDate,
          endDate,
          pool: poolFilter,
          status: statusFilter
        },
        user
      )
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs  animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-white">
                  Export Audit Log to Excel (.xlsx)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-amber-950 uppercase">
                  Admin &amp; Auditor
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Generate official institutional audit reports for compliance &amp; performance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning if unauthorized */}
        {!isAuthorized ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Access Restricted</h4>
            <p className="text-xs text-slate-500">
              Only authorized System Administrators and Internal Auditors can export institutional audit trails and performance history to Excel.
            </p>
            <button onClick={onClose} className="btn-secondary w-full mt-2">Close</button>
          </div>
        ) : (
          <div className="p-6 space-y-5 text-xs text-slate-700">
            {/* Quick Period Presets */}
            <div>
              <label className="label mb-1.5 flex items-center gap-1.5 font-semibold text-slate-900">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Select Reporting Period (Up to 2 Years)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('2years')}
                  className={`py-2 px-2.5 rounded-lg border text-center font-medium transition ${
                    dateMode === '2years'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Past 2 Years
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('30days')}
                  className={`py-2 px-2.5 rounded-lg border text-center font-medium transition ${
                    dateMode === '30days'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className={`py-2 px-2.5 rounded-lg border text-center font-medium transition ${
                    dateMode === 'all'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All History
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('custom')}
                  className={`py-2 px-2.5 rounded-lg border text-center font-medium transition ${
                    dateMode === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Custom Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setDateMode('custom')
                  }}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  End Date (To)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setDateMode('custom')
                  }}
                  className="input-field text-xs"
                />
              </div>
            </div>

            {/* Department Pool & Status Filter */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Department Pool Filter
                </label>
                <select
                  value={poolFilter}
                  onChange={(e) => setPoolFilter(e.target.value)}
                  className="input-field text-xs cursor-pointer"
                >
                  <option value="all">All Department Pools</option>
                  <option value="ama">Asset &amp; Archives Pool (AMA)</option>
                  <option value="transport">Transport &amp; Logistics Pool</option>
                  <option value="it">IT Infrastructure &amp; Systems Pool</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Request Lifecycle Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field text-xs cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="closed">Closed &amp; Registered</option>
                  <option value="in_transport">In Transit</option>
                  <option value="transport_completed">Relocated (Pending Closure)</option>
                  <option value="fully_approved">Awaiting Pickup</option>
                  <option value="head_approved">Awaiting AMA Approval</option>
                  <option value="pending_head">Awaiting Department Head</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Live Matches Counter Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold text-blue-950 block text-xs">
                    {matchingData.logsCount} Audit Events across {matchingData.requestsCount} Requests
                  </span>
                  <span className="text-[10px] text-blue-700">
                    Ready to export into multi-sheet formatted Excel workbook (.xlsx)
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || matchingData.logsCount === 0}
                className="btn-primary text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 border-emerald-700 shadow-emerald-500/20"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting ? 'Generating Excel...' : 'Download Excel (.xlsx)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
