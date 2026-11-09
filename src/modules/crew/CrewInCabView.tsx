import React, { useState, useRef, useEffect } from 'react'
import { SignaturePad } from '../../shared/components/SignaturePad'
import { MKRouteVisualizer } from '../../shared/components/MKRouteVisualizer'
import type { RoutedManifestStop, BlackbookHazard } from './useDriverRoutingEngine'

export type InCabStage = 'TRANSIT' | 'DOORSTEP' | 'POD'

export interface CrewInCabViewProps {
  job: any
  sequencedStops: RoutedManifestStop[]
  currentStop: RoutedManifestStop
  currentStopNumber: number
  totalStops: number
  completedDropIndices: number[]
  signatureSvg: string
  onSaveSignatureSvg: (svg: string) => void
  podUploading: boolean
  podMessage?: string
  onCompleteStop: (stop: RoutedManifestStop, podPhotoFile: File | null) => Promise<void> | void
  onLogException: (
    postcodeKey: string,
    hazardType: BlackbookHazard['hazard_type'],
    hazardNote: string
  ) => Promise<void> | void
  onOpenDisputeModal?: () => void
  onBackToPreLoad?: () => void
  onOpenConsumerTracker?: (jobId: string) => void
}

export const CrewInCabView: React.FC<CrewInCabViewProps> = ({
  job,
  sequencedStops,
  currentStop,
  currentStopNumber,
  totalStops,
  completedDropIndices,
  signatureSvg,
  onSaveSignatureSvg,
  podUploading,
  podMessage,
  onCompleteStop,
  onLogException,
  onOpenDisputeModal,
  onBackToPreLoad,
  onOpenConsumerTracker
}) => {
  const [stage, setStage] = useState<InCabStage>('TRANSIT')
  const [sheetExpanded, setSheetExpanded] = useState<boolean>(true)
  const [podPhotoFile, setPodPhotoFile] = useState<File | null>(null)
  const [podPhotoName, setPodPhotoName] = useState<string>('')
  const [showDelayMenu, setShowDelayMenu] = useState<boolean>(false)
  const [localBanner, setLocalBanner] = useState<string>('')

  // Slide-to-Complete state & refs
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [sliderX, setSliderX] = useState<number>(0)
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false)
  const [slideCompleted, setSlideCompleted] = useState<boolean>(false)

  // Bottom sheet touch drag tracking
  const sheetDragStartY = useRef<number | null>(null)

  // Reset stage & slider whenever the active stop changes
  useEffect(() => {
    setStage('TRANSIT')
    setSliderX(0)
    setSlideCompleted(false)
    setPodPhotoFile(null)
    setPodPhotoName('')
    setShowDelayMenu(false)
  }, [currentStop.stopId])

  const encodedDestination = encodeURIComponent(currentStop.address)
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`
  const wazeUrl = `https://waze.com/ul?q=${encodedDestination}&navigate=yes`

  const shortZoneLabel = currentStop.vanZone.split('(')[0].trim() // e.g. "Zone D"
  const isFinalStop = currentStopNumber >= totalStops

  const triggerQuickException = async (
    hazardType: BlackbookHazard['hazard_type'],
    noteText: string
  ) => {
    await onLogException(currentStop.postcode, hazardType, noteText)
    setLocalBanner(`⚠️ Logged [${hazardType.replace('_', ' ').toUpperCase()}]: ${noteText}`)
    setShowDelayMenu(false)
  }

  // Handle Slide-to-Complete pointer/touch movement
  const updateSliderPosition = (clientX: number) => {
    const track = trackRef.current
    if (!track || slideCompleted || podUploading) return
    const rect = track.getBoundingClientRect()
    const thumbWidth = 56
    const maxTravel = Math.max(1, rect.width - thumbWidth - 8)
    const clampedX = Math.max(0, Math.min(maxTravel, clientX - rect.left - thumbWidth / 2))
    setSliderX(clampedX)

    if (clampedX >= maxTravel * 0.82) {
      setIsDraggingSlider(false)
      setSlideCompleted(true)
      setSliderX(maxTravel)
      Promise.resolve(onCompleteStop(currentStop, podPhotoFile)).finally(() => {
        setTimeout(() => {
          setSlideCompleted(false)
          setSliderX(0)
        }, 600)
      })
    }
  }

  const endSliderDrag = () => {
    if (!isDraggingSlider) return
    setIsDraggingSlider(false)
    if (!slideCompleted) {
      setSliderX(0)
    }
  }

  // Lock background page scroll while full-screen In-Cab HUD is active
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    if (!isDraggingSlider) return
    const handleMouseMove = (e: MouseEvent) => updateSliderPosition(e.clientX)
    const handleMouseUp = () => endSliderDrag()
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSlider, slideCompleted, podUploading, podPhotoFile, currentStop])

  return (
    <div
      className="fixed inset-0 z-[100] w-screen h-[100dvh] max-h-[100dvh] bg-[#090D16] overflow-hidden flex flex-col justify-between select-none"
      style={{ height: '100dvh' }}
    >
      {/* 1. FULL-BLEED MAP / ROUTE CONTEXT CANVAS */}
      <div className="absolute inset-0 z-0 flex flex-col">
        <div className="flex-1 w-full h-full overflow-hidden opacity-95">
          <MKRouteVisualizer
            routeId={job.id}
            pickupAddress={job.pickup_address}
            drops={sequencedStops.map((s) => s.address)}
            completedIndices={sequencedStops
              .map((s, seqIdx) =>
                completedDropIndices.includes(s.originalIndex) ? seqIdx : -1
              )
              .filter((idx) => idx !== -1)}
            selectedStopIndex={Math.max(0, currentStopNumber - 1)}
            status={job.status}
            fullBleed={true}
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(9,13,22,0.75) 0%, rgba(9,13,22,0.15) 35%, rgba(9,13,22,0.85) 100%)'
          }}
        />
      </div>

      {/* 2. MINIMALIST TOP PILL HUD */}
      <div className="relative z-20 p-3.5 sm:p-4 flex flex-col gap-2">
        <div className="bg-slate-950/90 backdrop-blur-md border border-white/15 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-xl">
          <div className="flex items-center gap-2 flex-wrap">
            {onBackToPreLoad && (
              <button
                type="button"
                onClick={onBackToPreLoad}
                className="min-h-[38px] px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-extrabold transition-all"
              >
                ← LIFO Sheet
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold tracking-wider uppercase tabular-nums">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              STOP {currentStopNumber} OF {totalStops}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#00F5D4]/15 border border-[#00F5D4]/40 text-[#00F5D4] text-xs font-extrabold tabular-nums">
              📦 {shortZoneLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenConsumerTracker && (
              <button
                type="button"
                onClick={() => onOpenConsumerTracker(String(job.id))}
                className="hidden sm:inline-flex min-h-[38px] items-center px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-extrabold"
              >
                📍 Live Track
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDelayMenu(!showDelayMenu)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold tracking-wide uppercase shadow-md transition-all shrink-0"
            >
              ⚠️ FLAG DELAY
            </button>
          </div>
        </div>

        {/* QUICK DELAY / STREET-SENSE POPOVER */}
        {showDelayMenu && (
          <div className="bg-slate-950/95 backdrop-blur-md border border-amber-400/40 rounded-2xl p-3.5 shadow-2xl space-y-2.5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                ⚡ 1-Tap Non-Blocking Delay & Street-Sense Logger ({currentStop.postcode})
              </span>
              <button
                type="button"
                onClick={() => setShowDelayMenu(false)}
                className="text-xs text-slate-400 hover:text-white font-bold px-2"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerQuickException(
                    'tight_turning',
                    'Traffic / Gridlock delay on MK approach (+15 mins ETA notified)'
                  )
                }
                className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-left text-xs font-extrabold text-amber-200"
              >
                🚗 +15m Traffic Delay
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerQuickException(
                    'school_run',
                    'School run / cul-de-sac congestion at postcode — approaching with caution'
                  )
                }
                className="min-h-[44px] p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-left text-xs font-extrabold text-amber-200"
              >
                🏫 School Run / Access
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelayMenu(false)
                  if (onOpenDisputeModal) onOpenDisputeModal()
                }}
                className="min-h-[44px] p-2.5 rounded-xl bg-red-950/80 hover:bg-red-900/80 border border-red-500/40 text-left text-xs font-extrabold text-red-200"
              >
                🛡️ Formal SLA / Damage Log
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. EXPANDABLE MOBILE-FIRST BOTTOM SHEET */}
      <div
        className={`relative z-20 w-full bg-[#FFFFFF] text-[#0F172A] rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.45)] border-t border-slate-200 transition-all duration-300 flex flex-col ${
          sheetExpanded ? 'max-h-[82dvh]' : 'max-h-[38dvh]'
        }`}
      >
        {/* DRAG HANDLE BAR */}
        <div
          onTouchStart={(e) => {
            sheetDragStartY.current = e.touches[0].clientY
          }}
          onTouchEnd={(e) => {
            if (sheetDragStartY.current === null) return
            const deltaY = e.changedTouches[0].clientY - sheetDragStartY.current
            if (deltaY > 35) setSheetExpanded(false)
            else if (deltaY < -35) setSheetExpanded(true)
            sheetDragStartY.current = null
          }}
          onClick={() => setSheetExpanded(!sheetExpanded)}
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pb-5 pt-1 overflow-y-auto space-y-4">
          {/* PERSISTENT STREET-SENSE / BLACK-BOOK HAZARD BANNER */}
          {(currentStop.blackbookAlerts.length > 0 || localBanner || job.exception_notes) && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-xs font-extrabold text-amber-950 flex items-start justify-between gap-2">
              <div className="space-y-1">
                {localBanner && <div>{localBanner}</div>}
                {job.exception_notes && !localBanner && (
                  <div>⚠️ Active Route Note: {job.exception_notes}</div>
                )}
                {currentStop.blackbookAlerts.map((alert) => (
                  <div key={alert.id}>
                    📓 Street-Sense ({alert.postcode_key} • {alert.hazard_type.replace('_', ' ')}):{' '}
                    {alert.hazard_note}
                  </div>
                ))}
              </div>
              {localBanner && (
                <button
                  type="button"
                  onClick={() => setLocalBanner('')}
                  className="text-amber-700 hover:text-amber-950 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* DESTINATION HEADER + POSTCODE BADGE */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 border-b border-slate-100 pb-3.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-[#0F172A] text-white text-xs font-extrabold tracking-wider uppercase tabular-nums">
                  {currentStop.postcode}
                </span>
                <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg tabular-nums">
                  {currentStop.vanZone}
                </span>
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  ~{currentStop.estimatedCubeM3}m³ • {currentStop.distanceFromDepotKm} km
                </span>
              </div>
              <h2 className="text-[24px] leading-tight font-extrabold text-[#0F172A] pt-1">
                {currentStop.address}
              </h2>
            </div>

            {/* 3-STAGE PILL SWITCHER */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start">
              {(['TRANSIT', 'DOORSTEP', 'POD'] as InCabStage[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase transition-all ${
                    stage === s
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 4. STRICT 3-STATE PROGRESSIVE DISCLOSURE */}
          {stage === 'TRANSIT' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[56px] flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl px-5 py-3.5 flex items-center justify-center gap-2.5 text-base font-extrabold tracking-wide uppercase shadow-lg shadow-emerald-600/25 transition-all"
                >
                  <span>🗺 NAVIGATE IN SATNAV</span>
                  <span>↗</span>
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[56px] sm:w-36 bg-slate-100 hover:bg-slate-200 text-[#0F172A] border border-slate-300 rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-extrabold uppercase transition-all"
                >
                  🚗 Waze
                </a>
              </div>

              <button
                type="button"
                onClick={() => setStage('DOORSTEP')}
                className="min-h-[56px] w-full bg-[#0F172A] hover:bg-slate-800 text-white rounded-2xl px-5 py-3.5 text-base font-extrabold tracking-wide uppercase shadow-md transition-all"
              >
                ARRIVED AT STOP →
              </button>
            </div>
          )}

          {stage === 'DOORSTEP' && (
            <div className="space-y-3.5 pt-1">
              {/* DELIVERY NOTES (ROOM OF CHOICE / ASSEMBLY) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    🛋 Room-of-Choice Delivery Instructions
                  </span>
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    🛡️ Step A Pre-Load Verified
                  </span>
                </div>
                <p className="text-sm font-bold text-[#0F172A]">
                  {job.requires_assembly || job.loop_profile === 'assembly'
                    ? '🔧 Two-Man White-Glove Room-of-Choice Placement & Full Item Assembly Required.'
                    : '🛋 Two-Man Room-of-Choice Placement (Up to 2nd Floor). Inspect stairwell clearance before unstrapping.'}
                </p>
                {job.has_third_floor_no_lift && (
                  <p className="text-xs font-extrabold text-emerald-800">
                    ✓ +£25.00 3rd-Floor Walk-Up Surcharge Active (100% credited to crew pool)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href="tel:+441908000000"
                  className="min-h-[52px] bg-white hover:bg-slate-50 border border-slate-300 text-[#0F172A] rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all"
                >
                  📞 CALL RECIPIENT
                </a>
                <button
                  type="button"
                  onClick={() =>
                    triggerQuickException(
                      'stairs_hazard',
                      'Customer Not Home (10-min wait timer started) / Restricted Doorway Fit check'
                    )
                  }
                  className="min-h-[52px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all"
                >
                  ⚠️ ACCESS ISSUE
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStage('POD')}
                className="min-h-[56px] w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-5 py-3.5 text-base font-extrabold tracking-wide uppercase shadow-lg shadow-emerald-600/25 transition-all"
              >
                PROCEED TO POD &amp; SIGNATURE →
              </button>
            </div>
          )}

          {stage === 'POD' && (
            <div className="space-y-3.5 pt-1">
              {/* INLINE CAMERA INPUT */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A] block">
                    📷 Room-of-Choice Condition Photo
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {podPhotoName
                      ? `Attached: ${podPhotoName}`
                      : 'Snap placement photo to issue Ben Damage-Shield Certificate'}
                  </span>
                </div>
                <label className="min-h-[48px] cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm shrink-0 transition-all">
                  <span>{podPhotoName ? '↻ Retake Photo' : '📷 Snap POD Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setPodPhotoFile(e.target.files[0])
                        setPodPhotoName(e.target.files[0].name)
                      }
                    }}
                  />
                </label>
              </div>

              {/* CUSTOMER E-SIGNATURE PAD */}
              <SignaturePad onSaveSvg={onSaveSignatureSvg} savedSvg={signatureSvg} />

              {podMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-extrabold text-emerald-950">
                  {podMessage}
                </div>
              )}

              {/* SMOOTH SLIDE-TO-COMPLETE BAR */}
              <div
                ref={trackRef}
                className="relative w-full h-[60px] bg-slate-900 rounded-2xl p-1 flex items-center overflow-hidden select-none touch-none shadow-inner border border-slate-800"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-600/35 transition-none"
                  style={{ width: `${sliderX + 56}px` }}
                />
                <div className="w-full text-center text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white pointer-events-none z-10">
                  {podUploading
                    ? 'Uploading PoD to Vault...'
                    : slideCompleted
                    ? '✓ Stop Completed!'
                    : isFinalStop
                    ? '»» Slide to Complete Final Stop & Settle Loop »»'
                    : `»» Slide to Complete Stop #${currentStopNumber} »»`}
                </div>

                <div
                  role="slider"
                  aria-label="Slide to complete stop"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(sliderX)}
                  onMouseDown={() => {
                    if (!podUploading && !slideCompleted) setIsDraggingSlider(true)
                  }}
                  onTouchStart={() => {
                    if (!podUploading && !slideCompleted) setIsDraggingSlider(true)
                  }}
                  onTouchMove={(e) => {
                    if (isDraggingSlider && e.touches[0]) {
                      updateSliderPosition(e.touches[0].clientX)
                    }
                  }}
                  onTouchEnd={endSliderDrag}
                  style={{ transform: `translateX(${sliderX}px)` }}
                  className={`relative z-20 w-[52px] h-[52px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing touch-none ${
                    isDraggingSlider ? '' : 'transition-transform duration-200'
                  }`}
                >
                  {slideCompleted ? '✓' : '➔'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
