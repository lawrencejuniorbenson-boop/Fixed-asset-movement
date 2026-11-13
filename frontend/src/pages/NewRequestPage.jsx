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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
        <h1 className="page-title mt-2">New movement request</h1>
        <p className="page-subtitle">After you submit, it goes to your department head for approval.</p>
      </div>

      {savedDraft && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-amber-900">Draft restored</p>
              <p className="text-sm text-amber-800">Last saved {lastSavedTime || 'in an earlier session'}. Saving again replaces it.</p>
            </div>
          </div>
          <button type="button" onClick={handleDeleteDraft} className="btn-ghost btn-sm text-amber-900 hover:bg-amber-100">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Discard draft
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Relocation Details */}
        <div className="card space-y-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="section-title">
              Where and why
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="present_location">
                Current location <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="present_location"
                name="present_location"
                value={form.present_location}
                onChange={handleFormChange}
                placeholder="e.g. Accra Main Branch, 2nd floor"
                className={`input-field ${errors.present_location ? 'border-red-400 ring-1 ring-red-200' : ''}`}
              />
              {errors.present_location && (
                <p className="mt-1 text-sm text-red-600" role="alert">{errors.present_location}</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="new_location">
                New location <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="new_location"
                name="new_location"
                value={form.new_location}
                onChange={handleFormChange}
                placeholder="e.g. Kumasi Adum Branch"
                className={`input-field ${errors.new_location ? 'border-red-400 ring-1 ring-red-200' : ''}`}
              />
              {errors.new_location && (
                <p className="mt-1 text-sm text-red-600" role="alert">{errors.new_location}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="purpose">
              Purpose <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <textarea
              rows={2}
              id="purpose"
                name="purpose"
              value={form.purpose}
              onChange={handleFormChange}
              placeholder="Why do these assets need to move?"
              className={`input-field ${errors.purpose ? 'border-red-400 ring-1 ring-red-200' : ''}`}
            />
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.purpose}</p>
            )}
          </div>

          <div className="pt-2">
            <label className="label">
              Who will move it? <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, fulfillment_type: 'transport' }))}
                aria-pressed={form.fulfillment_type === 'transport'}
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
                    <span className="text-sm font-medium text-slate-900">Transport pool</span>
                    {form.fulfillment_type === 'transport' && (
                      <span className="badge badge-blue">Selected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                    Furniture, fixtures and general office equipment.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, fulfillment_type: 'it' }))}
                aria-pressed={form.fulfillment_type === 'it'}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition ${
                  form.fulfillment_type === 'it'
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-950'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  form.fulfillment_type === 'it' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">IT pool</span>
                    {form.fulfillment_type === 'it' && (
                      <span className="badge badge-blue">Selected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                    Servers, network equipment, racks, UPS and other data-centre hardware.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Officer Doing Movement & Authorization */}
        <div className="card space-y-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="section-title">
              People and timing
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Officer doing the movement</label>
              <ActiveDirectoryStaffPicker
                label=""
                placeholder="Search staff or type a name"
                selectedStaff={selectedMovementOfficer}
                onSelect={handleSelectMovementOfficer}
                onTextChange={(txt) => setForm(prev => ({ ...prev, officer_doing_movement: txt }))}
                value={form.officer_doing_movement}
              />
              <p className="hint">The person accompanying the assets.</p>
            </div>

            <div>
              <label className="label">Authorizing head</label>
              <ActiveDirectoryStaffPicker
                label=""
                placeholder="Search staff or type a name"
                selectedStaff={selectedAuthorizer}
                onSelect={handleSelectAuthorizer}
                onTextChange={(txt) => setForm(prev => ({ ...prev, authorized_by: txt }))}
                value={form.authorized_by}
              />
              <p className="hint">Your department head, as named on the paper form.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="label" htmlFor="movement_date">
                Move date <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <input
                type="date"
                id="movement_date"
                name="movement_date"
                value={form.movement_date}
                onChange={handleFormChange}
                className="input-field"
              />
            </div>

            <div>
              <label className="label" htmlFor="priority">Priority</label>
              <select
                id="priority"
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
        <div className="card space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="section-title">
                Assets to move
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                List each item with its asset tag or code (up to 10).
              </p>
            </div>
            {items.length < 10 && (
              <button
                type="button"
                onClick={addItemRow}
                className="btn-secondary btn-sm shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Add item
              </button>
            )}
          </div>

          {errors.items && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
              {errors.items}
            </p>
          )}

          <ol className="space-y-3">
            {items.map((row, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600" aria-hidden="true">
                  {idx + 1}
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_13rem]">
                  <div>
                    <label htmlFor={`item-name-${idx}`} className="sr-only">Asset name, item {idx + 1}</label>
                    <input
                      id={`item-name-${idx}`}
                      type="text"
                      value={row.name_of_asset}
                      onChange={(e) => handleItemChange(idx, 'name_of_asset', e.target.value)}
                      placeholder="Asset name, e.g. Executive desk"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`item-code-${idx}`} className="sr-only">Asset code, item {idx + 1}</label>
                    <input
                      id={`item-code-${idx}`}
                      type="text"
                      value={row.asset_code}
                      onChange={(e) => handleItemChange(idx, 'asset_code', e.target.value)}
                      placeholder="Asset code"
                      className="input-field font-mono"
                    />
                  </div>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove item ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* Form Actions with Draft Support */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {savedDraft ? (
              <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                <FileClock className="w-3.5 h-3.5" />
                Single draft saved {lastSavedTime ? `at ${lastSavedTime}` : ''}
              </span>
            ) : (
              <span>You can save a draft and finish later.</span>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {savedDraft && (
              <button
                type="button"
                onClick={handleDeleteDraft}
                className="btn-ghost text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="btn-secondary"
              title="Save as single draft (overwrites previous draft)"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {savingDraft ? 'Saving…' : 'Save draft'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
