import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Truck, Users, CheckCircle2, Clock, MapPin, Search,
  ArrowRight, ShieldCheck, Phone, Fuel, Gauge, AlertCircle,
  ExternalLink, Calendar, Car, ArrowUpRight, Sparkles
} from 'lucide-react'
import api from '../api/axios'
import LoadingSkeleton from './LoadingSkeleton'
import StatusBadge from './StatusBadge'

export default function TransportFleetDashboard({ user }) {
  const [fleetData, setFleetData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('vehicles') // 'vehicles' | 'drivers' | 'missions'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'available' | 'assigned'
  const [searchTerm, setSearchTerm] = useState('')

  const loadFleetData = async () => {
    try {
      const res = await api.get('/transport/fleet')
      setFleetData(res.data?.data || null)
    } catch (err) {
      console.error('Failed to load fleet data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFleetData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={1} cols={4} />
        <LoadingSkeleton rows={4} cols={3} />
      </div>
    )
  }

  const metrics = fleetData?.metrics || {
    total_vehicles: 0,
    available_vehicles: 0,
    assigned_vehicles: 0,
    total_drivers: 0,
    available_drivers: 0,
    assigned_drivers: 0,
    active_missions: 0
  }

  const vehicles = fleetData?.vehicles || []
  const drivers = fleetData?.drivers || []
  const activeTasks = fleetData?.active_tasks || []

  // Filter vehicles
  const filteredVehicles = vehicles.filter(v => {
    const matchFilter = statusFilter === 'all' || v.status === statusFilter
    const q = searchTerm.toLowerCase()
    const matchSearch =
      !q ||
      v.reg_number.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      (v.active_task?.reference_no || '').toLowerCase().includes(q) ||
      (v.active_task?.assigned_officer_name || '').toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    const matchFilter = statusFilter === 'all' || d.status === statusFilter
    const q = searchTerm.toLowerCase()
    const matchSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.staff_id.toLowerCase().includes(q) ||
      d.job_title.toLowerCase().includes(q) ||
      (d.active_task?.reference_no || '').toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner for Transport Department */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-sm border border-blue-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/10 shrink-0">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-blue-100 border border-blue-400/30">
                  Transport &amp; Fleet Operations
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Fleet Tracking
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white mt-1">
                Transport Department Fleet &amp; Driver Operations
              </h1>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Real-time visibility of institutional vehicles, certified drivers, and active asset relocation tasks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/transport"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-blue-900 hover:bg-blue-50 font-semibold text-xs rounded-xl shadow-xs transition"
            >
              <Truck className="w-4 h-4 text-blue-700" />
              Manage Logistics Tasks ({activeTasks.length})
            </Link>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vehicles Available */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available Vehicles</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-extrabold text-emerald-700">{metrics.available_vehicles}</p>
            <span className="text-xs text-slate-500 font-medium">/ {metrics.total_vehicles} total cars</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Ready for task assignment</p>
        </div>

        {/* Vehicles Assigned */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Assigned / In Transit</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-extrabold text-blue-900">{metrics.assigned_vehicles}</p>
            <span className="text-xs text-slate-500 font-medium">cars deployed</span>
          </div>
          <p className="text-[11px] text-blue-600 font-medium mt-1">Executing asset relocation</p>
        </div>

        {/* Drivers Available */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available Drivers</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-extrabold text-emerald-700">{metrics.available_drivers}</p>
            <span className="text-xs text-slate-500 font-medium">/ {metrics.total_drivers} officers</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">On duty &amp; ready</p>
        </div>

        {/* Drivers Assigned */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:border-blue-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Assigned on Mission</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-extrabold text-indigo-800">{metrics.assigned_drivers}</p>
            <span className="text-xs text-slate-500 font-medium">officers driving</span>
          </div>
          <p className="text-[11px] text-indigo-600 font-medium mt-1">{metrics.active_missions} active task(s)</p>
        </div>
      </div>

      {/* Main Content Area: Tabs & Filters */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="px-6 pt-5 border-b border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/40 via-white to-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`flex items-center gap-2 pb-3.5 px-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'vehicles'
                  ? 'border-blue-600 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-blue-700'
              }`}
            >
              <Car className="w-4 h-4" />
              Fleet Vehicles / Cars ({vehicles.length})
            </button>

            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center gap-2 pb-3.5 px-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'drivers'
                  ? 'border-blue-600 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-blue-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Drivers &amp; Transport Officers ({drivers.length})
            </button>

            <button
              onClick={() => setActiveTab('missions')}
              className={`flex items-center gap-2 pb-3.5 px-3 text-xs font-bold border-b-2 transition ${
                activeTab === 'missions'
                  ? 'border-blue-600 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-blue-700'
              }`}
            >
              <Truck className="w-4 h-4" />
              Active Relocation Missions ({activeTasks.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="pb-3 md:pb-3 relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search car plate, driver, ref..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>
        </div>

        {/* Status Filter Buttons (for vehicles and drivers) */}
        {activeTab !== 'missions' && (
          <div className="px-6 py-3 border-b border-blue-50 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Filter by Status:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-blue-50 border border-slate-200'
                }`}
              >
                All ({activeTab === 'vehicles' ? vehicles.length : drivers.length})
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  statusFilter === 'available'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                Available ({activeTab === 'vehicles' ? metrics.available_vehicles : metrics.available_drivers})
              </button>
              <button
                onClick={() => setStatusFilter('assigned')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  statusFilter === 'assigned'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                }`}
              >
                Assigned to Task ({activeTab === 'vehicles' ? metrics.assigned_vehicles : metrics.assigned_drivers})
              </button>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Showing {activeTab === 'vehicles' ? filteredVehicles.length : filteredDrivers.length} record(s)
            </span>
          </div>
        )}

        {/* 1. VEHICLES VIEW */}
        {activeTab === 'vehicles' && (
          <div className="p-6">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No vehicles matching filter "{statusFilter}".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredVehicles.map(veh => {
                  const isAssigned = veh.status === 'assigned'
                  const task = veh.active_task

                  return (
                    <div
                      key={veh.id}
                      className={`rounded-2xl border transition p-5 flex flex-col justify-between ${
                        isAssigned
                          ? 'border-blue-300 bg-gradient-to-b from-blue-50/50 to-white shadow-sm ring-1 ring-blue-500/10'
                          : 'border-slate-200 hover:border-emerald-200 bg-white shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Top Plate & Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <span className="font-mono font-bold text-sm px-2.5 py-1 rounded-lg bg-blue-950 text-white tracking-wider border border-blue-900 shadow-2xs">
                              {veh.reg_number}
                            </span>
                            <span className="ml-2 text-[10px] font-semibold text-slate-400">
                              {veh.capacity}
                            </span>
                          </div>

                          {isAssigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                              Assigned to Task
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Available
                            </span>
                          )}
                        </div>

                        {/* Vehicle Name & Type */}
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          {veh.name}
                        </h3>
                        <p className="text-xs text-blue-600 font-medium mt-0.5">
                          {veh.category} &bull; {veh.fuel_type}
                        </p>

                        {/* Depot Bay */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{veh.depot_bay}</span>
                        </div>

                        {/* Features Tags */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {veh.features.slice(0, 3).map((f, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              {f}
                            </span>
                          ))}
                        </div>

                        {/* TASK ASSIGNMENT CARD (If assigned) */}
                        {isAssigned && task && (
                          <div className="mt-4 p-3.5 rounded-xl bg-blue-100/60 border border-blue-200">
                            <div className="flex items-center justify-between text-[11px] font-bold text-blue-950 mb-1.5">
                              <span className="flex items-center gap-1 text-blue-800">
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                Mission {task.reference_no}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-blue-700 border border-blue-200">
                                {task.status === 'in_progress' ? 'In Transit' : 'Scheduled'}
                              </span>
                            </div>

                            <div className="text-[11px] space-y-1 text-slate-700">
                              <p className="truncate">
                                <strong className="text-blue-950">Driver:</strong> {task.assigned_officer_name}
                              </p>
                              <p className="truncate">
                                <strong className="text-blue-950">Route:</strong> {task.present_location} &rarr; {task.new_location}
                              </p>
                              {task.scheduled_date && (
                                <p className="text-[10px] text-slate-500">
                                  Scheduled: {task.scheduled_date} &bull; {task.items_count} item(s)
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        {isAssigned && task ? (
                          <Link
                            to={`/transport/${task.task_id}`}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-2xs"
                          >
                            <span>Open Mission Tracker</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <Link
                            to="/transport"
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Available &bull; Assign to Task</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. DRIVERS VIEW */}
        {activeTab === 'drivers' && (
          <div className="p-6">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No drivers matching filter "{statusFilter}".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                {filteredDrivers.map(driver => {
                  const isAssigned = driver.status === 'assigned'
                  const task = driver.active_task

                  return (
                    <div
                      key={driver.id}
                      className={`rounded-2xl border transition p-5 flex flex-col justify-between ${
                        isAssigned
                          ? 'border-indigo-300 bg-gradient-to-b from-indigo-50/40 to-white shadow-sm ring-1 ring-indigo-500/10'
                          : 'border-slate-200 hover:border-emerald-200 bg-white shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Header: Driver Name & Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200">
                              {driver.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900">{driver.name}</h3>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                  {driver.staff_id}
                                </span>
                              </div>
                              <p className="text-xs text-blue-700 font-medium">{driver.job_title}</p>
                            </div>
                          </div>

                          {isAssigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                              Assigned on Mission
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Available
                            </span>
                          )}
                        </div>

                        {/* Driver Attributes */}
                        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">License Class</span>
                            <span className="font-semibold text-slate-800 text-[11px] truncate block">
                              {driver.license_class}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Experience</span>
                            <span className="font-semibold text-slate-800 text-[11px] block">
                              {driver.experience_years} Years &bull; Certified
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 mt-3 pt-2">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-blue-600" /> {driver.phone}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {driver.base_depot}
                          </span>
                        </div>

                        {/* ACTIVE TASK ASSIGNMENT */}
                        {isAssigned && task && (
                          <div className="mt-4 p-3.5 rounded-xl bg-indigo-100/60 border border-indigo-200">
                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950 mb-1.5">
                              <span className="flex items-center gap-1 text-indigo-900">
                                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                Assigned Task: {task.reference_no}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                                {task.status === 'in_progress' ? 'En Route' : 'Scheduled'}
                              </span>
                            </div>

                            <div className="text-[11px] space-y-1 text-slate-700">
                              <p className="truncate">
                                <strong className="text-indigo-950">Vehicle:</strong> {task.vehicle_details || 'Logistics Van'}
                              </p>
                              <p className="truncate">
                                <strong className="text-indigo-950">Destination:</strong> {task.new_location}
                              </p>
                              {task.scheduled_date && (
                                <p className="text-[10px] text-slate-500">
                                  Scheduled: {task.scheduled_date}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Driver Card Action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        {isAssigned && task ? (
                          <Link
                            to={`/transport/${task.task_id}`}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-indigo-700 text-white hover:bg-indigo-800 transition shadow-2xs"
                          >
                            <span>View Assigned Relocation Task</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <span className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Driver Ready for Dispatch</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. MISSIONS SCHEDULE VIEW */}
        {activeTab === 'missions' && (
          <div className="p-6">
            {activeTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">All Relocation Missions Completed</p>
                <p className="text-xs text-slate-400 mt-1">There are currently no active transport tasks awaiting or executing movement.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTasks.map(task => {
                  const ref = task.request?.reference_no || `REQ-${task.movement_request_id}`
                  const fromLoc = task.request?.present_location || 'Branch'
                  const toLoc = task.request?.new_location || 'Head Office'
                  const officer = task.assigned_officer_name || 'Not assigned yet'
                  const vehicle = task.vehicle_details || 'Vehicle not selected'
                  const itemsCount = (task.items || []).length

                  return (
                    <div
                      key={task.id}
                      className="p-5 rounded-2xl border border-blue-200 bg-white hover:shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200">
                            {ref}
                          </span>
                          <StatusBadge status={task.status} fulfillmentType={task.fulfillment_type} />
                          {task.scheduled_date && (
                            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {task.scheduled_date}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                          <span>{fromLoc}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-blue-900">{toLoc}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1 text-blue-950 font-medium">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            <strong>Car:</strong> {vehicle}
                          </span>
                          <span className="flex items-center gap-1 text-blue-950 font-medium">
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                            <strong>Officer:</strong> {task.assigned_officer_name || officer || 'Pending'}
                          </span>
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <strong>Driver:</strong> {task.driver_name || (task.driver_type === 'vendor' ? (task.vendor_name ? `Vendor (${task.vendor_name})` : 'Vendor Carrier') : 'Vendor / Self')}
                          </span>
                          <span className="text-slate-400">
                            &bull; {itemsCount} asset item(s) itemized
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/transport/${task.id}`}
                          className="btn-primary py-2 px-4 text-xs bg-blue-600 hover:bg-blue-700"
                        >
                          View Mission &rarr;
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

