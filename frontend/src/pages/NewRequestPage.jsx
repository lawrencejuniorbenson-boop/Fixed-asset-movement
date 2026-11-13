import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, Send, Save, FileClock, XCircle, Building2, UserCheck, CheckCircle2, Truck, Server } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ActiveDirectoryStaffPicker from '../components/ActiveDirectoryStaffPicker'

export default function NewRequestPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState({
    present_location: '',
    new_location: '',
    purpose: '',
    fulfillment_type: 'transport', // 'transport' | 'it'
    officer_doing_movement: user?.name || '',
    officer_doing_movement_staff_id: user?.staff_id || '',
    authorized_by: '',
    authorized_by_staff_id: '',
    requesting_officer_staff_id: user?.staff_id || '',
    department: user?.department || '',
    unit: '',
    movement_date: new Date().toISOString().split('T')[0],
    priority: 'Normal',
    signature_requester: user?.name || ''
  })

  // Table of Assets (matches doc table)
  const [items, setItems] = useState([
    { item_no: 1, name_of_asset: '', asset_code: '' }
  ])

  const [selectedMovementOfficer, setSelectedMovementOfficer] = useState(null)
  const [selectedAuthorizer, setSelectedAuthorizer] = useState(null)

  // Draft state (Strictly only 1 draft can exist at a time)
  const [savedDraft, setSavedDraft] = useState(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState(null)

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Initialize with user profile and check for any existing single draft
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        officer_doing_movement: prev.officer_doing_movement || user.name || '',
        officer_doing_movement_staff_id: prev.officer_doing_movement_staff_id || user.staff_id || '',
        requesting_officer_staff_id: prev.requesting_officer_staff_id || user.staff_id || '',
        department: prev.department || user.department || '',
        signature_requester: prev.signature_requester || user.name || ''
      }))
    }

    // Check for existing single draft to restore
    api.get('/requests/draft')
      .then(res => {
        const draft = res.data?.data
        if (draft && draft.form) {
          setSavedDraft(draft)
          setForm(prev => ({ ...prev, ...draft.form }))
          if (Array.isArray(draft.items) && draft.items.length > 0) {
            setItems(draft.items)
          }
          if (draft.updated_at) {
            setLastSavedTime(new Date(draft.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
          }
          toast.info('Restored your saved draft.')
        }
      })
      .catch(() => {})
  }, [user])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })

    if (field === 'name_of_asset') {
      const lower = value.toLowerCase()
      const itKeywords = ['server', 'switch', 'router', 'rack', 'ups', 'cisco', 'firewall', 'nas', 'san', 'datacenter', 'workstation', 'patch panel']
      const isIT = itKeywords.some(kw => lower.includes(kw))
      if (isIT) {
        setForm(prev => {
          if (prev.fulfillment_type !== 'it') {
            return { ...prev, fulfillment_type: 'it' }
          }
          return prev
        })
      }
    }
  }

  const addItemRow = () => {
    if (items.length >= 10) {
      toast.error('Maximum 10 items per form.')
      return
    }
    setItems(prev => [
      ...prev,
      { item_no: prev.length + 1, name_of_asset: '', asset_code: '' }
    ])
  }

  const removeItemRow = (index) => {
    if (items.length === 1) {
      toast.error('The movement form must have at least one asset item.')
      return
    }
    setItems(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((item, i) => ({ ...item, item_no: i + 1 }))
    })
  }

  // Active Directory selection handler for Officer Doing Movement
  const handleSelectMovementOfficer = (staff) => {
    setSelectedMovementOfficer(staff)
    if (staff) {
      setForm(prev => ({
        ...prev,
        officer_doing_movement: staff.name,
        officer_doing_movement_staff_id: staff.staff_id
      }))
    } else {
      setForm(prev => ({
        ...prev,
        officer_doing_movement: '',
        officer_doing_movement_staff_id: ''
      }))
    }
  }

  // Active Directory selection handler for Authorizer (Head / Supervisor)
  const handleSelectAuthorizer = (staff) => {
    setSelectedAuthorizer(staff)
    if (staff) {
      setForm(prev => ({
        ...prev,
        authorized_by: staff.name,
        authorized_by_staff_id: staff.staff_id
      }))
    } else {
      setForm(prev => ({
        ...prev,
        authorized_by: '',
        authorized_by_staff_id: ''
      }))
    }
  }

  // Save current progress as the single draft
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      const res = await api.post('/requests/draft', { form, items })
      const draft = res.data?.data
      setSavedDraft(draft)
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setLastSavedTime(timeStr)
      toast.success('Draft saved successfully! You can finish it later.')
    } catch (err) {
      toast.error('Failed to save draft.')
    } finally {
      setSavingDraft(false)
    }
  }

  // Delete the single draft
  const handleDeleteDraft = async () => {
    if (!window.confirm('Are you sure you want to delete this saved draft?')) return
    try {
      await api.delete('/requests/draft')
      setSavedDraft(null)
      setLastSavedTime(null)
      // Reset to defaults
      setForm({
        present_location: '',
        new_location: '',
        purpose: '',
        fulfillment_type: 'transport',
        officer_doing_movement: user?.name || '',
        officer_doing_movement_staff_id: user?.staff_id || '',
        authorized_by: '',
        authorized_by_staff_id: '',
        requesting_officer_staff_id: user?.staff_id || '',
        department: user?.department || '',
        unit: '',
        movement_date: new Date().toISOString().split('T')[0],
        priority: 'Normal',
        signature_requester: user?.name || ''
      })
      setItems([{ item_no: 1, name_of_asset: '', asset_code: '' }])
      toast.success('Draft discarded.')
    } catch {
      toast.error('Failed to delete draft.')
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.present_location?.trim()) errs.present_location = 'Present location is required.'
    if (!form.new_location?.trim()) errs.new_location = 'New location is required.'
    if (!form.purpose?.trim()) errs.purpose = 'Purpose for the movement is required.'
    if (!form.movement_date) errs.movement_date = 'Movement date is required.'

    const validItems = items.filter(it => it.name_of_asset?.trim() && it.asset_code?.trim())
    if (validItems.length === 0) {
      errs.items = 'Please specify at least one asset with Name and Asset Code.'
    }

    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error('Please complete all required fields.')
      return
    }

    setLoading(true)
    try {
      const validItems = items.filter(it => it.name_of_asset?.trim() && it.asset_code?.trim())
      const payload = {
        present_location: form.present_location?.trim() || '',
        new_location: form.new_location?.trim() || '',
        purpose: form.purpose?.trim() || '',
        fulfillment_type: form.fulfillment_type || 'transport',
        officer_doing_movement: form.officer_doing_movement || user?.name || '',
        officer_doing_movement_staff_id: form.officer_doing_movement_staff_id || user?.staff_id || '',
        authorized_by: form.authorized_by || '',
        authorized_by_staff_id: form.authorized_by_staff_id || '',
        requesting_officer_staff_id: form.requesting_officer_staff_id || user?.staff_id || '',
        department: form.department || user?.department || '',
        unit: form.unit || '',
        movement_date: form.movement_date || new Date().toISOString().split('T')[0],
        priority: form.priority || 'Normal',
        signature_requester: form.signature_requester || user?.name || 'Signed Electronically',
        items: validItems
      }

      const res = await api.post('/requests', payload)
      const data = res.data?.data || res.data
      setSavedDraft(null) // Draft cleared on submission
      toast.success(`Request ${data.reference_no} submitted successfully!`)
      navigate(`/requests/${data.id}`)
    } catch (err) {
      console.error('Submission error:', err)
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to submit request.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            New Fixed Asset Movement Request
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Initial Asset Movement Request for Multi-Tier Approval
          </p>
        </div>

        {/* Active Directory Connection Status */}
        <div className="flex items-center gap-2 bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200/80 text-[11px] text-blue-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">Directory Ready</span>
        </div>
      </div>

      {/* Active Draft Banner */}
      {savedDraft && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <FileClock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-amber-950 flex items-center gap-2">
                <span>Saved Draft Restored</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Strictly 1 Draft Allowed
                </span>
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Last updated at {lastSavedTime || 'earlier session'}. You can continue editing, save updates, or discard it.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDeleteDraft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Draft
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Relocation Details */}
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4">
          <div className="border-b border-blue-50 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
              1. Location &amp; Purpose
            </h2>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Step 1 of 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Present Location of Asset <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="present_location"
                value={form.present_location}
                onChange={handleFormChange}
                placeholder="e.g. Branch Premises, Floor 1"
                className={`input-field ${errors.present_location ? 'border-rose-400 ring-1 ring-rose-200' : ''}`}
              />
              {errors.present_location && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.present_location}</p>
              )}
            </div>

            <div>
              <label className="label">
                New Location of Asset <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="new_location"
                value={form.new_location}
                onChange={handleFormChange}
                placeholder="e.g. Destination Branch / Facility"
                className={`input-field ${errors.new_location ? 'border-rose-400 ring-1 ring-rose-200' : ''}`}
              />
              {errors.new_location && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.new_location}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">
              Purpose for the Movement <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              name="purpose"
              value={form.purpose}
              onChange={handleFormChange}
              placeholder="State the administrative, operational or maintenance reason for relocating this asset..."
              className={`input-field ${errors.purpose ? 'border-rose-400 ring-1 ring-rose-200' : ''}`}
            />
            {errors.purpose && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.purpose}</p>
            )}
          </div>

          <div className="pt-2">
            <label className="label">
              Fulfillment &amp; Relocation Department <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, fulfillment_type: 'transport' }))}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                  form.fulfillment_type === 'transport'
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-950'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  form.fulfillment_type === 'transport' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">Transport &amp; Logistics Unit</span>
                    {form.fulfillment_type === 'transport' && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Standard fleet, trucks, moving contractors, office furniture, fixtures &amp; general branch equipment.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, fulfillment_type: 'it' }))}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                  form.fulfillment_type === 'it'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  form.fulfillment_type === 'it' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">IT Infrastructure &amp; Systems</span>
                    {form.fulfillment_type === 'it' && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Specialized IT pickup: enterprise servers, switches, racks, UPS, routers &amp; data center hardware.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Officer Doing Movement & Authorization */}
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4">
          <div className="border-b border-blue-50 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
              2. Staff Assignment &amp; Approval Authority (Active Directory)
            </h2>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Step 2 of 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Officer Doing the Movement</label>
              <ActiveDirectoryStaffPicker
                label=""
                placeholder="Search or type staff name..."
                selectedStaff={selectedMovementOfficer}
                onSelect={handleSelectMovementOfficer}
                onTextChange={(txt) => setForm(prev => ({ ...prev, officer_doing_movement: txt }))}
                value={form.officer_doing_movement}
              />
              <p className="text-[10px] text-slate-400 mt-1">Custodian or designated staff accompanying transfer.</p>
            </div>

            <div>
              <label className="label">Authorized By (Head / Supervisor)</label>
              <ActiveDirectoryStaffPicker
                label=""
                placeholder="Search or type approving head name..."
                selectedStaff={selectedAuthorizer}
                onSelect={handleSelectAuthorizer}
                onTextChange={(txt) => setForm(prev => ({ ...prev, authorized_by: txt }))}
                value={form.authorized_by}
              />
              <p className="text-[10px] text-slate-400 mt-1">Select from directory or type supervisor / department head name.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="label">
                Requested Movement Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="movement_date"
                value={form.movement_date}
                onChange={handleFormChange}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Movement Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
                className="input-field cursor-pointer"
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Asset Schedule Table (Up to 10 Rows) */}
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4">
          <div className="border-b border-blue-50 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                3. Asset Schedule (Max 10 Items)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Itemize each physical asset by name and tag code.
              </p>
            </div>
            {items.length < 10 && (
              <button
                type="button"
                onClick={addItemRow}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Add Row
              </button>
            )}
          </div>

          {errors.items && (
            <p className="text-xs text-rose-500 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {errors.items}
            </p>
          )}

          <div className="border border-blue-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-blue-50/70 border-b border-blue-100 text-blue-900 font-semibold">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12 uppercase text-[10px]">No.</th>
                  <th className="px-3 py-2.5 text-left uppercase text-[10px]">Name of Asset</th>
                  <th className="px-3 py-2.5 text-left w-52 uppercase text-[10px]">Asset Code</th>
                  <th className="px-2 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 bg-white">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition">
                    <td className="px-3 py-2 text-center font-semibold text-slate-500">
                      {row.item_no}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.name_of_asset}
                        onChange={(e) => handleItemChange(idx, 'name_of_asset', e.target.value)}
                        placeholder="Enter asset name or description"
                        className="w-full px-2.5 py-1.5 border border-blue-100 rounded text-xs uppercase focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.asset_code}
                        onChange={(e) => handleItemChange(idx, 'asset_code', e.target.value)}
                        placeholder="Enter asset tag or code"
                        className="w-full px-2.5 py-1.5 border border-blue-100 rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Actions with Draft Support */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-blue-100">
          <div className="text-[11px] text-slate-500">
            {savedDraft ? (
              <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                <FileClock className="w-3.5 h-3.5" />
                Single draft saved {lastSavedTime ? `at ${lastSavedTime}` : ''}
              </span>
            ) : (
              <span className="text-slate-400">
                You can save an uncompleted draft to finish later (1 draft max).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {savedDraft && (
              <button
                type="button"
                onClick={handleDeleteDraft}
                className="btn-danger py-2 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="btn-secondary py-2 text-xs"
              title="Save as single draft (overwrites previous draft)"
            >
              <Save className="w-3.5 h-3.5 text-blue-600" />
              {savingDraft ? 'Saving Draft...' : 'Save as Draft'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary py-2 text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Submitting Form...' : 'Submit Movement Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
