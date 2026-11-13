import React from 'react'
import { Navigation, ArrowUpRight } from 'lucide-react'

export interface MKRouteVisualizerProps {
  routeId?: string | number
  pickupAddress: string
  drops: string[]
  completedIndices?: number[]
  selectedStopIndex?: number
  onSelectStop?: (index: number) => void
  status?: string
  compact?: boolean
  fullBleed?: boolean
}

interface ProjectedPoint {
  x: number
  y: number
  label: string
  postcode: string
  zoneStatus: 'mk-core' | 'mk-outer' | 'out-of-zone'
}

// Deterministic MK Grid coordinate projector (maps MK1-MK19 & regional postcodes onto our H1-H10 / V1-V11 viewport)
function projectAddressToMKGrid(address: string, index: number, isOrigin: boolean): ProjectedPoint {
  const upper = (address || '').toUpperCase()
  const pcMatch = upper.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})?\b/)
  const outcode = pcMatch ? pcMatch[1] : isOrigin ? 'MK11' : `MK${9 + (index % 8)}`
  const fullPostcode = pcMatch ? pcMatch[0] : outcode

  // Anchor coordinates in a 600x300 SVG viewport where Central MK (MK9) is (300, 150)
  const anchors: Record<string, { x: number; y: number; zone: ProjectedPoint['zoneStatus'] }> = {
    MK9: { x: 300, y: 145, zone: 'mk-core' }, // Central Milton Keynes / Midsummer Blvd
    MK11: { x: 185, y: 110, zone: 'mk-core' }, // Kiln Farm / Stony Stratford
    MK12: { x: 225, y: 95, zone: 'mk-core' }, // Wolverton
    MK8: { x: 215, y: 140, zone: 'mk-core' }, // Two Mile Ash / Crownhill
    MK5: { x: 235, y: 175, zone: 'mk-core' }, // Shenley / Knowlhill
    MK6: { x: 315, y: 180, zone: 'mk-core' }, // Fishermead / Oldbrook
    MK1: { x: 305, y: 235, zone: 'mk-core' }, // Bletchley / Denbigh
    MK2: { x: 285, y: 245, zone: 'mk-core' }, // Bletchley Central
    MK3: { x: 245, y: 235, zone: 'mk-core' }, // Bletchley West
    MK4: { x: 210, y: 215, zone: 'mk-core' }, // Furzton / Emerson Valley
    MK7: { x: 365, y: 205, zone: 'mk-core' }, // Caldecotte / Walnut Tree
    MK10: { x: 390, y: 155, zone: 'mk-core' }, // Kingston / Broughton
    MK13: { x: 270, y: 105, zone: 'mk-core' }, // Bradwell / New Bradwell
    MK14: { x: 315, y: 100, zone: 'mk-core' }, // Linford Wood / Stantonbury
    MK15: { x: 365, y: 115, zone: 'mk-core' }, // Willen / Pineham
    MK16: { x: 375, y: 65, zone: 'mk-outer' }, // Newport Pagnell
    MK17: { x: 430, y: 235, zone: 'mk-outer' }, // Woburn Sands
    MK18: { x: 110, y: 180, zone: 'mk-outer' }, // Buckingham
    MK19: { x: 150, y: 70, zone: 'mk-outer' }, // Hanslope / Deanshanger
    MK40: { x: 515, y: 185, zone: 'out-of-zone' }, // Bedford
    MK42: { x: 525, y: 205, zone: 'out-of-zone' }, // Bedford South
    NN1: { x: 225, y: 40, zone: 'out-of-zone' }, // Northampton
    NN4: { x: 245, y: 52, zone: 'out-of-zone' }, // Northampton South
    LU7: { x: 335, y: 272, zone: 'mk-outer' } // Leighton Buzzard
  }

  const matched = anchors[outcode]
  if (matched) {
    // Apply slight deterministic offset if multiple stops share an outcode
    const jitterX = isOrigin ? 0 : ((index * 23) % 28) - 14
    const jitterY = isOrigin ? 0 : ((index * 17) % 24) - 12
    return {
      x: Math.max(45, Math.min(555, matched.x + jitterX)),
      y: Math.max(35, Math.min(265, matched.y + jitterY)),
      label: address.split(',')[0]?.trim() || outcode,
      postcode: fullPostcode,
      zoneStatus: matched.zone
    }
  }

  // Fallback deterministic ring placement around MK9
  const angle = ((index + 1) * 1.15) % (Math.PI * 2)
  const radius = isOrigin ? 55 : 95 + (index % 3) * 28
  const isMK = outcode.startsWith('MK')
  return {
    x: Math.round(300 + Math.cos(angle) * radius),
    y: Math.round(150 + Math.sin(angle) * (radius * 0.65)),
    label: address.split(',')[0]?.trim() || 'MK Stop',
    postcode: fullPostcode,
    zoneStatus: isMK ? 'mk-core' : 'out-of-zone'
  }
}

