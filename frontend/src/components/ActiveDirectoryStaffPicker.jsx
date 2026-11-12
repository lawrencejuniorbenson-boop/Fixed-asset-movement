import React, { useState, useEffect, useRef } from 'react'
import { Search, UserCheck, Building2, Check, X, Shield, ExternalLink } from 'lucide-react'
import api from '../api/axios'

/**
 * Active Directory Staff Picker Component
 * Queries the organization's Active Directory / LDAP directory live.
 */
export default function ActiveDirectoryStaffPicker({
  label,
  value,
  initialValue,
  selectedStaff,
  onSelect,
  onSelectStaff,
  onTextChange,
  placeholder = 'Search by name, staff ID, department...',
  roleFilter = '',
  departmentFilter = '',
  showSupervisorSuggestion = false
}) {
  const effectiveValue = value !== undefined ? value : (initialValue || '')
  const selectHandler = onSelect || onSelectStaff
  const [query, setQuery] = useState(effectiveValue)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    setQuery(effectiveValue)
  }, [effectiveValue])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search to Active Directory
  useEffect(() => {
    if (!open || query.trim().length === 0) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get('/directory/search', {
          params: {
            q: query,
            role: roleFilter,
            department: departmentFilter,
            limit: 8
          }
        })
        setResults(res.data?.data || [])
      } catch (err) {
        console.error('Directory search error:', err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query, open, roleFilter, departmentFilter])

  const handleSelect = (staff) => {
    selectHandler?.(staff)
    setQuery(staff.name)
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    selectHandler?.(null)
    onTextChange?.('')
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="label mb-0">{label}</label>
          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Directory
          </span>
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const val = e.target.value
            setQuery(val)
            onTextChange?.(val)
            setOpen(true)
          }}
          placeholder={placeholder}
          className="input-field pl-9 pr-8 text-xs"
        />

        {selectedStaff || query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown Results */}
      {open && (results.length > 0 || (query.trim().length > 0 && loading)) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Directory Matches</span>
            {loading && <span className="text-blue-600 font-medium lowercase">querying...</span>}
          </div>

          {results.map((staff) => (
            <div
              key={staff.id || staff.staff_id || staff.email}
              onClick={() => handleSelect(staff)}
              className="p-3 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between gap-3 text-left"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">{staff.name}</span>
                  {staff.staff_id && (
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
                      {staff.staff_id}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {staff.job_title || staff.role?.replace(/_/g, ' ') || 'Staff'} &bull; <strong className="text-slate-700 font-medium">{staff.department || 'Operations'}</strong>
                </p>
                {staff.email && (
                  <p className="text-[10px] text-slate-400 truncate max-w-sm">
                    {staff.email}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-blue-600 font-medium hover:underline whitespace-nowrap">
                Select &rarr;
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

