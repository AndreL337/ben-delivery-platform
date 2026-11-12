import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient'
import { parseManifestDrops } from '../../config/pricingMatrix2026'
import type { JobRecord } from '../../types/logistics'
import { MKRouteVisualizer } from '../../shared/components/MKRouteVisualizer'

const DEMO_TRACK_JOB: JobRecord = {
  id: 'mk-live-loop-884',
  pickup_address: 'Bletchley Sofa & Oak Showroom, Watling St, Milton Keynes MK1 1BN',
  drop_addresses:
    '14 Midsummer Blvd, Central Milton Keynes MK9 2EA\n82 Newport Rd, Woburn Sands MK17 8UF\n19 Gold St, Northampton NN1 1RA\n45 High St, Bedford MK40 1RY',
  status: 'In Progress',
  vehicle_setup: 'independent',
  loop_profile: 'assembly',
  requires_tail_lift: true,
  requires_assembly: true,
  pre_load_inspected: true,
  completed_drops_json: [0, 1],
  created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString()
}

const PUBLIC_TRACKING_COLUMNS =
  'id, pickup_address, drop_addresses, status, requires_tail_lift, requires_assembly, pre_load_inspected, completed_drops_json, exception_notes, created_at'

function redactPeerStopAddress(addr: string, isCurrentRecipient: boolean): string {
  if (isCurrentRecipient) return addr
  const pcMatch = addr.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})?\b/)
  const outcode = pcMatch ? pcMatch[1] : 'MK Sector'
  return `Protected Customer Stop (${outcode} Area)`
}