export const MKRouteVisualizer: React.FC<MKRouteVisualizerProps> = ({
  routeId,
  pickupAddress,
  drops,
  completedIndices = [],
  selectedStopIndex = 0,
  onSelectStop,
  status = 'In Progress',
  compact = false,
  fullBleed = false
}) => {
  const effectiveOrigin = pickupAddress?.trim() || 'Kiln Farm Depot, Milton Keynes MK11'
  const effectiveDrops =
    drops && drops.length > 0 ? drops : ['14 Midsummer Blvd, Central Milton Keynes MK9 2EA']

  const originPt = projectAddressToMKGrid(effectiveOrigin, 0, true)
  const dropPts = effectiveDrops.map((d, idx) => projectAddressToMKGrid(d, idx + 1, false))
  const allPts = [originPt, ...dropPts]

  // Build smooth SVG path connecting Origin -> Drop 1 -> Drop 2 ...
  const polylinePoints = allPts.map((p) => `${p.x},${p.y}`).join(' ')

  // Build multi-stop Google Maps Turn-by-Turn URL
  const originEncoded = encodeURIComponent(effectiveOrigin)
  const destinationAddr = effectiveDrops[effectiveDrops.length - 1] || effectiveOrigin
  const destinationEncoded = encodeURIComponent(destinationAddr)
  const intermediateStops = effectiveDrops.slice(0, -1)
  const waypointsParam =
    intermediateStops.length > 0
      ? `&waypoints=${encodeURIComponent(intermediateStops.join('|'))}`
      : ''
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originEncoded}&destination=${destinationEncoded}${waypointsParam}&travelmode=driving`

  const completedSet = new Set(completedIndices)

  return (
    <div
      className={
        fullBleed
          ? 'w-full h-full bg-[#090D16] overflow-hidden'
          : 'bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-md'
      }
    >
      {/* TOP TELEMETRY BAR */}
      {!fullBleed && (
        <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F6EB61] shadow-[0_0_10px_#F6EB61] animate-pulse" />
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-200">
              Hub 01 (M1 Corridor) Spatial Telemetry {routeId ? `• Loop #${routeId}` : ''}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEFCE8] text-[#713F12] border border-[#F6EB61]/60 tabular-nums">
              {effectiveDrops.length} Stop{effectiveDrops.length === 1 ? '' : 's'} • {status}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Depot Origin
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#F6EB61] inline-block" /> Active Stop
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Completed
            </span>
          </div>
        </div>
      )}

      {/* INTERACTIVE SVG MK GRID MAP */}
      <div className={`relative w-full ${fullBleed ? 'h-full' : ''} bg-[#090D16] select-none`}>
        <svg
          viewBox="0 0 600 300"
          preserveAspectRatio={fullBleed ? 'xMidYMid slice' : undefined}
          className={`w-full ${fullBleed ? 'h-full' : compact ? 'h-52' : 'h-64 sm:h-72'} block`}
          role="img"
          aria-label="Milton Keynes Interactive Route Map"
        >
          <defs>
            <radialGradient id="mkRadarGlow" cx="50%" cy="48%" r="50%">
              <stop offset="0%" stopColor="#004225" stopOpacity="0.28" />
              <stop offset="65%" stopColor="#005A34" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#090D16" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="routeSplineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F6EB61" />
              <stop offset="55%" stopColor="#F6EB61" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>

          {/* MK9 35-Mile Catchment Radar Background */}
          <rect width="600" height="300" fill="url(#mkRadarGlow)" />

          {/* Milton Keynes H1-H10 & V1-V11 Grid Roads */}
          {[50, 100, 150, 200, 250].map((y, i) => (
            <g key={`h-${y}`}>
              <line
                x1="0"
                y1={y}
                x2="600"
                y2={y}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeWidth={y === 150 ? '1.5' : '1'}
                strokeDasharray={y === 150 ? undefined : '4 4'}
              />
              <text
                x="10"
                y={y - 4}
                fill="rgba(148, 163, 184, 0.35)"
                fontSize="8"
                fontWeight="700"
                fontFamily="monospace"
              >
                H{i * 2 + 2} GRID
              </text>
            </g>
          ))}

          {[90, 195, 300, 405, 510].map((x, i) => (
            <g key={`v-${x}`}>
              <line
                x1={x}
                y1="0"
                x2={x}
                y2="300"
                stroke="rgba(148, 163, 184, 0.12)"
                strokeWidth={x === 300 ? '1.5' : '1'}
                strokeDasharray={x === 300 ? undefined : '4 4'}
              />
              <text
                x={x + 4}
                y="14"
                fill="rgba(148, 163, 184, 0.35)"
                fontSize="8"
                fontWeight="700"
                fontFamily="monospace"
              >
                V{i * 2 + 3}
              </text>
            </g>
          ))}

          {/* M1 Motorway Corridor & A5 Trunk Diagonal */}
          <path
            d="M 445 0 Q 395 145 480 300"
            fill="none"
            stroke="rgba(59, 130, 246, 0.22)"
            strokeWidth="3"
          />
          <text x="452" y="28" fill="rgba(96, 165, 250, 0.5)" fontSize="8" fontWeight="800">
            M1 J14
          </text>
          <path
            d="M 135 0 L 345 300"
            fill="none"
            stroke="rgba(16, 185, 129, 0.16)"
            strokeWidth="2.5"
          />
          <text x="155" y="28" fill="rgba(52, 211, 153, 0.45)" fontSize="8" fontWeight="800">
            A5 TRUNK
          </text>

          {/* MK9 35-Mile Guardrail Ring */}
          <ellipse
            cx="300"
            cy="150"
            rx="235"
            ry="122"
            fill="none"
            stroke="rgba(0, 245, 212, 0.18)"
            strokeWidth="1.2"
            strokeDasharray="6 4"
          />
          <text
            x="300"
            y="286"
            textAnchor="middle"
            fill="rgba(0, 245, 212, 0.55)"
            fontSize="8.5"
            fontWeight="700"
          >
            MK9 35-MILE FAIR-USE CATCHMENT RING
          </text>

          {/* Route Spline Shadow */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="rgba(246, 235, 97, 0.22)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Animated Route Spline */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="url(#routeSplineGrad)"
            strokeWidth="3"
            strokeDasharray="8 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="26"
              to="0"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </polyline>

          {/* ORIGIN DEPOT PIN */}
          <g transform={`translate(${originPt.x}, ${originPt.y})`}>
            <circle r="13" fill="rgba(245, 158, 11, 0.22)" />
            <circle r="7.5" fill="#F59E0B" stroke="#090D16" strokeWidth="2" />
            <rect
              x="-54"
              y="-30"
              width="108"
              height="17"
              rx="4"
              fill="#0F172A"
              stroke="#F59E0B"
              strokeWidth="1"
            />
            <text
              x="0"
              y="-19"
              textAnchor="middle"
              fill="#FDE68A"
              fontSize="8.5"
              fontWeight="800"
            >
              DEPOT: {originPt.postcode}
            </text>
          </g>

          {/* DESTINATION DROP PINS */}
          {dropPts.map((pt, idx) => {
            const isDone = completedSet.has(idx) || status === 'Completed' || status === 'delivered'
            const isSelected = selectedStopIndex === idx
            const pinColor = isDone ? '#10B981' : isSelected ? '#F6EB61' : '#38BDF8'
            return (
              <g
                key={idx}
                transform={`translate(${pt.x}, ${pt.y})`}
                onClick={() => onSelectStop && onSelectStop(idx)}
                style={{ cursor: onSelectStop ? 'pointer' : 'default' }}
              >
                {isSelected && (
                  <circle r="16" fill="rgba(246, 235, 97, 0.25)">
                    <animate
                      attributeName="r"
                      values="12;19;12"
                      dur="1.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  r="9.5"
                  fill={pinColor}
                  stroke="#090D16"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#090D16"
                  fontSize="9.5"
                  fontWeight="900"
                >
                  {isDone ? 'OK' : idx + 1}
                </text>
                <rect
                  x="-58"
                  y="13"
                  width="116"
                  height="17"
                  rx="4"
                  fill={isSelected ? '#0F172A' : 'rgba(15, 23, 42, 0.88)'}
                  stroke={pinColor}
                  strokeWidth={isSelected ? '1.2' : '0.8'}
                />
                <text
                  x="0"
                  y="24"
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  #{idx + 1} {pt.label.slice(0, 15)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* BOTTOM ACTION & TURN-BY-TURN HANDOFF BAR */}
      {!fullBleed && (
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-300 truncate">
            <span className="font-extrabold text-[#00F5D4]">Origin:</span> {effectiveOrigin}{' '}
            <span className="text-slate-500 mx-1">→</span>
            <span className="font-extrabold text-emerald-400">
              Stop #{Math.min(selectedStopIndex + 1, effectiveDrops.length)}:
            </span>{' '}
            {effectiveDrops[selectedStopIndex] || effectiveDrops[0]}
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#004225] hover:bg-[#005A34] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
          >
            <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Launch Turn-by-Turn in Google Maps</span>
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </a>
        </div>
      )}
    </div>
  )
}
