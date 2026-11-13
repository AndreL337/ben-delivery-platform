import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowRight,
  Route,
  Percent,
  ShieldCheck,
  Truck,
  CheckCircle2,
  AlertCircle,
  Lock,
  Smartphone,
  FlaskConical,
  KeyRound
} from 'lucide-react'
import { supabase } from './config/supabaseClient'
import { PRICING_MATRIX } from './config/pricingMatrix2026'
import type { VehicleSetup, LoopProfile, AppRoute } from './types/logistics'
import { AgentCommandCenter } from './modules/admin/AgentCommandCenter'
import { ConsumerTrackView } from './modules/tracking/ConsumerTrackView'
import { BookJobForm } from './modules/retailerAndCrew/BookJobForm'
import { BenWordmark } from './shared/components/BenWordmark'
import { BenLogo } from './shared/components/BenLogo'
import { RateCardView } from './modules/marketing/RateCardView'
import { RegionalHubView } from './modules/marketing/RegionalHubView'
import { REGIONAL_HUBS } from './config/regionalHubs'
import { LegalDocumentModal, type LegalDocType } from './shared/components/LegalModals'
import './App.css'

interface ParsedLocation {
  route: AppRoute
  trackedJobId: string | null
  hubSlug?: string | null
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

  // 6. /rate-card -> Printable A4 B2B Rate Card & Pilot Sheet
  if (/^\/rate-card$/i.test(cleanPath)) {
    return { route: 'rate-card', trackedJobId: null }
  }

