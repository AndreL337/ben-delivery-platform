import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../config/supabaseClient'
import { PRICING_MATRIX, parseManifestDrops } from '../../config/pricingMatrix2026'
import type {
  VehicleSetup,
  LoopProfile,
  ComplianceCredentialItem,
  ComplianceDocType,
  ComplianceStatus
} from '../../types/logistics'
import { RateJobModal, DisputePanel } from '../../shared/components/FeedbackModals'
import { ComplianceUploadModal } from '../crew/ComplianceUploadModal'
import { CrewInCabView } from '../crew/CrewInCabView'
import { useDriverRoutingEngine, type RoutingMode } from '../crew/useDriverRoutingEngine'
import { MKRouteVisualizer } from '../../shared/components/MKRouteVisualizer'
import {
  SAMPLE_MK_MANIFESTS,
  extractManifestWithGeminiOrFallback,
  calculateShiftAndGuardrails
} from '../../shared/utils/manifestAiParser'

const getGateA6StorageKey = (uid: string) => `ben_mk_gate_a6_signed_v1_${uid || 'anon'}`

const escapeCsvCell = (val: unknown): string => {
  const raw = String(val ?? '').replace(/\r?\n/g, ' ').trim()
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export function BookJobForm({
  retailerId,
  mode,
  onRequireAuth,
  onOpenConsumerTracker
}: {
  retailerId: string
  mode: 'retailer' | 'driver'
  onRequireAuth?: () => void
  onOpenConsumerTracker?: (jobId: string) => void
}) {
  const [activeUserId, setActiveUserId] = useState<string>(retailerId || '')
  const [jobData, setJobData] = useState<{
    vehicle_setup: VehicleSetup
    loop_profile: LoopProfile
    pickup_address: string
    drop_addresses: string
    requires_tail_lift: boolean
    requires_assembly: boolean
    has_third_floor_no_lift: boolean
  }>({
    vehicle_setup: 'independent',
    loop_profile: 'roc',
    pickup_address: '',
    drop_addresses: '',
    requires_tail_lift: true,
    requires_assembly: false,
    has_third_floor_no_lift: false
  })
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [submittingJob, setSubmittingJob] = useState<boolean>(false)
  const [bookingBanner, setBookingBanner] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Task 3: AI Manifest Importer States
  const [aiRawInput, setAiRawInput] = useState<string>('')
  const [aiFileName, setAiFileName] = useState<string>('')
  const [aiExtracting, setAiExtracting] = useState<boolean>(false)
  const [aiExtractionBanner, setAiExtractionBanner] = useState<string>('')

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
  const [retailerTab, setRetailerTab] = useState<'book' | 'track' | 'ledger'>('book')
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
      subtitle: 'Commercial 3.5t Luton haulage / courier motor policy certificate.',
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

  // Task 3: Handle AI Manifest Extraction (Text or File Drop/Upload)
  const applyExtractedManifest = async (
    rawNotes: string,
    filePart?: { mimeType: string; base64Data: string; fileName: string }
  ) => {
    setAiExtracting(true)
    setAiExtractionBanner('')
    try {
      const extracted = await extractManifestWithGeminiOrFallback(rawNotes, filePart)
      setJobData({
        vehicle_setup: extracted.vehicle_setup,
        loop_profile: extracted.loop_profile,
        pickup_address: extracted.pickup_address,
        drop_addresses: extracted.drop_addresses,
        requires_tail_lift: extracted.requires_tail_lift,
        requires_assembly: extracted.requires_assembly,
        has_third_floor_no_lift: extracted.has_third_floor_no_lift
      })
      setAiExtractionBanner(
        `⚡ Auto-Populated via ${
          extracted.source === 'gemini-2.5-flash'
            ? 'Gemini 2.5 Flash Structured Schema'
            : 'Ben MK Smart-Parser'
        }: ${extracted.summaryNote}`
      )
    } catch (err: any) {
      console.error('[Ben AI Manifest Parse Error]', err)
    }
    setAiExtracting(false)
  }

  const handleManifestFileUpload = (file: File) => {
    setAiFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const resultStr = String(reader.result || '')
      const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : ''
      applyExtractedManifest(aiRawInput, {
        mimeType: file.type || 'application/pdf',
        base64Data,
        fileName: file.name
      })
    }
    reader.readAsDataURL(file)
  }

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
    if (
      activeDriverJob?.status === 'In Progress' ||
      activeDriverJob?.status === 'in_transit' ||
      Boolean(activeDriverJob?.pre_load_inspected)
    ) {
      setInCabRouteStarted(true)
    } else {
      setInCabRouteStarted(false)
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
        '🛡️ Ben Damage-Shield Certificate Issued: Pre-Load matched to Room-of-Choice PoD & e-Signature verified!'
      )
      setSignatureSvg('')
      const { data: updatedJobs } = await supabase.from('jobs').select('*').eq('id', jobId)
      if (updatedJobs?.[0]) setRatingJob(updatedJobs[0])
      await fetchLogisticsData()
    } catch (err: any) {
      console.error('[Ben PoD Upload/Sync Failure]', err)
      setPodMessage(
        `⚠️ Signal interrupted (${err.message}). Do NOT close this tab — tap Capture again once 4G signal returns.`
      )
    } finally {
      setPodUploading(false)
    }
  }

  const retailerOwnedJobs = activeJobs.filter(
    (j) => !activeUserId || !j.retailer_id || String(j.retailer_id) === String(activeUserId)
  )

  const exportLedgerToCSV = () => {
    const completedJobs = retailerOwnedJobs.filter(
      (j) => j.status === 'Completed' || j.status === 'delivered'
    )
    const headers = [
      'Date',
      'Pickup Address',
      'Gross Fare (£)',
      'Ben Platform Fee 12.5% (£)',
      'Crew Net Pool 87.5% (£)',
      'Tail-Lift Required',
      'Assembly Required'
    ]
    const csvRows = completedJobs.map((job) => {
      const date = job.created_at
        ? new Date(job.created_at).toLocaleDateString()
        : new Date().toLocaleDateString()
      return [
        escapeCsvCell(date),
        escapeCsvCell(job.pickup_address),
        escapeCsvCell(job.gross_fee ?? 440),
        escapeCsvCell(job.platform_fee ?? 55),
        escapeCsvCell(job.net_pool ?? 385),
        escapeCsvCell(job.requires_tail_lift ? 'Yes' : 'No'),
        escapeCsvCell(job.requires_assembly ? 'Yes' : 'No')
      ].join(',')
    })
    const csvString = [headers.map(escapeCsvCell).join(','), ...csvRows].join('\n')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    const isoDate = new Date().toISOString().split('T')[0]
    a.setAttribute('href', url)
    a.setAttribute('download', `Ben_Agency_Ledger_${isoDate}.csv`)
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const selectedTier = PRICING_MATRIX[jobData.vehicle_setup][jobData.loop_profile]
  const heavyAccessSurcharge = jobData.has_third_floor_no_lift ? 25 : 0
  const totalGrossFee = selectedTier.grossFee + heavyAccessSurcharge
  const totalCrewNetPool = selectedTier.netPool + heavyAccessSurcharge

  const effectiveMaxDrops = jobData.requires_assembly
    ? Math.min(selectedTier.maxDrops, 8)
    : selectedTier.maxDrops
  const parsedDropList = parseManifestDrops(jobData.drop_addresses)
  const dropCount = parsedDropList.length
  const exceedsFairUseCap = dropCount > effectiveMaxDrops

  // Task 2: Live Shift Capacity & MK9 Guardrail Metrics
  const shiftMetrics = calculateShiftAndGuardrails(
    parsedDropList,
    jobData.loop_profile,
    jobData.requires_assembly
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingJob(true)
    setBookingBanner(null)

    try {
      const activeUid = await ensureAuthenticatedPilotSession()

      // Exact schema-aligned payload for `public.jobs`
      const payload = {
        retailer_id: activeUid,
        pickup_address: jobData.pickup_address.trim(),
        drop_addresses: parsedDropList.join('\n'),
        status: 'Unassigned',
        vehicle_setup: jobData.vehicle_setup,
        loop_profile: jobData.loop_profile,
        gross_fee: totalGrossFee,
        platform_fee: selectedTier.platformFee,
        net_pool: totalCrewNetPool,
        requires_tail_lift: Boolean(jobData.requires_tail_lift),
        requires_assembly: Boolean(jobData.requires_assembly),
        has_third_floor_no_lift: Boolean(jobData.has_third_floor_no_lift),
        heavy_access_surcharge: heavyAccessSurcharge,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase.from('jobs').insert([payload]).select()

      if (error) {
        console.error('[Ben Job Creation Error - public.jobs]', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          payload
        })
        setBookingBanner({
          type: 'error',
          text: `Database Error (${error.code || 'RLS'}): ${error.message}${
            error.hint ? ` — Hint: ${error.hint}` : ''
          }`
        })
        setSubmittingJob(false)
        return
      }

      if (data && data[0]) {
        const createdJob = data[0]
        const { error: payoutError } = await supabase.from('payouts').insert([
          {
            job_id: createdJob.id,
            amount_pence: Math.round(totalCrewNetPool * 100),
            platform_fee_pence: Math.round(selectedTier.platformFee * 100),
            status: 'pending',
            total_charged_to_retailer: totalGrossFee,
            driver_payout: totalCrewNetPool,
            payout_status: 'Pending'
          }
        ])

        if (payoutError) {
          console.warn('[Ben Payout Row Notice - public.payouts]', {
            message: payoutError.message,
            details: payoutError.details,
            hint: payoutError.hint,
            code: payoutError.code
          })
        }

        setBookingBanner({
          type: 'success',
          text: `✅ Route #${createdJob.id} (${createdJob.pickup_address}) launched to Open Freight Board!`
        })
        setJobData({
          ...jobData,
          pickup_address: '',
          drop_addresses: ''
        })
        await fetchLogisticsData()
        setRetailerTab('track')
      }
    } catch (err: any) {
      console.error('[Ben Job Submission Unexpected Exception]', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        raw: err
      })
      setBookingBanner({
        type: 'error',
        text: err?.message || 'Could not dispatch route.'
      })
    }
    setSubmittingJob(false)
  }

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
            '⚠️ Route already claimed by another crew or compliance gate not met.'
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
      {!activeUserId && (
        <div className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-xs font-extrabold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            🔐 Operator Session Required: Sign in to your {mode === 'driver' ? '2-Man Crew' : 'Retailer Showroom'} account to dispatch or claim live Milton Keynes routes.
          </span>
          {onRequireAuth && (
            <button
              type="button"
              onClick={onRequireAuth}
              className="min-h-[38px] px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-extrabold shrink-0"
            >
              Sign In / Create Account →
            </button>
          )}
        </div>
      )}
      {bookingBanner && (
        <div
          className={`mb-5 p-4 rounded-xl border text-xs font-extrabold flex items-center justify-between ${
            bookingBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{bookingBanner.text}</span>
          <button
            type="button"
            onClick={() => setBookingBanner(null)}
            className="ml-3 text-slate-500 hover:text-[#0F172A]"
          >
            ✕
          </button>
        </div>
      )}

      {mode === 'retailer' ? (
        <div>
          <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E2E8F0] mb-6">
            <button
              type="button"
              onClick={() => setRetailerTab('book')}
              className={`min-h-[48px] py-2 text-sm font-extrabold rounded-lg transition-all ${
                retailerTab === 'book'
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              📝 Book Loop
            </button>
            <button
              type="button"
              onClick={() => setRetailerTab('track')}
              className={`min-h-[48px] py-2 text-sm font-extrabold rounded-lg transition-all tabular-nums ${
                retailerTab === 'track'
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              📡 Track ({retailerOwnedJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setRetailerTab('ledger')}
              className={`min-h-[48px] py-2 text-sm font-extrabold rounded-lg transition-all ${
                retailerTab === 'ledger'
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              💰 Ledger
            </button>
          </div>

          {retailerTab === 'book' && (
            <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
              {/* TASK 3: ZERO-TYPING AI MANIFEST DROPZONE */}
              <div className="bg-[#F8FAFC] border-2 border-dashed border-emerald-400/80 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                        Zero-Typing AI Dispatch
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        Gemini 2.5 Flash + Deterministic MK Fallback
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-[#0F172A] mt-1.5">
                      ⚡ Instant AI Dispatch Import (Drop Invoice / Paste WhatsApp or Dispatch Notes)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Paste raw showroom notes or drop an invoice PDF/image to auto-configure vehicle setup, assembly profile, 3rd-floor stairs, and multi-drop postcodes in 1 click.
                    </p>
                  </div>

                  <label className="min-h-[48px] cursor-pointer bg-[#FFFFFF] hover:bg-slate-50 border border-[#E2E8F0] text-[#0F172A] text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm shrink-0 transition-all">
                    <span>📄 {aiFileName ? `Loaded: ${aiFileName.slice(0, 18)}` : 'Drop / Upload Invoice'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/*,.txt,.csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleManifestFileUpload(e.target.files[0])
                        }
                      }}
                    />
                  </label>
                </div>

                {/* ONE-CLICK SAMPLE MK RETAILER MANIFEST PRESETS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {SAMPLE_MK_MANIFESTS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setAiRawInput(preset.rawDispatchNotes)
                        applyExtractedManifest(preset.rawDispatchNotes)
                      }}
                      className="min-h-[48px] text-left p-3 rounded-xl bg-[#FFFFFF] hover:bg-emerald-50/70 border border-[#E2E8F0] hover:border-emerald-400 transition-all flex items-center justify-between gap-2 shadow-sm"
                    >
                      <span className="text-xs font-extrabold text-[#0F172A]">
                        ⚡ {preset.buttonLabel}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0 tabular-nums">
                        {preset.badge}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <textarea
                    rows={2}
                    placeholder="Or paste raw WhatsApp / Showroom dispatch notes here (e.g. 'Pickup Kiln Farm MK11, 4 drops in MK9 & MK17, assemble wardrobe on 3rd floor no lift')..."
                    value={aiRawInput}
                    onChange={(e) => setAiRawInput(e.target.value)}
                    className="flex-1 bg-[#FFFFFF] border border-[#E2E8F0] focus:border-emerald-600 rounded-xl p-3 text-xs text-[#0F172A] outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={aiExtracting || !aiRawInput.trim()}
                    onClick={() => applyExtractedManifest(aiRawInput)}
                    className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-extrabold transition-all shrink-0 shadow-sm"
                  >
                    {aiExtracting ? 'Extracting...' : '⚡ Parse & Auto-Fill Form'}
                  </button>
                </div>

                {aiExtractionBanner && (
                  <div className="bg-emerald-100/90 border border-emerald-300 text-emerald-950 text-xs font-extrabold px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                    <span>{aiExtractionBanner}</span>
                    <button
                      type="button"
                      onClick={() => setAiExtractionBanner('')}
                      className="text-emerald-800 hover:text-emerald-950 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* "PAY ON SUCCESS" PILOT GUARANTEE BANNER */}
              <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-950 block">
                    🛡 Milton Keynes Showroom Pilot — "Pay on Success" Guarantee
                  </span>
                  <p className="text-xs text-blue-900 mt-0.5 leading-relaxed">
                    Pay the fixed route rate (£440 Standard ROC / £520 Assembly) <strong>only upon successful completion & verified photographic PoD</strong>. If delivery fails due to crew error, damage, or platform fault, you are invoiced <strong>£0.00</strong> (capped at first 3 routes per showroom within a 14-day window).
                  </p>
                </div>
              </div>

              {/* 2026 SETUP & PROFILE SELECTORS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold uppercase text-slate-600 tracking-wider block mb-2">
                    1. Vehicle Setup
                  </label>
                  <div className="grid grid-cols-2 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, vehicle_setup: 'independent' })}
                      className={`min-h-[48px] py-2 px-2 rounded-lg text-xs font-extrabold transition-all ${
                        jobData.vehicle_setup === 'independent'
                          ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Independent 3.5t Van
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, vehicle_setup: 'clientVehicle' })}
                      className={`min-h-[48px] py-2 px-2 rounded-lg text-xs font-extrabold transition-all ${
                        jobData.vehicle_setup === 'clientVehicle'
                          ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Client Vehicle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase text-slate-600 tracking-wider block mb-2">
                    2. Service Profile
                  </label>
                  <div className="grid grid-cols-3 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setJobData({
                          ...jobData,
                          loop_profile: 'roc',
                          requires_assembly: false
                        })
                      }
                      className={`min-h-[48px] py-2 px-1.5 rounded-lg text-[11px] font-extrabold transition-all ${
                        jobData.loop_profile === 'roc'
                          ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Standard ROC
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setJobData({
                          ...jobData,
                          loop_profile: 'assembly',
                          requires_assembly: true
                        })
                      }
                      className={`min-h-[48px] py-2 px-1.5 rounded-lg text-[11px] font-extrabold transition-all ${
                        jobData.loop_profile === 'assembly'
                          ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Delivery & Assembly
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, loop_profile: 'overflow' })}
                      className={`min-h-[48px] py-2 px-1.5 rounded-lg text-[11px] font-extrabold transition-all ${
                        jobData.loop_profile === 'overflow'
                          ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Overflow Mini-Loop
                    </button>
                  </div>
                </div>
              </div>

              {/* APTEAN-INSPIRED ROUTE MATCHING CONSTRAINT CHECKBOXES */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
                  3. Aptean-Grade Route Matching & Access Constraints
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      jobData.requires_tail_lift
                        ? 'bg-amber-50/90 border-amber-400 shadow-sm'
                        : 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={jobData.requires_tail_lift}
                      onChange={(e) =>
                        setJobData({ ...jobData, requires_tail_lift: e.target.checked })
                      }
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-[#0F172A] block">
                        3.5t Luton / Tail-Lift Required
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug block mt-0.5">
                        Mandatory for marble tables, range cookers, or heavy runs &gt;100kg.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      jobData.requires_assembly
                        ? 'bg-blue-50/90 border-blue-400 shadow-sm'
                        : 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={jobData.requires_assembly}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setJobData({
                          ...jobData,
                          requires_assembly: checked,
                          loop_profile: checked ? 'assembly' : jobData.loop_profile
                        })
                      }}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-[#0F172A] block">
                        Two-Man Assembly Required
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug block mt-0.5">
                        Room-of-choice bed/dining table assembly; caps loop at 5–8 drops/day.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      jobData.has_third_floor_no_lift
                        ? 'bg-emerald-50/90 border-emerald-400 shadow-sm'
                        : 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={jobData.has_third_floor_no_lift}
                      onChange={(e) =>
                        setJobData({
                          ...jobData,
                          has_third_floor_no_lift: e.target.checked
                        })
                      }
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-[#0F172A] block">
                        3rd Floor+ Walk-Up (No Lift)
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug block mt-0.5">
                        Adds +£25.00 heavy-access fee (passed 100% to the 2-man crew).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* LIVE 2026 RATE SUMMARY BANNER */}
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-emerald-950 block">
                    {selectedTier.label}
                  </span>
                  <span className="text-xs text-slate-700 tabular-nums">
                    Cap: <strong>{effectiveMaxDrops} Max Drops (≤9 hrs)</strong> • Ben Fee (12.5%): £
                    {selectedTier.platformFee.toFixed(2)} • Crew Net Pool:{' '}
                    <strong>£{totalCrewNetPool.toFixed(2)}</strong>
                    {heavyAccessSurcharge > 0 ? ' (incl. +£25 3rd-Floor Access)' : ''}
                  </span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                    £{totalGrossFee.toFixed(2)}
                  </span>
                  <span className="block text-[10px] font-extrabold uppercase text-emerald-900">
                    Pay on Success Rate
                  </span>
                </div>
              </div>

              <input
                placeholder="Pickup Depot / Showroom Address (Milton Keynes Origin, e.g. Kiln Farm MK11 / Bletchley MK1)"
                value={jobData.pickup_address}
                onChange={(e) => setJobData({ ...jobData, pickup_address: e.target.value })}
                required
                className="min-h-[48px] bg-[#FFFFFF] border border-[#E2E8F0] focus:border-emerald-600 text-[#0F172A] rounded-xl py-3 px-4 outline-none placeholder:text-slate-400 font-medium"
              />

              {/* MULTI-LINE MANIFEST BUILDER */}
              <div className="space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <label className="text-xs font-extrabold uppercase text-slate-700 block">
                      4. Multi-Drop Manifest Builder (One Full UK Address Per Line)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Commas inside an address are preserved safely; press Enter for each new stop.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const sampleStop =
                          dropCount % 2 === 0
                            ? '14 Midsummer Blvd, Central Milton Keynes, MK9 2EA'
                            : '82 Newport Rd, Woburn Sands, Milton Keynes, MK17 8UF'
                        setJobData({
                          ...jobData,
                          drop_addresses: jobData.drop_addresses
                            ? `${jobData.drop_addresses}\n${sampleStop}`
                            : sampleStop
                        })
                      }}
                      className="min-h-[38px] text-xs font-extrabold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 transition-all"
                    >
                      + Add Sample MK Stop
                    </button>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1.5 rounded-lg tabular-nums ${
                        exceedsFairUseCap
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]'
                      }`}
                    >
                      {dropCount} / {effectiveMaxDrops} Max Drops
                    </span>
                  </div>
                </div>
                <textarea
                  rows={4}
                  placeholder={`14 Midsummer Blvd, Central Milton Keynes, MK9 2EA\n82 Newport Rd, Woburn Sands, MK17 8UF\n19 Gold St, Northampton, NN1 1RA`}
                  value={jobData.drop_addresses}
                  onChange={(e) => setJobData({ ...jobData, drop_addresses: e.target.value })}
                  required
                  className={`w-full bg-[#FFFFFF] border ${
                    exceedsFairUseCap
                      ? 'border-amber-500 focus:border-amber-600'
                      : 'border-[#E2E8F0] focus:border-emerald-600'
                  } text-[#0F172A] rounded-xl py-3 px-4 text-sm outline-none placeholder:text-slate-400`}
                />
              </div>

              {/* TASK 2: LIVE SHIFT CAPACITY & MK9 GUARDRAIL METER + INTERACTIVE MAP PREVIEW */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A] block">
                      ⏱️ Live Shift Capacity & MK9 35-Mile Guardrail Meter
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Calculates stem drive + inter-drop transit +{' '}
                      {jobData.requires_assembly || jobData.loop_profile === 'assembly'
                        ? '50 mins/drop (Assembly)'
                        : '20 mins/drop (Standard ROC)'}{' '}
                      against the {shiftMetrics.shiftCapHours.toFixed(1)}-Hour Fair-Use Cap.
                    </span>
                  </div>
                  <div className="text-left sm:text-right tabular-nums">
                    <span
                      className={`text-sm font-extrabold px-3 py-1 rounded-full border ${
                        shiftMetrics.isOverShiftCap
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      Est. Shift: {shiftMetrics.estimatedHours} hrs /{' '}
                      {shiftMetrics.shiftCapHours.toFixed(1)} hrs Cap ({shiftMetrics.shiftUtilizationPct}%)
                    </span>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      shiftMetrics.isOverShiftCap
                        ? 'bg-red-600'
                        : shiftMetrics.shiftUtilizationPct > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${Math.max(6, shiftMetrics.shiftUtilizationPct)}%` }}
                  />
                </div>

                {/* POSTCODE CATCHMENT & OVERFLOW RECOMMENDATION */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg tabular-nums">
                      ✓ {shiftMetrics.inZoneMkDrops} MK1–MK19 Core Drop(s)
                    </span>
                    {shiftMetrics.outOfZoneDrops.length > 0 && (
                      <span className="font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                        ⚠️ Out-of-Zone (&gt;MK19): {shiftMetrics.outOfZoneDrops.join(', ')} (+£2.20/mi beyond 35mi)
                      </span>
                    )}
                  </div>

                  {shiftMetrics.recommendOverflowLoop && (
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, loop_profile: 'overflow' })}
                      className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all tabular-nums"
                    >
                      💡 {dropCount} Drop(s) ≤3.5 hrs — Switch to £145 Overflow Mini-Loop →
                    </button>
                  )}
                </div>

                {/* LIVE ROUTE MAP PREVIEW */}
                {(jobData.pickup_address.trim() || parsedDropList.length > 0) && (
                  <MKRouteVisualizer
                    pickupAddress={
                      jobData.pickup_address || 'Kiln Farm Showroom Depot, Milton Keynes MK11'
                    }
                    drops={parsedDropList}
                    status="Draft Preview"
                    compact
                  />
                )}
              </div>

              {/* FAIR-USE GUARDRAIL DROP-COUNT WARNING */}
              {exceedsFairUseCap && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 space-y-1">
                  <div className="font-extrabold text-sm flex items-center gap-1.5 tabular-nums">
                    ⚠️ Fair-Use Manifest Guardrail Triggered ({dropCount} drops entered vs{' '}
                    {effectiveMaxDrops}-drop cap)
                  </div>
                  <p>
                    The selected profile (<strong>{selectedTier.label}</strong>) is capped at{' '}
                    <strong>{effectiveMaxDrops} drops</strong> (≤9 operational hours, ≤1,200 kg total).
                    Proceeding with {dropCount} drops will flag the{' '}
                    <strong>Dispatch Guardrail Agent</strong> to add an Overflow Mini-Loop (£145 flat) or £50/hr overtime protection.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingJob}
                className="min-h-[52px] w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-md mt-2 tabular-nums text-base"
              >
                {submittingJob
                  ? 'Dispatching Route Array to MK Node...'
                  : `Launch Route Array (£${totalGrossFee.toFixed(2)} Pay-on-Success) →`}
              </button>
            </form>
          )}

          {retailerTab === 'track' && (
            <div className="space-y-4">
              {retailerOwnedJobs.map((j) => {
                const stops = parseManifestDrops(j.drop_addresses)
                return (
                  <div
                    key={String(j.id)}
                    className="p-5 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl flex flex-col gap-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[#0F172A] font-extrabold text-base tabular-nums">
                            Route #{String(j.id)} • {j.pickup_address}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-300">
                            🛡️ Ben Damage-Shield Certificate: Zero Transit Damage Verified
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 block tabular-nums">
                          {stops.length} Drops ({stops.join(' → ')}) • Gross: £
                          {Number(j.gross_fee ?? 440).toFixed(2)} • Crew Pool: £
                          {Number(j.net_pool ?? 385).toFixed(2)}
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {j.requires_tail_lift && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              ⚠️ Tail-Lift Van Required
                            </span>
                          )}
                          {(j.requires_assembly || j.loop_profile === 'assembly') && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                              🔧 Tools & Assembly Required
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {onOpenConsumerTracker && (
                          <button
                            type="button"
                            onClick={() => onOpenConsumerTracker(String(j.id))}
                            className="min-h-[48px] text-xs font-extrabold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                          >
                            📍 Open Live Customer Map & ETA
                          </button>
                        )}
                        <span className="text-xs px-3 py-2 bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] rounded-xl font-extrabold">
                          {j.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {retailerOwnedJobs.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  No routes dispatched yet. Use the Book Loop tab to launch a loop.
                </p>
              )}
            </div>
          )}

          {retailerTab === 'ledger' && (
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-[#E2E8F0] pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-[#0F172A]">
                    Agency Settlement (12.5% Fee / 87.5% Crew Pool)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    Cumulative Ben Commission:
                    <span className="font-extrabold text-emerald-700 ml-2">
                      £
                      {retailerOwnedJobs
                        .filter((j) => j.status === 'Completed' || j.status === 'delivered')
                        .reduce((sum, j) => sum + Number(j.platform_fee ?? 55), 0)
                        .toFixed(2)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={exportLedgerToCSV}
                  className="min-h-[48px] text-xs font-extrabold px-4 py-2 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl text-[#0F172A] transition-all"
                >
                  ⬇ Export CSV
                </button>
              </div>
              <div className="flex flex-col space-y-3">
                {retailerOwnedJobs
                  .filter((j) => j.status === 'Completed' || j.status === 'delivered')
                  .map((job) => (
                    <div
                      key={String(job.id)}
                      className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl"
                    >
                      <div className="space-y-1">
                        <div className="font-extrabold text-sm text-[#0F172A]">
                          Route #{String(job.id)} • {job.pickup_address}
                        </div>
                        <div className="text-[11px] text-emerald-900 font-extrabold bg-emerald-100/80 border border-emerald-300 px-2.5 py-0.5 rounded-md inline-block">
                          🛡️ Ben Damage-Shield Certificate: Zero Transit Damage Verified (Pre-Load Matched to Room-of-Choice POD)
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium tabular-nums">
                          {job.created_at
                            ? new Date(job.created_at).toLocaleDateString()
                            : 'Active Cycle'}{' '}
                          • 48-Hr Escrow SLA Active
                        </div>
                        <div className="flex space-x-3 mt-1.5">
                          <button
                            onClick={() => setRatingJob(job)}
                            className="text-xs font-extrabold text-emerald-700 hover:underline"
                          >
                            ★ Rate Crew
                          </button>
                          <button
                            onClick={() => setDisputeJob(job)}
                            className="text-xs font-extrabold text-red-600 hover:underline"
                          >
                            ⚠ Report Issue
                          </button>
                        </div>
                      </div>
                      <div className="text-left sm:text-right tabular-nums">
                        <div className="font-extrabold text-emerald-700 text-base">
                          +£{Number(job.platform_fee ?? 55).toFixed(2)}
                        </div>
                        <div className="text-[10px] uppercase font-extrabold text-slate-500">
                          Ben Fee (12.5%)
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : mode === 'driver' && !complianceAccepted ? (
        /* GATE A6: STRENGTHENED UK COMPLIANCE GATE IN CREW PORTAL */
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-5">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-red-100 text-red-800 px-2.5 py-1 rounded-full border border-red-200">
              Gate A6 Audit • Version v1.0-pilot-outside-ir35
            </span>
            <h3 className="text-red-800 text-lg font-extrabold mt-2 flex items-center">
              ⚠️ Independent Contractor Agreement & Insurance Verification
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
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              📄 Crew Insurance Certificate Details (Required to Unlock Board)
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
              <span className="text-xs text-slate-600 truncate">
                {certificateFileName
                  ? `📎 Attached: ${certificateFileName}`
                  : 'Or upload GIT / Public Liability Certificate (PDF/JPG):'}
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
                  <h3 className="text-base font-extrabold text-[#0F172A]">
                    🔐 Crew Compliance Locker (Document Vault)
                  </h3>
                  {agreementSignedAt && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Gate A6 Persisted (`v1.0-pilot-outside-ir35`)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Upload your mandatory UK commercial policies to `compliance-docs` for Supply & Compliance Agent verification.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#FFFFFF] px-3 py-1.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] font-bold text-slate-600">Registered Van Asset:</span>
                <button
                  type="button"
                  onClick={() => setCrewHasTailLiftLuton(!crewHasTailLiftLuton)}
                  className={`min-h-[38px] text-[11px] font-extrabold px-3 py-1 rounded-lg transition-all ${
                    crewHasTailLiftLuton
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {crewHasTailLiftLuton
                    ? '✓ 3.5t Luton w/ Tail-Lift'
                    : 'Standard LWB (No Tail-Lift)'}
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
                    className="min-h-[48px] w-full py-2 px-3 rounded-xl border border-[#E2E8F0] hover:border-emerald-500 hover:bg-emerald-50/50 text-[#0F172A] text-xs font-extrabold transition-all"
                  >
                    {cred.status === 'Action Required'
                      ? '📤 Upload Certificate'
                      : '↻ Update Certificate'}
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
                            '🛡️ Ben Damage-Shield Certificate Issued: Route marked Completed & e-Signature verified!'
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
                      <h3 className="text-lg font-extrabold text-[#0F172A] mt-1.5 mb-1 tabular-nums">
                        📍 Active Loop #{String(activeDriverJob.id)}: {activeDriverJob.pickup_address}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          Status: {activeDriverJob.status} • Net Crew Pool: £
                          {Number(activeDriverJob.net_pool ?? 385).toFixed(2)}
                        </span>
                        {activeDriverJob.requires_tail_lift && (
                          <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                            ⚠️ Tail-Lift Van Required
                          </span>
                        )}
                        {(activeDriverJob.requires_assembly ||
                          activeDriverJob.loop_profile === 'assembly') && (
                          <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300">
                            🔧 Tools &amp; Assembly Required
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => setInCabRouteStarted(true)}
                        className="min-h-[48px] text-xs font-extrabold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                      >
                        🚀 Full-Screen In-Cab HUD
                      </button>
                      {onOpenConsumerTracker && (
                        <button
                          type="button"
                          onClick={() => onOpenConsumerTracker(String(activeDriverJob.id))}
                          className="min-h-[48px] text-xs font-extrabold px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white"
                        >
                          📍 View Customer Tracker
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DRIVER-FIRST ROUTING ENGINE (3-MODE SEQUENCING + HOME POSTCODE + 1-TAP INVERT) */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#0F172A] text-white">
                            🧭 Driver-First Routing Engine
                          </span>
                          {syncingRoute && (
                            <span className="text-[10px] font-bold text-emerald-700">
                              ↻ Syncing LIFO Plan...
                            </span>
                          )}
                          {preLoadInspected && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              🔒 Locked by Pre-Load Gate
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
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950 block">
                          🛡️ Step A • Depot Pre-Load &amp; Reverse-Load (LIFO) Bay Sheet
                        </span>
                        <p className="text-xs text-emerald-900 mt-0.5">
                          Load items from Zone A (Bulkhead) to Zone D (Tail-Lift), inspect carton corners, and tap Start Route to launch the mobile In-Cab View.
                        </p>
                      </div>
                      <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-600 text-white self-start sm:self-center">
                        {preLoadInspected ? '✓ Pre-Load & LIFO Locked' : 'Ready to Load'}
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

                      <label className="min-h-[48px] cursor-pointer bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] rounded-xl px-3 py-2 flex items-center justify-between text-xs font-extrabold text-[#0F172A]">
                        <span className="truncate">📷 {preLoadPhotoName}</span>
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
                      className="min-h-[56px] w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl py-3.5 px-5 text-base tracking-wide uppercase shadow-lg shadow-emerald-600/25 transition-all"
                    >
                      🚀 Lock LIFO Load &amp; Start Route (In-Cab HUD) →
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#E2E8F0] pb-2">
                <h3 className="text-lg font-extrabold text-[#0F172A]">
                  Open Freight Board (87.5% Net Crew Pool)
                </h3>
                {!isCrewComplianceVerified && (
                  <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    🔒 Upload & Verify All 3 Unexpired Policies Above to Claim Routes
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
                          <span className="font-extrabold text-[#0F172A] block tabular-nums">
                            Route #{String(j.id)} • {j.pickup_address}
                          </span>
                          <span className="text-xs font-extrabold text-emerald-700 block tabular-nums">
                            2-Man Crew Net Pool (87.5%): £{Number(j.net_pool ?? 385).toFixed(2)} •{' '}
                            {stops.length} Drops
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {j.requires_tail_lift && (
                              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                ⚠️ Tail-Lift Van Required
                              </span>
                            )}
                            {(j.requires_assembly || j.loop_profile === 'assembly') && (
                              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300">
                                🔧 Tools & Assembly Required
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <button
                            disabled={claimBlocked}
                            onClick={() => handleClaimRoute(String(j.id))}
                            className={`min-h-[48px] text-xs font-extrabold py-2.5 px-5 rounded-xl transition-all shadow-sm ${
                              claimBlocked
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {tailLiftRestricted
                              ? '🔒 Requires 3.5t Tail-Lift Asset'
                              : !isCrewComplianceVerified
                              ? '🔒 Insurance Verification Required'
                              : 'Claim Route'}
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
              Ben Logistics Node • Outside IR35 Independent Contractor Status Active
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
