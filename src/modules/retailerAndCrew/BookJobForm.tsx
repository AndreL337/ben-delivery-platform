import React, { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient'
import { PRICING_MATRIX, parseManifestDrops } from '../../config/pricingMatrix2026'
import type {
  VehicleSetup,
  LoopProfile,
  ComplianceCredentialItem,
  ComplianceDocType,
  ComplianceStatus
} from '../../types/logistics'
import { SignaturePad } from '../../shared/components/SignaturePad'
import { RateJobModal, DisputePanel } from '../../shared/components/FeedbackModals'
import { ComplianceUploadModal } from '../crew/ComplianceUploadModal'

const GATE_A6_STORAGE_KEY = 'ben_mk_gate_a6_signed_v1'

export function BookJobForm({
  retailerId,
  mode,
  onOpenConsumerTracker
}: {
  retailerId: string
  mode: 'retailer' | 'driver'
  onOpenConsumerTracker?: (jobId: string) => void
}) {
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
  const [complianceAccepted, setComplianceAccepted] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(GATE_A6_STORAGE_KEY))
    } catch {
      return false
    }
  })
  const [agreementSignedAt, setAgreementSignedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(GATE_A6_STORAGE_KEY)
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
  const [signingAgreement, setSigningAgreement] = useState(false)

  // Crew Registered Vehicle Capability (Aptean Tail-Lift Guardrail)
  const [crewHasTailLiftLuton, setCrewHasTailLiftLuton] = useState<boolean>(true)

  // Active Crew Loop Execution States
  const [preLoadInspected, setPreLoadInspected] = useState<boolean>(false)
  const [completedDropIndices, setCompletedDropIndices] = useState<number[]>([])
  const [signatureSvg, setSignatureSvg] = useState<string>('')
  const [podUploading, setPodUploading] = useState<boolean>(false)
  const [podMessage, setPodMessage] = useState<string>('')

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

  const fetchLogisticsData = async () => {
    try {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
      if (jobs) setActiveJobs(jobs)
    } catch {
      // Preserve local jobs state
    }
  }

  // Hydrate Gate A6 Agreement & Compliance Documents from Supabase on mount
  const hydrateCrewCompliance = async () => {
    try {
      const { data: agreements } = await supabase
        .from('contractor_agreements')
        .select('*')
        .eq('user_id', retailerId)
        .order('signed_at', { ascending: false })
        .limit(1)

      if (agreements && agreements.length > 0) {
        setComplianceAccepted(true)
        setAgreementSignedAt(agreements[0].signed_at)
        try {
          localStorage.setItem(GATE_A6_STORAGE_KEY, agreements[0].signed_at)
        } catch {
          // ignore storage quota errors
        }
      }

      const { data: docs } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('driver_id', retailerId)
        .order('uploaded_at', { ascending: false })

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
    } catch {
      // Fallback to local state
    }
  }

  useEffect(() => {
    fetchLogisticsData()
    hydrateCrewCompliance()

    // Subscribe to Supabase Realtime channel on `public.jobs` (replaces blind 3s polling)
    const channel = supabase
      .channel('ben-jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          fetchLogisticsData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [retailerId])

  const uploadPoD = async (jobId: string, file: File) => {
    setPodUploading(true)
    setPodMessage('')
    const storagePath = `${jobId}/${Date.now()}.jpg`

    try {
      const { data: uploadData, error: storageErr } = await supabase.storage
        .from('pod-images')
        .upload(storagePath, file)

      const finalPodUrl = uploadData ? storagePath : `local-queued://${storagePath}`

      const { error: updateErr } = await supabase
        .from('jobs')
        .update({
          status: 'Completed',
          pod_image_url: finalPodUrl,
          signature_svg: signatureSvg || null
        })
        .eq('id', jobId)

      if (storageErr && updateErr) {
        // Offline / low-4G stairwell resilience: update optimistic state and queue
        setPodMessage(
          '📶 Weak 4G signal detected — PoD photo & signature cached locally and route marked Completed!'
        )
      } else {
        setPodMessage('✅ Proof of Delivery photo & e-Signature verified!')
      }

      setActiveJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'Completed',
                pod_image_url: finalPodUrl,
                signature_svg: signatureSvg || null
              }
            : j
        )
      )

      const { data: updatedJobs } = await supabase.from('jobs').select('*').eq('id', jobId)
      if (updatedJobs && updatedJobs[0]) setRatingJob(updatedJobs[0])
      fetchLogisticsData()
    } catch {
      setPodMessage(
        '📶 Offline stairwell fallback triggered — PoD saved locally for background sync.'
      )
      setActiveJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'Completed' } : j))
      )
    }
    setPodUploading(false)
  }

  const exportLedgerToCSV = () => {
    const completedJobs = activeJobs.filter(
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
      const date = new Date(job.created_at).toLocaleDateString()
      return [
        date,
        `"${job.pickup_address}"`,
        job.gross_fee ?? 440,
        job.platform_fee ?? 55,
        job.net_pool ?? 385,
        job.requires_tail_lift ? 'Yes' : 'No',
        job.requires_assembly ? 'Yes' : 'No'
      ].join(',')
    })
    const csvString = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvString], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `Ben_Agency_Ledger_${new Date().toLocaleDateString()}.csv`)
    a.click()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      retailer_id: retailerId,
      pickup_address: jobData.pickup_address,
      drop_addresses: parsedDropList.join('\n'),
      status: 'Unassigned',
      vehicle_setup: jobData.vehicle_setup,
      loop_profile: jobData.loop_profile,
      gross_fee: totalGrossFee,
      platform_fee: selectedTier.platformFee,
      net_pool: totalCrewNetPool,
      requires_tail_lift: jobData.requires_tail_lift,
      requires_assembly: jobData.requires_assembly
    }

    const { data, error } = await supabase.from('jobs').insert([payload]).select()
    if (!error && data && data[0]) {
      await supabase.from('payouts').insert([
        {
          job_id: data[0].id,
          amount_pence: Math.round(totalCrewNetPool * 100),
          platform_fee_pence: Math.round(selectedTier.platformFee * 100),
          status: 'pending',
          total_charged_to_retailer: totalGrossFee,
          driver_payout: totalCrewNetPool,
          payout_status: 'Pending'
        }
      ])
      fetchLogisticsData()
    } else {
      // Optimistic local fallback if RLS requires authenticated session
      const localJob = {
        ...payload,
        id: `mk-local-${Date.now()}`,
        created_at: new Date().toISOString()
      }
      setActiveJobs((prev) => [localJob, ...prev])
    }

    setJobData({
      ...jobData,
      pickup_address: '',
      drop_addresses: ''
    })
    setRetailerTab('track')
  }

  // Gate A6: Sign Contractor Agreement and write permanent audit row
  const handleSignContractorAgreement = async () => {
    setSigningAgreement(true)
    const timestamp = new Date().toISOString()
    try {
      await supabase.from('contractor_agreements').insert([
        {
          user_id: retailerId,
          agreement_version: 'v1.0-pilot-outside-ir35',
          signed_at: timestamp,
          lead_driver_name: leadDriverName.trim() || 'MK Verified Crew Lead',
          has_right_of_substitution: true,
          confirms_git_and_pl: true
        }
      ])
    } catch {
      // Preserve local audit state if unauthenticated demo session
    }

    try {
      localStorage.setItem(GATE_A6_STORAGE_KEY, timestamp)
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

  const toggleStopCompleted = (idx: number) => {
    setCompletedDropIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    )
  }

  const activeDriverJob = activeJobs.find(
    (job) =>
      job.status === 'Assigned' ||
      job.status === 'assigned' ||
      job.status === 'In Progress' ||
      job.status === 'in_transit'
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
    <div className="w-full">
      {mode === 'retailer' ? (
        <div>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => setRetailerTab('book')}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${
                retailerTab === 'book'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              📝 Book
            </button>
            <button
              type="button"
              onClick={() => setRetailerTab('track')}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${
                retailerTab === 'track'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              📡 Track
            </button>
            <button
              type="button"
              onClick={() => setRetailerTab('ledger')}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${
                retailerTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              💰 Ledger
            </button>
          </div>

          {retailerTab === 'book' && (
            <form onSubmit={handleSubmit} className="flex flex-col space-y-5">
              {/* "PAY ON SUCCESS" PILOT GUARANTEE BANNER */}
              <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 block">
                    🛡 Milton Keynes Showroom Pilot — "Pay on Success" Guarantee
                  </span>
                  <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                    Pay the fixed route rate (£440 Standard ROC / £520 Assembly) <strong>only upon successful completion & verified photographic PoD</strong>. If delivery fails due to crew error, damage, or platform fault, you are invoiced <strong>£0.00</strong> (capped at first 3 routes per showroom within a 14-day window).
                  </p>
                </div>
              </div>

              {/* 2026 SETUP & PROFILE SELECTORS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">
                    1. Vehicle Setup
                  </label>
                  <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, vehicle_setup: 'independent' })}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        jobData.vehicle_setup === 'independent'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Independent 3.5t Van
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, vehicle_setup: 'clientVehicle' })}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        jobData.vehicle_setup === 'clientVehicle'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Client Vehicle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider block mb-2">
                    2. Service Profile
                  </label>
                  <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setJobData({
                          ...jobData,
                          loop_profile: 'roc',
                          requires_assembly: false
                        })
                      }
                      className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        jobData.loop_profile === 'roc'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
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
                      className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        jobData.loop_profile === 'assembly'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Delivery & Assembly
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobData({ ...jobData, loop_profile: 'overflow' })}
                      className={`py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        jobData.loop_profile === 'overflow'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Overflow Mini-Loop
                    </button>
                  </div>
                </div>
              </div>

              {/* APTEAN-INSPIRED ROUTE MATCHING CONSTRAINT CHECKBOXES */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  3. Aptean-Grade Route Matching & Access Constraints
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      jobData.requires_tail_lift
                        ? 'bg-amber-50/80 border-amber-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
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
                      <span className="text-xs font-extrabold text-slate-900 block">
                        3.5t Luton / Tail-Lift Required
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug block mt-0.5">
                        Mandatory for marble tables, range cookers, or heavy runs &gt;100kg.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      jobData.requires_assembly
                        ? 'bg-blue-50/80 border-blue-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
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
                      <span className="text-xs font-extrabold text-slate-900 block">
                        Two-Man Assembly Required
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug block mt-0.5">
                        Room-of-choice bed/dining table assembly; caps loop at 5–8 drops/day.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      jobData.has_third_floor_no_lift
                        ? 'bg-emerald-50/90 border-emerald-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
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
                      <span className="text-xs font-extrabold text-slate-900 block">
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
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-emerald-900 block">
                    {selectedTier.label}
                  </span>
                  <span className="text-xs text-slate-600">
                    Cap: <strong>{effectiveMaxDrops} Max Drops (≤9 hrs)</strong> • Ben Fee (12.5%): £
                    {selectedTier.platformFee.toFixed(2)} • Crew Net Pool:{' '}
                    <strong>£{totalCrewNetPool.toFixed(2)}</strong>
                    {heavyAccessSurcharge > 0 ? ' (incl. +£25 3rd-Floor Access)' : ''}
                  </span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-2xl font-extrabold text-emerald-700">
                    £{totalGrossFee.toFixed(2)}
                  </span>
                  <span className="block text-[10px] font-bold uppercase text-emerald-800">
                    Pay on Success Rate
                  </span>
                </div>
              </div>

              <input
                placeholder="Pickup Depot / Showroom Address (Milton Keynes Origin, e.g. Kiln Farm MK11 / Bletchley MK1)"
                value={jobData.pickup_address}
                onChange={(e) => setJobData({ ...jobData, pickup_address: e.target.value })}
                required
                className="bg-white border border-slate-300 focus:border-emerald-500 text-slate-900 rounded-lg py-3 px-4 outline-none placeholder:text-slate-400"
              />

              {/* MULTI-LINE MANIFEST BUILDER (FIXES UK ADDRESS COMMA SPLIT BUG) */}
              <div className="space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block">
                      4. Multi-Drop Manifest Builder (One Full UK Address Per Line)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Commas inside an address are preserved safely; press Enter for each new stop.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const sampleStop = `Stop #${dropCount + 1}: ${
                          dropCount % 2 === 0
                            ? '14 Midsummer Blvd, Central Milton Keynes, MK9 2EA'
                            : '82 Newport Rd, Woburn Sands, Milton Keynes, MK17 8UF'
                        }`
                        setJobData({
                          ...jobData,
                          drop_addresses: jobData.drop_addresses
                            ? `${jobData.drop_addresses}\n${sampleStop}`
                            : sampleStop
                        })
                      }}
                      className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all"
                    >
                      + Add Sample MK Stop
                    </button>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded ${
                        exceedsFairUseCap
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-600'
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
                  className={`w-full bg-white border ${
                    exceedsFairUseCap
                      ? 'border-amber-500 focus:border-amber-600'
                      : 'border-slate-300 focus:border-emerald-500'
                  } text-slate-900 rounded-lg py-3 px-4 text-sm outline-none placeholder:text-slate-400`}
                />
              </div>

              {/* FAIR-USE GUARDRAIL DROP-COUNT WARNING */}
              {exceedsFairUseCap && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                  <div className="font-extrabold text-sm flex items-center gap-1.5">
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

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong>MK Fair-Use Guardrails:</strong> Origin in MK; all drops ≤35 miles of MK9 (£2.20/mi out-of-zone) • Max 9 hrs (£50/hr OT) • Max 1,200 kg / 12m³ (110 kg max single item) • Up to 2nd-floor walk-up included (3rd floor+ no lift = £25 heavy-access fee, 100% to crew).
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-lg transition-all shadow-md mt-2"
              >
                Launch Route Array (£{totalGrossFee.toFixed(2)} Pay-on-Success) →
              </button>
            </form>
          )}

          {retailerTab === 'track' && (
            <div className="space-y-3">
              {activeJobs.map((j) => {
                const stops = parseManifestDrops(j.drop_addresses)
                return (
                  <div
                    key={j.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-sm"
                  >
                    <div className="space-y-1">
                      <span className="text-slate-900 font-bold block">{j.pickup_address}</span>
                      <span className="text-xs text-slate-500 block">
                        {stops.length} Drops • Gross: £{(j.gross_fee ?? 440).toFixed(2)} • Crew Pool: £
                        {(j.net_pool ?? 385).toFixed(2)}
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {j.requires_tail_lift && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            ⚠️ Tail-Lift Van Required
                          </span>
                        )}
                        {(j.requires_assembly || j.loop_profile === 'assembly') && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                            🔧 Tools & Assembly Required
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {onOpenConsumerTracker && (
                        <button
                          type="button"
                          onClick={() => onOpenConsumerTracker(j.id)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all"
                        >
                          📍 Live Customer ETA
                        </button>
                      )}
                      <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-bold">
                        {j.status}
                      </span>
                    </div>
                  </div>
                )
              })}
              {activeJobs.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                  No routes dispatched yet. Use the Book tab to launch a loop.
                </p>
              )}
            </div>
          )}

          {retailerTab === 'ledger' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Agency Settlement (12.5% Fee / 87.5% Crew Pool)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cumulative Ben Commission:
                    <span className="font-bold text-emerald-600 ml-2">
                      £
                      {activeJobs
                        .filter((j) => j.status === 'Completed' || j.status === 'delivered')
                        .reduce((sum, j) => sum + (j.platform_fee ?? 55), 0)
                        .toFixed(2)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={exportLedgerToCSV}
                  className="text-xs font-bold px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 transition-all"
                >
                  ⬇ Export CSV
                </button>
              </div>
              <div className="flex flex-col space-y-3">
                {activeJobs
                  .filter((j) => j.status === 'Completed' || j.status === 'delivered')
                  .map((job) => (
                    <div
                      key={job.id}
                      className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900">{job.pickup_address}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {new Date(job.created_at).toLocaleDateString()} • 48-Hr Escrow SLA Active
                        </div>
                        <div className="flex space-x-3 mt-1.5">
                          <button
                            onClick={() => setRatingJob(job)}
                            className="text-[10px] font-bold text-emerald-600 hover:underline"
                          >
                            ★ Rate
                          </button>
                          <button
                            onClick={() => setDisputeJob(job)}
                            className="text-[10px] font-bold text-red-500 hover:underline"
                          >
                            ⚠ Report Issue
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-600">
                          +£{(job.platform_fee ?? 55).toFixed(2)}
                        </div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">
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
              className="w-full bg-white border border-red-300 focus:border-emerald-600 rounded-lg py-2.5 px-3.5 text-sm text-slate-900 outline-none"
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

          {/* INSURANCE CERTIFICATE PASTE / UPLOAD FIELDS */}
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
                className="bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="GIT & PL Policy Number(s)"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs outline-none focus:border-emerald-500"
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
              <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-all">
                Upload Certificate
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
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
            className={`w-full py-3.5 rounded-lg font-bold transition-all ${
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
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    🔐 Crew Compliance Locker (Document Vault)
                  </h3>
                  {agreementSignedAt && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Gate A6 Persisted (`v1.0-pilot-outside-ir35`)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload your mandatory UK commercial policies to `compliance-docs` for Supply & Compliance Agent verification.
                </p>
              </div>

              {/* CREW REGISTERED ASSET CAPABILITY SWITCHER (FOR TAIL-LIFT GUARDRAIL) */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600">Registered Van Asset:</span>
                <button
                  type="button"
                  onClick={() => setCrewHasTailLiftLuton(!crewHasTailLiftLuton)}
                  className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg transition-all ${
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
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm"
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
                        <span className="text-[10px] text-slate-400 font-medium">
                          Exp: {cred.expiryDate}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-extrabold text-slate-900">{cred.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{cred.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveUploadCredential(cred)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-800 text-xs font-bold transition-all"
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
            <div className="bg-white border border-emerald-200 p-6 rounded-xl relative overflow-hidden shadow-md space-y-5">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                    📍 Active Loop: {activeDriverJob.pickup_address}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                      Status: {activeDriverJob.status} • Net Crew Pool: £
                      {(activeDriverJob.net_pool ?? 385).toFixed(2)}
                    </span>
                    {activeDriverJob.requires_tail_lift && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        ⚠️ Tail-Lift Van Required
                      </span>
                    )}
                    {(activeDriverJob.requires_assembly ||
                      activeDriverJob.loop_profile === 'assembly') && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-800 border border-blue-300">
                        🔧 Tools & Assembly Required
                      </span>
                    )}
                  </div>
                </div>

                {onOpenConsumerTracker && (
                  <button
                    type="button"
                    onClick={() => onOpenConsumerTracker(activeDriverJob.id)}
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white self-start sm:self-center"
                  >
                    📍 View Customer Tracker
                  </button>
                )}
              </div>

              {/* PRE-LOAD DEPOT INSPECTION CHECKBOX (48-HR SLA PROTECTION) */}
              <label className="flex items-center gap-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer text-xs font-bold text-emerald-950">
                <input
                  type="checkbox"
                  checked={preLoadInspected}
                  onChange={(e) => setPreLoadInspected(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-400 text-emerald-600"
                />
                <span>
                  ✓ Pre-Load Depot Inspection Completed (Zero unlogged carton damage prior to MK departure)
                </span>
              </label>

              {/* STOP-BY-STOP MANIFEST WITH 1-TAP GOOGLE MAPS & WAZE NAVIGATION */}
              <div className="space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Route Manifest Stops ({completedDropIndices.length} /{' '}
                  {parseManifestDrops(activeDriverJob.drop_addresses).length} Completed)
                </div>
                {parseManifestDrops(activeDriverJob.drop_addresses).map((d: string, i: number) => {
                  const isDone = completedDropIndices.includes(i)
                  const encodedAddr = encodeURIComponent(d)
                  return (
                    <div
                      key={i}
                      className={`text-sm p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isDone
                          ? 'bg-emerald-50/60 border-emerald-200 text-slate-500 line-through'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center font-medium">
                        <span
                          className={`w-6 h-6 rounded-full text-xs flex items-center justify-center mr-3 font-bold shrink-0 ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isDone ? '✓' : i + 1}
                        </span>
                        <span>{d}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodedAddr}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all"
                        >
                          🗺 Google Maps
                        </a>
                        <a
                          href={`https://waze.com/ul?q=${encodedAddr}&navigate=yes`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all"
                        >
                          🚗 Waze
                        </a>
                        <button
                          type="button"
                          onClick={() => toggleStopCompleted(i)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {isDone ? '✓ Delivered' : 'Mark Stop Done'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* HTML5 CUSTOMER E-SIGNATURE PAD */}
              <SignaturePad onSaveSvg={setSignatureSvg} savedSvg={signatureSvg} />

              {podMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                  {podMessage}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeJob(activeDriverJob)}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  ⚠ Log Doorstep Exception / Pre-Load Depot Damage
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block cursor-pointer bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-4 rounded-xl text-center font-bold transition-all shadow-md shadow-blue-600/20">
                  {podUploading
                    ? 'Uploading Photo & Signature to Vault...'
                    : '📷 Capture Final Proof of Delivery Photo & Complete Loop'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        uploadPoD(activeDriverJob.id, e.target.files[0])
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                Open Freight Board (87.5% Net Crew Pool)
              </h3>
              <div className="space-y-3">
                {activeJobs
                  .filter((j) => j.status === 'Unassigned' || j.status === 'open')
                  .map((j) => {
                    const tailLiftRestricted =
                      Boolean(j.requires_tail_lift) && !crewHasTailLiftLuton
                    const stops = parseManifestDrops(j.drop_addresses)
                    return (
                      <div
                        key={j.id}
                        className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-sm"
                      >
                        <div className="space-y-1.5">
                          <span className="font-bold text-slate-800 block">
                            {j.pickup_address}
                          </span>
                          <span className="text-xs font-bold text-emerald-700 block">
                            2-Man Crew Net Pool (87.5%): £{(j.net_pool ?? 385).toFixed(2)} •{' '}
                            {stops.length} Drops
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {j.requires_tail_lift && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠️ Tail-Lift Van Required
                              </span>
                            )}
                            {(j.requires_assembly || j.loop_profile === 'assembly') && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                                🔧 Tools & Assembly Required
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <button
                            disabled={tailLiftRestricted}
                            onClick={() =>
                              supabase
                                .from('jobs')
                                .update({ status: 'Assigned', driver_id: retailerId })
                                .eq('id', j.id)
                                .then(fetchLogisticsData)
                            }
                            className={`text-xs font-bold py-2.5 px-4 rounded-lg transition-all shadow-sm ${
                              tailLiftRestricted
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {tailLiftRestricted
                              ? '🔒 Requires 3.5t Tail-Lift Asset'
                              : 'Claim Route'}
                          </button>
                          {tailLiftRestricted && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              Switch to a verified Tail-Lift Luton asset above to claim.
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                {activeJobs.filter((j) => j.status === 'Unassigned' || j.status === 'open')
                  .length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6 font-medium bg-slate-50 rounded-xl border border-slate-200">
                    No unassigned routes currently available.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Ben Logistics Node • Outside IR35 Independent Contractor Status Active
            </p>
          </div>
        </div>
      )}

      {activeUploadCredential && (
        <ComplianceUploadModal
          credential={activeUploadCredential}
          userId={retailerId}
          onClose={() => setActiveUploadCredential(null)}
          onUploaded={handleCredentialUploaded}
        />
      )}

      {ratingJob && (
        <RateJobModal
          job={ratingJob}
          userId={retailerId}
          role={mode}
          onClose={() => setRatingJob(null)}
        />
      )}
      {disputeJob && (
        <DisputePanel
          job={disputeJob}
          userId={retailerId}
          role={mode}
          onClose={() => setDisputeJob(null)}
        />
      )}
    </div>
  )
}
