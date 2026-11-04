import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient'
import { parseManifestDrops } from '../../config/pricingMatrix2026'
import type { JobRecord } from '../../types/logistics'

const DEMO_TRACK_JOB: JobRecord = {
  id: 'mk-live-loop-884',
  pickup_address: 'Bletchley Sofa & Oak Showroom, Watling St, Milton Keynes MK1 1BN',
  drop_addresses:
    '14 Midsummer Blvd, Central Milton Keynes MK9 2EA\n82 Newport Rd, Woburn Sands MK17 8UF\n19 Gold St, Northampton NN1 1RA\n45 High St, Bedford MK40 1RY',
  status: 'In Progress',
  vehicle_setup: 'independent',
  loop_profile: 'assembly',
  gross_fee: 520,
  platform_fee: 65,
  net_pool: 455,
  requires_tail_lift: true,
  requires_assembly: true,
  pre_load_inspected: true,
  completed_drops_json: [0, 1],
  created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString()
}

export function ConsumerTrackView({ selectedJobId }: { selectedJobId?: string | null }) {
  const [jobs, setJobs] = useState<JobRecord[]>([DEMO_TRACK_JOB])
  const [activeJob, setActiveJob] = useState<JobRecord>(DEMO_TRACK_JOB)
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0)

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        // 1. If a specific job ID (integer or UUID) is passed via ?track=<job_id>, call the sanitized public RPC
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

        // 2. Otherwise query visible jobs (for authenticated Retailer/Crew)
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
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

  const drops = parseManifestDrops(activeJob.drop_addresses)
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

  const currentStage = isRouteCompleted || isStopCompleted
    ? 5
    : activeJob.status === 'Unassigned' || activeJob.status === 'open' || activeJob.status === 'draft'
    ? 1
    : stopsAway === 0
    ? 4
    : 3

  const stages = [
    { step: 1, title: 'Scheduled at MK Showroom', desc: 'Manifest verified & slot locked' },
    { step: 2, title: 'Depot Pre-Load Inspected', desc: 'Cartons checked & loaded on 3.5t Luton' },
    { step: 3, title: 'Out for Delivery in MK', desc: '2-Man specialist crew on active loop' },
    {
      step: 4,
      title: stopsAway === 0 ? 'Crew Approaching Next (Est. 18 mins)' : `${stopsAway} Stop(s) Away`,
      desc: 'Live GPS telemetry & room-of-choice prep'
    },
    { step: 5, title: 'Delivered to Room of Choice', desc: 'Photo PoD & e-Signature verified' }
  ]

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">
                Deliveroo-Grade Live Customer Portal • Route #{String(activeJob.id)}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
              📍 Live 2-Man Bulky Delivery Tracker
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Origin Showroom: <strong>{activeJob.pickup_address}</strong>
            </p>
          </div>

          {jobs.length > 1 && (
            <select
              value={String(activeJob.id)}
              onChange={(e) => {
                const found = jobs.find((j) => String(j.id) === e.target.value)
                if (found) {
                  setActiveJob(found)
                  setSelectedStopIndex(0)
                }
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-800 outline-none"
            >
              {jobs.map((j) => (
                <option key={String(j.id)} value={String(j.id)}>
                  Route #{String(j.id)}: {j.pickup_address.slice(0, 24)} ({j.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* CUSTOMER STOP SELECTOR */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Select Customer Drop on Manifest ({drops.length} Total Drops)
            </span>
            <span className="text-xs font-bold text-emerald-700">
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
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    selectedStopIndex === idx
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : done
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {done ? '✓ ' : ''}Stop #{idx + 1}: {addr.split(',')[0]}
                </button>
              )
            })}
          </div>
        </div>

        {/* LIVE ETA HERO CARD */}
        <div className="bg-emerald-950 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-400/30">
              Stop #{selectedStopIndex + 1} Destination
            </span>
            <h3 className="text-lg font-extrabold text-white pt-1">
              {drops[selectedStopIndex] || 'Milton Keynes Customer Address'}
            </h3>
            <p className="text-xs text-emerald-200">
              {activeJob.requires_assembly
                ? '🔧 Includes Two-Man White-Glove Room-of-Choice Assembly & Packaging Removal'
                : '🛋 Includes Two-Man Room-of-Choice Placement (Up to 2nd Floor)'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-5 py-3.5 text-left sm:text-right shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold block">
              {currentStage === 5 ? 'Delivery Status' : 'Estimated Arrival'}
            </span>
            <span className="text-2xl font-extrabold text-white block">
              {currentStage === 5
                ? 'Delivered ✓'
                : stopsAway === 0
                ? '15–25 Mins'
                : `~${stopsAway * 35 + 20} Mins`}
            </span>
            <span className="text-[11px] text-emerald-200 font-medium">
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
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
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
                      ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                      : reached
                      ? 'bg-white border-emerald-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${
                        reached
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
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
                  <div className="text-xs font-extrabold text-slate-900 leading-snug">
                    {s.title}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{s.desc}</div>
                </div>
              )
            })}
          </div>
        </div>

        {activeJob.exception_notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 font-semibold">
            ⚠️ Active Route Exception Logged: {activeJob.exception_notes}
          </div>
        )}

        {/* CREW & VEHICLE CREDENTIALS BAR */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-lg">
              👷
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-900">
                MK Verified 2-Man Bulky Crew (3.5t Luton Tail-Lift)
              </div>
              <div className="text-[11px] text-slate-500">
                £50k Goods in Transit • £1m Public Liability (Driver & Porter Insured)
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
