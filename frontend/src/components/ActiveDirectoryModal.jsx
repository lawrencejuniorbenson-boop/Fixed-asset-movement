import React, { useState, useEffect } from 'react'
import { X, Search, CheckCircle2, RefreshCw, Server, Users, Shield, Building2 } from 'lucide-react'
import api from '../api/axios'
import { useToast } from '../context/ToastContext'

export default function ActiveDirectoryModal({ isOpen, onClose }) {
  const toast = useToast()
  const [status, setStatus] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [testing, setTesting] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [statusRes, searchRes] = await Promise.all([
        api.get('/directory/status'),
        api.get('/directory/search', { params: { q: search, department: selectedDept, limit: 20 } })
      ])
      setStatus(statusRes.data?.data)
      setStaffList(searchRes.data?.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, search, selectedDept])

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const res = await api.post('/directory/test-connection')
      toast.success(res.data?.data?.message || 'Active Directory connection successful!')
      await loadData()
    } catch {
      toast.error('Failed to connect to Active Directory server.')
    } finally {
      setTesting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Corporate Active Directory (LDAP / IAM) Integration
              </h2>
              <p className="text-[11px] text-slate-400">
                Staff information, organizational hierarchy &amp; reporting lines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection Status Banner */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <span className="font-semibold text-slate-900">
                Status: {status?.connection_status || 'CONNECTED'}
              </span>
              <span className="text-slate-400 text-[11px] block sm:inline sm:ml-2">
                Domain: <strong className="font-mono text-slate-700">{status?.domain || 'ad.bank.internal'}</strong> &bull; Server: <span className="font-mono text-slate-600">{status?.server_url || 'ldap://ad01.bank.internal:389'}</span>
              </span>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-secondary py-1 px-2.5 text-[11px] self-start sm:self-auto"
          >
            <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Verifying...' : 'Test Sync'}
          </button>
        </div>

        {/* Directory Search & Filters */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by Name, Staff ID, Email, Title..."
                className="input-field pl-9 text-xs"
              />
            </div>
            {status?.departments && (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="input-field text-xs sm:w-56 cursor-pointer"
              >
                <option value="">All Departments</option>
                {status.departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>

          {/* Staff Grid */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Directory Staff Records ({staffList.length})
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {staffList.length > 0 ? (
                staffList.map((staff) => (
                  <div key={staff.staff_id} className="p-3.5 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{staff.name}</span>
                        <span className="font-mono text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                          {staff.staff_id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({staff.sam_account_name})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {staff.job_title} &bull; <strong className="text-slate-700 font-medium">{staff.department}</strong> ({staff.unit})
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Location: {staff.office_location}
                      </p>
                    </div>

                    <div className="text-left sm:text-right text-[11px]">
                      <span className="text-slate-400 block text-[10px]">Reporting Manager:</span>
                      <span className="font-medium text-slate-800">{staff.manager_name}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No staff members match the specified criteria in Active Directory.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
          <span>Active Directory schema version 2024.1 &bull; Base DN: {status?.base_dn}</span>
          <button onClick={onClose} className="btn-secondary py-1 px-3 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

