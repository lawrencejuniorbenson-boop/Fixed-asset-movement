/**
 * frontend/src/api/client.js
 * Small REST-style facade over the Supabase data service, so pages can call
 * api.get('/requests') etc. All data goes to Supabase; access rules are
 * enforced by the database (Row Level Security + triggers).
 */

import { supabaseDataService } from '../services/supabaseDataService'

// The signed-in / acting user, set by AuthContext.
let activeUser = null
export function setApiUser(u) {
  activeUser = u
}

function getActiveUser() {
  return activeUser || { id: null, name: '', email: '', role: '', department: '', staff_id: '' }
}

// Supabase Direct Router
async function handleSupabaseRoute(method, url, data, config = {}) {
  const cleanUrl = url.replace(/^\/api/, '').replace(/^\//, '')
  const [baseRoute, queryString] = cleanUrl.split('?')
  const urlParams = new URLSearchParams(queryString || '')
  const filterType = urlParams.get('type')

  const user = getActiveUser()
  const userId = user.id
  const role = user.role
  const isItPersona = role === 'it_head' || role === 'it_officer'

  // 1. STATS
  if (baseRoute === 'requests/stats') {
    const res = await supabaseDataService.getStats(role, userId)
    return { data: { success: true, data: res } }
  }

  // 2. DRAFTS
  if (baseRoute === 'requests/draft') {
    if (method === 'get') {
      const draft = await supabaseDataService.getDraft(userId)
      return { data: { success: true, data: draft } }
    }
    if (method === 'post') {
      const saved = await supabaseDataService.saveDraft(userId, data)
      return { data: { success: true, data: saved } }
    }
    if (method === 'delete') {
      await supabaseDataService.deleteDraft(userId)
      return { data: { success: true, message: 'Draft deleted.' } }
    }
  }

  // 3. REQUEST DETAIL & ACTIONS
  const approveMatch = baseRoute.match(/^requests\/(\d+)\/approve$/)
  if (approveMatch) {
    const req = await supabaseDataService.approveRequest(approveMatch[1], data?.remarks, user)
    return { data: { success: true, data: req, message: 'Approved successfully.' } }
  }

  const rejectMatch = baseRoute.match(/^requests\/(\d+)\/reject$/)
  if (rejectMatch) {
    const req = await supabaseDataService.rejectRequest(rejectMatch[1], data?.remarks, user)
    return { data: { success: true, data: req, message: 'Rejected.' } }
  }

  const closeMatch = baseRoute.match(/^requests\/(\d+)\/close$/)
  if (closeMatch) {
    const req = await supabaseDataService.closeRequest(closeMatch[1], data?.remarks, user)
    return { data: { success: true, data: req, message: 'Request closed.' } }
  }

  const requestDetailMatch = baseRoute.match(/^requests\/(\d+)$/)
  if (requestDetailMatch) {
    const req = await supabaseDataService.getRequestById(requestDetailMatch[1])
    return { data: { success: true, data: req } }
  }

  // 4. REQUESTS LIST & CREATE
  if (baseRoute === 'requests') {
    if (method === 'get') {
      const list = await supabaseDataService.getRequests(role, userId)
      return { data: { success: true, data: list } }
    }
    if (method === 'post') {
      const created = await supabaseDataService.createRequest(data, user)
      return { data: { success: true, data: created } }
    }
  }

  // 5. TRANSPORT & IT LOGISTICS
  if (baseRoute === 'transport/officers' || baseRoute === 'it-logistics/officers') {
    const wantsIt = filterType === 'it' || baseRoute.startsWith('it-logistics') || isItPersona
    const officers = await supabaseDataService.getFulfillmentOfficers(wantsIt)
    return { data: { success: true, data: officers } }
  }

  const assignMatch = baseRoute.match(/^(?:transport|it-logistics)\/(\d+)\/assign$/)
  if (assignMatch) {
    const t = await supabaseDataService.assignTransport(assignMatch[1], data, user)
    return { data: { success: true, data: t } }
  }

  const startMatch = baseRoute.match(/^(?:transport|it-logistics)\/(\d+)\/start$/)
  if (startMatch) {
    const t = await supabaseDataService.startTransport(startMatch[1], user)
    return { data: { success: true, data: t } }
  }

  const completeMatch = baseRoute.match(/^(?:transport|it-logistics)\/(\d+)\/complete$/)
  if (completeMatch) {
    const t = await supabaseDataService.completeTransport(completeMatch[1], data?.completion_notes, user)
    return { data: { success: true, data: t } }
  }

  const transportDetailMatch = baseRoute.match(/^(?:transport|it-logistics)\/(\d+)$/)
  if (transportDetailMatch) {
    const t = await supabaseDataService.getTransportTaskById(transportDetailMatch[1])
    return { data: { success: true, data: t } }
  }

  if (baseRoute === 'transport' || baseRoute === 'it-logistics') {
    const tasks = await supabaseDataService.getTransportTasks(user)
    if (baseRoute === 'it-logistics') {
      return { data: { success: true, data: tasks.filter(t => t.fulfillment_type === 'it') } }
    }
    if (baseRoute === 'transport' && role !== 'admin' && role !== 'auditor') {
      return { data: { success: true, data: tasks.filter(t => t.fulfillment_type !== 'it') } }
    }
    return { data: { success: true, data: tasks } }
  }

  // 6. STAFF DIRECTORY
  const staffMatch = cleanUrl.match(/^directory\/staff\/(.+)$/)
  if (staffMatch) {
    const idOrEmail = decodeURIComponent(staffMatch[1]).toLowerCase()
    const allUsers = await supabaseDataService.getUsers()
    const staff = allUsers.find(s => 
      (s.email && s.email.toLowerCase() === idOrEmail) ||
      (s.staff_id && s.staff_id.toLowerCase() === idOrEmail) ||
      (s.name && s.name.toLowerCase() === idOrEmail)
    ) || null
    return { data: { success: true, data: staff } }
  }

  if (cleanUrl.startsWith('directory/search')) {
    const q = config?.params?.q || urlParams.get('q') || ''
    const results = await supabaseDataService.getUsers(q)
    return { data: { success: true, data: results } }
  }

  if (cleanUrl === 'users') {
    if (method === 'post') {
      const created = await supabaseDataService.createUser(data)
      return { data: { success: true, data: created } }
    }
    const results = await supabaseDataService.getUsers()
    return { data: { success: true, data: results } }
  }

  const updateUserMatch = cleanUrl.match(/^users\/(\d+)$/)
  if (updateUserMatch && method === 'post') {
    const updated = await supabaseDataService.updateUser(updateUserMatch[1], data || {})
    return { data: { success: true, data: updated } }
  }

  const deleteUserMatch = cleanUrl.match(/^users\/(\d+)$/)
  if (deleteUserMatch && method === 'delete') {
    await supabaseDataService.deleteUser(deleteUserMatch[1])
    return { data: { success: true } }
  }

  throw new Error(`Unsupported API route: ${method.toUpperCase()} /${cleanUrl}`)
}

// Response shape kept as { data: { success, data } } for the existing pages.
const api = {
  get: (url, config) => handleSupabaseRoute('get', url, null, config),
  post: (url, data) => handleSupabaseRoute('post', url, data),
  delete: (url) => handleSupabaseRoute('delete', url)
}

export default api
