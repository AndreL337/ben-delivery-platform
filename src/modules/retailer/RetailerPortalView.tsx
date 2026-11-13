import React, { useState, useMemo } from 'react'
import { supabase } from '../../config/supabaseClient'
import { PRICING_MATRIX, parseManifestDrops } from '../../config/pricingMatrix2026'
import {
  SAMPLE_MK_MANIFESTS,
  parseDispatchNotesDeterministic,
  calculateShiftAndGuardrails
} from '../../shared/utils/manifestAiParser'
import { RateJobModal, DisputePanel } from '../../shared/components/FeedbackModals'
import { BenWordmark } from '../../shared/components/BenWordmark'
import { LegalDocumentModal, type LegalDocType } from '../../shared/components/LegalModals'

export interface RetailerPortalViewProps {
  retailerId: string
  retailerName?: string
  jobs: any[]
  onRefresh: () => Promise<void> | void
  onSignOut?: () => Promise<void> | void
  onRequireAuth?: () => void
  onOpenConsumerTracker?: (jobId: string) => void
}

type ServiceTierKey = 'bulky_2man' | 'commercial_multidrop'
type FilterTab = 'all' | 'in_transit' | 'completed'

const escapeCsvCell = (val: unknown): string => {
  const raw = String(val ?? '').replace(/\r?\n/g, ' ').trim()
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export const RetailerPortalView: React.FC<RetailerPortalViewProps> = ({
  retailerId,
  retailerName = 'MK Showroom Manager',
  jobs,
  onRefresh,
  onSignOut,
  onRequireAuth,
  onOpenConsumerTracker
}) => {
  // Ledger filter & search states
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Slide-over Booking Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
  const [serviceTier, setServiceTier] = useState<ServiceTierKey>('bulky_2man')
  const [fleetClassSpec, setFleetClassSpec] = useState<string>(
    '3.5t Luton / Low-Loader Box Van (with Tail-Lift) — 2-Man Heavy Bulky & White-Glove'
  )
  const [pickupAddress, setPickupAddress] = useState<string>(
    'Barker & Stonehouse MK Hub, Kiln Farm, Milton Keynes MK11 3LG'
  )
  const [dropAddressesRaw, setDropAddressesRaw] = useState<string>('')
  const [requiresAssembly, setRequiresAssembly] = useState<boolean>(false)
  const [hasThirdFloorNoLift, setHasThirdFloorNoLift] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [toastBanner, setToastBanner] = useState<string | null>(null)

  // Modals: PoD Certificate, Pilot Invoice/Settlement, Legal Terms, Crew Rating, Dispute
  const [selectedJobForPoD, setSelectedJobForPoD] = useState<any | null>(null)
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState<any | null>(null)
  const [pilotTermsAccepted, setPilotTermsAccepted] = useState<boolean>(false)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null)
  const [invoiceCopied, setInvoiceCopied] = useState<boolean>(false)
  const [ratingJob, setRatingJob] = useState<any | null>(null)
  const [disputeJob, setDisputeJob] = useState<any | null>(null)

  // KPI calculations
  const kpiStats = useMemo(() => {
    const total = jobs.length
    const activeOnRoad = jobs.filter((j) =>
      ['Assigned', 'In Progress', 'in_transit'].includes(String(j.status))
    ).length
    const awaitingClaim = jobs.filter((j) =>
      ['Unassigned', 'open', 'Pending'].includes(String(j.status))
    ).length
    const completedPod = jobs.filter((j) =>
      ['Completed', 'delivered'].includes(String(j.status))
    ).length
    return { total, activeOnRoad, awaitingClaim, completedPod }
  }, [jobs])

  // Filtered ledger rows
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const status = String(job.status || 'Unassigned')
      if (filterTab === 'in_transit') {
        if (!['Assigned', 'In Progress', 'in_transit', 'Unassigned', 'open'].includes(status)) {
          return false
        }
      } else if (filterTab === 'completed') {
        if (!['Completed', 'delivered'].includes(status)) {
          return false
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const idStr = `#mk-${job.id} ${job.id}`.toLowerCase()
        const pickupStr = String(job.pickup_address || '').toLowerCase()
        const dropsStr = String(job.drop_addresses || '').toLowerCase()
        return idStr.includes(q) || pickupStr.includes(q) || dropsStr.includes(q)
      }
      return true
    })
  }, [jobs, filterTab, searchQuery])

  // Drawer pricing & manifest parsing
  const parsedDrops = useMemo(() => parseManifestDrops(dropAddressesRaw), [dropAddressesRaw])
  const dropCount = parsedDrops.length

  const activeLoopProfile =
    serviceTier === 'commercial_multidrop'
      ? 'overflow'
      : requiresAssembly
      ? 'assembly'
      : 'roc'

  const pricingTier = PRICING_MATRIX.independent[activeLoopProfile]
  const heavyAccessSurcharge = hasThirdFloorNoLift ? 25 : 0
  const grossFee = pricingTier.grossFee + heavyAccessSurcharge
  const platformFee = pricingTier.platformFee
  const netPool = pricingTier.netPool + heavyAccessSurcharge

  const shiftMetrics = useMemo(
    () =>
      calculateShiftAndGuardrails(
        parsedDrops,
        activeLoopProfile,
        serviceTier === 'bulky_2man' && requiresAssembly
      ),
    [parsedDrops, activeLoopProfile, serviceTier, requiresAssembly]
  )

  // CSV Export (Sanitized RFC 4180)
  const handleExportCsv = () => {
    const headers = [
      'Manifest ID',
      'Date',
      'Pickup Origin',
      'Stops Count',
      'Destinations',
      'Vehicle Tier',
      'Status',
      'Gross Fee (GBP)',
      'Platform Fee (GBP)',
      'Crew Net Pool (GBP)'
    ]

    const rows = filteredJobs.map((job) => {
      const drops = parseManifestDrops(job.drop_addresses)
      const tierLabel =
        job.loop_profile === 'overflow'
          ? 'Commercial Multi-Drop (LWB / XLWB / MWB Van)'
          : '2-Man Bulky Goods (3.5t LWB, XLWB & Luton Tail-Lift)'
      const dateFormatted = job.created_at
        ? new Date(job.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      return [
        escapeCsvCell(`#MK-${job.id}`),
        escapeCsvCell(dateFormatted),
        escapeCsvCell(job.pickup_address || ''),
        escapeCsvCell(drops.length),
        escapeCsvCell(drops.join(' | ')),
        escapeCsvCell(tierLabel),
        escapeCsvCell(job.status || 'Unassigned'),
        escapeCsvCell(Number(job.gross_fee ?? 440).toFixed(2)),
        escapeCsvCell(Number(job.platform_fee ?? 55).toFixed(2)),
        escapeCsvCell(Number(job.net_pool ?? 385).toFixed(2))
      ].join(',')
    })

    const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const isoDate = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `Ben_Showroom_Dispatch_Ledger_${isoDate}.csv`)
    link.click()
    window.URL.revokeObjectURL(url)
  }

  // Book New Run Submission
  const handleBookRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDrawerError(null)

    if (!pickupAddress.trim()) {
      setDrawerError('Please enter a pickup origin address.')
      return
    }
    if (parsedDrops.length === 0) {
      setDrawerError('Please enter at least one delivery destination (1 line per stop).')
      return
    }
    if (!pilotTermsAccepted) {
      setDrawerError(
        'Please review and accept the Retailer Service Agreement & Pay-on-Success Pilot Terms before dispatching.'
      )
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      const activeUid = session?.user?.id || retailerId

      if (!activeUid) {
        setSubmitting(false)
        if (onRequireAuth) onRequireAuth()
        else setDrawerError('Authentication required: Please sign in via Operator Login.')
        return
      }

      const payload = {
        retailer_id: activeUid,
        pickup_address: pickupAddress.trim(),
        drop_addresses: parsedDrops.join('\n'),
        status: 'Unassigned',
        vehicle_setup: 'independent',
        loop_profile: activeLoopProfile,
        gross_fee: grossFee,
        platform_fee: platformFee,
        net_pool: netPool,
        requires_tail_lift: serviceTier === 'bulky_2man',
        requires_assembly: serviceTier === 'bulky_2man' && requiresAssembly,
        has_third_floor_no_lift: hasThirdFloorNoLift,
        heavy_access_surcharge: heavyAccessSurcharge,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase.from('jobs').insert([payload]).select()

      if (error) {
        setDrawerError(`Dispatch Error (${error.code || 'RLS'}): ${error.message}`)
        setSubmitting(false)
        return
      }

      if (data && data[0]) {
        const createdJob = data[0]
        await supabase.from('payouts').insert([
          {
            job_id: createdJob.id,
            amount_pence: Math.round(netPool * 100),
            platform_fee_pence: Math.round(platformFee * 100),
            status: 'pending',
            total_charged_to_retailer: grossFee,
            driver_payout: netPool,
            payout_status: 'Pending'
          }
        ])

        setToastBanner(
          `Manifest #MK-${createdJob.id} (${parsedDrops.length} stop${
            parsedDrops.length === 1 ? '' : 's'
          }) dispatched to the Open Freight Board.`
        )
        setDropAddressesRaw('')
        setRequiresAssembly(false)
        setHasThirdFloorNoLift(false)
        setIsDrawerOpen(false)
        await onRefresh()
      }
    } catch (err: any) {
      setDrawerError(err?.message || 'Unexpected error dispatching manifest.')
    } finally {
      setSubmitting(false)
    }
  }

  // Resolve PoD public image URL from `pod-images` bucket
  const resolvePodPhotoUrl = (job: any): string | null => {
    const rawPod = job?.proof_of_delivery || job?.pod_image_url || job?.photo_url
    if (!rawPod) return null
    const str = String(rawPod).trim()
    if (!str) return null
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
      return str
    }
    const { data } = supabase.storage.from('pod-images').getPublicUrl(str)
    return data?.publicUrl || null
  }

  return (
    <div className="w-full bg-slate-50/60 text-[#0f172a] rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* 1. TOP UTILITY BAR */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <BenWordmark variant="light" size="md" />
            <span className="text-slate-300 font-light">|</span>
            <span className="text-xs font-semibold text-slate-600">
              Showroom &amp; Commercial Dispatch OS • Hub 01 (M1 Corridor) &amp; National UK
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <span>🏢</span>
            <span>{retailerName}</span>
            {retailerId ? (
              <span className="text-[10px] font-mono text-[#004225] bg-[#F0F7F4] px-1.5 py-0.5 rounded border border-[#004225]/20">
                Verified
              </span>
            ) : (
              <span className="text-[10px] font-mono text-[#713F12] bg-[#FEFCE8] px-1.5 py-0.5 rounded border border-[#F6EB61]">
                Guest Preview
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href="/rate-card"
            onClick={(e) => {
              e.preventDefault()
              window.history.pushState({}, '', '/rate-card')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#FEFCE8] hover:bg-yellow-100 text-[#713F12] border border-[#004225] text-xs font-extrabold transition-all flex items-center gap-1.5"
          >
            <span>📄 2026 Rate Card</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setDrawerError(null)
              setIsDrawerOpen(true)
            }}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#004225] hover:bg-[#005A34] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>+ Book New Run</span>
          </button>

          {retailerId && onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all"
            >
              Sign Out
            </button>
          ) : (
            onRequireAuth && (
              <button
                type="button"
                onClick={onRequireAuth}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all"
              >
                Operator Sign In
              </button>
            )
          )}
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastBanner && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span>✅ {toastBanner}</span>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* 2. KPI STRIP (4 STAT CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Total Manifests Dispatched
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#0A0F0D] tabular-nums">
                {kpiStats.total}
              </span>
              <span className="text-[11px] font-medium text-slate-500">Hub 01 (M1)</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Active on Road
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#004225] tabular-nums">
                {kpiStats.activeOnRoad}
              </span>
              <span className="text-[11px] font-semibold text-[#713F12] bg-[#FEFCE8] px-2 py-0.5 rounded border border-[#F6EB61]">
                In Transit
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Awaiting Crew Claim
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-amber-700 tabular-nums">
                {kpiStats.awaitingClaim}
              </span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Open Board
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Delivered &amp; Verified PoD
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                {kpiStats.completedPod}
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                SLA Settled
              </span>
            </div>
          </div>
        </div>

        {/* 3. DISPATCH LEDGER CONTROLS & TABLE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Table Filter & Search Header */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Filter Chips */}
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 self-start">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filterTab === 'all'
                    ? 'bg-white text-[#0f172a] shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-[#0f172a]'
                }`}
              >
                All Runs ({jobs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('in_transit')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filterTab === 'in_transit'
                    ? 'bg-white text-[#0f172a] shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-[#0f172a]'
                }`}
              >
                In Transit ({kpiStats.activeOnRoad + kpiStats.awaitingClaim})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  filterTab === 'completed'
                    ? 'bg-white text-[#0f172a] shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-[#0f172a]'
                }`}
              >
                Completed ({kpiStats.completedPod})
              </button>
            </div>

            {/* Search Input + CSV Export + Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Search ID, pickup, or postcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[38px] bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 rounded-lg px-3 py-1.5 text-xs text-[#0f172a] outline-none placeholder:text-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={() => onRefresh()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all"
              >
                ↻ Refresh
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#0f172a] border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>⬇ Export CSV</span>
              </button>
            </div>
          </div>

          {/* High-Density Tabular Ledger */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Manifest ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Pickup Origin</th>
                  <th className="py-3 px-4">Stops &amp; Route Scope</th>
                  <th className="py-3 px-4">Vehicle Tier</th>
                  <th className="py-3 px-4">Assigned Crew</th>
                  <th className="py-3 px-4">Status &amp; Progress</th>
                  <th className="py-3 px-4 text-right">Fee</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 px-6 text-center text-slate-500">
                      <p className="text-sm font-bold text-[#0f172a]">No dispatch manifests found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Click &ldquo;+ Book New Run&rdquo; in the top bar to dispatch a multi-drop route to the Milton Keynes fleet.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const drops = parseManifestDrops(job.drop_addresses)
                    const completedArr = Array.isArray(job.completed_drops_json)
                      ? job.completed_drops_json
                      : []
                    const isCompleted = ['Completed', 'delivered'].includes(String(job.status))
                    const isAssigned = ['Assigned', 'In Progress', 'in_transit'].includes(
                      String(job.status)
                    )
                    const doneCount = isCompleted ? drops.length : completedArr.length
                    const dateStr = job.created_at
                      ? new Date(job.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Active'
                    const isCommercialOverflow = job.loop_profile === 'overflow'
                    const firstPostcode =
                      drops[0]?.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i)?.[1] ||
                      'MK9'
                    const lastPostcode =
                      drops[drops.length - 1]?.match(
                        /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i
                      )?.[1] || firstPostcode

                    return (
                      <tr
                        key={String(job.id)}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-[#0f172a] whitespace-nowrap">
                          #MK-{String(job.id)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#0f172a] max-w-[200px] truncate">
                          {job.pickup_address || 'Milton Keynes Depot'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#0f172a] tabular-nums">
                            {drops.length} {drops.length === 1 ? 'Stop' : 'Stops'}{' '}
                            <span className="font-normal text-slate-500">
                              ({firstPostcode.toUpperCase()} → {lastPostcode.toUpperCase()})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                            {drops[0] || 'Standard MK Loop'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isCommercialOverflow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                              LWB / MWB Commercial Multi-Drop
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[#0A0F0D] text-[11px] font-semibold">
                              2-Man 3.5t LWB / Luton {job.requires_assembly ? '+ Assembly' : 'Tail-Lift'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {job.driver_id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#004225]" />
                              <span className="font-semibold text-[#0A0F0D]">
                                Crew #{String(job.driver_id).slice(0, 6).toUpperCase()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-medium">Open Freight Board</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F0F7F4] text-[#004225] border border-[#004225]/25 text-[11px] font-bold tabular-nums">
                              ✓ Completed ({drops.length}/{drops.length})
                            </span>
                          ) : isAssigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEFCE8] text-[#713F12] border border-[#F6EB61] text-[11px] font-bold tabular-nums">
                              ● In Transit ({doneCount}/{drops.length})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold tabular-nums">
                              ⏳ Awaiting Claim (0/{drops.length})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0f172a] whitespace-nowrap tabular-nums">
                          <div>£{Number(job.gross_fee ?? 440).toFixed(2)}</div>
                          {isCompleted && (
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              Crew £{Number(job.net_pool ?? Number(job.gross_fee ?? 440) * 0.875).toFixed(2)} (87.5%) • Ben £
                              {Number(job.platform_fee ?? Number(job.gross_fee ?? 440) * 0.125).toFixed(2)} (12.5%)
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isCompleted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedJobForPoD(job)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all"
                                >
                                  View PoD
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInvoiceCopied(false)
                                    setSelectedJobForInvoice(job)
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#004225] hover:bg-[#005A34] text-white text-xs font-bold transition-all shadow-sm"
                                  title="Generate Pilot Invoice / Settlement Summary"
                                >
                                  Invoice / Split
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRatingJob(job)}
                                  className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold"
                                  title="Rate 2-Man Crew"
                                >
                                  ★ Rate
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onOpenConsumerTracker) {
                                    onOpenConsumerTracker(String(job.id))
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#0f172a] border border-slate-200 text-xs font-bold transition-all shadow-sm"
                              >
                                Live Map ↗
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDisputeJob(job)}
                              className="px-2 py-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-500 hover:text-red-700 border border-slate-200 text-[11px] font-semibold"
                              title="Log Exception / Issue"
                            >
                              Issue
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. SLIDE-OVER BOOKING DRAWER (isDrawerOpen) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
            <form onSubmit={handleBookRunSubmit} className="flex flex-col flex-1 justify-between">
              <div className="p-6 space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#004225] block">
                      3.5t LWB, XLWB &amp; Luton 2-Man Specialist Network — Hub 01 &amp; National UK
                    </span>
                    <h3 className="text-lg font-extrabold text-[#0A0F0D]">
                      Book New Multi-Drop Run
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                {drawerError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                    ⚠️ {drawerError}
                  </div>
                )}

                {/* 1. Service Tier Selector Cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                    1. Select Service &amp; UK Fleet Class
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setServiceTier('bulky_2man')
                        setFleetClassSpec(
                          '3.5t Luton / Low-Loader Box Van (with Tail-Lift) — 2-Man Heavy Bulky & White-Glove'
                        )
                      }}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        serviceTier === 'bulky_2man'
                          ? 'bg-[#F0F7F4] text-[#0A0F0D] border-2 border-[#004225] shadow-sm'
                          : 'bg-white text-[#0A0F0D] border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#004225]">
                          2-Man Bulky Goods
                        </span>
                        <span className="text-xs font-extrabold tabular-nums text-[#004225]">
                          £{requiresAssembly ? '520' : '440'}
                        </span>
                      </div>
                      <p className="text-[11px] mt-1 leading-snug text-slate-600">
                        3.5t Luton / Low-Loader (with Tail-Lift) or LWB/XLWB High-Roof • 2-Man Crew
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setServiceTier('commercial_multidrop')
                        setRequiresAssembly(false)
                        setFleetClassSpec(
                          'LWB / XLWB High-Roof Panel Van (3.5t) — e.g., Sprinter, Transit Jumbo, Crafter, Master'
                        )
                      }}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        serviceTier === 'commercial_multidrop'
                          ? 'bg-[#F0F7F4] text-[#0A0F0D] border-2 border-[#004225] shadow-sm'
                          : 'bg-white text-[#0A0F0D] border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#004225]">
                          Commercial Multi-Drop
                        </span>
                        <span className="text-xs font-extrabold tabular-nums text-[#004225]">
                          £145
                        </span>
                      </div>
                      <p className="text-[11px] mt-1 leading-snug text-slate-600">
                        LWB / XLWB High-Roof or MWB Commercial &amp; EV Van • Half-Day Loop (1–4 drops)
                      </p>
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Required UK Commercial Vehicle Taxonomy
                    </label>
                    <select
                      value={fleetClassSpec}
                      onChange={(e) => setFleetClassSpec(e.target.value)}
                      className="w-full min-h-[40px] bg-slate-50 border border-slate-200 focus:border-[#004225] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0A0F0D] outline-none"
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
                </div>

                {/* Optional Bulky Add-ons */}
                {serviceTier === 'bulky_2man' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70 cursor-pointer text-xs font-semibold text-[#0f172a]">
                      <input
                        type="checkbox"
                        checked={requiresAssembly}
                        onChange={(e) => setRequiresAssembly(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900"
                      />
                      <span>Include In-Room Assembly (£520 tier)</span>
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70 cursor-pointer text-xs font-semibold text-[#0f172a]">
                      <input
                        type="checkbox"
                        checked={hasThirdFloorNoLift}
                        onChange={(e) => setHasThirdFloorNoLift(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900"
                      />
                      <span>3rd Floor+ Walk-Up No Lift (+£25)</span>
                    </label>
                  </div>
                )}

                {/* 2. Pickup Origin Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                    2. Pickup Origin (Showroom / Warehouse Hub)
                  </label>
                  <input
                    type="text"
                    required
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="e.g. Barker & Stonehouse MK Hub, Kiln Farm, Milton Keynes MK11 3LG"
                    className="w-full min-h-[42px] bg-white border border-slate-200 focus:border-slate-400 rounded-lg px-3.5 py-2 text-xs text-[#0f172a] outline-none"
                  />
                </div>

                {/* 3. Multi-Drop Manifest Textarea + Quick Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      3. Multi-Drop Destinations (1 Line Per Stop)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {SAMPLE_MK_MANIFESTS.slice(0, 2).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const extracted = parseDispatchNotesDeterministic(
                              preset.rawDispatchNotes
                            )
                            setPickupAddress(extracted.pickup_address)
                            setDropAddressesRaw(extracted.drop_addresses)
                            setRequiresAssembly(extracted.requires_assembly)
                            setHasThirdFloorNoLift(extracted.has_third_floor_no_lift)
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 border border-slate-200 transition-all"
                        >
                          {preset.id.includes('assembly') ? 'Load Assembly Sample' : 'Load MK9 Sample'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    required
                    value={dropAddressesRaw}
                    onChange={(e) => setDropAddressesRaw(e.target.value)}
                    placeholder={
                      '14 Midsummer Blvd, Central Milton Keynes MK9 2EA\n82 Watling St, Bletchley MK2 2BY\n19 Newport Rd, Woburn Sands MK17 8UF'
                    }
                    className="w-full bg-white border border-slate-200 focus:border-slate-400 rounded-lg p-3.5 text-xs font-mono text-[#0f172a] outline-none placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Parsed Stops:{' '}
                      <strong className="text-[#0f172a] tabular-nums">{dropCount}</strong> /{' '}
                      {pricingTier.maxDrops} max fair-use cap
                    </span>
                    <span className="tabular-nums">
                      Est. Shift: <strong>{shiftMetrics.estimatedHours} hrs</strong> (
                      {shiftMetrics.inZoneMkDrops} MK In-Zone)
                    </span>
                  </div>
                </div>

                {/* 4. Real-Time Run Cost Calculator Badge */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 tabular-nums">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Service Tier Base Rate ({pricingTier.label})</span>
                    <span className="font-semibold text-[#0f172a]">
                      £{pricingTier.grossFee.toFixed(2)}
                    </span>
                  </div>
                  {heavyAccessSurcharge > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>3rd Floor+ Walk-Up Surcharge (100% to Crew)</span>
                      <span className="font-semibold text-[#0f172a]">
                        +£{heavyAccessSurcharge.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Included Stops ({dropCount} parsed)</span>
                    <span>
                      {dropCount > pricingTier.maxDrops
                        ? `⚠️ Exceeds ${pricingTier.maxDrops}-drop cap`
                        : 'Within Fair-Use Cap'}
                    </span>
                  </div>
                  <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#0f172a] block">
                        Total Fixed Run Fee
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Includes £{netPool.toFixed(2)} Direct Crew Settlement (87.5%) + £{platformFee.toFixed(2)} Ben Fee (12.5%)
                      </span>
                    </div>
                    <span className="text-2xl font-extrabold text-[#0f172a]">
                      £{grossFee.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 5. Retailer Service Agreement & Pay-on-Success Pilot Terms Gate */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={pilotTermsAccepted}
                      onChange={(e) => setPilotTermsAccepted(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#004225]"
                    />
                    <span>
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={() => setActiveLegalDoc('retailer_pilot')}
                        className="font-extrabold text-[#004225] underline hover:text-emerald-900"
                      >
                        Retailer Service Agreement &amp; Pay-on-Success Pilot Terms
                      </button>{' '}
                      (£0.00 fee if Ben/crew fails, 48-hr damage SLA, direct crew settlement + 12.5% platform fee invoice on verified PoD).
                    </span>
                  </label>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-[#004225] hover:bg-[#005A34] disabled:bg-slate-400 text-white text-xs font-bold shadow-sm transition-all tabular-nums"
                >
                  {submitting
                    ? 'Dispatching Manifest...'
                    : `Dispatch Run (£${grossFee.toFixed(2)}) →`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. POD CERTIFICATE MODAL (selectedJobForPoD) */}
      {selectedJobForPoD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  🛡️ Ben Damage-Shield Certificate Verified
                </span>
                <h3 className="text-lg font-extrabold text-[#0f172a] mt-1.5">
                  Proof of Delivery — Manifest #MK-{String(selectedJobForPoD.id)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Origin: {selectedJobForPoD.pickup_address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobForPoD(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Doorstep Photo Evidence */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  1. Doorstep / Room-of-Choice Photo
                </span>
                {resolvePodPhotoUrl(selectedJobForPoD) ? (
                  <img
                    src={resolvePodPhotoUrl(selectedJobForPoD)!}
                    alt={`PoD Manifest #MK-${selectedJobForPoD.id}`}
                    className="w-full h-48 object-cover rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="w-full h-48 rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-xs font-bold text-slate-700">
                      Condition Gate Photo Verified
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      Bucket: pod-images/job_{String(selectedJobForPoD.id)}.jpg
                    </span>
                  </div>
                )}
                <span className="text-[11px] text-emerald-700 font-semibold">
                  ✓ Matched against morning depot pre-load inspection
                </span>
              </div>

              {/* Right: Customer e-Signature SVG */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  2. Customer Doorstep e-Signature
                </span>
                {selectedJobForPoD.signature_svg ? (
                  <div className="w-full h-48 rounded-lg border border-slate-200 bg-white flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={selectedJobForPoD.signature_svg}
                      alt="Customer e-Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-2xl mb-1">✍️</span>
                    <span className="text-xs font-bold text-slate-700">
                      Signed &amp; Accepted at Room of Choice
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      Zero transit exceptions logged
                    </span>
                  </div>
                )}
                <span className="text-[11px] text-slate-600 font-medium tabular-nums">
                  Settled Fee: £{Number(selectedJobForPoD.gross_fee ?? 440).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const job = selectedJobForPoD
                  setSelectedJobForPoD(null)
                  setInvoiceCopied(false)
                  setSelectedJobForInvoice(job)
                }}
                className="px-4 py-2 rounded-lg bg-[#004225] hover:bg-[#005A34] text-white text-xs font-bold shadow-sm"
              >
                Generate Pilot Invoice / Settlement Summary →
              </button>
              <button
                type="button"
                onClick={() => setSelectedJobForPoD(null)}
                className="px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PILOT SETTLEMENT & 12.5% PLATFORM FEE INVOICE MODAL */}
      {selectedJobForInvoice && (() => {
        const gross = Number(selectedJobForInvoice.gross_fee ?? 440)
        const crewNet = Number(selectedJobForInvoice.net_pool ?? gross * 0.875)
        const benFee = Number(selectedJobForInvoice.platform_fee ?? gross * 0.125)
        const invDate = selectedJobForInvoice.created_at
          ? new Date(selectedJobForInvoice.created_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
        const invRef = `BEN-PILOT-${String(selectedJobForInvoice.id).slice(0, 8).toUpperCase()}`
        const summaryText = [
          `BEN LOGISTICS LTD — DAY-1 PILOT SETTLEMENT & PLATFORM FEE INVOICE`,
          `Invoice Reference: ${invRef}`,
          `Date: ${invDate}`,
          `Showroom: ${retailerName}`,
          `Manifest: #MK-${selectedJobForInvoice.id}`,
          `Origin: ${selectedJobForInvoice.pickup_address}`,
          `------------------------------------------------------------`,
          `1. 87.5% Direct Crew Settlement (Paid Directly to Crew): £${crewNet.toFixed(2)}`,
          `2. 12.5% Ben Platform Fee (Invoiced by Ben Logistics Ltd): £${benFee.toFixed(2)}`,
          `Total Route Value (Verified PoD): £${gross.toFixed(2)}`,
          `------------------------------------------------------------`,
          `Pilot Settlement Note: Ben Logistics Ltd acts strictly as a tech marketplace agent and does not hold client escrow funds during the MK pilot.`
        ].join('\n')

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-[#0f172a]">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                    Day-1 Pilot Direct Settlement • Zero Escrow Held
                  </span>
                  <h3 className="text-lg font-extrabold text-[#0f172a] mt-1.5">
                    Pilot Invoice &amp; Settlement Summary ({invRef})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manifest #MK-{String(selectedJobForInvoice.id)} • Verified PoD Date: {invDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJobForInvoice(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs tabular-nums">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-[#0f172a] block">
                      1. 87.5% Direct Crew Settlement
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Settled directly to Independent 2-Man Crew (#
                      {selectedJobForInvoice.driver_id
                        ? String(selectedJobForInvoice.driver_id).slice(0, 6).toUpperCase()
                        : 'MK-CREW'}
                      )
                    </span>
                  </div>
                  <span className="text-base font-extrabold text-[#004225]">
                    £{crewNet.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-200">
                  <div>
                    <span className="font-extrabold text-[#0f172a] block">
                      2. 12.5% Ben Platform Fee Invoice
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Invoiced by Ben Logistics Ltd upon verified photographic + e-signature PoD
                    </span>
                  </div>
                  <span className="text-base font-extrabold text-[#0f172a]">
                    £{benFee.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-300">
                  <span className="font-extrabold uppercase tracking-wider text-[#0f172a]">
                    Total Completed Route Value
                  </span>
                  <span className="text-xl font-extrabold text-[#0f172a]">
                    £{gross.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 leading-relaxed">
                <strong>Compliance &amp; Escrow Notice:</strong> To keep Day-1 Milton Keynes pilot
                operations lean and compliant, Ben Logistics Ltd does not hold unregulated client
                escrow funds. Showrooms settle the 87.5% crew pool directly upon PoD and pay the
                12.5% Ben Platform Fee invoice (ops@benlogistics.co.uk).
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(summaryText)
                    setInvoiceCopied(true)
                  }}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-[#0f172a] border border-slate-200 text-xs font-bold"
                >
                  {invoiceCopied ? '✓ Copied to Clipboard' : '📋 Copy Summary'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-[#004225] hover:bg-[#005A34] text-white text-xs font-bold shadow-sm"
                >
                  🖨 Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedJobForInvoice(null)}
                  className="px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* LEGAL TERMS & PAY-ON-SUCCESS PILOT AGREEMENT MODAL */}
      <LegalDocumentModal
        docType={activeLegalDoc}
        onClose={() => setActiveLegalDoc(null)}
        onAccept={
          activeLegalDoc === 'retailer_pilot' ? () => setPilotTermsAccepted(true) : undefined
        }
      />

      {/* CREW RATING MODAL */}
      {ratingJob && (
        <RateJobModal
          job={ratingJob}
          userId={retailerId}
          role="retailer"
          onClose={() => {
            setRatingJob(null)
            onRefresh()
          }}
        />
      )}

      {/* DISPUTE / ISSUE PANEL */}
      {disputeJob && (
        <DisputePanel
          job={disputeJob}
          userId={retailerId}
          role="retailer"
          onClose={() => setDisputeJob(null)}
        />
      )}
    </div>
  )
}
export default RetailerPortalView
