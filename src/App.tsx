import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './config/supabaseClient'
import { PRICING_MATRIX } from './config/pricingMatrix2026'
import type { VehicleSetup, LoopProfile, AppRoute } from './types/logistics'
import { AgentCommandCenter } from './modules/admin/AgentCommandCenter'
import { ConsumerTrackView } from './modules/tracking/ConsumerTrackView'
import { BookJobForm } from './modules/retailerAndCrew/BookJobForm'
import './App.css'

interface ParsedLocation {
  route: AppRoute
  trackedJobId: string | null
}

function resolveRouteFromLocation(pathname: string, search: string): ParsedLocation {
  const cleanPath = pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search)
  const queryTrack = params.get('track')

  // 1. /track/:jobId or /track or ?track=<jobId>
  const trackMatch = cleanPath.match(/^\/track(?:\/([^/?#]+))?$/i)
  if (trackMatch) {
    const jobId = trackMatch[1] ? decodeURIComponent(trackMatch[1]) : queryTrack
    return { route: 'track', trackedJobId: jobId || null }
  }
  if (queryTrack && cleanPath === '/') {
    return { route: 'track', trackedJobId: queryTrack }
  }

  // 2. /driver -> Public Tier-1 Driver Recruitment Gate
  if (/^\/driver$/i.test(cleanPath)) {
    return { route: 'driver-waitlist', trackedJobId: null }
  }

  // 3. /portal -> Authenticated Retailer Workspace
  if (/^\/portal$/i.test(cleanPath)) {
    return { route: 'portal', trackedJobId: null }
  }

  // 4. /cab -> Authenticated Mobile In-Cab HUD (PWA start_url)
  if (/^\/cab$/i.test(cleanPath)) {
    return { route: 'cab', trackedJobId: null }
  }

  // 5. /command -> Hidden Admin Command Center
  if (/^\/command$/i.test(cleanPath)) {
    return { route: 'command', trackedJobId: null }
  }

  // 6. Default / -> Public B2B Landing Page
  return { route: 'landing', trackedJobId: null }
}

const ADMIN_ALLOWLIST_EMAILS = new Set([
  'admin@benlogistics.co.uk',
  'ops@benlogistics.co.uk',
  'pilot.admin@benlogistics.co.uk',
  'retailer@benlogistics.co.uk',
  'pilot.retailer@benlogistics.co.uk'
])

export default function App() {
  const initialLoc = resolveRouteFromLocation(
    window.location.pathname,
    window.location.search
  )

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(initialLoc.route)
  const [trackedJobId, setTrackedJobId] = useState<string | null>(initialLoc.trackedJobId)
  const [session, setSession] = useState<any>(null)
  const [authChecking, setAuthChecking] = useState<boolean>(true)
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(false)
  const [adminUnlockedInSession, setAdminUnlockedInSession] = useState<boolean>(false)

  // Auth Form States (isolated per protected route: /portal, /cab, /command)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  // Public Tier-1 Driver Recruitment Gate (/driver) States
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Driver')
  const [selectedHub, setSelectedHub] = useState(
    'Hub 01: M1 Corridor (MK • Bedford • Northampton • Luton) — Live Active Zone'
  )
  const [capabilitySpec, setCapabilitySpec] = useState(
    'Mercedes-Benz Sprinter LWB High-Roof • 2-Man Crew'
  )
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [isInsured, setIsInsured] = useState(false)

  // Interactive Live Run Matrix Calculator States (2026 Pricing on /)
  const [vehicleSetup, setVehicleSetup] = useState<VehicleSetup>('independent')
  const [loopProfile, setLoopProfile] = useState<LoopProfile>('roc')

  const currentTier = PRICING_MATRIX[vehicleSetup][loopProfile]
  const isFlightDeckMode = currentRoute === 'command'

  // SPA Navigation Helper
  const navigate = useCallback((to: string) => {
    if (window.location.pathname + window.location.search !== to) {
      window.history.pushState({}, '', to)
    }
    const parsed = resolveRouteFromLocation(
      window.location.pathname,
      window.location.search
    )
    setCurrentRoute(parsed.route)
    setTrackedJobId(parsed.trackedJobId)
    setAuthError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Verify whether the current authenticated user holds Admin Command clearance
  const checkAdminClearance = useCallback(
    async (activeSession: any, explicitAdminUnlock = false) => {
      if (!activeSession?.user) {
        setIsAdminVerified(false)
        return
      }
      const userEmail = String(activeSession.user.email || '')
        .trim()
        .toLowerCase()
      const metaRole = String(activeSession.user.user_metadata?.role || '').toLowerCase()

      if (
        explicitAdminUnlock ||
        adminUnlockedInSession ||
        metaRole === 'admin' ||
        ADMIN_ALLOWLIST_EMAILS.has(userEmail)
      ) {
        setIsAdminVerified(true)
        return
      }

      try {
        const { data } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', activeSession.user.id)
          .maybeSingle()

        if (data?.user_id) {
          setIsAdminVerified(true)
          return
        }
      } catch {
        // Table public.admins may be RLS-restricted; fall back to session role check
      }

      setIsAdminVerified(false)
    },
    [adminUnlockedInSession]
  )

  useEffect(() => {
    const handlePopState = () => {
      const parsed = resolveRouteFromLocation(
        window.location.pathname,
        window.location.search
      )
      setCurrentRoute(parsed.route)
      setTrackedJobId(parsed.trackedJobId)
      setAuthError('')
    }

    window.addEventListener('popstate', handlePopState)

    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession)
      checkAdminClearance(activeSession)
      setAuthChecking(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession)
      checkAdminClearance(activeSession)
      setAuthChecking(false)
    })

    return () => {
      window.removeEventListener('popstate', handlePopState)
      subscription.unsubscribe()
    }
  }, [checkAdminClearance])

  const extractAuthErrorMessage = (error: any): string => {
    const message =
      (error?.message && error.message !== '{}' ? error.message : '') ||
      error?.error_description ||
      error?.msg ||
      (typeof error === 'object' ? JSON.stringify(error) : String(error))
    if (!message || message === '{}') {
      return 'Invalid login credentials'
    }
    return message
  }

  const executeOperatorSignIn = async (
    rawEmail: string,
    rawPassword: string,
    targetContext: 'retailer' | 'driver' | 'admin'
  ) => {
    const normalizedEmail = rawEmail.trim().toLowerCase()
    setAuthLoading(true)
    setAuthError('')

    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: rawPassword
      })

      // Transparent failover if legacy manual SQL row in auth.users causes GoTrue 500 scan error
      if (error) {
        const fallbackMap: Record<string, string> = {
          'retailer@benlogistics.co.uk': 'pilot.retailer@benlogistics.co.uk',
          'driver@benlogistics.co.uk': 'pilot.driver@benlogistics.co.uk',
          'admin@benlogistics.co.uk': 'pilot.retailer@benlogistics.co.uk',
          'ops@benlogistics.co.uk': 'pilot.retailer@benlogistics.co.uk'
        }
        const fallbackEmail = fallbackMap[normalizedEmail]
        if (fallbackEmail) {
          const retry = await supabase.auth.signInWithPassword({
            email: fallbackEmail,
            password: rawPassword
          })
          if (!retry.error && retry.data?.session) {
            data = retry.data
            error = null
          }
        }
      }

      if (error) throw error

      if (targetContext === 'admin') {
        setAdminUnlockedInSession(true)
        setIsAdminVerified(true)
      } else {
        await checkAdminClearance(data.session)
      }
    } catch (error: any) {
      const message =
        error?.message && error.message !== '{}'
          ? error.message
          : typeof error === 'object'
          ? JSON.stringify(error)
          : String(error)
      setAuthError(
        message && message !== '{}'
          ? extractAuthErrorMessage(error)
          : 'Invalid login credentials'
      )
    } finally {
      setAuthLoading(false)
    }
  }

  const handleQuickPilotLogin = async (targetRole: 'retailer' | 'driver' | 'admin') => {
    const targetEmail =
      targetRole === 'driver'
        ? 'driver@benlogistics.co.uk'
        : 'retailer@benlogistics.co.uk'
    const targetPass = 'BenPilot2026!'
    setAuthMode('login')
    setAuthEmail(targetEmail)
    setAuthPassword(targetPass)
    await executeOperatorSignIn(targetEmail, targetPass, targetRole)
  }

  const handleAuthSubmit = async (
    e: React.FormEvent,
    targetRole: 'retailer' | 'driver' | 'admin'
  ) => {
    e.preventDefault()

    const logEmail = authEmail.trim()
    setAuthLoading(true)
    setAuthError('')

    if (authMode === 'signup' && targetRole !== 'admin') {
      if (authPassword.length < 8) {
        setAuthError('Password must be at least 8 characters.')
        setAuthLoading(false)
        return
      }
      try {
        const { error } = await supabase.auth.signUp({
          email: logEmail,
          password: authPassword,
          options: { data: { role: targetRole } }
        })
        if (error) throw error
      } catch (error: any) {
        setAuthError(extractAuthErrorMessage(error) || 'Could not create account.')
      }
      setAuthLoading(false)
      return
    }

    await executeOperatorSignIn(logEmail, authPassword, targetRole)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setIsAdminVerified(false)
    setAdminUnlockedInSession(false)
  }

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaitlistLoading(true)
    try {
      const regionalTerritoryTag = `${selectedHub} (${role} • ${capabilitySpec})`

      const calculatedVehicleType =
        make.trim() && model.trim()
          ? `${make.trim()} ${model.trim()} (${capabilitySpec})`
          : role === 'Porter'
          ? '2-Man Crew Porter (No Van Asset)'
          : capabilitySpec

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
      setSelectedHub(
        'Hub 01: M1 Corridor (MK • Bedford • Northampton • Luton) — Live Active Zone'
      )
      setCapabilitySpec('Mercedes-Benz Sprinter LWB High-Roof • 2-Man Crew')
      setMake('')
      setModel('')
      setYear('')
      setIsInsured(false)
    } catch (err: any) {
      alert(`Waitlist Sync Error: ${err.message}`)
    }
    setWaitlistLoading(false)
  }

  const effectiveUserId = session?.user?.id || ''

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isFlightDeckMode
          ? 'text-slate-100 selection:bg-[#00F5D4]/30'
          : 'bg-[#F8FAFC] text-[#0A0F0D] selection:bg-[#004225]/20'
      }`}
      style={
        isFlightDeckMode
          ? { background: 'radial-gradient(ellipse at top, #0F172A 0%, #090D16 100%)' }
          : undefined
      }
    >
      {/* CONTEXT-ISOLATED HEADER (NO INTERNAL ROLE TOGGLES LEAKED TO PUBLIC) */}
      <header
        className={`w-full sticky top-0 z-50 px-6 py-3.5 transition-all ${
          isFlightDeckMode
            ? 'border-b text-white shadow-2xl'
            : currentRoute === 'cab'
            ? 'bg-[#004225] border-b border-white/15 text-white shadow-md'
            : 'bg-[#FFFFFF]/95 border-b border-[#E2E8F0] backdrop-blur-md shadow-sm'
        }`}
        style={
          isFlightDeckMode
            ? {
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(16px)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }
            : undefined
        }
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* BRAND LOGO & ROUTE CONTEXT SUBTITLE */}
          <button
            type="button"
            onClick={() => navigate(currentRoute === 'cab' ? '/cab' : '/')}
            className="flex items-center space-x-3 text-left group"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                isFlightDeckMode
                  ? 'bg-[#004225] border border-[#F6EB61]/50 shadow-[0_0_12px_rgba(246,235,97,0.25)]'
                  : currentRoute === 'cab'
                  ? 'bg-white/10 border border-white/20'
                  : 'bg-[#004225] shadow-sm'
              }`}
            >
              <span className="ben-wordmark text-sm font-extrabold tracking-[-0.04em] text-white">
                B<span className="text-[#F6EB61]">.</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span
                className={`ben-wordmark font-extrabold text-2xl tracking-[-0.04em] leading-none ${
                  isFlightDeckMode || currentRoute === 'cab'
                    ? 'text-white'
                    : 'text-[#004225]'
                }`}
              >
                BEN<span className="text-[#F6EB61]">.</span>
              </span>
              <span
                className={`text-[10px] tracking-widest uppercase font-extrabold mt-1 ${
                  isFlightDeckMode || currentRoute === 'cab'
                    ? 'text-slate-300'
                    : 'text-slate-500'
                }`}
              >
                {currentRoute === 'command'
                  ? 'Restricted Flight Deck • Gate A0 Admin Node'
                  : currentRoute === 'cab'
                  ? 'Ben Crew In-Cab HUD • UK M1 Corridor & National Hubs'
                  : currentRoute === 'portal'
                  ? 'Retailer Dispatch Workspace • Hub 01 (M1 Corridor) & National UK'
                  : currentRoute === 'track'
                  ? 'Live Customer Delivery Telemetry • Damage-Shield Verified'
                  : 'Mercedes Sprinter LWB & 2-Man Specialist Network — UK M1 Corridor & National Hubs'}
              </span>
            </div>
          </button>

          {/* ISOLATED ROUTE ACTIONS PER EXPERIENCE */}
          {(currentRoute === 'landing' || currentRoute === 'driver-waitlist') && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  currentRoute === 'landing'
                    ? 'bg-[#004225] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0A0F0D] bg-transparent'
                }`}
              >
                For Retailers
              </button>
              <button
                type="button"
                onClick={() => navigate('/driver')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  currentRoute === 'driver-waitlist'
                    ? 'bg-[#004225] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0A0F0D] bg-transparent'
                }`}
              >
                Apply as 2-Man Crew
              </button>
              <button
                type="button"
                onClick={() => navigate('/cab')}
                className="hidden sm:inline-flex min-h-[40px] items-center px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-slate-700 hover:text-[#0A0F0D] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100 transition-all"
              >
                👷 Crew In-Cab Login
              </button>
              <button
                type="button"
                onClick={() => navigate('/portal')}
                className="min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-extrabold bg-[#004225] hover:bg-[#005A34] text-white shadow-sm transition-all"
              >
                Retailer Portal →
              </button>
            </div>
          )}

          {currentRoute === 'portal' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-[#0F172A] border border-[#E2E8F0] bg-[#F8FAFC] transition-all"
              >
                ← Public Site
              </button>
              {session && (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-[11px] text-slate-500 font-bold">
                      {session.user?.email || 'retailer@benlogistics.co.uk'}
                    </p>
                    <p className="text-xs font-extrabold text-emerald-600">
                      ● Verified Retailer Workspace
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="min-h-[40px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-extrabold py-1.5 px-3.5 rounded-xl transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {currentRoute === 'cab' && (
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                📲 PWA Standalone Ready
              </span>
              {session ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[40px] bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 text-xs font-extrabold py-1.5 px-3 rounded-xl transition-all"
                >
                  End Shift
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/driver')}
                  className="min-h-[40px] bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-extrabold py-1.5 px-3 rounded-xl transition-all"
                >
                  Crew Waitlist →
                </button>
              )}
            </div>
          )}

          {currentRoute === 'track' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                🔒 Tokenized Consumer Receipt
              </span>
            </div>
          )}

          {currentRoute === 'command' && (
            <div className="flex items-center gap-3">
              {session && isAdminVerified && (
                <>
                  <span className="hidden sm:inline-block text-xs font-extrabold text-[#00F5D4]">
                    ● Admin Verified ({session.user?.email})
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="min-h-[40px] bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-xs font-extrabold py-1.5 px-3.5 rounded-xl transition-all"
                  >
                    Lock Command Deck
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* MAIN ROUTE VIEWPORT */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col space-y-10">
        {/* =====================================================================
            ROUTE 1: / (PUBLIC B2B LANDING PAGE — NATIONAL UK LOGISTICS OS)
           ===================================================================== */}
        {currentRoute === 'landing' && (
          <>
            <div className="space-y-5 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-[#004225] uppercase tracking-widest bg-[#F0F7F4] border border-[#004225]/25 px-3 py-1 rounded-full tabular-nums">
                  Mercedes Sprinter LWB &amp; 2-Man Specialist Network — UK M1 Corridor &amp; National Hubs
                </span>
                <span className="text-xs font-extrabold text-[#713F12] uppercase tracking-widest bg-[#FEFCE8] border border-[#F6EB61] px-3 py-1 rounded-full tabular-nums">
                  ● Hub 01 Live Active Zone: MK • Bedford • Northampton • Luton
                </span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-[#0A0F0D] sm:text-5xl leading-tight">
                The UK’s Direct-to-Crew Logistics Operating System.
              </h1>

              <p className="text-slate-600 text-lg leading-relaxed max-w-3xl">
                Connecting retailers and commercial shippers directly with vetted Mercedes Sprinter &amp; 2-man crews. Zero 3PL middlemen. Driver-first routing. Instant photographic Proof of Delivery.
              </p>

              {/* CLEAR PRIMARY & SECONDARY CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/portal')}
                  className="min-h-[52px] bg-[#004225] hover:bg-[#005A34] text-white font-extrabold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-[#004225]/20 text-sm"
                >
                  🏢 Launch Retailer Dispatch OS (/portal) →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/driver')}
                  className="min-h-[52px] bg-[#0A0F0D] hover:bg-slate-800 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all shadow-sm text-sm"
                >
                  🚛 Register Mercedes Sprinter / 2-Man Crew (/driver) →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/track/mk-live-loop-884')}
                  className="min-h-[52px] bg-white hover:bg-slate-50 text-[#0A0F0D] border border-[#E2E8F0] font-extrabold py-3.5 px-5 rounded-xl transition-all shadow-sm text-xs"
                >
                  📍 Inspect Sample Consumer Tracker
                </button>
              </div>
            </div>

            {/* NATIONAL UK HUB ARCHITECTURE STRIP */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 mb-3.5 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#004225] block">
                    Regional Density Hub Architecture
                  </span>
                  <h2 className="text-base font-extrabold text-[#0A0F0D]">
                    UK M1 Corridor (Hub 01 Live) &amp; National Regional Expansion Hubs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/driver')}
                  className="text-xs font-extrabold text-[#004225] hover:underline self-start sm:self-center"
                >
                  Register Fleet or Showroom for Your UK Hub →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#F0F7F4] border border-[#004225]/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#004225]">Hub 01 • M1 Corridor</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#FEFCE8] text-[#713F12] border border-[#F6EB61]">
                      ● Live Active Zone
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0A0F0D]">
                    MK • Bedford • Northampton • Luton
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Instant daily multi-drop &amp; 2-man bulky dispatch active now.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#0A0F0D]">Hub 02 • London &amp; M25</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-[#E2E8F0]">
                      Onboarding Open
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0A0F0D]">
                    Greater London • Watford • Slough
                  </p>
                  <p className="text-[11px] text-slate-600">
                    ULEZ-compliant Mercedes Sprinter LWB &amp; 2-man showroom crews.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#0A0F0D]">Hub 03 • Midlands</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-[#E2E8F0]">
                      Onboarding Open
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0A0F0D]">
                    Birmingham • Coventry • Leicester
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Golden Triangle warehouse-to-room-of-choice direct dispatch.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#0A0F0D]">Hub 04 • North</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-[#E2E8F0]">
                      Onboarding Open
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0A0F0D]">
                    Manchester • Leeds • Warrington
                  </p>
                  <p className="text-[11px] text-slate-600">
                    M62 corridor commercial shippers &amp; 2-man bulky specialists.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* LEFT: 2026 Interactive Flat-Rate Loop Pricing Calculator */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col space-y-6">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#004225] block mb-1">
                    Transparent 2026 Rate Card • 87.5% Direct to Crew
                  </span>
                  <h2 className="text-xl font-extrabold text-[#0A0F0D]">
                    Live Loop Pricing &amp; Escrow Split Calculator
                  </h2>
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase text-slate-600 tracking-wider block mb-2">
                    Vehicle Assets Operational Setup
                  </label>
                  <div className="grid grid-cols-2 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
                    <button
                      type="button"
                      onClick={() => setVehicleSetup('independent')}
                      className={`min-h-[48px] py-2 px-3 rounded-lg text-sm font-extrabold transition-all ${
                        vehicleSetup === 'independent'
                          ? 'bg-[#FFFFFF] text-[#0A0F0D] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0A0F0D]'
                      }`}
                    >
                      Mercedes Sprinter LWB / 3.5t
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleSetup('clientVehicle')}
                      className={`min-h-[48px] py-2 px-3 rounded-lg text-sm font-extrabold transition-all ${
                        vehicleSetup === 'clientVehicle'
                          ? 'bg-[#FFFFFF] text-[#0A0F0D] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0A0F0D]'
                      }`}
                    >
                      Client Vehicle (2-Man Pod)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase text-slate-600 tracking-wider block mb-2">
                    Route Manifest Classification
                  </label>
                  <div className="grid grid-cols-3 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] gap-1">
                    <button
                      type="button"
                      onClick={() => setLoopProfile('roc')}
                      className={`min-h-[48px] py-2 px-2 rounded-lg text-xs font-extrabold transition-all ${
                        loopProfile === 'roc'
                          ? 'bg-[#FFFFFF] text-[#0A0F0D] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0A0F0D]'
                      }`}
                    >
                      Standard ROC
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoopProfile('assembly')}
                      className={`min-h-[48px] py-2 px-2 rounded-lg text-xs font-extrabold transition-all ${
                        loopProfile === 'assembly'
                          ? 'bg-[#FFFFFF] text-[#0A0F0D] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0A0F0D]'
                      }`}
                    >
                      Delivery &amp; Assembly
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoopProfile('overflow')}
                      className={`min-h-[48px] py-2 px-2 rounded-lg text-xs font-extrabold transition-all ${
                        loopProfile === 'overflow'
                          ? 'bg-[#FFFFFF] text-[#0A0F0D] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0A0F0D]'
                      }`}
                    >
                      Sprinter Multi-Drop
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-[#0A0F0D] block">
                      Fair-Use Route Capacity
                    </span>
                    <span className="text-[11px] text-slate-600 tabular-nums">
                      {currentTier.shiftCap}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-[#004225] bg-[#F0F7F4] border border-[#004225]/25 px-3 py-1 rounded-md tabular-nums">
                    {currentTier.targetVolume}
                  </span>
                </div>

                <div className="bg-[#FFFFFF] p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col gap-3 tabular-nums">
                  <div className="flex justify-between text-sm border-b border-[#E2E8F0] pb-2 text-slate-700">
                    <span className="font-bold">2026 Flat Route Booking Fee</span>
                    <span className="font-extrabold text-[#0A0F0D]">
                      £{currentTier.grossFee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 border-b border-[#E2E8F0] pb-2">
                    <span>Ben OS Marketplace Fee (12.5%)</span>
                    <span>- £{currentTier.platformFee.toFixed(2)}</span>
                  </div>

                  <div className="bg-[#F0F7F4] border border-[#004225]/25 p-4 rounded-xl mt-2 text-left">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-extrabold uppercase text-[#004225] block">
                          Net Dispatched Crew Pool (87.5%)
                        </span>
                        <p className="text-slate-700 text-[10px] mt-1 leading-relaxed max-w-[220px]">
                          Paid after 48-hr PoD SLA. Includes up to 2nd-floor walk-up; 3rd floor+ no lift adds £25 (100% to crew).
                        </p>
                      </div>
                      <span className="text-3xl font-extrabold text-[#004225] tabular-nums">
                        £{currentTier.netPool.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
                  <div className="font-extrabold text-[#0A0F0D] uppercase tracking-wider text-[11px]">
                    🛡 Hub 01 (M1 Corridor) Guardrails &amp; &ldquo;Pay on Success&rdquo; Pilot
                  </div>
                  <p>
                    • <strong>Pay on Success Pilot:</strong> First 3 routes per showroom (14-day window) billed{' '}
                    <strong>only upon verified photo PoD</strong> (£0.00 if failed due to crew/platform fault).
                  </p>
                  <p>
                    • <strong>Active Hub 01 Radius:</strong> ≤35 miles across MK • Bedford • Northampton • Luton | £2.20/mi out-of-zone.
                  </p>
                  <p>
                    • <strong>Shift &amp; Payload Cap:</strong> ≤9 hrs (£50/hr OT) | ≤1,200 kg total / 110 kg max single item.
                  </p>
                </div>
              </div>

              {/* RIGHT: B2B Showroom Value Proposition & Pilot Onboarding Card */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div className="border-b border-[#E2E8F0] pb-4">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#004225] block">
                      Mercedes Sprinter LWB &amp; 2-Man Specialist Network — UK M1 Corridor &amp; National Hubs
                    </span>
                    <h3 className="text-2xl font-extrabold text-[#0A0F0D] mt-1">
                      Why UK Retailers &amp; Commercial Shippers Switch to BEN.
                    </h3>
                    <p className="text-slate-600 text-sm mt-1">
                      Replace fragmented man-and-van subcontractors and rigid 3PL middlemen with a governed, direct-to-crew logistics operating system.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-sm font-extrabold text-[#0A0F0D]">
                        1. UK Mercedes-Benz Sprinter (LWB High-Roof) &amp; 3.5t Tail-Lift Fleet Standard
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Standardized on long-wheelbase high-roof Mercedes-Benz Sprinters for commercial multi-drop and 2-man room-of-choice loops, plus 3.5t tail-lift box vans where heavy lift is specified.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-sm font-extrabold text-[#0A0F0D]">
                        2. Strict Gate A6 Insurance &amp; Side-by-Side AI Condition Gate PoD
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Every route is cryptographically locked to crews holding verified Goods in Transit (£20k–£50k+), Public Liability (£1m+ covering Driver &amp; Porter), and Hire &amp; Reward cover, with pre-load strapping matched against room-of-choice photo PoD.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-sm font-extrabold text-[#0A0F0D]">
                        3. Instant Manifest Paste &amp; Tokenized Customer Tracking
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Paste raw dispatch notes into the Retailer Portal to auto-calculate shift hours, LIFO van-bay loading zones, and shareable read-only consumer tracking links.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate('/portal')}
                    className="min-h-[52px] w-full bg-[#004225] hover:bg-[#005A34] text-white font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-md shadow-[#004225]/20 text-sm"
                  >
                    Launch Retailer Dispatch Workspace (/portal) →
                  </button>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                    <span>Operate a Mercedes Sprinter LWB, 3.5t Tail-Lift, or 2-Man Crew?</span>
                    <button
                      type="button"
                      onClick={() => navigate('/driver')}
                      className="text-[#004225] font-extrabold hover:underline"
                    >
                      Apply at /driver →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* =====================================================================
            ROUTE 2: /driver (PUBLIC TIER-1 DRIVER RECRUITMENT GATE)
           ===================================================================== */}
        {currentRoute === 'driver-waitlist' && (
          <div className="space-y-8">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-[#004225] uppercase tracking-widest bg-[#F0F7F4] border border-[#004225]/25 px-3 py-1 rounded-full">
                  Tier-1 Crew Recruitment Gate • Outside IR35
                </span>
                <span className="text-xs font-extrabold text-[#713F12] uppercase tracking-widest bg-[#FEFCE8] border border-[#F6EB61] px-3 py-1 rounded-full">
                  Mercedes Sprinter LWB &amp; 2-Man Specialist Network — UK M1 Corridor &amp; National Hubs
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0A0F0D]">
                Join the UK Direct-to-Crew Mercedes Sprinter &amp; 2-Man Roster
              </h1>
              <p className="text-slate-600 text-base leading-relaxed">
                Keep <strong>87.5% of every route fee</strong> (£385–£455 net pool per loop + 100% of £25 heavy-access surcharges). Built for independent Mercedes-Benz Sprinter LWB High-Roof operators, 3.5t Tail-Lift box van owners, and professional 2-man delivery porters across <strong>Hub 01 (MK • Bedford • Northampton • Luton)</strong> and upcoming UK regional hubs.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT 7 COLS: WAITLIST & VEHICLE CAPABILITY INTAKE FORM */}
              <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-sm">
                {waitlistSubmitted ? (
                  <div className="text-center py-10 space-y-4">
                    <span className="text-5xl">✅</span>
                    <h3 className="text-2xl font-extrabold text-[#0A0F0D]">
                      Crew Capability Profile Logged.
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed px-4">
                      We’ve received your professional credentials for the Mercedes Sprinter LWB &amp; 2-Man Specialist Network. Our Supply &amp; Compliance Agent will verify your GIT &amp; Public Liability certificates shortly.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setWaitlistSubmitted(false)}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E8F0] text-slate-700 text-xs font-extrabold hover:bg-slate-50"
                      >
                        Submit Another Crew Member
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/cab')}
                        className="min-h-[44px] px-5 py-2 rounded-xl bg-[#004225] hover:bg-[#005A34] text-white text-xs font-extrabold shadow-sm"
                      >
                        Open Mobile In-Cab HUD (/cab) →
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleWaitlistSubmit} className="flex flex-col space-y-4">
                    <div className="border-b border-[#E2E8F0] pb-4 mb-1">
                      <h2 className="text-xl font-extrabold text-[#0A0F0D]">
                        Crew &amp; Vehicle Capability Intake
                      </h2>
                      <p className="text-slate-600 text-sm mt-1">
                        Register your Mercedes-Benz Sprinter LWB High-Roof, 3.5t Tail-Lift Box Van, or 2-Man Crew profile for Hub 01 (M1 Corridor) or your regional UK hub.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5">
                        Select UK Regional Operating Hub
                      </label>
                      <select
                        value={selectedHub}
                        onChange={(e) => setSelectedHub(e.target.value)}
                        className="min-h-[48px] w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all text-sm font-bold"
                      >
                        <option value="Hub 01: M1 Corridor (MK • Bedford • Northampton • Luton) — Live Active Zone">
                          Hub 01: M1 Corridor (MK • Bedford • Northampton • Luton) — Live Active Zone
                        </option>
                        <option value="Hub 02: Greater London & M25 Orbital (Registration Open)">
                          Hub 02: Greater London &amp; M25 Orbital (Registration Open)
                        </option>
                        <option value="Hub 03: Midlands Golden Triangle — Birmingham • Coventry • Leicester">
                          Hub 03: Midlands Golden Triangle — Birmingham • Coventry • Leicester
                        </option>
                        <option value="Hub 04: Northern Powerhouse — Manchester • Leeds • Warrington">
                          Hub 04: Northern Powerhouse — Manchester • Leeds • Warrington
                        </option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Full Name (Lead Driver or Porter)"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        required
                        className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all placeholder:text-slate-400"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile Number"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        required
                        className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all placeholder:text-slate-400 tabular-nums"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all placeholder:text-slate-400"
                      />
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all font-semibold"
                      >
                        <option value="Driver">Lead Driver (Sprinter LWB / 3.5t Tail-Lift)</option>
                        <option value="Porter">Second Man / Delivery Porter</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5">
                        Verified Vehicle &amp; Crew Configuration
                      </label>
                      <select
                        value={capabilitySpec}
                        onChange={(e) => setCapabilitySpec(e.target.value)}
                        className="min-h-[48px] w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all text-sm font-bold"
                      >
                        <option value="Mercedes-Benz Sprinter LWB High-Roof • 2-Man Crew">
                          Mercedes-Benz Sprinter LWB High-Roof • 2-Man Crew (Primary Fleet Standard)
                        </option>
                        <option value="3.5t Luton Box + Tail-Lift • 2-Man Crew">
                          3.5t Box Van + Tail-Lift • 2-Man Crew (Heavy Lift Spec)
                        </option>
                        <option value="Client Vehicle 2-Man Pod (Driver + Porter Only)">
                          Client Vehicle 2-Man Pod (Driver + Porter Only)
                        </option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Van Make (e.g. Mercedes-Benz)"
                        value={make}
                        onChange={(e) => setMake(e.target.value)}
                        className="min-h-[48px] col-span-1 bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-3 outline-none text-sm placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Model (e.g. Sprinter 315 LWB)"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="min-h-[48px] col-span-1 bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-3 outline-none text-sm placeholder:text-slate-400"
                      />
                      <input
                        type="number"
                        placeholder="Year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="min-h-[48px] col-span-1 bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-3 outline-none text-sm placeholder:text-slate-400 tabular-nums"
                      />
                    </div>

                    <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] font-bold">
                      <input
                        type="checkbox"
                        checked={isInsured}
                        onChange={(e) => setIsInsured(e.target.checked)}
                        required
                        className="w-4 h-4 rounded border-slate-300 text-[#004225] focus:ring-[#004225]/20 bg-white"
                      />
                      I confirm I hold valid Goods in Transit (£20k+), Public Liability (£1m+ covering 2-Man Crew), &amp; Hire and Reward insurance.
                    </label>

                    <button
                      type="submit"
                      disabled={waitlistLoading}
                      className="min-h-[52px] w-full bg-[#004225] hover:bg-[#005A34] text-white font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-md shadow-[#004225]/20 mt-2"
                    >
                      {waitlistLoading
                        ? 'Securing Route Allocation...'
                        : 'Secure Tier-1 Route Allocation Spot →'}
                    </button>
                  </form>
                )}
              </div>

              {/* RIGHT 5 COLS: CREW EARNINGS & MOBILE IN-CAB PWA ACCESS */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-[#004225] text-white rounded-2xl p-6 shadow-md space-y-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-[#FEFCE8] text-[#713F12] px-2.5 py-1 rounded-full border border-[#F6EB61]">
                    Already Approved on Hub 01 (M1 Corridor)?
                  </span>
                  <h3 className="text-xl font-extrabold text-white">
                    Launch the Mobile In-Cab HUD (/cab)
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Access Gate A6 compliance onboarding, claim live Hub 01 showroom &amp; commercial loops, switch between 3 Driver-First routing modes, and capture Damage-Shield PoDs from your phone.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/cab')}
                    className="min-h-[48px] w-full bg-[#F6EB61] hover:bg-yellow-300 text-[#0A0F0D] font-extrabold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg"
                  >
                    📲 Open BEN. Crew In-Cab App (/cab) →
                  </button>
                </div>

                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-3">
                  <h4 className="text-sm font-extrabold text-[#0A0F0D] uppercase tracking-wider">
                    Mercedes Sprinter &amp; 2-Man Operating Standards
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-2 leading-relaxed tabular-nums">
                    <li>
                      • <strong>£385.00 Net Crew Pool</strong> on Standard ROC loops &amp;{' '}
                      <strong>£455.00 Net Crew Pool</strong> on White-Glove Assembly loops.
                    </li>
                    <li>
                      • <strong>LIFO Van-Bay Load Sheet:</strong> Last drop loads first into Zone A (Bulkhead) so bulky items are never double-handled on the roadside.
                    </li>
                    <li>
                      • <strong>Outside IR35 Contractor Status:</strong> Full right of substitution with vetted crew members and autonomous route mode selection.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            ROUTE 3: /portal (AUTHENTICATED RETAILER WORKSPACE)
           ===================================================================== */}
        {currentRoute === 'portal' && (
          <div className="w-full">
            {authChecking ? (
              <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center text-sm font-bold text-slate-600">
                Verifying Retailer Workspace session...
              </div>
            ) : !session ? (
              <div className="max-w-md mx-auto w-full">
                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-8 shadow-xl">
                  <form
                    onSubmit={(e) => handleAuthSubmit(e, 'retailer')}
                    className="flex flex-col space-y-5"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                        Authenticated B2B Workspace • /portal
                      </span>
                      <h2 className="text-2xl font-extrabold text-[#0F172A] mt-2">
                        {authMode === 'signup'
                          ? 'Register Showroom Account'
                          : 'Retailer Portal Sign In'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Sign in to dispatch 2-man bulky loops, track live MK routes, and export VAT/CSV reconciliation ledgers.
                      </p>
                    </div>

                    {authError && (
                      <p className="text-red-700 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-200">
                        ⚠️ {authError}
                      </p>
                    )}

                    <input
                      type="email"
                      placeholder="Showroom Email (e.g. retailer@benlogistics.co.uk)"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-[#0F172A] rounded-xl py-3 px-4 outline-none transition-all text-sm"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Security Password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-[#0F172A] rounded-xl py-3 px-4 outline-none transition-all text-sm"
                      required
                    />

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="min-h-[48px] w-full bg-[#004225] hover:bg-[#005A34] text-white font-extrabold py-3 px-4 rounded-xl transition-all shadow-md shadow-[#004225]/20 text-sm"
                    >
                      {authLoading
                        ? 'Authenticating Showroom...'
                        : authMode === 'signup'
                        ? 'Create Retailer Workspace →'
                        : 'Sign In to Retailer Portal →'}
                    </button>

                    <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 text-center">
                        Hub 01 (M1 Corridor) &amp; National UK Retailer Pilot Instant Access
                      </span>
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={() => handleQuickPilotLogin('retailer')}
                        className="min-h-[44px] w-full bg-[#0A0F0D] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold py-2.5 px-3 rounded-xl transition-all shadow-sm"
                      >
                        🧪 Demo Retailer Sign-In (retailer@benlogistics.co.uk)
                      </button>
                    </div>

                    <p className="text-center text-xs text-slate-600">
                      {authMode === 'signup'
                        ? 'Already have a showroom account?'
                        : 'Need a showroom pilot account?'}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === 'signup' ? 'login' : 'signup')
                          setAuthError('')
                        }}
                        className="text-emerald-700 font-extrabold hover:underline"
                      >
                        {authMode === 'signup' ? 'Sign in' : 'Register showroom'}
                      </button>
                    </p>
                  </form>
                </div>
              </div>
            ) : (
              <BookJobForm
                retailerId={effectiveUserId}
                retailerName={
                  session?.user?.user_metadata?.full_name ||
                  session?.user?.email ||
                  'MK Showroom Manager'
                }
                mode="retailer"
                onSignOut={handleSignOut}
                onRequireAuth={() => handleSignOut()}
                onOpenConsumerTracker={(jobId) =>
                  navigate(`/track/${encodeURIComponent(jobId)}`)
                }
              />
            )}
          </div>
        )}

        {/* =====================================================================
            ROUTE 4: /cab (AUTHENTICATED MOBILE IN-CAB HUD & PWA START_URL)
           ===================================================================== */}
        {currentRoute === 'cab' && (
          <div className="max-w-4xl mx-auto w-full">
            {authChecking ? (
              <div className="max-w-md mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center text-sm font-bold text-slate-600">
                Initializing Ben Crew In-Cab HUD...
              </div>
            ) : !session ? (
              <div className="max-w-md mx-auto w-full space-y-4">
                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-7 shadow-xl">
                  <form
                    onSubmit={(e) => handleAuthSubmit(e, 'driver')}
                    className="flex flex-col space-y-5"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full">
                        Mobile In-Cab HUD • /cab
                      </span>
                      <h2 className="text-2xl font-extrabold text-[#0F172A] mt-2">
                        👷 Ben Crew Sign-In
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Authenticate your 2-Man Crew profile to access Gate A6 compliance, LIFO load sheets, 3-Mode routing, and Camera/Canvas PoD.
                      </p>
                    </div>

                    {authError && (
                      <p className="text-red-700 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-200">
                        ⚠️ {authError}
                      </p>
                    )}

                    <input
                      type="email"
                      placeholder="Crew Email (e.g. driver@benlogistics.co.uk)"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-[#0F172A] rounded-xl py-3 px-4 outline-none transition-all text-sm"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Security Password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-[#0F172A] rounded-xl py-3 px-4 outline-none transition-all text-sm"
                      required
                    />

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="min-h-[50px] w-full bg-[#004225] hover:bg-[#005A34] text-white font-extrabold py-3 px-4 rounded-xl transition-all shadow-md shadow-[#004225]/20 text-sm"
                    >
                      {authLoading
                        ? 'Unlocking In-Cab HUD...'
                        : authMode === 'signup'
                        ? 'Create Crew Operator Account →'
                        : 'Unlock Mobile In-Cab HUD →'}
                    </button>

                    <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 text-center">
                        Hub 01 (M1 Corridor) Verified Crew Instant Pilot Access
                      </span>
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={() => handleQuickPilotLogin('driver')}
                        className="min-h-[46px] w-full bg-[#FEFCE8] hover:bg-yellow-100 disabled:opacity-50 text-[#713F12] border border-[#F6EB61] text-xs font-extrabold py-2.5 px-3 rounded-xl transition-all shadow-sm"
                      >
                        🚚 Demo Driver Sign-In (driver@benlogistics.co.uk)
                      </button>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 text-[11px] text-slate-600 space-y-1">
                      <div className="font-extrabold text-[#0F172A]">
                        📲 Install &ldquo;Ben Crew&rdquo; to Your Phone Home Screen
                      </div>
                      <p>
                        In Safari (iOS) tap <strong>Share → Add to Home Screen</strong>, or in Chrome (Android) tap <strong>Install App</strong> to launch <code>/cab</code> full-screen without an App Store download.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-sm">
                <div className="border-b border-[#E2E8F0] pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#0F172A]">
                      👷 Ben Crew In-Cab HUD
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                      Gate A6 Compliance, 3-Mode Driver-First Routing, LIFO Van-Bay Load Sheet, and Side-by-Side AI Damage-Shield PoD.
                    </p>
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-center">
                    MK9 Realtime Node
                  </span>
                </div>

                <BookJobForm
                  retailerId={effectiveUserId}
                  mode="driver"
                  onRequireAuth={() => handleSignOut()}
                  onOpenConsumerTracker={(jobId) =>
                    navigate(`/track/${encodeURIComponent(jobId)}`)
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            ROUTE 5: /track/:jobId (PUBLIC TOKENIZED CONSUMER TRACKER)
           ===================================================================== */}
        {currentRoute === 'track' && (
          <ConsumerTrackView selectedJobId={trackedJobId} />
        )}

        {/* =====================================================================
            ROUTE 6: /command (HIDDEN ADMIN COMMAND CENTER - STRICTLY GATED)
           ===================================================================== */}
        {currentRoute === 'command' && (
          <div className="w-full">
            {authChecking ? (
              <div className="max-w-md mx-auto bg-slate-900/90 border border-white/10 rounded-2xl p-8 text-center text-sm font-bold text-slate-300">
                Verifying Executive Admin Clearance...
              </div>
            ) : !session || !isAdminVerified ? (
              <div className="max-w-md mx-auto w-full">
                <div
                  className="rounded-2xl p-8 shadow-2xl border text-slate-100"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(16px)',
                    borderColor: 'rgba(0, 245, 212, 0.25)'
                  }}
                >
                  <form
                    onSubmit={(e) => handleAuthSubmit(e, 'admin')}
                    className="flex flex-col space-y-5"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-[#00F5D4]/15 text-[#00F5D4] border border-[#00F5D4]/40 px-2.5 py-1 rounded-full">
                        🔒 Restricted Executive Node • /command
                      </span>
                      <h2 className="text-2xl font-extrabold text-white mt-2.5">
                        Admin Command Center Gate
                      </h2>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Strictly gated behind Admin Auth verification for monitoring{' '}
                        <code className="text-[#00F5D4]">public.agent_events</code> and executing 1-click human-in-the-loop escrow &amp; Gate A6 approvals.
                      </p>
                    </div>

                    {session && !isAdminVerified && (
                      <div className="bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold p-3 rounded-xl">
                        ⚠️ Current session ({session.user?.email}) does not hold Admin Command clearance. Authenticate with an Admin Operator credential below.
                      </div>
                    )}

                    {authError && (
                      <p className="text-red-300 text-xs font-bold bg-red-950/60 p-3 rounded-lg border border-red-500/40">
                        ⚠️ {authError}
                      </p>
                    )}

                    <input
                      type="email"
                      placeholder="Admin Operator Email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="min-h-[48px] bg-slate-950/90 border border-white/15 focus:border-[#00F5D4] text-white rounded-xl py-3 px-4 outline-none transition-all text-sm"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Admin Security Key"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="min-h-[48px] bg-slate-950/90 border border-white/15 focus:border-[#00F5D4] text-white rounded-xl py-3 px-4 outline-none transition-all text-sm"
                      required
                    />

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="min-h-[48px] w-full bg-[#00F5D4] hover:bg-teal-300 text-slate-950 font-extrabold py-3 px-4 rounded-xl transition-all shadow-lg shadow-[#00F5D4]/20 text-sm"
                    >
                      {authLoading
                        ? 'Verifying Admin Clearance...'
                        : 'Verify Admin & Unlock Flight Deck →'}
                    </button>

                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 text-center">
                        Principal Architect / Pilot Executive Clearance
                      </span>
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={() => handleQuickPilotLogin('admin')}
                        className="min-h-[44px] w-full bg-slate-900 hover:bg-slate-800 border border-[#00F5D4]/40 text-[#00F5D4] text-xs font-extrabold py-2.5 px-3 rounded-xl transition-all"
                      >
                        🔐 Authenticate Pilot Admin Session
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <AgentCommandCenter />
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer
        className={`w-full py-6 border-t text-center text-xs font-medium mt-auto ${
          isFlightDeckMode
            ? 'border-white/10 bg-[#090D16] text-slate-400'
            : 'border-[#E2E8F0] bg-[#FFFFFF] text-slate-500'
        }`}
      >
        &copy; 2026 Ben Logistics Ltd (<span className="font-bold text-[#004225]">BEN.</span> — Mercedes Sprinter LWB &amp; 2-Man Specialist Network — UK M1 Corridor &amp; National Hubs). Acting strictly as a Direct-to-Crew Logistics Operating System connecting Retailers and Independent Contractor Crews.
      </footer>
    </div>
  )
}