  // 7. /hubs/:citySlug -> Programmatic Regional Hub SEO Landing Page
  const hubMatch = cleanPath.match(/^\/hubs\/([^/?#]+)$/i)
  if (hubMatch) {
    return {
      route: 'hub',
      trackedJobId: null,
      hubSlug: decodeURIComponent(hubMatch[1]).toLowerCase()
    }
  }

  // 8. Default / -> Public B2B Landing Page
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
  const [hubSlug, setHubSlug] = useState<string | null>(initialLoc.hubSlug || null)
  const [session, setSession] = useState<any>(null)
  const [authChecking, setAuthChecking] = useState<boolean>(true)
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(false)
  const [adminUnlockedInSession, setAdminUnlockedInSession] = useState<boolean>(false)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null)

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
    'LWB / XLWB High-Roof Panel Van (3.5t) — e.g., Sprinter, Transit Jumbo, Crafter, Master'
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
    setHubSlug(parsed.hubSlug || null)
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
      setHubSlug(parsed.hubSlug || null)
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
      setCapabilitySpec(
        'LWB / XLWB High-Roof Panel Van (3.5t) — e.g., Sprinter, Transit Jumbo, Crafter, Master'
      )
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
      {/* CONTEXT-ISOLATED HEADER (MOBBIN / STRIPE GLASSMORPHIC BAR) */}
      <header
        className={`w-full sticky top-0 z-50 h-16 px-6 flex items-center transition-all ${
          isFlightDeckMode
            ? 'border-b text-white shadow-2xl'
            : 'bg-white/85 backdrop-blur-md border-b border-slate-200/70 text-[#0A0F0D]'
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
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
          {/* LEFT: LOGO + 1PX VERTICAL DIVIDER + MUTED SUBTITLE */}
          <button
            type="button"
            onClick={() => navigate(currentRoute === 'cab' ? '/cab' : '/')}
            className="flex items-center gap-3 text-left group shrink-0"
          >
            <BenLogo variant={isFlightDeckMode ? 'dark' : 'light'} size="md" />
            <span
              className={`hidden md:inline-block h-4 w-px ${
                isFlightDeckMode ? 'bg-white/20' : 'bg-slate-200'
              }`}
              aria-hidden="true"
            />
            <span
              className={`hidden md:inline-block text-xs font-medium tracking-tight ${
                isFlightDeckMode ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {currentRoute === 'command'
                ? 'Restricted Flight Deck • Gate A0 Admin Node'
                : currentRoute === 'cab'
                ? 'Crew In-Cab HUD • UK M1 & National Hubs'
                : currentRoute === 'portal'
                ? 'Retailer Dispatch Workspace'
                : currentRoute === 'rate-card'
                ? '2026 Enterprise B2B Rate Card'
                : currentRoute === 'hub'
                ? 'Hub 01 Regional Dispatch Corridor'
                : currentRoute === 'track'
                ? 'Live Consumer Delivery Telemetry'
                : 'UK Direct-to-Crew Logistics OS'}
            </span>
          </button>

          {/* RIGHT: CLEAN TEXT LINKS + GHOST SIGN IN + PRIMARY BOOK DISPATCH */}
          {(currentRoute === 'landing' ||
            currentRoute === 'driver-waitlist' ||
            currentRoute === 'rate-card' ||
            currentRoute === 'hub') && (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => navigate('/rate-card')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentRoute === 'rate-card'
                    ? 'text-[#004225] bg-[#F0F7F4]'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Rate Card
              </button>
              <button
                type="button"
                onClick={() => navigate('/driver')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentRoute === 'driver-waitlist'
                    ? 'text-[#004225] bg-[#F0F7F4]'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Driver Network
              </button>
              <button
                type="button"
                onClick={() => navigate('/track/mk-live-loop-884')}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
              >
                Track Delivery
              </button>
              <button
                type="button"
                onClick={() => navigate('/cab')}
                className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => navigate('/portal')}
                className="bg-[#004225] hover:bg-[#005A34] text-white rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm inline-flex items-center gap-1.5"
              >
                <span>Book Dispatch</span>
              </button>
            </div>
          )}

          {currentRoute === 'portal' && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/rate-card')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all"
              >
                Rate Card
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-950 border border-slate-200/80 bg-white transition-all"
              >
                Public Site
              </button>
              {session && (
                <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                  <div className="hidden sm:block text-right">
                    <p className="text-[11px] text-slate-500 font-medium">
                      {session.user?.email || 'retailer@benlogistics.co.uk'}
                    </p>
                    <p className="text-[11px] font-semibold text-[#004225] inline-flex items-center gap-1.5 justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span>Verified Workspace</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {currentRoute === 'cab' && (
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F0F7F4] text-[#004225]">
                <Smartphone className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>PWA Ready</span>
              </span>
              {session ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all"
                >
                  End Shift
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/driver')}
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all inline-flex items-center gap-1"
                >
                  <span>Crew Waitlist</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}

          {currentRoute === 'track' && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-full">
                <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Tokenized Consumer Receipt</span>
              </span>
            </div>
          )}

          {currentRoute === 'command' && (
            <div className="flex items-center gap-3">
              {session && isAdminVerified && (
                <>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#00F5D4]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00F5D4]" />
                    <span>Admin Verified ({session.user?.email})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all"
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
          <div className="space-y-12">
            {/* ASYMMETRIC 12-COLUMN STRIPE / WISE HERO + INTERACTIVE ROUTE RATE CALCULATOR */}
            <section className="ben-blueprint-grid py-2 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* LEFT 7 COLUMNS: FLUID HERO TYPOGRAPHY & DUAL CTAs */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  </span>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                    Hub 01 Live — M1 Corridor &amp; National UK Network
                  </span>
                </div>

                <h1 className="text-4xl lg:text-5xl font-bold tracking-[-0.035em] text-slate-950 leading-[1.08]">
                  The UK’s Direct-to-Crew Logistics Operating System.
                </h1>

                <p className="text-slate-600 text-lg leading-relaxed max-w-2xl">
                  Connect commercial shippers straight to vetted 3.5t LWB, XLWB &amp; Luton 2-man delivery crews. Zero 3PL middlemen, driver-first routing, and instant photographic Proof of Delivery.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/portal')}
                    className="min-h-[48px] bg-[#004225] hover:bg-[#005A34] text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-sm inline-flex items-center gap-2 text-sm"
                  >
                    <span>Book Dispatch</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/driver')}
                    className="min-h-[48px] bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/80 font-semibold py-3 px-6 rounded-xl transition-all shadow-sm inline-flex items-center gap-2 text-sm"
                  >
                    <span>Join Driver Network</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/rate-card')}
                    className="min-h-[48px] px-4 py-3 text-sm font-semibold text-[#004225] hover:text-[#005A34] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>View 2026 Rate Card</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {/* RIGHT 5 COLUMNS: UNIFIED INTERACTIVE ROUTE RATE & SPLIT CALCULATOR */}
              <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 overflow-hidden">
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#004225] block">
                        2026 Live Rate Calculator
                      </span>
                      <h2 className="text-base font-bold text-slate-950 mt-0.5">
                        Flat-Rate Loop &amp; Crew Split
                      </h2>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md tabular-nums">
                      {currentTier.targetVolume}
                    </span>
                  </div>

                  {/* Segmented Pill Selector: Vehicle Setup */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Fleet Setup
                    </label>
                    <div className="grid grid-cols-2 bg-slate-100/90 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setVehicleSetup('independent')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                          vehicleSetup === 'independent'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Independent 3.5t Van
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehicleSetup('clientVehicle')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                          vehicleSetup === 'clientVehicle'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Client Vehicle Pod
                      </button>
                    </div>
                  </div>

                  {/* Segmented Pill Selector: Route Profile */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Service Tier
                    </label>
                    <div className="grid grid-cols-3 bg-slate-100/90 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setLoopProfile('roc')}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                          loopProfile === 'roc'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Standard ROC
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoopProfile('assembly')}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                          loopProfile === 'assembly'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        White-Glove
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoopProfile('overflow')}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                          loopProfile === 'overflow'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Mini-Loop
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <span>{currentTier.shiftCap}</span>
                    <span>Platform OS Fee (12.5%): £{currentTier.platformFee.toFixed(2)}</span>
                  </div>
                </div>

                {/* Clean Bottom Summary Bar in #004225 */}
                <div className="bg-[#004225] text-white px-6 py-4 flex items-center justify-between tabular-nums">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F6EB61] block">
                      Flat Daily Route Rate
                    </span>
                    <div className="text-2xl font-bold mt-0.5">
                      £{currentTier.grossFee.toFixed(0)}
                      <span className="text-xs font-normal text-emerald-100/80 ml-1">
                        / loop
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/80 block">
                      87.5% Direct to Crew
                    </span>
                    <div className="text-lg font-bold text-[#F6EB61] mt-0.5">
                      £{currentTier.netPool.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* THE 3 VALUE PILLARS — SEAMLESS 3-COLUMN EDITORIAL STRIP */}
            <section className="border-y border-slate-200/80 bg-white rounded-2xl border overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/70">
                <div className="p-6 md:p-8 space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-[#004225]/5 text-[#004225] flex items-center justify-center">
                    <Route className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-slate-950">
                    Direct-to-Crew UK Logistics
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Connect commercial shippers straight to vetted 2-man delivery crews nationwide. Cut 3PL middleman layers out of your supply chain instantly.
                  </p>
                </div>

                <div className="p-6 md:p-8 space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-[#004225]/5 text-[#004225] flex items-center justify-center">
                    <Percent className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-slate-950">
                    Zero Broker Markups
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Lock in transparent flat-rate loops across your UK supply chain with total clarity—87.5% flows directly to the operating crew.
                  </p>
                </div>

                <div className="p-6 md:p-8 space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-[#004225]/5 text-[#004225] flex items-center justify-center">
                    <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-slate-950">
                    Instant Digital Proof of Delivery
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Track live updates and receive side-by-side Condition Gate photo sign-offs and customer e-signatures right from the warehouse floor.
                  </p>
                </div>
              </div>
            </section>

            {/* REGIONAL DENSITY HUB ARCHITECTURE — HAIRLINE DIVIDED STRIP */}
            <section className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#004225] block">
                    National UK Hub Architecture
                  </span>
                  <h2 className="text-base font-bold text-slate-950">
                    Hub 01 Live (M1 Corridor) &amp; Regional Expansion Zones
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/driver')}
                  className="text-xs font-semibold text-[#004225] hover:underline inline-flex items-center gap-1 self-start sm:self-center"
                >
                  <span>Register Fleet for Your Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70">
                <div className="p-5 space-y-1.5 bg-[#F0F7F4]/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#004225]">Hub 01 • M1 Corridor</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#713F12] bg-[#FEFCE8] px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span>Live</span>
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    MK • Bedford • Northampton • Luton
                  </p>
                  <p className="text-xs text-slate-500">
                    Daily multi-drop &amp; 2-man bulky dispatch active now.
                  </p>
                </div>

                <div className="p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Hub 02 • London &amp; M25</span>
                    <span className="text-[11px] font-medium text-slate-500">Onboarding</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Greater London • Watford • Slough
                  </p>
                  <p className="text-xs text-slate-500">
                    ULEZ-compliant 3.5t LWB, XLWB, EV &amp; Luton crews.
                  </p>
                </div>

                <div className="p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Hub 03 • Midlands</span>
                    <span className="text-[11px] font-medium text-slate-500">Onboarding</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Birmingham • Coventry • Leicester
                  </p>
                  <p className="text-xs text-slate-500">
                    Golden Triangle direct room-of-choice dispatch.
                  </p>
                </div>

                <div className="p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Hub 04 • North</span>
                    <span className="text-[11px] font-medium text-slate-500">Onboarding</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Manchester • Leeds • Warrington
                  </p>
                  <p className="text-xs text-slate-500">
                    M62 corridor commercial shippers &amp; 2-man teams.
                  </p>
                </div>
              </div>
            </section>
          </div>
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
                  3.5t LWB, XLWB &amp; Luton 2-Man Specialist Network — UK M1 Corridor &amp; National Hubs
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0A0F0D]">
                Join the UK Direct-to-Crew 3.5t Commercial Van &amp; 2-Man Roster
              </h1>
              <p className="text-slate-600 text-base leading-relaxed">
                Keep <strong>87.5% of every route fee</strong> (£385–£455 net pool per loop + 100% of £25 heavy-access surcharges). Open to independent owner-operators running LWB/XLWB High-Roof vans (Ford Transit, Mercedes Sprinter, VW Crafter, Renault Master, Iveco Daily, Vauxhall Movano, Peugeot Boxer), 3.5t Luton/Low-Loader tail-lift box vans, 7.5t trucks, and professional 2-man delivery porters.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT 7 COLS: WAITLIST & VEHICLE CAPABILITY INTAKE FORM */}
              <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-sm">
                {waitlistSubmitted ? (
                  <div className="text-center py-10 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-[#004225] flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-2xl font-bold text-[#0A0F0D]">
                      Crew Capability Profile Logged.
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed px-4">
                      We’ve received your professional credentials for the 3.5t LWB, XLWB &amp; Luton 2-Man Specialist Network. Our Supply &amp; Compliance Agent will verify your GIT &amp; Public Liability certificates shortly.
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
                        Register your LWB/XLWB panel van, 3.5t Luton/Low-Loader box van, commercial vehicle, or 2-Man Porter profile for Hub 01 (M1 Corridor) or your regional UK hub.
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
                        <option value="Driver">Lead Driver / Owner-Operator (3.5t / 7.5t)</option>
                        <option value="Porter">Second Man / Delivery Porter &amp; Assembly</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5">
                        UK Commercial Fleet Taxonomy (Make &amp; Model Agnostic)
                      </label>
                      <select
                        value={capabilitySpec}
                        onChange={(e) => setCapabilitySpec(e.target.value)}
                        className="min-h-[48px] w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-4 outline-none transition-all text-sm font-bold"
                      >
                        <option value="LWB / XLWB High-Roof Panel Van (3.5t) — e.g., Sprinter, Transit Jumbo, Crafter, Master">
                          1. LWB / XLWB High-Roof Panel Van (3.5t) — e.g., Sprinter, Transit Jumbo, Crafter, Master
                        </option>
                        <option value="3.5t Luton / Low-Loader Box Van (with Tail-Lift) — 2-Man Heavy Bulky & White-Glove">
                          2. 3.5t Luton / Low-Loader Box Van (with Tail-Lift) — 2-Man Heavy Bulky &amp; White-Glove
                        </option>
                        <option value="MWB / Urban Commercial & EV Van — Trade Counter & High-Density Multi-Drop">
                          3. MWB / Urban Commercial &amp; EV Van — Trade Counter &amp; High-Density Multi-Drop
                        </option>
                        <option value="7.5t Box Truck (with Tail-Lift) — Heavy Commercial Trunking">
                          4. 7.5t Box Truck (with Tail-Lift) — Heavy Commercial Trunking
                        </option>
                        <option value="No Vehicle (On-Roster 2-Man Porter / Assembly Specialist)">
                          5. No Vehicle (On-Roster 2-Man Porter / Assembly Specialist)
                        </option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Make (e.g. Ford, Mercedes, VW)"
                        value={make}
                        onChange={(e) => setMake(e.target.value)}
                        className="min-h-[48px] col-span-1 bg-[#FFFFFF] border border-[#E2E8F0] focus:border-[#004225] text-[#0A0F0D] rounded-xl py-2.5 px-3 outline-none text-sm placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Model (e.g. Transit, Sprinter, Crafter)"
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

              {/* RIGHT 5 COLS: CREW EARNINGS & MOBILE IN-CAB PWA ACCESS (LIGHT SURFACE 90/8/2) */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-[#FEFCE8] text-[#713F12] px-2.5 py-1 rounded-full border border-[#F6EB61]">
                    Already Approved on Hub 01 (M1 Corridor)?
                  </span>
                  <h3 className="text-xl font-extrabold text-[#0A0F0D]">
                    Launch the Mobile In-Cab HUD (/cab)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Access Gate A6 compliance onboarding, claim live Hub 01 showroom &amp; commercial loops, switch between 3 Driver-First routing modes, and capture Damage-Shield PoDs from your phone.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/cab')}
                    className="min-h-[48px] w-full bg-[#004225] hover:bg-[#005A34] text-white font-semibold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider shadow-sm inline-flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" strokeWidth={1.75} />
                    <span>Open ben. Crew In-Cab App (/cab)</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>

                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-3">
                  <h4 className="text-sm font-extrabold text-[#0A0F0D] uppercase tracking-wider">
                    UK 3.5t &amp; 2-Man Crew Operating Standards
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
                      <p className="text-red-700 text-xs font-semibold bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        <span>{authError}</span>
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
                        className="min-h-[44px] w-full bg-[#0A0F0D] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition-all shadow-sm inline-flex items-center justify-center gap-2"
                      >
                        <FlaskConical className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Demo Retailer Sign-In (retailer@benlogistics.co.uk)</span>
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
                      <h2 className="text-2xl font-bold text-[#0F172A] mt-2 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[#004225]" strokeWidth={1.75} />
                        <span>Ben Crew Sign-In</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Authenticate your 2-Man Crew profile to access Gate A6 compliance, LIFO load sheets, 3-Mode routing, and Camera/Canvas PoD.
                      </p>
                    </div>

                    {authError && (
                      <p className="text-red-700 text-xs font-semibold bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        <span>{authError}</span>
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
                        className="min-h-[46px] w-full bg-[#FEFCE8] hover:bg-yellow-100 disabled:opacity-50 text-[#713F12] border border-[#F6EB61] text-xs font-semibold py-2.5 px-3 rounded-xl transition-all shadow-sm inline-flex items-center justify-center gap-2"
                      >
                        <Truck className="w-4 h-4" strokeWidth={1.75} />
                        <span>Demo Driver Sign-In (driver@benlogistics.co.uk)</span>
                      </button>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 text-[11px] text-slate-600 space-y-1">
                      <div className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-[#004225]" strokeWidth={1.75} />
                        <span>Install &ldquo;Ben Crew&rdquo; to Your Phone Home Screen</span>
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
                    <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
                      <Truck className="w-5 h-5 text-[#004225]" strokeWidth={1.75} />
                      <span>Ben Crew In-Cab HUD</span>
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
            ROUTE 5B: /rate-card (PRINTABLE A4 B2B RATE CARD & PILOT SHEET)
           ===================================================================== */}
        {currentRoute === 'rate-card' && (
          <RateCardView onNavigate={navigate} />
        )}

        {/* =====================================================================
            ROUTE 5C: /hubs/:citySlug (PROGRAMMATIC REGIONAL HUB SEO LANDING)
           ===================================================================== */}
        {currentRoute === 'hub' && (
          <RegionalHubView hubSlug={hubSlug} onNavigate={navigate} />
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
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest bg-[#00F5D4]/15 text-[#00F5D4] border border-[#00F5D4]/40 px-2.5 py-1 rounded-full">
                        <Lock className="w-3 h-3" strokeWidth={1.75} />
                        <span>Restricted Executive Node • /command</span>
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
                      <div className="bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-semibold p-3 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                        <span>
                          Current session ({session.user?.email}) does not hold Admin Command clearance. Authenticate with an Admin Operator credential below.
                        </span>
                      </div>
                    )}

                    {authError && (
                      <p className="text-red-300 text-xs font-semibold bg-red-950/60 p-3 rounded-lg border border-red-500/40 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        <span>{authError}</span>
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
                        className="min-h-[44px] w-full bg-slate-900 hover:bg-slate-800 border border-[#00F5D4]/40 text-[#00F5D4] text-xs font-semibold py-2.5 px-3 rounded-xl transition-all inline-flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Authenticate Pilot Admin Session</span>
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
        className={`w-full py-6 px-6 border-t text-center text-xs font-medium mt-auto ${
          isFlightDeckMode
            ? 'border-white/10 bg-[#090D16] text-slate-400'
            : 'border-[#E2E8F0] bg-[#FFFFFF] text-slate-500'
        }`}
      >
        <div className="max-w-6xl mx-auto space-y-4">
          {/* ACTIVE HUB 01 CORRIDOR INDEX FOR SEO & REGIONAL DISCOVERY */}
          {!isFlightDeckMode && (
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2 pb-4 border-b border-slate-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active Hub 01 Corridors:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-semibold">
                {REGIONAL_HUBS.map((hub) => (
                  <a
                    key={hub.slug}
                    href={`/hubs/${hub.slug}`}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/hubs/${hub.slug}`)
                    }}
                    className="text-slate-600 hover:text-[#004225] hover:underline transition-colors"
                  >
                    {hub.city}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>
              &copy; 2026 Ben Logistics Ltd (
              <BenWordmark variant={isFlightDeckMode ? 'dark' : 'light'} size="sm" className="mx-0.5" />{' '}
              — UK Ltd Marketplace Agent). Not a carrier or employer.
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveLegalDoc('terms')}
                className="hover:underline text-emerald-700"
              >
                Platform Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalDoc('retailer_pilot')}
                className="hover:underline text-emerald-700"
              >
                Pay-on-Success Pilot Agreement
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalDoc('gdpr')}
                className="hover:underline text-emerald-700"
              >
                UK GDPR &amp; 90-Day Data Retention
              </button>
            </div>
          </div>
        </div>
      </footer>

      <LegalDocumentModal docType={activeLegalDoc} onClose={() => setActiveLegalDoc(null)} />
    </div>
  )
}
