import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Users,
  Server,
  Layers,
  ChevronRight
} from 'lucide-react'
import { useAuth, errorText } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const { user, login, register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'register'

  // Sign In fields (clean by default)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Register fields
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regDept, setRegDept] = useState('Banking Operations')
  const [regStaffId, setRegStaffId] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')

    if (mode === 'signin') {
      if (!email.trim() || !password) {
        setError('Please provide both corporate email and password.')
        return
      }

      setLoading(true)
      try {
        const authUser = await login(email.trim(), password)
        toast.success(`Welcome back, ${authUser?.name || 'Officer'}!`)
        navigate('/dashboard')
      } catch (err) {
        setError(errorText(err, 'Invalid email or password.'))
      } finally {
        setLoading(false)
      }
    } else {
      if (!regName.trim() || !regEmail.trim() || !regPassword) {
        setError('Full Name, corporate email, and password are required.')
        return
      }

      setLoading(true)
      try {
        const result = await register({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          department: regDept.trim(),
          staff_id: regStaffId.trim()
        })
        if (result.needsConfirmation) {
          toast.success('Account created. Check your email to confirm it, then sign in.')
          setMode('signin')
          setEmail(regEmail.trim().toLowerCase())
          setRegPassword('')
        } else {
          toast.success(`Account registered! Signed in as ${result.user.name}`)
          navigate('/dashboard')
        }
      } catch (err) {
        setError(errorText(err, 'Registration failed.'))
      } finally {
        setLoading(false)
      }
    }
  }



  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Graphic Accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* Top Banner Navigation */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center font-black shadow-lg shadow-blue-500/20 border border-blue-400/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-wider text-white uppercase">ENTERPRISE BANK</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                CORPORATE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Fixed Asset Movement Portal &bull; Enterprise Service</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-300">Active Directory Online</span>
          </div>
          {user && (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition"
            >
              <span>Back to Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md mx-auto">
          
          {/* Main Card: Staff Login & Registration Form */}
          <div className="w-full">
            <div className="bg-white rounded-2xl shadow-2xl shadow-slate-950/80 border border-slate-200 overflow-hidden">
              
              {/* Form Header */}
              <div className="p-6 sm:p-7 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Internal Access Only
                  </span>
                </div>

                {/* Mode Tabs */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold mb-3">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setError('') }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-center transition ${
                      mode === 'signin'
                        ? 'bg-white text-blue-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Staff Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError('') }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-center transition ${
                      mode === 'register'
                        ? 'bg-white text-blue-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Register New Staff
                  </button>
                </div>

                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {mode === 'signin' ? 'Staff Sign In' : 'Register Corporate Staff'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  {mode === 'signin'
                    ? 'Sign in with your corporate email and password.'
                    : 'Create your staff account. You will receive an email to confirm it.'}
                </p>
              </div>

              {/* Form Body */}
              <div className="p-6 sm:p-7">
                {user && (
                  <div className="mb-5 p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-blue-950">Currently signed in as:</p>
                      <p className="text-[11px] text-blue-700">{user.name} ({user.role})</p>
                    </div>
                    <Link
                      to="/dashboard"
                      className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                      Enter &rarr;
                    </Link>
                  </div>
                )}

                {error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Authentication Error</p>
                      <p className="text-[11px] mt-0.5 text-rose-600">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'signin' ? (
                    <>
                      {/* Email */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          Corporate Email Address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. your.name@bank.internal"
                            required
                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-800">
                            Corporate Password
                          </label>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <span className="text-[11px]">Remember on this terminal</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">Domain: bank.internal</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Full Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. Kwame Mensah"
                          required
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                        />
                      </div>

                      {/* Corporate Email */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          Corporate Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="e.g. kwame.mensah@bank.internal"
                          required
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            minLength={8}
                            required
                            className="w-full px-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        New accounts start as <strong>Requesting Officer</strong>. Approver, pool and
                        admin roles are assigned by a System Administrator.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            Department
                          </label>
                          <input
                            type="text"
                            value={regDept}
                            onChange={(e) => setRegDept(e.target.value)}
                            placeholder="e.g. Operations / Branch"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            Staff ID
                          </label>
                          <input
                            type="text"
                            value={regStaffId}
                            onChange={(e) => setRegStaffId(e.target.value)}
                            placeholder="e.g. EMP-0812"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 shadow-md shadow-blue-600/30 active:scale-[0.99] disabled:opacity-60 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span>Single Sign-On Enabled</span>
                  </span>
                  <span>IT Helpdesk: Ext 1042</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
