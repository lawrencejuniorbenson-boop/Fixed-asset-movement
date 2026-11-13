import React from 'react'
import { formatDate } from '../lib/format'
import { Download, Lock, CheckCircle2, FileText } from 'lucide-react'

export default function MovementFormView({ request }) {
  if (!request) return null

  const isFlowCompleted = request.status === 'closed'

  const items = request.items || []
  // Keep 10 rows to mirror official physical document
  const rows = [...items]
  while (rows.length < 10) {
    rows.push({
      item_no: rows.length + 1,
      name_of_asset: '',
      asset_code: ''
    })
  }

  const handleDownloadPdf = () => {
    if (!isFlowCompleted) return
    const prevTitle = document.title
    document.title = `Official_Fixed_Asset_Movement_Form_${request.reference_no || 'Document'}`
    window.print()
    setTimeout(() => {
      document.title = prevTitle
    }, 1500)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
      {/* Utility Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="text-xs font-semibold text-blue-950 tracking-wide uppercase">
            Official Movement Sheet
          </span>
          <span className="text-xs font-mono text-blue-700 font-medium">
            &bull; Ref: {request.reference_no}
          </span>
        </div>

        {isFlowCompleted ? (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            title="Download Official Completed Movement Form as PDF"
          >
            <Download className="w-3.5 h-3.5 text-emerald-100" />
            <span>Download Official Movement Form (PDF)</span>
          </button>
        ) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium"
            title="Official Form download is unlocked once all approval, logistics transit, and register closure stages are complete."
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Download Locked &bull; Available once request flow is completed</span>
          </div>
        )}
      </div>

      {/* The Printable Official Document Sheet */}
      <div className="p-8 sm:p-12 max-w-3xl mx-auto bg-white text-slate-900  print:p-0">
        {/* Document Header */}
        <div className="text-center pb-6 border-b-2 border-slate-900">
          <h1 className="text-lg font-bold tracking-widest uppercase text-slate-900">
            FIXED ASSET MOVEMENT FORM
          </h1>
          <p className="text-[11px] font-medium tracking-wider text-slate-500 mt-1 uppercase">
            Asset Management &amp; Archives Department
          </p>
        </div>

        {/* Metadata Fields */}
        <div className="mt-6 space-y-3.5 text-xs">
          <div className="flex items-baseline">
            <span className="font-semibold text-slate-800 w-64 uppercase tracking-wider text-[11px]">
              PRESENT LOCATION OF THE ASSET:
            </span>
            <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">
              {request.present_location}
            </span>
          </div>

          <div className="flex items-baseline">
            <span className="font-semibold text-slate-800 w-64 uppercase tracking-wider text-[11px]">
              NEW LOCATION OF THE ASSET:
            </span>
            <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">
              {request.new_location}
            </span>
          </div>

          <div className="flex items-baseline">
            <span className="font-semibold text-slate-800 w-64 uppercase tracking-wider text-[11px]">
              PURPOSE FOR THE MOVEMENT:
            </span>
            <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">
              {request.purpose}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex items-baseline">
              <span className="font-semibold text-slate-800 w-52 uppercase tracking-wider text-[11px]">
                OFFICER DOING THE MOVEMENT:
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">
                {request.officer_doing_movement || request.requester_name}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-semibold text-slate-800 w-28 uppercase tracking-wider text-[11px]">
                SIGNATURE:
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 italic text-slate-800">
                {request.signature_requester || '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex items-baseline">
              <span className="font-semibold text-slate-800 w-36 uppercase tracking-wider text-[11px]">
                AUTHORIZED BY:
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">
                {request.head_approver_name || (request.authorized_by ? `${request.authorized_by} (approval pending)` : '—')}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-semibold text-slate-800 w-20 uppercase tracking-wider text-[11px]">
                DATE:
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">
                {formatDate(request.movement_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule of Assets (Clean Grid from the Original Document) */}
        <div className="mt-8">
          <table className="w-full border-collapse border border-slate-800 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-800">
                <th className="border border-slate-800 px-3 py-2 text-center w-12 font-bold uppercase text-slate-900">
                  No.
                </th>
                <th className="border border-slate-800 px-4 py-2 text-left font-bold uppercase text-slate-900">
                  NAME OF ASSET
                </th>
                <th className="border border-slate-800 px-4 py-2 text-left w-56 font-bold uppercase text-slate-900">
                  ASSET CODE
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="h-8 border-b border-slate-800">
                  <td className="border border-slate-800 px-3 py-1.5 text-center font-semibold text-slate-700">
                    {row.item_no || idx + 1}
                  </td>
                  <td className="border border-slate-800 px-4 py-1.5 font-medium text-slate-900 uppercase">
                    {row.name_of_asset || ''}
                  </td>
                  <td className="border border-slate-800 px-4 py-1.5 font-mono text-slate-800">
                    {row.asset_code || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Authorization Section: Approved by Asset Management & Archives Department Pool */}
        <div className="mt-8 pt-4 border-t-2 border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span>Authorized by Asset &amp; Archives Department Pool</span>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase ">
                    AMA Pool
                  </span>
                </p>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-xs font-medium text-slate-700 uppercase">Authorizing Officer:</span>
                  <span className="min-w-[220px] border-b border-dotted border-slate-400 font-semibold text-slate-900">
                    {request.ama_head_name || request.ama_officer_name || '.............................................'}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xs font-medium text-slate-700 uppercase">Signature:</span>
                  <span className="min-w-[220px] border-b border-dotted border-slate-400 italic text-slate-800">
                    {request.ama_head_signature || request.ama_head_name || '.......................................'}
                  </span>
                </div>
              </div>

              {request.ama_officer_name && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                  <span className="text-blue-700 font-medium">Verified by (Asset &amp; Archives Pool): </span>
                  <span className="font-semibold text-slate-900">{request.ama_officer_name}</span>
                  {request.ama_officer_approved_at && (
                    <span className="text-slate-400 ml-1">on {formatDate(request.ama_officer_approved_at)}</span>
                  )}
                </div>
              )}
            </div>

            {/* Approval Status Stamp */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-blue-50/50 min-w-[180px]">
              <span className="text-[10px] uppercase font-semibold text-blue-700 tracking-wider">
                Status
              </span>
              <span className="text-xs font-bold uppercase text-blue-950 mt-0.5 text-center">
                {request.status.replace(/_/g, ' ')}
              </span>
              {request.ama_head_approved_at && (
                <span className="text-[10px] text-blue-700 mt-0.5">
                  {formatDate(request.ama_head_approved_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Fulfillment Annex (Transport / IT) */}
        {request.transport_task && (
          <div className="mt-8 pt-4 border-t border-dashed border-slate-200 text-xs text-slate-700 space-y-1.5 bg-blue-50/30 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold uppercase tracking-wider text-[11px] text-blue-950">
                {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
                  ? 'IT Infrastructure & Logistics Execution'
                  : 'Transport & Logistics Execution'}
              </p>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded border border-slate-200">
                {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
                  ? 'IT Systems Pool'
                  : 'Transport Pool'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px] text-slate-600">
              <div>
                <span className="text-blue-700 font-medium block">Department Pool:</span>
                <span className="font-semibold text-slate-900 block">
                  {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it'
                    ? 'IT Infrastructure & Systems'
                    : 'Transport & Logistics'}
                </span>
              </div>
              <div>
                <span className="text-blue-700 font-medium block">
                  {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'Transit Carrier / Protocol:' : 'Vehicle / Carrier:'}
                </span>
                <span className="font-semibold text-slate-900 block truncate" title={request.transport_task.vehicle_details}>
                  {request.transport_task.vehicle_details || (request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'IT Designated Carrier' : 'Designated Pool Carrier')}
                </span>
              </div>
              <div>
                <span className="text-blue-700 font-medium block">
                  {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'Technical Escort / Officer:' : 'Driver / Carrier:'}
                </span>
                <span className="font-semibold text-slate-900 block truncate" title={request.transport_task.driver_name}>
                  {request.transport_task.driver_name || (request.transport_task.status === 'pending_assignment'
                    ? (request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'Pending IT assignment' : 'Pending driver')
                    : (request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'IT Infrastructure Escort' : 'Department Driver / Carrier'))}
                </span>
              </div>
              <div>
                <span className="text-blue-700 font-medium block">Relocation Date:</span>
                <span className="font-semibold text-slate-900 block">
                  {request.transport_task.scheduled_date || '—'}
                </span>
              </div>
            </div>
            {request.transport_task.completed_at && (
              <p className="text-emerald-700 font-medium text-[11px] pt-1">
                &bull; Physical relocation completed by {request.fulfillment_type === 'it' || request.transport_task?.fulfillment_type === 'it' ? 'IT Infrastructure & Systems Department' : 'Transport & Logistics Department'} on {new Date(request.transport_task.completed_at).toLocaleDateString()}. Asset &amp; Archives Department notified.
              </p>
            )}
            {request.ama_closed_at && (
              <p className="text-blue-900 text-[11px]">
                &bull; Asset register records updated and closed by Asset &amp; Archives Department on {formatDate(request.ama_closed_at)}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