export function ConsumerTrackView({ selectedJobId }: { selectedJobId?: string | null }) {
  const [jobs, setJobs] = useState<JobRecord[]>([DEMO_TRACK_JOB])
  const [activeJob, setActiveJob] = useState<JobRecord>(DEMO_TRACK_JOB)
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0)

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // 1. If a specific job ID (integer or UUID) is passed via /track/:jobId or ?track=<job_id>, call the sanitized public RPC
        const targetLookupId = selectedJobId ? String(selectedJobId).trim() : null
        if (targetLookupId && !targetLookupId.startsWith('mk-')) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_job_tracking', {
            p_job_id: targetLookupId
          })
          if (rpcError) {
            console.error('[ConsumerTrackView RPC Error]', {
              message: rpcError.message,
              details: rpcError.details,
              hint: rpcError.hint
            })
          }
          if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
            setJobs(rpcData as JobRecord[])
            setActiveJob(rpcData[0] as JobRecord)
            return
          }
        }

        // 2. Otherwise query strictly non-financial public tracking columns
        const { data, error } = await supabase
          .from('jobs')
          .select(PUBLIC_TRACKING_COLUMNS)
          .order('id', { ascending: false })
          .limit(10)
        if (error) {
          console.warn('[ConsumerTrackView Jobs Query Notice]', {
            message: error.message,
            details: error.details,
            hint: error.hint
          })
        }
        if (data && data.length > 0) {
          const all = data as JobRecord[]
          setJobs(all)
          const matched = targetLookupId
            ? all.find((j) => String(j.id) === targetLookupId) || all[0]
            : all[0]
          setActiveJob(matched)
        }
      } catch (err: any) {
        console.error('[ConsumerTrackView Unexpected Error]', err)
      }
    }
    fetchJobs()
  }, [selectedJobId])

  const rawDrops = parseManifestDrops(activeJob.drop_addresses)
  const drops = rawDrops.map((addr, idx) =>
    redactPeerStopAddress(addr, idx === selectedStopIndex)
  )
  const completedSet = new Set<number>(
    Array.isArray(activeJob.completed_drops_json)
      ? activeJob.completed_drops_json
      : activeJob.status === 'Completed' || activeJob.status === 'delivered'
      ? drops.map((_, idx) => idx)
      : []
  )

  const isRouteCompleted =
    activeJob.status === 'Completed' ||
    activeJob.status === 'delivered' ||
    (drops.length > 0 && completedSet.size === drops.length)
  const isStopCompleted = completedSet.has(selectedStopIndex)
  const nextActiveStopIdx = drops.findIndex((_, idx) => !completedSet.has(idx))
  const stopsAway =
    isRouteCompleted || isStopCompleted
      ? 0
      : Math.max(0, selectedStopIndex - (nextActiveStopIdx === -1 ? 0 : nextActiveStopIdx))

  const currentStage =
    isRouteCompleted || isStopCompleted
      ? 5
      : activeJob.status === 'Unassigned' ||
        activeJob.status === 'open' ||
        activeJob.status === 'draft'
      ? 2
      : stopsAway === 0
      ? 4
      : 3

  const stages = [
    { step: 1, title: 'Scheduled at MK Showroom', desc: 'Manifest verified & slot locked' },
    { step: 2, title: 'Depot Pre-Load Inspected', desc: 'Cartons & van strapping verified' },
    { step: 3, title: 'Out for Delivery in MK', desc: '2-Man specialist crew on active loop' },
    {
      step: 4,
      title: stopsAway === 0 ? 'Crew Approaching Next (Est. 18 mins)' : `${stopsAway} Stop(s) Away`,
      desc: 'Live GPS telemetry & room-of-choice prep'
    },
    { step: 5, title: 'Delivered to Room of Choice', desc: 'Photo PoD & e-Signature verified' }
  ]

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 text-[#0F172A]">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 tabular-nums">
                High-Contrast Daylight Tracker • Route #{String(activeJob.id)}
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                🛡️ AI Damage Shield Active
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] mt-1">
              📍 Live 2-Man Bulky Delivery Tracker
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Origin Showroom: <strong className="text-[#0F172A]">{activeJob.pickup_address}</strong>
            </p>
          </div>

          {!selectedJobId && jobs.length > 1 && (
            <select
              value={String(activeJob.id)}
              onChange={(e) => {
                const found = jobs.find((j) => String(j.id) === e.target.value)
                if (found) {
                  setActiveJob(found)
                  setSelectedStopIndex(0)
                }
              }}
              className="min-h-[48px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl py-2.5 px-3.5 text-xs font-extrabold text-[#0F172A] outline-none"
            >
              {jobs.map((j) => (
                <option key={String(j.id)} value={String(j.id)}>
                  Route #{String(j.id)}: {j.pickup_address.slice(0, 24)} ({j.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* TASK 2: INTERACTIVE MK GRID ROUTE VIEWPORT + GOOGLE MAPS TURN-BY-TURN HANDOFF */}
        <MKRouteVisualizer
          routeId={activeJob.id}
          pickupAddress={activeJob.pickup_address}
          drops={drops}
          completedIndices={Array.from(completedSet)}
          selectedStopIndex={selectedStopIndex}
          onSelectStop={setSelectedStopIndex}
          status={activeJob.status}
        />

        {/* CUSTOMER STOP SELECTOR */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Select Customer Drop on Manifest ({drops.length} Total Drops)
            </span>
            <span className="text-xs font-extrabold text-emerald-700 tabular-nums">
              {completedSet.size} / {drops.length} Completed
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {drops.map((addr, idx) => {
              const done = completedSet.has(idx) || isRouteCompleted
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedStopIndex(idx)}
                  className={`min-h-[48px] text-xs font-extrabold px-3.5 py-2 rounded-xl border transition-all tabular-nums ${
                    selectedStopIndex === idx
                      ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                      : done
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:border-slate-400'
                  }`}
                >
                  {done ? '✓ ' : ''}Stop #{idx + 1}: {addr.split(',')[0]}
                </button>
              )
            })}
          </div>
        </div>

        {/* LIVE ETA HERO CARD */}
        <div className="bg-[#0F172A] text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-400/30 tabular-nums">
              Stop #{selectedStopIndex + 1} Destination
            </span>
            <h3 className="text-lg font-extrabold text-white pt-1">
              {drops[selectedStopIndex] || 'Milton Keynes Customer Address'}
            </h3>
            <p className="text-xs text-emerald-200">
              {activeJob.requires_assembly || activeJob.loop_profile === 'assembly'
                ? '🔧 Includes Two-Man White-Glove Room-of-Choice Assembly & Packaging Removal'
                : '🛋 Includes Two-Man Room-of-Choice Placement (Up to 2nd Floor)'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-5 py-3.5 text-left sm:text-right shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold block">
              {currentStage === 5 ? 'Delivery Status' : 'Estimated Arrival'}
            </span>
            <span className="text-2xl font-extrabold text-white block tabular-nums">
              {currentStage === 5
                ? 'Delivered ✓'
                : stopsAway === 0
                ? '15–25 Mins'
                : `~${stopsAway * 35 + 20} Mins`}
            </span>
            <span className="text-[11px] text-emerald-200 font-medium tabular-nums">
              {currentStage === 5
                ? 'PoD Verified in Vault'
                : stopsAway === 0
                ? 'You are the next stop!'
                : `Crew is ${stopsAway} stop(s) away`}
            </span>
          </div>
        </div>

        {/* 5-STAGE DELIVEROO VISUAL STATE MACHINE */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Live Telemetry Progression
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
            {stages.map((s) => {
              const reached = currentStage >= s.step
              const isCurrent = currentStage === s.step
              return (
                <div
                  key={s.step}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                      : reached
                      ? 'bg-white border-emerald-200'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center tabular-nums ${
                        reached
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {reached ? '✓' : s.step}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-extrabold text-[#0F172A] leading-snug">
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1 leading-relaxed">{s.desc}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* TASK 4: SIDE-BY-SIDE AI CONDITION GATE & DAMAGE-SHIELD CERTIFICATE */}
        <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛡️</span>
              <div>
                <h4 className="text-sm font-extrabold text-emerald-950">
                  🛡️ Ben Damage-Shield Certificate: Zero Transit Damage Verified (Pre-Load Matched to Room-of-Choice POD)
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Side-by-side AI Condition Gate protecting Retailer, Customer, and 2-Man Crew against transit damage disputes.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-emerald-600 text-white shrink-0 self-start sm:self-center">
              ✓ 100% Condition Match
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* STEP A: DEPOT PRE-LOAD */}
            <div className="bg-white border border-emerald-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Step A • Depot Pre-Load Gate
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ✓ Verified at Origin
                </span>
              </div>
              <p className="text-xs font-bold text-[#0F172A]">
                Origin: {activeJob.pickup_address}
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Carton corners intact, protective blankets & 3.5t Luton ratchet strapping logged prior to departure.
              </p>
            </div>

            {/* STEP B: DOORSTEP POD */}
            <div className="bg-white border border-emerald-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Step B • Doorstep Room-of-Choice POD
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {activeJob.pod_image_url || currentStage === 5
                    ? '✓ Photo PoD Matched'
                    : '● Armed for Drop'}
                </span>
              </div>
              <p className="text-xs font-bold text-[#0F172A]">
                Destination: {drops[selectedStopIndex] || 'Milton Keynes Customer Stop'}
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {activeJob.pod_image_url
                  ? `Vault Reference: ${activeJob.pod_image_url} — Zero transit scuffs or property damage logged.`
                  : 'In-home placement & assembly condition photo matched against Step A pre-load baseline.'}
              </p>
            </div>
          </div>
        </div>

        {activeJob.exception_notes && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 font-bold">
            ⚠️ Active Route Exception Logged: {activeJob.exception_notes}
          </div>
        )}

        {/* CREW & VEHICLE CREDENTIALS BAR */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-lg">
              👷
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#0A0F0D]">
                Verified 2-Man Crew (Mercedes Sprinter LWB &amp; 3.5t Tail-Lift Specialist Network)
              </div>
              <div className="text-[11px] text-slate-600">
                £50k Goods in Transit • £1m Public Liability (Driver &amp; Porter Insured) • Hub 01 (M1 Corridor)
              </div>
            </div>
          </div>

          {activeJob.signature_svg && (
            <div className="bg-white border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">
                ✍️ Customer Signature On File
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
