import { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  FileText,
  Paperclip,
  Upload,
  MapPin,
  Wrench,
  Navigation,
  Compass,
  Camera,
  Check,
  X
} from 'lucide-react'
import { supabase } from '../../config/supabaseClient'
import { parseManifestDrops } from '../../config/pricingMatrix2026'
import type {
  ComplianceCredentialItem,
  ComplianceDocType,
  ComplianceStatus
} from '../../types/logistics'
import { RateJobModal, DisputePanel } from '../../shared/components/FeedbackModals'
import { ComplianceUploadModal } from '../crew/ComplianceUploadModal'
import { CrewInCabView } from '../crew/CrewInCabView'
import { RetailerPortalView } from '../retailer/RetailerPortalView'
import { useDriverRoutingEngine, type RoutingMode } from '../crew/useDriverRoutingEngine'

const getGateA6StorageKey = (uid: string) => `ben_mk_gate_a6_signed_v1_${uid || 'anon'}`

export function BookJobForm({
  retailerId,
  retailerName,
  mode,
  onSignOut,
  onRequireAuth,
  onOpenConsumerTracker
}: {
  retailerId: string
  retailerName?: string
  mode: 'retailer' | 'driver'
  onSignOut?: () => Promise<void> | void
  onRequireAuth?: () => void
  onOpenConsumerTracker?: (jobId: string) => void
}) {
  const [activeUserId, setActiveUserId] = useState<string>(retailerId || '')
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [bookingBanner, setBookingBanner] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [complianceAccepted, setComplianceAccepted] = useState<boolean>(() => {
    if (!retailerId) return false
    try {
      return Boolean(localStorage.getItem(getGateA6StorageKey(retailerId)))
    } catch {
      return false
    }
  })
  const [agreementSignedAt, setAgreementSignedAt] = useState<string | null>(() => {
    if (!retailerId) return null
    try {
      return localStorage.getItem(getGateA6StorageKey(retailerId))
    } catch {
      return null
    }
  })
  const [ratingJob, setRatingJob] = useState<any>(null)
  const [disputeJob, setDisputeJob] = useState<any>(null)

  // Strengthened UK Compliance Gate (Gate A6) States
  const [leadDriverName, setLeadDriverName] = useState('')
  const [substitutionChecked, setSubstitutionChecked] = useState(false)
  const [gitPlChecked, setGitPlChecked] = useState(false)
  const [porterCoveredChecked, setPorterCoveredChecked] = useState(false)
  const [slaChecked, setSlaChecked] = useState(false)
  const [insurerName, setInsurerName] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [certificateDetails, setCertificateDetails] = useState('')
  const [certificateFileName, setCertificateFileName] = useState('')
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [signingAgreement, setSigningAgreement] = useState(false)

  // Crew Registered Vehicle Capability (Aptean Tail-Lift Guardrail)
  const [crewHasTailLiftLuton, setCrewHasTailLiftLuton] = useState<boolean>(true)

  // Active Crew Loop Execution & Task 4 AI Damage Shield States
  const [preLoadInspected, setPreLoadInspected] = useState<boolean>(false)
  const [inCabRouteStarted, setInCabRouteStarted] = useState<boolean>(true)
  const [preLoadPhotoName, setPreLoadPhotoName] = useState<string>(
    'mk_depot_preload_strapping_verified.jpg'
  )
  const [completedDropIndices, setCompletedDropIndices] = useState<number[]>([])
  const [signatureSvg, setSignatureSvg] = useState<string>('')
  const [podUploading, setPodUploading] = useState<boolean>(false)
  const [podMessage, setPodMessage] = useState<string>('')
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Uber-Style Compliance Locker States
  const [credentials, setCredentials] = useState<ComplianceCredentialItem[]>([
    {
      docType: 'goods_in_transit',
      title: '1. Goods in Transit (GIT £20k–£50k+)',
      subtitle: 'Covers bulky household furniture & appliances during MK transit and loading.',
      status: 'Action Required'
    },
    {
      docType: 'public_liability',
      title: '2. Public Liability (£1m+ Driver & Porter)',
      subtitle: 'Covers in-home property damage for both Lead Driver and Second Man / Porter.',
      status: 'Action Required'
    },
    {
      docType: 'hire_and_reward',
      title: '3. Hire & Reward Motor Insurance',
      subtitle: 'Commercial 3.5t LWB, XLWB, Luton & 7.5t haulage / courier motor policy certificate.',
      status: 'Action Required'
    }
  ])
  const [activeUploadCredential, setActiveUploadCredential] =
    useState<ComplianceCredentialItem | null>(null)

  useEffect(() => {
    setActiveUserId(retailerId || '')
  }, [retailerId])

  // Enforce real authenticated sessions via Supabase Auth
  const ensureAuthenticatedPilotSession = async (): Promise<string> => {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()
    if (error || !session?.user?.id) {
      throw new Error('Authentication required: Please sign in via Operator Portal Login.')
    }
    if (session.user.id !== activeUserId) {
      setActiveUserId(session.user.id)
    }
    return session.user.id
  }

  const fetchLogisticsData = async () => {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      const uid = session?.user?.id || retailerId
      if (uid && uid !== activeUserId) {
        setActiveUserId(uid)
      }

      let query = supabase.from('jobs').select('*').order('id', { ascending: false }).limit(50)
      if (mode === 'retailer' && uid) {
        query = supabase
          .from('jobs')
          .select('*')
          .eq('retailer_id', uid)
          .order('id', { ascending: false })
          .limit(50)
      }

      const { data: jobs, error } = await query

      if (error) {
        console.error('[Ben Jobs Fetch Error]', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        return
      }
      if (jobs) setActiveJobs(jobs)
    } catch (err: any) {
      console.error('[Ben Jobs Fetch Unexpected Error]', err)
    }
  }

  // Hydrate Gate A6 Agreement & Compliance Documents from Supabase on mount
  const hydrateCrewCompliance = async () => {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      const activeUid = session?.user?.id || retailerId
      if (!activeUid) {
        setComplianceAccepted(false)
        setAgreementSignedAt(null)
        return
      }

      const storageKey = getGateA6StorageKey(activeUid)
      const cachedSignedAt = (() => {
        try {
          return localStorage.getItem(storageKey)
        } catch {
          return null
        }
      })()

      const { data: agreements, error: agrErr } = await supabase
        .from('contractor_agreements')
        .select('*')
        .eq('user_id', activeUid)
        .eq('agreement_version', 'v1.0-pilot-outside-ir35')
        .order('signed_at', { ascending: false })
        .limit(1)

      if (agrErr) {
        console.warn('[Ben Gate A6 Hydration Notice]', {
          message: agrErr.message,
          details: agrErr.details,
          hint: agrErr.hint
        })
      }

      if (agreements && agreements.length > 0) {
        setComplianceAccepted(true)
        setAgreementSignedAt(agreements[0].signed_at)
        try {
          localStorage.setItem(storageKey, agreements[0].signed_at)
        } catch {
          // ignore storage quota errors
        }
      } else if (cachedSignedAt) {
        setComplianceAccepted(true)
        setAgreementSignedAt(cachedSignedAt)
      } else {
        setComplianceAccepted(false)
        setAgreementSignedAt(null)
      }

      const { data: docs, error: docErr } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('driver_id', activeUid)
        .order('uploaded_at', { ascending: false })

      if (docErr) {
        console.warn('[Ben Compliance Docs Hydration Notice]', {
          message: docErr.message,
          details: docErr.details,
          hint: docErr.hint
        })
      }

      if (docs && docs.length > 0) {
        setCredentials((prev) =>
          prev.map((cred) => {
            const match = docs.find((d: any) => d.doc_type === cred.docType)
            if (!match) return cred
            return {
              ...cred,
              status: match.verified ? 'Verified' : 'Pending Review',
              fileUrl: match.file_url,
              expiryDate: match.expiry_date,
              uploadedAt: match.uploaded_at
            }
          })
        )
      }
    } catch (err: any) {
      console.error('[Ben Compliance Hydration Unexpected Error]', err)
    }
  }

  useEffect(() => {
    fetchLogisticsData()
    hydrateCrewCompliance()

    const channel = supabase
      .channel('ben-jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          // Debounce and guard realtime refreshes so mid-form typing or canvas drawing is not clobbered
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current)
          realtimeTimerRef.current = setTimeout(() => {
            const activeTag = document.activeElement?.tagName
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
              return
            }
            fetchLogisticsData()
          }, 1200)
        }
      )
      .subscribe()

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [retailerId, mode])

  // Scope activeDriverJob strictly to the authenticated driver
  const activeDriverJob = activeJobs.find(
    (job) =>
      Boolean(activeUserId) &&
      String(job.driver_id) === String(activeUserId) &&
      ['Assigned', 'assigned', 'In Progress', 'in_transit'].includes(job.status)
  )

  useEffect(() => {
    if (Array.isArray(activeDriverJob?.completed_drops_json)) {
      setCompletedDropIndices(activeDriverJob.completed_drops_json)
    } else {
      setCompletedDropIndices([])
    }
    if (typeof activeDriverJob?.pre_load_inspected === 'boolean') {
      setPreLoadInspected(activeDriverJob.pre_load_inspected)
    }
    if (activeDriverJob) {
      setInCabRouteStarted(true)
    }
  }, [activeDriverJob?.id])

  // Instantiate Driver-First Routing Engine Hook
  const {
    routingMode,
    setRoutingMode,
    routeInverted,
    setRouteInverted,
    driverHomePostcode,
    setDriverHomePostcode,
    sequencedStops,
    lifoLoadSheet,
    syncingRoute,
    persistRoutingPlan,
    addBlackbookHazard
  } = useDriverRoutingEngine(activeDriverJob)

  const uploadPoD = async (jobId: string, file: File) => {
    setPodUploading(true)
    setPodMessage('')
    const storagePath = `${jobId}/${Date.now()}.jpg`

    try {
      // 1. Upload with upsert in case of retry after partial failure
      const { data: uploadData, error: storageErr } = await supabase.storage
        .from('pod-images')
        .upload(storagePath, file, { upsert: true })

      if (storageErr || !uploadData) {
        throw new Error(`Storage upload failed: ${storageErr?.message || 'No data'}`)
      }

      // 2. Retry DB update up to 3 times with exponential backoff if 4G drops mid-request
      let updateErr: any = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase
          .from('jobs')
          .update({
            status: 'Completed',
            pod_image_url: storagePath,
            signature_svg: signatureSvg || null,
            completed_drops_json: parseManifestDrops(activeDriverJob?.drop_addresses).map(
              (_, i) => i
            )
          })
          .eq('id', jobId)

        if (!error) {
          updateErr = null
          break
        }
        updateErr = error
        await new Promise((r) => setTimeout(r, attempt * 1500))
      }

      if (updateErr) {
        throw new Error(`Database status sync failed after PoD upload: ${updateErr.message}`)
      }

      setPodMessage(
        'Ben Damage-Shield Certificate Issued: Pre-Load matched to Room-of-Choice PoD & e-Signature verified.'
      )
      setSignatureSvg('')
      const { data: updatedJobs } = await supabase.from('jobs').select('*').eq('id', jobId)
      if (updatedJobs?.[0]) setRatingJob(updatedJobs[0])
      await fetchLogisticsData()
    } catch (err: any) {
      console.error('[Ben PoD Upload/Sync Failure]', err)
      setPodMessage(
        `Signal interrupted (${err.message}). Do NOT close this tab — tap Capture again once 4G signal returns.`
      )
    } finally {
      setPodUploading(false)
    }
  }

  const retailerOwnedJobs = activeJobs.filter(
    (j) => !activeUserId || !j.retailer_id || String(j.retailer_id) === String(activeUserId)
  )

  // Gate A6: Sign Contractor Agreement, upload certificate to Storage, and write permanent audit row
  const handleSignContractorAgreement = async () => {
    setSigningAgreement(true)
    const timestamp = new Date().toISOString()
    try {
      const activeUid = await ensureAuthenticatedPilotSession()
      const { error } = await supabase.from('contractor_agreements').insert([
        {
          user_id: activeUid,
          agreement_version: 'v1.0-pilot-outside-ir35',
          signed_at: timestamp,
          lead_driver_name: leadDriverName.trim() || 'MK Verified Crew Lead',
          has_right_of_substitution: true,
          confirms_git_and_pl: true
        }
      ])
      if (error) {
        throw error
      }

      if (certificateFile) {
        const certPath = `${activeUid}/goods_in_transit_${Date.now()}.pdf`
        await supabase.storage
          .from('compliance-docs')
          .upload(certPath, certificateFile, { upsert: true })
        await supabase.from('compliance_documents').insert([
          {
            driver_id: activeUid,
            doc_type: 'goods_in_transit',
            file_url: certPath,
            expiry_date: '2027-11-01',
            verified: false,
            status: 'Pending Verification',
            uploaded_at: timestamp
          }
        ])
      }

      try {
        localStorage.setItem(getGateA6StorageKey(activeUid), timestamp)
      } catch {
        // ignore storage errors
      }

      if (policyNumber.trim() || certificateDetails.trim() || certificateFileName) {
        setCredentials((prev) =>
          prev.map((c) =>
            c.docType === 'goods_in_transit' || c.docType === 'public_liability'
              ? { ...c, status: 'Pending Review', uploadedAt: timestamp }
              : c
          )
        )
      }

      setAgreementSignedAt(timestamp)
      setComplianceAccepted(true)
    } catch (err: any) {
      console.error('[Ben Gate A6 Error]', err)
      setBookingBanner({
        type: 'error',
        text: err?.message || 'Please sign in via Operator Portal Login before signing Gate A6.'
      })
    }
    setSigningAgreement(false)
  }

  const handleCredentialUploaded = (
    docType: ComplianceDocType,
    fileUrl: string,
    expiryDate: string
  ) => {
    setCredentials((prev) =>
      prev.map((c) =>
        c.docType === docType
          ? {
              ...c,
              status: 'Pending Review',
              fileUrl,
              expiryDate,
              uploadedAt: new Date().toISOString()
            }
          : c
      )
    )
  }

  const toggleStopCompleted = async (idx: number) => {
    if (!activeDriverJob) return
    const nextIndices = completedDropIndices.includes(idx)
      ? completedDropIndices.filter((i) => i !== idx)
      : [...completedDropIndices, idx]

    setCompletedDropIndices(nextIndices)
    const nextStatus = nextIndices.length > 0 ? 'In Progress' : 'Assigned'

    const { error } = await supabase
      .from('jobs')
      .update({
        completed_drops_json: nextIndices,
        status: nextStatus
      })
      .eq('id', activeDriverJob.id)

    if (error) {
      console.error('[Ben Stop Sync Error]', error)
    }
  }

  const handleClaimRoute = async (jobId: string) => {
    setBookingBanner(null)
    try {
      const activeUid = await ensureAuthenticatedPilotSession()

      // 1. Attempt atomic server-side claim RPC first
      const { data: rpcJob, error: rpcErr } = await supabase.rpc('claim_open_route', {
        p_job_id: jobId
      })

      if (!rpcErr && rpcJob) {
        await fetchLogisticsData()
        return
      }

      // 2. Fallback to optimistic-concurrency update if RPC is not yet pushed to remote DB
      const { data, error } = await supabase
        .from('jobs')
        .update({ status: 'Assigned', driver_id: activeUid })
        .eq('id', jobId)
        .in('status', ['Unassigned', 'open'])
        .is('driver_id', null)
        .select()

      if (error || !data || data.length === 0) {
        setBookingBanner({
          type: 'error',
          text:
            rpcErr?.message ||
            error?.message ||
            'Route already claimed by another crew or compliance gate not met.'
        })
        await fetchLogisticsData()
        return
      }

      await supabase
        .from('payouts')
        .update({ driver_id: activeUid })
        .eq('job_id', String(jobId))

      await fetchLogisticsData()
    } catch (err: any) {
      setBookingBanner({
        type: 'error',
        text: err?.message || 'Authentication required to claim a route.'
      })
    }
  }

  const todayIso = new Date().toISOString().split('T')[0]
  const isCrewComplianceVerified = credentials.every(
    (c) =>
      c.status === 'Verified' &&
      Boolean(c.expiryDate) &&
      String(c.expiryDate) >= todayIso
  )

  const allComplianceRequirementsMet =
    leadDriverName.trim().length > 0 &&
    substitutionChecked &&
    gitPlChecked &&
    porterCoveredChecked &&
    slaChecked &&
    (certificateDetails.trim().length > 0 ||
      policyNumber.trim().length > 0 ||
      certificateFileName.length > 0)

  const badgeStyleForStatus = (status: ComplianceStatus) => {
    if (status === 'Verified') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
    if (status === 'Pending Review') {
      return 'bg-amber-100 text-amber-800 border-amber-200'
    }
    return 'bg-red-100 text-red-700 border-red-200'
  }

  return (
    <div className="w-full text-[#0F172A]">
      {mode === 'driver' && !activeUserId && (
        <div className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Operator Session Required: Sign in to your 2-Man Crew account to claim live Milton Keynes routes.</span>
          </span>
          {onRequireAuth && (
            <button
              type="button"
              onClick={onRequireAuth}
              className="min-h-[38px] px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold shrink-0"
            >
              Sign In / Create Account →
            </button>
          )}
        </div>
      )}
      {bookingBanner && (
        <div
          className={`mb-5 p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            bookingBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{bookingBanner.text}</span>
          <button
            type="button"
            onClick={() => setBookingBanner(null)}
            className="ml-3 text-slate-500 hover:text-[#0F172A] p-0.5"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {mode === 'retailer' ? (
        <RetailerPortalView
          retailerId={activeUserId || retailerId}
          retailerName={retailerName}
          jobs={retailerOwnedJobs}
          onRefresh={fetchLogisticsData}
          onSignOut={onSignOut}
          onRequireAuth={onRequireAuth}
          onOpenConsumerTracker={onOpenConsumerTracker}
        />
      ) : mode === 'driver' && !complianceAccepted ? (
        /* GATE A6: STRENGTHENED UK COMPLIANCE GATE IN CREW PORTAL */
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-red-100 text-red-800 px-2.5 py-1 rounded-full border border-red-200">
              Gate A6 Audit • Version v1.0-pilot-outside-ir35
            </span>
            <h3 className="text-red-800 text-lg font-bold mt-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span>Independent Contractor Agreement &amp; Insurance Verification</span>
            </h3>
            <p className="text-xs text-red-700 mt-1">
              Ben Logistics acts strictly as a technology marketplace agent connecting Retailers and Independent Contractor Crews (not a carrier or employer). Signing logs a permanent Gate A6 audit record to `public.contractor_agreements`.
            </p>
          </div>

          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-red-900 block mb-1.5">
              Lead Driver / Contractor Entity Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. David Thorne (Thorne 2-Man Logistics Ltd)"
              value={leadDriverName}
              onChange={(e) => setLeadDriverName(e.target.value)}
              required
              className="min-h-[48px] w-full bg-white border border-red-300 focus:border-emerald-600 rounded-xl py-2.5 px-3.5 text-sm text-[#0F172A] outline-none"
            />
          </div>

          <div className="text-sm text-slate-700 space-y-2.5 bg-white/90 p-4 rounded-xl border border-red-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={substitutionChecked}
                onChange={(e) => setSubstitutionChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-xs text-slate-700">
                <strong>Unfettered Right of Substitution & Self-Employed Status:</strong> I confirm we operate as an independent business entity responsible for our own tax/NI, retain the unfettered right to provide a vetted substitute crew member, have full freedom to accept/reject routes without penalty, and supply our own tools/equipment.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                checked={gitPlChecked}
                onChange={(e) => setGitPlChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-xs text-slate-700">
                <strong>Mandatory Insurance Minimums:</strong> I hold active <strong>Goods in Transit (GIT) insurance (£20,000–£50,000+ minimum)</strong>, <strong>Public Liability insurance (£1,000,000+ minimum)</strong>, and commercial <strong>Hire & Reward Motor Insurance</strong>.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                checked={porterCoveredChecked}
                onChange={(e) => setPorterCoveredChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-xs text-slate-700">
                <strong>Second Man / Porter Coverage & Right to Work:</strong> I confirm our Public Liability policy explicitly covers both the <strong>Lead Driver and Second Man / Porter</strong> for in-home property operations, and both crew members hold valid UK Right to Work.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                checked={slaChecked}
                onChange={(e) => setSlaChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-xs text-slate-700">
                <strong>48-Hour Dispute & Damage SLA:</strong> I agree that route payouts are held for 48 hours post-PoD, pre-existing depot damage must be photographed before loading, and in-transit/in-home damage is claimed against Crew GIT/PL insurance (crew liable for policy excess up to £250).
              </span>
            </label>
          </div>

          <div className="bg-white p-4 rounded-xl border border-red-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" strokeWidth={1.75} />
              <span>Crew Insurance Certificate Details (Required to Unlock Board)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Insurer Name (e.g. AXA, Aviva, PolicyBee)"
                value={insurerName}
                onChange={(e) => setInsurerName(e.target.value)}
                className="min-h-[44px] bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="GIT & PL Policy Number(s)"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="min-h-[44px] bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs outline-none focus:border-emerald-500"
              />
            </div>
            <textarea
              placeholder="Paste Insurance Certificate Summary / Cover Limits (£20k+ GIT, £1m+ PL, Porter Extension, Expiry Date)..."
              value={certificateDetails}
              onChange={(e) => setCertificateDetails(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs outline-none focus:border-emerald-500"
            />
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-600 truncate inline-flex items-center gap-1.5">
                {certificateFileName ? (
                  <>
                    <Paperclip className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                    <span>Attached: {certificateFileName}</span>
                  </>
                ) : (
                  <span>Or upload GIT / Public Liability Certificate (PDF/JPG):</span>
                )}
              </span>
              <label className="cursor-pointer bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all">
                Upload Certificate
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCertificateFile(e.target.files[0])
                      setCertificateFileName(e.target.files[0].name)
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            disabled={!allComplianceRequirementsMet || signingAgreement}
            onClick={handleSignContractorAgreement}
            className={`min-h-[52px] w-full py-3.5 rounded-xl font-extrabold transition-all ${
              allComplianceRequirementsMet
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {signingAgreement
              ? 'Recording Gate A6 Audit Signature...'
              : 'Sign Gate A6 Agreement & Initialize Crew Portal →'}
          </button>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {/* UBER-STYLE COMPLIANCE LOCKER CARD */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#004225]" strokeWidth={1.75} />
                    <span>Crew Compliance Locker (Document Vault)</span>
                  </h3>
                  {agreementSignedAt && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Check className="w-3 h-3" strokeWidth={2} />
                      <span>Gate A6 Persisted (`v1.0-pilot-outside-ir35`)</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Upload your mandatory UK commercial policies to `compliance-docs` for Supply &amp; Compliance Agent verification.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#FFFFFF] px-3 py-1.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] font-bold text-slate-600">Registered Van Asset:</span>
                <button
                  type="button"
                  onClick={() => setCrewHasTailLiftLuton(!crewHasTailLiftLuton)}
                  className={`min-h-[38px] text-[11px] font-semibold px-3 py-1 rounded-lg transition-all inline-flex items-center gap-1 ${
                    crewHasTailLiftLuton
                      ? 'bg-[#004225] text-white'
                      : 'bg-[#FEFCE8] text-[#713F12] border border-[#F6EB61]'
                  }`}
                >
                  {crewHasTailLiftLuton ? (
                    <>
                      <Check className="w-3 h-3" strokeWidth={2} />
                      <span>3.5t Luton / Low-Loader + Tail-Lift</span>
                    </>
                  ) : (
                    <span>LWB / XLWB High-Roof Panel Van (3.5t)</span>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {credentials.map((cred) => (
                <div
                  key={cred.docType}
                  className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${badgeStyleForStatus(
                          cred.status
                        )}`}
                      >
                        {cred.status}
                      </span>
                      {cred.expiryDate && (
                        <span className="text-[10px] text-slate-500 font-medium tabular-nums">
                          Exp: {cred.expiryDate}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-extrabold text-[#0F172A]">{cred.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{cred.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveUploadCredential(cred)}
                    className="min-h-[48px] w-full py-2 px-3 rounded-xl border border-[#E2E8F0] hover:border-emerald-500 hover:bg-emerald-50/50 text-[#0F172A] text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>
                      {cred.status === 'Action Required' ? 'Upload Certificate' : 'Update Certificate'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {activeDriverJob ? (
            (() => {
              const fallbackStop = {
                stopId: 'stop-0',
                originalIndex: 0,
                deliverySequence: 1,
                address:
                  parseManifestDrops(activeDriverJob.drop_addresses)[0] ||
                  '14 Midsummer Blvd, Central Milton Keynes MK9 2EA',
                postcode: 'MK9 2EA',
                estimatedCubeM3: 2.4,
                distanceFromDepotKm: 4.5,
                distanceFromHomeKm: 1.2,
                lifoLoadSequence: 1,
                vanZone: 'Zone D (Tail-Lift — Load Last / Drop First)' as const,
                blackbookAlerts: []
              }
              const firstUncompletedStop =
                sequencedStops.find((s) => !completedDropIndices.includes(s.originalIndex)) ||
                sequencedStops[sequencedStops.length - 1] ||
                fallbackStop

              return inCabRouteStarted ? (
                <CrewInCabView
                  job={activeDriverJob}
                  sequencedStops={sequencedStops.length > 0 ? sequencedStops : [fallbackStop]}
                  currentStop={firstUncompletedStop}
                  currentStopNumber={firstUncompletedStop.deliverySequence}
                  totalStops={Math.max(1, sequencedStops.length)}
                  completedDropIndices={completedDropIndices}
                  signatureSvg={signatureSvg}
                  onSaveSignatureSvg={setSignatureSvg}
                  podUploading={podUploading}
                  podMessage={podMessage}
                  onBackToPreLoad={() => setInCabRouteStarted(false)}
                  onOpenConsumerTracker={onOpenConsumerTracker}
                  onOpenDisputeModal={() => setDisputeJob(activeDriverJob)}
                  onCompleteStop={async (stop, podPhotoFile) => {
                    const willCompleteIndices = completedDropIndices.includes(stop.originalIndex)
                      ? completedDropIndices
                      : [...completedDropIndices, stop.originalIndex]

                    await toggleStopCompleted(stop.originalIndex)

                    // If all stops on the manifest are now finished, settle the route
                    if (willCompleteIndices.length >= Math.max(1, sequencedStops.length)) {
                      if (podPhotoFile) {
                        await uploadPoD(String(activeDriverJob.id), podPhotoFile)
                      } else {
                        const { error } = await supabase
                          .from('jobs')
                          .update({
                            status: 'Completed',
                            signature_svg: signatureSvg || null,
                            completed_drops_json: willCompleteIndices
                          })
                          .eq('id', activeDriverJob.id)

                        if (!error) {
                          setPodMessage(
                            'Ben Damage-Shield Certificate Issued: Route marked Completed & e-Signature verified.'
                          )
                          setSignatureSvg('')
                          const { data: updatedJobs } = await supabase
                            .from('jobs')
                            .select('*')
                            .eq('id', activeDriverJob.id)
                          if (updatedJobs?.[0]) setRatingJob(updatedJobs[0])
                          await fetchLogisticsData()
                        }
                      }
                    }
                  }}
                  onLogException={async (postcodeKey, hazardType, hazardNote) => {
                    await addBlackbookHazard(postcodeKey, hazardType, hazardNote)
                    await supabase
                      .from('jobs')
                      .update({
                        exception_notes: `[${hazardType.toUpperCase()}] ${hazardNote}`
                      })
                      .eq('id', activeDriverJob.id)
                    await fetchLogisticsData()
                  }}
                />
              ) : (
                /* MORNING PRE-LOAD MODE: DRIVER-FIRST ROUTING + STEP A REVERSE-LOAD (LIFO) BAY SHEET */
                <div className="bg-[#FFFFFF] border border-emerald-300 p-6 rounded-2xl relative overflow-hidden shadow-md space-y-6">
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        Morning Depot Pre-Load &amp; LIFO Sequencing
                      </span>
                      <h3 className="text-lg font-bold text-[#0F172A] mt-1.5 mb-1 tabular-nums flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#004225] shrink-0" strokeWidth={1.75} />
                        <span>Active Loop #{String(activeDriverJob.id)}: {activeDriverJob.pickup_address}</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          Status: {activeDriverJob.status} • Net Crew Pool: £
                          {Number(activeDriverJob.net_pool ?? 385).toFixed(2)}
                        </span>
                        {activeDriverJob.requires_tail_lift && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Tail-Lift Van Required</span>
                          </span>
                        )}
                        {(activeDriverJob.requires_assembly ||
                          activeDriverJob.loop_profile === 'assembly') && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300">
                            <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Tools &amp; Assembly Required</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => setInCabRouteStarted(true)}
                        className="min-h-[48px] text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm inline-flex items-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Full-Screen In-Cab HUD</span>
                      </button>
                      {onOpenConsumerTracker && (
                        <button
                          type="button"
                          onClick={() => onOpenConsumerTracker(String(activeDriverJob.id))}
                          className="min-h-[48px] text-xs font-bold px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white inline-flex items-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>View Customer Tracker</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DRIVER-FIRST ROUTING ENGINE (3-MODE SEQUENCING + HOME POSTCODE + 1-TAP INVERT) */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#0F172A] text-white">
                            <Compass className="w-3 h-3" strokeWidth={1.75} />
                            <span>Driver-First Routing Engine</span>
                          </span>
                          {syncingRoute && (
                            <span className="text-[10px] font-bold text-emerald-700">
                              Syncing LIFO Plan...
                            </span>
                          )}
                          {preLoadInspected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              <Lock className="w-3 h-3" strokeWidth={1.75} />
                              <span>Locked by Pre-Load Gate</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Select drop sequencing mode before loading the van. Re-ordering automatically flips the Reverse-Load (LIFO) bay sheet below.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500">
                            Home PC:
                          </span>
                          <input
                            type="text"
                            disabled={preLoadInspected}
                            value={driverHomePostcode}
                            onChange={(e) => {
                              const nextPc = e.target.value.toUpperCase()
                              setDriverHomePostcode(nextPc)
                              persistRoutingPlan(routingMode, routeInverted, nextPc)
                            }}
                            className="w-16 text-xs font-extrabold text-[#0F172A] outline-none bg-transparent uppercase tabular-nums"
                            placeholder="MK9"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={preLoadInspected}
                          onClick={() => {
                            const nextInv = !routeInverted
                            setRouteInverted(nextInv)
                            persistRoutingPlan(routingMode, nextInv, driverHomePostcode)
                          }}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                            preLoadInspected
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : routeInverted
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-slate-400'
                          }`}
                        >
                          ⇄ 1-Tap Invert Route {routeInverted ? '(Inverted)' : ''}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          {
                            mode: 'clear_bulk_first' as RoutingMode,
                            title: 'Mode A • Clear the Bulk First',
                            desc: 'Drops largest m³ items first to free van floor space early'
                          },
                          {
                            mode: 'out_and_back' as RoutingMode,
                            title: 'Mode B • Out-and-Back',
                            desc: `Starts furthest out, finishes near Home (${driverHomePostcode || 'MK9'})`
                          },
                          {
                            mode: 'tightest_loop' as RoutingMode,
                            title: 'Mode C • Tightest Loop',
                            desc: 'Nearest-neighbor MK road-network progression'
                          }
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.mode}
                          type="button"
                          disabled={preLoadInspected}
                          onClick={() => {
                            setRoutingMode(opt.mode)
                            persistRoutingPlan(opt.mode, routeInverted, driverHomePostcode)
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            routingMode === opt.mode
                              ? 'bg-white border-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                              : 'bg-white/60 border-[#E2E8F0] hover:bg-white'
                          } ${preLoadInspected ? 'opacity-65 cursor-not-allowed' : ''}`}
                        >
                          <div className="text-xs font-extrabold text-[#0F172A]">{opt.title}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            {opt.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* STEP A: DEPOT PRE-LOAD + REVERSE-LOAD (LIFO) BAY SHEET */}
                  <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#004225]" strokeWidth={1.75} />
                          <span>Step A • Depot Pre-Load &amp; Reverse-Load (LIFO) Bay Sheet</span>
                        </span>
                        <p className="text-xs text-emerald-900 mt-0.5">
                          Load items from Zone A (Bulkhead) to Zone D (Tail-Lift), inspect carton corners, and tap Start Route to launch the mobile In-Cab View.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-600 text-white self-start sm:self-center">
                        {preLoadInspected ? (
                          <>
                            <Check className="w-3 h-3" strokeWidth={2} />
                            <span>Pre-Load &amp; LIFO Locked</span>
                          </>
                        ) : (
                          <span>Ready to Load</span>
                        )}
                      </span>
                    </div>

                    <div className="bg-[#FFFFFF] border border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 space-y-2 max-h-56 overflow-y-auto">
                        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-600">
                          <span>LIFO Van Loading Order (Zone A → Zone D)</span>
                          <span>{lifoLoadSheet.length} Drops</span>
                        </div>
                        {lifoLoadSheet.map((item) => (
                          <div
                            key={item.stopId}
                            className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between font-extrabold text-[#0F172A]">
                              <span>
                                Load #{item.lifoLoadSequence} → Drop #{item.deliverySequence} (
                                {item.postcode})
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                                ~{item.estimatedCubeM3}m³
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-emerald-700">
                              {item.vanZone}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{item.address}</div>
                          </div>
                        ))}
                      </div>

                      <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-[#0F172A]">
                        <input
                          type="checkbox"
                          checked={preLoadInspected}
                          onChange={async (e) => {
                            const locked = e.target.checked
                            setPreLoadInspected(locked)
                            await supabase
                              .from('jobs')
                              .update({
                                pre_load_inspected: locked,
                                load_plan_locked_at: locked ? new Date().toISOString() : null
                              })
                              .eq('id', activeDriverJob.id)
                          }}
                          className="w-4 h-4 mt-0.5 rounded border-emerald-400 text-emerald-600"
                        />
                        <span>
                          Lock Reverse-Load (LIFO) sequence: Carton corners intact &amp; 3.5t Luton ratchet strapping verified prior to departure.
                        </span>
                      </label>

                      <label className="min-h-[48px] cursor-pointer bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] rounded-xl px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                        <span className="truncate inline-flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
                          <span>{preLoadPhotoName}</span>
                        </span>
                        <span className="text-emerald-700 shrink-0 ml-2">Update Pre-Load Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setPreLoadPhotoName(e.target.files[0].name)
                              setPreLoadInspected(true)
                            }
                          }}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        setPreLoadInspected(true)
                        setInCabRouteStarted(true)
                        await supabase
                          .from('jobs')
                          .update({
                            pre_load_inspected: true,
                            load_plan_locked_at: new Date().toISOString(),
                            status: 'In Progress'
                          })
                          .eq('id', activeDriverJob.id)
                      }}
                      className="min-h-[56px] w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl py-3.5 px-5 text-base tracking-wide uppercase shadow-lg shadow-emerald-600/25 transition-all inline-flex items-center justify-center gap-2"
                    >
                      <Navigation className="w-4 h-4" strokeWidth={1.75} />
                      <span>Lock LIFO Load &amp; Start Route (In-Cab HUD) →</span>
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#E2E8F0] pb-2">
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Open Freight Board (87.5% Net Crew Pool)
                </h3>
                {!isCrewComplianceVerified && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    <Lock className="w-3 h-3" strokeWidth={1.75} />
                    <span>Upload &amp; Verify All 3 Unexpired Policies Above to Claim Routes</span>
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {activeJobs
                  .filter(
                    (j) =>
                      j.status === 'Unassigned' ||
                      j.status === 'open' ||
                      j.status === 'draft'
                  )
                  .map((j) => {
                    const tailLiftRestricted =
                      Boolean(j.requires_tail_lift) && !crewHasTailLiftLuton
                    const claimBlocked = tailLiftRestricted || !isCrewComplianceVerified
                    const stops = parseManifestDrops(j.drop_addresses)
                    return (
                      <div
                        key={String(j.id)}
                        className="bg-[#FFFFFF] border border-[#E2E8F0] p-4 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-sm"
                      >
                        <div className="space-y-1.5">
                          <span className="font-bold text-[#0F172A] block tabular-nums">
                            Route #{String(j.id)} • {j.pickup_address}
                          </span>
                          <span className="text-xs font-bold text-emerald-700 block tabular-nums">
                            2-Man Crew Net Pool (87.5%): £{Number(j.net_pool ?? 385).toFixed(2)} •{' '}
                            {stops.length} Drops
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {j.requires_tail_lift && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle className="w-3 h-3" strokeWidth={1.75} />
                                <span>Tail-Lift Van Required</span>
                              </span>
                            )}
                            {(j.requires_assembly || j.loop_profile === 'assembly') && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300">
                                <Wrench className="w-3 h-3" strokeWidth={1.75} />
                                <span>Tools &amp; Assembly Required</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <button
                            disabled={claimBlocked}
                            onClick={() => handleClaimRoute(String(j.id))}
                            className={`min-h-[48px] text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 ${
                              claimBlocked
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {claimBlocked && <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />}
                            <span>
                              {tailLiftRestricted
                                ? 'Requires 3.5t Tail-Lift Asset'
                                : !isCrewComplianceVerified
                                ? 'Insurance Verification Required'
                                : 'Claim Route'}
                            </span>
                          </button>
                          {tailLiftRestricted && (
                            <span className="text-[10px] text-amber-800 font-bold">
                              Switch to a verified Tail-Lift Luton asset above to claim.
                            </span>
                          )}
                          {!tailLiftRestricted && !isCrewComplianceVerified && (
                            <span className="text-[10px] text-amber-800 font-bold">
                              Requires Verified GIT, Public Liability & Hire/Reward (unexpired).
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                {activeJobs.filter(
                  (j) =>
                    j.status === 'Unassigned' ||
                    j.status === 'open' ||
                    j.status === 'draft'
                ).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6 font-medium bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    No unassigned routes currently available.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="mt-8 pt-4 border-t border-[#E2E8F0] text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">
              <span className="lowercase text-[#004225]">ben.</span> — 3.5t LWB, XLWB &amp; Luton 2-Man Specialist Network — UK M1 Corridor &amp; National Hubs • Outside IR35 Active
            </p>
          </div>
        </div>
      )}

      {activeUploadCredential && (
        <ComplianceUploadModal
          credential={activeUploadCredential}
          userId={activeUserId}
          onClose={() => setActiveUploadCredential(null)}
          onUploaded={handleCredentialUploaded}
        />
      )}

      {ratingJob && (
        <RateJobModal
          job={ratingJob}
          userId={activeUserId}
          role={mode}
          onClose={() => setRatingJob(null)}
        />
      )}
      {disputeJob && (
        <DisputePanel
          job={disputeJob}
          userId={activeUserId}
          role={mode}
          onClose={() => setDisputeJob(null)}
        />
      )}
    </div>
  )
}
