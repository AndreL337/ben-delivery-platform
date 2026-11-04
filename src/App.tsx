import React, { useState, useEffect } from 'react'
import { supabase } from './config/supabaseClient'
import { PRICING_MATRIX } from './config/pricingMatrix2026'
import type { VehicleSetup, LoopProfile, TopNavTab } from './types/logistics'
import { AgentCommandCenter } from './modules/admin/AgentCommandCenter'
import { ConsumerTrackView } from './modules/tracking/ConsumerTrackView'
import { BookJobForm } from './modules/retailerAndCrew/BookJobForm'
import './App.css'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [activeNav, setActiveNav] = useState<TopNavTab>('waitlist')
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [roleMode, setRoleMode] = useState<'retailer' | 'driver'>('retailer')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [signupRole, setSignupRole] = useState<'driver' | 'retailer'>('driver')

  // Waitlist States
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Driver')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [isInsured, setIsInsured] = useState(false)

  // Interactive Live Run Matrix Calculator States (2026 Pricing)
  const [vehicleSetup, setVehicleSetup] = useState<VehicleSetup>('independent')
  const [loopProfile, setLoopProfile] = useState<LoopProfile>('roc')

  const currentTier = PRICING_MATRIX[vehicleSetup][loopProfile]

  useEffect(() => {
    // Support direct consumer deep-link: ?track=<job_id>
    const params = new URLSearchParams(window.location.search)
    const trackParam = params.get('track')
    if (trackParam) {
      setTrackedJobId(trackParam)
      setActiveNav('tracking')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!trackParam && session?.user?.user_metadata?.role) {
        const r = session.user.user_metadata.role
        setRoleMode(r)
        setActiveNav(r === 'driver' ? 'driver' : 'retailer')
      }
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.user_metadata?.role) {
        const r = session.user.user_metadata.role
        setRoleMode(r)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const logEmail = authEmail.trim()
    setAuthLoading(true)
    setAuthError('')

    if (authMode === 'signup') {
      if (authPassword.length < 8) {
        setAuthError('Password must be at least 8 characters.')
        setAuthLoading(false)
        return
      }
      try {
        const { error } = await supabase.auth.signUp({
          email: logEmail,
          password: authPassword,
          options: { data: { role: signupRole } }
        })
        if (error) throw error
        setRoleMode(signupRole)
        setActiveNav(signupRole === 'driver' ? 'driver' : 'retailer')
        setShowLogin(false)
      } catch (err: any) {
        setAuthError(err.message || 'Could not create account.')
      }
      setAuthLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: logEmail,
        password: authPassword
      })
      if (error) throw error

      const userRole = data.user?.user_metadata?.role
      if (userRole === 'driver') {
        setRoleMode('driver')
        setActiveNav('driver')
      } else if (userRole === 'retailer') {
        setRoleMode('retailer')
        setActiveNav('retailer')
      } else {
        setRoleMode('driver')
        setActiveNav('driver')
      }
      setShowLogin(false)
    } catch (err: any) {
      setAuthError(err.message || 'Invalid login credentials.')
    }
    setAuthLoading(false)
  }

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaitlistLoading(true)
    try {
      const regionalTerritoryTag = `Milton Keynes (${role})`

      const calculatedVehicleType =
        make.trim() && model.trim()
          ? `${make.trim()} ${model.trim()}`
          : role === 'Porter'
          ? 'No Asset / Porter'
          : 'Standard Van'

      const { error } = await supabase.from('drivers_waitlist').insert([
        {
          full_name: driverName.trim(),
          phone_number: driverPhone.trim(),
          email: email.trim(),
          role: role,
          vehicle_type: calculatedVehicleType,
          vehicle_make: make.trim() || null,
          vehicle_model: model.trim() || null,
          vehicle_year: parseInt(year) || null,
          is_insured: isInsured,
          region: regionalTerritoryTag
        }
      ])

      if (error) throw error
      setWaitlistSubmitted(true)

      setDriverName('')
      setDriverPhone('')
      setEmail('')
      setRole('Driver')
      setMake('')
      setModel('')
      setYear('')
      setIsInsured(false)
    } catch (err: any) {
      alert(`Waitlist Sync Error: ${err.message}`)
    }
    setWaitlistLoading(false)
  }

  const effectiveUserId = session?.user?.id || '00000000-0000-0000-0000-000000000001'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* 1. PREMIUM HEADER / TOP BAR + ROLE SWITCHER */}
      <header className="w-full bg-white/95 border-b border-slate-200 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-wider text-slate-900 leading-none">
                  BEN<span className="text-emerald-600 font-medium">LOGISTICS</span>
                </span>
                <span className="text-[10px] text-slate-500 tracking-widest uppercase font-bold mt-1">
                  Milton Keynes 2-Man Bulky Hub • 2026 Matrix
                </span>
              </div>
            </div>

            <div className="md:hidden">
              {!session ? (
                <button
                  onClick={() => setShowLogin(!showLogin)}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-all shadow-sm"
                >
                  {showLogin ? '← Close Auth' : 'Operator Login'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    supabase.auth.signOut()
                    setSession(null)
                    setRoleMode('retailer')
                    setShowLogin(false)
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold py-1.5 px-3 rounded-lg transition-all"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* TOP NAVIGATION / ROLE SWITCHER */}
          <nav className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowLogin(false)
                setActiveNav('waitlist')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeNav === 'waitlist' && !showLogin
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚛 Public Waitlist
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLogin(false)
                setRoleMode('retailer')
                setActiveNav('retailer')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeNav === 'retailer' && !showLogin
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏢 Retailer Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLogin(false)
                setRoleMode('driver')
                setActiveNav('driver')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeNav === 'driver' && !showLogin
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👷 Crew Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLogin(false)
                setActiveNav('tracking')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeNav === 'tracking' && !showLogin
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📍 Live Customer Track
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLogin(false)
                setActiveNav('agents')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeNav === 'agents' && !showLogin
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80'
              }`}
            >
              🤖 Agent Command Center
            </button>
          </nav>

          {/* DESKTOP AUTH CONTROLS */}
          <div className="hidden md:flex items-center space-x-3">
            {!session ? (
              <button
                onClick={() => setShowLogin(!showLogin)}
                className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3.5 rounded-lg transition-all shadow-sm"
              >
                {showLogin ? '← Back to Hub' : 'Operator Portal Login'}
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Verified {roleMode}</p>
                  <p className="text-xs font-bold text-emerald-600">Live & Connected</p>
                </div>
                <button
                  onClick={() => {
                    supabase.auth.signOut()
                    setSession(null)
                    setRoleMode('retailer')
                    setShowLogin(false)
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold py-2 px-3.5 rounded-lg transition-all"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN HUB CONTENT CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col space-y-10">
        {showLogin ? (
          /* CONSOLE LOGIN VIEW */
          <div className="max-w-md mx-auto w-full">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/50">
              <form onSubmit={handleLogin} className="flex flex-col space-y-5">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    {authMode === 'signup' ? 'Create Your Account' : 'Operator Sign In'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {authMode === 'signup'
                      ? 'Set up secure access to the Ben network.'
                      : 'Sign in to your driver or retailer account.'}
                  </p>
                </div>

                {authError && (
                  <p className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                    ⚠️ {authError}
                  </p>
                )}

                <input
                  type="text"
                  placeholder="Email Address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 rounded-lg py-3 px-4 outline-none transition-all"
                  required
                />
                <input
                  type="password"
                  placeholder="Security Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 rounded-lg py-3 px-4 outline-none transition-all"
                  required
                />

                {authMode === 'signup' && (
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">
                      I am a
                    </label>
                    <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSignupRole('driver')}
                        className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                          signupRole === 'driver'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Driver / Porter
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupRole('retailer')}
                        className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                          signupRole === 'retailer'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Retailer
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md shadow-emerald-600/20"
                >
                  {authLoading
                    ? 'Verifying...'
                    : authMode === 'signup'
                    ? 'Create Account →'
                    : 'Authenticate Operator →'}
                </button>

                <p className="text-center text-xs text-slate-500">
                  {authMode === 'signup' ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'signup' ? 'login' : 'signup')
                      setAuthError('')
                    }}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    {authMode === 'signup' ? 'Sign in' : 'Create one'}
                  </button>
                </p>
              </form>
            </div>
          </div>
        ) : activeNav === 'waitlist' ? (
          /* TAB 1: PUBLIC WAITLIST & 2026 LIVE RUN MATRIX ENGINE */
          <>
            <div className="space-y-4 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                  2026 Milton Keynes 2-Man Bulky Network • 87.5% Crew Net Pool
                </span>
                <span className="text-xs font-bold text-blue-800 uppercase tracking-widest bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                  🛡 Showroom Pilot: Pay on Success (First 3 Routes / 14 Days)
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                Enterprise 2-Man Dispatch. Transparent Flat-Rate Loops.
              </h1>
              <p className="text-slate-600 text-lg">
                Aptean-grade route matching, photo PoD, and vetted 2-man crews for Milton Keynes showrooms — without 3PL lock-in. Select your operational setup below to inspect the 2026 pricing matrix.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* LEFT: 2026 Matrix Calculator */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">
                    Vehicle Assets Operational Setup
                  </label>
                  <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setVehicleSetup('independent')}
                      className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                        vehicleSetup === 'independent'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Independent 3.5t Van
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleSetup('clientVehicle')}
                      className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                        vehicleSetup === 'clientVehicle'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Client Vehicle (2-Man Pod)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">
                    Route Manifest Classification
                  </label>
                  <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setLoopProfile('roc')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        loopProfile === 'roc'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Standard ROC
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoopProfile('assembly')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        loopProfile === 'assembly'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Delivery & Assembly
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoopProfile('overflow')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        loopProfile === 'overflow'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Overflow Mini-Loop
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs font-bold uppercase text-slate-600 block">
                      Fair-Use Route Capacity
                    </span>
                    <span className="text-[11px] text-slate-500">{currentTier.shiftCap}</span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-md">
                    {currentTier.targetVolume}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2 text-slate-700">
                    <span className="font-semibold">2026 Flat Route Booking Fee</span>
                    <span className="font-extrabold text-slate-900">
                      £{currentTier.grossFee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                    <span>Ben Marketplace Fee (12.5%)</span>
                    <span>- £{currentTier.platformFee.toFixed(2)}</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mt-2 text-left">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold uppercase text-emerald-800 block">
                          Net Dispatched Crew Pool (87.5%)
                        </span>
                        <p className="text-slate-600 text-[10px] mt-1 leading-relaxed max-w-[220px]">
                          Paid after 48-hr PoD SLA. Includes up to 2nd-floor walk-up; 3rd floor+ no lift adds £25 (100% to crew).
                        </p>
                      </div>
                      <span className="text-3xl font-extrabold text-emerald-600">
                        £{currentTier.netPool.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    🛡 MK9 Fair-Use Guardrails & "Pay on Success" Pilot
                  </div>
                  <p>• <strong>Pay on Success Pilot:</strong> First 3 routes per showroom (14-day MK window) billed <strong>only upon verified photo PoD</strong> (£0.00 if failed due to crew/platform fault).</p>
                  <p>• <strong>Radius Cap:</strong> ≤35 miles from Central MK (MK9) | £2.20/mi out-of-zone.</p>
                  <p>• <strong>Shift & Payload Cap:</strong> ≤9 hrs (£50/hr OT) | ≤1,200 kg total / 110 kg max single item.</p>
                </div>
              </div>

              {/* RIGHT: Waitlist Registration Form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                {waitlistSubmitted ? (
                  <div className="text-center py-10 space-y-4">
                    <span className="text-5xl">✅</span>
                    <h3 className="text-2xl font-extrabold text-slate-900">Entry Logged.</h3>
                    <p className="text-slate-600 text-sm leading-relaxed px-4">
                      We’ve received your professional credentials for the Milton Keynes 2-Man Bulky Network. Our Supply & Compliance Agent will verify your GIT & Public Liability certificates shortly.
                    </p>
                    <button
                      onClick={() => setWaitlistSubmitted(false)}
                      className="text-emerald-600 text-sm font-bold hover:underline mt-4"
                    >
                      Submit another crew member
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleWaitlistSubmit} className="flex flex-col space-y-4">
                    <div className="border-b border-slate-100 pb-4 mb-2">
                      <h3 className="text-xl font-extrabold text-slate-900">
                        Join the Tier-1 MK 2-Man Roster
                      </h3>
                      <p className="text-slate-500 text-sm mt-1">
                        Register your 3.5t Luton Crew or Porter profile for Milton Keynes routes.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        required
                        className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all placeholder:text-slate-400"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile Number"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        required
                        className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all placeholder:text-slate-400"
                      />
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 rounded-lg py-2.5 px-4 outline-none transition-all appearance-none"
                      >
                        <option value="Driver">Lead Driver (3.5t Luton)</option>
                        <option value="Porter">Second Man / Delivery Porter</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Make"
                        value={make}
                        onChange={(e) => setMake(e.target.value)}
                        className="col-span-1 bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-2.5 px-3 outline-none text-sm placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="col-span-1 bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-2.5 px-3 outline-none text-sm placeholder:text-slate-400"
                      />
                      <input
                        type="number"
                        placeholder="Year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="col-span-1 bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-2.5 px-3 outline-none text-sm placeholder:text-slate-400"
                      />
                    </div>

                    <label className="flex items-center gap-3 text-xs text-slate-600 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium">
                      <input
                        type="checkbox"
                        checked={isInsured}
                        onChange={(e) => setIsInsured(e.target.checked)}
                        required
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 bg-white"
                      />
                      I confirm I hold valid Goods in Transit (£20k+) & Public Liability (£1m+) insurance.
                    </label>

                    <button
                      type="submit"
                      disabled={waitlistLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all shadow-md shadow-emerald-600/20 mt-2"
                    >
                      {waitlistLoading ? 'Securing Allocation...' : 'Secure Route Allocation Spot →'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        ) : activeNav === 'tracking' ? (
          /* TAB 4: DELIVEROO-GRADE LIVE CONSUMER TRACKING PORTAL */
          <ConsumerTrackView selectedJobId={trackedJobId} />
        ) : activeNav === 'agents' ? (
          /* TAB 5: AGENT COMMAND CENTER */
          <AgentCommandCenter />
        ) : (
          /* TAB 2 & TAB 3: RETAILER PORTAL OR CREW PORTAL */
          <div className="max-w-3xl mx-auto w-full">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-lg">
              <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    {activeNav === 'retailer' ? '🏢 Retailer Dispatch Portal' : '👷 2-Man Crew Portal'}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {activeNav === 'retailer'
                      ? 'Aptean-grade route matching, multi-stop manifest builder, and "Pay on Success" Pilot protection.'
                      : 'Persisted Gate A6 compliance gateway, Uber-style Compliance Locker, 1-tap SatNav, and e-Signature PoD.'}
                  </p>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-center">
                  MK9 Realtime Node
                </span>
              </div>

              <BookJobForm
                retailerId={effectiveUserId}
                mode={activeNav === 'driver' ? 'driver' : 'retailer'}
                onOpenConsumerTracker={(jobId) => {
                  setTrackedJobId(jobId)
                  setActiveNav('tracking')
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="w-full py-6 border-t border-slate-200 text-center text-xs font-medium text-slate-500 bg-white mt-auto">
        &copy; 2026 Ben Logistics Ltd (Milton Keynes Marketplace Node). Acting strictly as a technology marketplace agent connecting Retailers and Independent Contractor Crews.
      </footer>
    </div>
  )
}
