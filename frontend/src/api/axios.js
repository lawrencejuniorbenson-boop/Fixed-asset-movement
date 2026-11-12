/**
 * frontend/src/api/axios.js
 * Hybrid API Client:
 * 1. If Supabase is connected -> queries Supabase cloud directly (serverless)
 * 2. If Supabase is not configured -> routes via Axios to local Express backend on port 3001
 */

import axios from 'axios'
import { isSupabaseConfigured } from '../lib/supabase'
import { supabaseDataService } from '../services/supabaseDataService'
import { INSTITUTIONAL_FLEET, INSTITUTIONAL_DRIVERS } from '../services/fleetData'

const axiosInstance = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
})

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-handle session expiration / 401 Unauthorized
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('FAM_ACTIVE_USER')
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Current active persona helper
function getActiveUser() {
  const defaultUser = {
    id: null,
    name: 'Authorized Officer',
    email: '',
    role: 'requesting_officer',
    department: '',
    staff_id: ''
  }
  try {
    const raw = localStorage.getItem('FAM_ACTIVE_USER')
    return raw ? JSON.parse(raw) : defaultUser
  } catch {
    return defaultUser
  }
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
  const userDept = user.department || ''
  const isItPersona = role === 'it_head' || role === 'it_officer' || userDept.includes('IT') || userDept.includes('Information')

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

  if (cleanUrl === 'transport/fleet') {
    let allTasks = []
    try {
      allTasks = await supabaseDataService.getTransportTasks()
    } catch {
      allTasks = []
    }
    const activeTasks = (allTasks || []).filter(t => t.status !== 'completed')

    const vehicles = INSTITUTIONAL_FLEET.map(veh => {
      const assignedTask = activeTasks.find(t => {
        const vDetails = (t.vehicle_details || '').toUpperCase()
        const vReg = (veh.reg_number || '').toUpperCase()
        const vName = (veh.name || '').toUpperCase()
        return vDetails.includes(vReg) || (vDetails.includes('SPRINTER') && vName.includes('SPRINTER')) || (vDetails.includes('ISUZU') && vName.includes('ISUZU'))
      })

      if (assignedTask) {
        return {
          ...veh,
          status: 'assigned',
          active_task: {
            task_id: assignedTask.id,
            request_id: assignedTask.movement_request_id,
            reference_no: assignedTask.request?.reference_no || `REQ-${assignedTask.movement_request_id}`,
            present_location: assignedTask.request?.present_location || 'Branch',
            new_location: assignedTask.request?.new_location || 'Head Office',
            scheduled_date: assignedTask.scheduled_date,
            status: assignedTask.status,
            assigned_officer_name: assignedTask.assigned_officer_name || 'Transport Officer',
            items_count: (assignedTask.items || []).length
          }
        }
      }
      return { ...veh, status: 'available', active_task: null }
    })

    const drivers = INSTITUTIONAL_DRIVERS.map(driver => {
      const assignedTask = activeTasks.find(t => {
        return (
          t.assigned_officer_id === driver.id ||
          (t.assigned_officer_name && t.assigned_officer_name.toLowerCase().includes(driver.name.toLowerCase())) ||
          (t.vehicle_details && t.vehicle_details.toLowerCase().includes(driver.name.toLowerCase()))
        )
      })

      if (assignedTask) {
        return {
          ...driver,
          status: 'assigned',
          active_task: {
            task_id: assignedTask.id,
            request_id: assignedTask.movement_request_id,
            reference_no: assignedTask.request?.reference_no || `REQ-${assignedTask.movement_request_id}`,
            vehicle_details: assignedTask.vehicle_details,
            present_location: assignedTask.request?.present_location || 'Branch',
            new_location: assignedTask.request?.new_location || 'Head Office',
            scheduled_date: assignedTask.scheduled_date,
            status: assignedTask.status
          }
        }
      }
      return { ...driver, status: 'available', active_task: null }
    })

    return {
      data: {
        success: true,
        data: {
          metrics: {
            total_vehicles: vehicles.length,
            available_vehicles: vehicles.filter(v => v.status === 'available').length,
            assigned_vehicles: vehicles.filter(v => v.status === 'assigned').length,
            total_drivers: drivers.length,
            available_drivers: drivers.filter(d => d.status === 'available').length,
            assigned_drivers: drivers.filter(d => d.status === 'assigned').length,
            active_missions: activeTasks.length
          },
          vehicles,
          drivers,
          active_tasks: activeTasks
        }
      }
    }
  }



  // 6. DIRECTORY (ACTIVE DIRECTORY)
  if (cleanUrl === 'directory/status') {
    return {
      data: {
        success: true,
        data: {
          server_url: 'ldap://ad.bank.internal:389',
          domain: 'ad.bank.internal',
          connection_status: 'CONNECTED',
          last_sync: new Date().toISOString()
        }
      }
    }
  }

  const staffMatch = cleanUrl.match(/^directory\/staff\/(.+)$/)
  if (staffMatch) {
    const idOrEmail = decodeURIComponent(staffMatch[1]).toLowerCase()
    const allUsers = await supabaseDataService.getUsers()
    const staff = allUsers.find(s => 
      (s.email && s.email.toLowerCase() === idOrEmail) ||
      (s.staff_id && s.staff_id.toLowerCase() === idOrEmail) ||
      (s.name && s.name.toLowerCase() === idOrEmail)
    ) || allUsers[0] || null
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

  const deleteUserMatch = cleanUrl.match(/^users\/(\d+)$/)
  if (deleteUserMatch && method === 'delete') {
    await supabaseDataService.deleteUser(deleteUserMatch[1])
    return { data: { success: true } }
  }

  // Fallback to axios if not handled
  return axiosInstance({ method, url, data })
}

// Unified API Wrapper
const api = {
  get: async (url, config) => {
    if (isSupabaseConfigured()) {
      try {
        return await handleSupabaseRoute('get', url, null, config)
      } catch (err) {
        console.warn('Supabase query error:', err)
        const isOffline = err?.message?.includes('fetch failed') || err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch')
        if (isOffline) {
          return axiosInstance.get(url, config)
        }
        throw err
      }
    }
    return axiosInstance.get(url, config)
  },

  post: async (url, data, config) => {
    if (isSupabaseConfigured()) {
      try {
        return await handleSupabaseRoute('post', url, data)
      } catch (err) {
        console.warn('Supabase post error:', err)
        const isOffline = err?.message?.includes('fetch failed') || err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch')
        if (isOffline) {
          return axiosInstance.post(url, data, config)
        }
        throw err
      }
    }
    return axiosInstance.post(url, data, config)
  },

  delete: async (url, config) => {
    if (isSupabaseConfigured()) {
      try {
        return await handleSupabaseRoute('delete', url)
      } catch (err) {
        console.warn('Supabase delete error:', err)
        const isOffline = err?.message?.includes('fetch failed') || err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch')
        if (isOffline) {
          return axiosInstance.delete(url, config)
        }
        throw err
      }
    }
    return axiosInstance.delete(url, config)
  }
}

export default api
