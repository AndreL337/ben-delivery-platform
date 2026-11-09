import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../../config/supabaseClient'
import { parseManifestDrops } from '../../config/pricingMatrix2026'

export type RoutingMode = 'clear_bulk_first' | 'out_and_back' | 'tightest_loop'
export type VanLoadZone =
  | 'Zone A (Bulkhead — Load First / Drop Last)'
  | 'Zone B (Mid-Deck Forward)'
  | 'Zone C (Mid-Deck Rear)'
  | 'Zone D (Tail-Lift — Load Last / Drop First)'

export interface RoutedManifestStop {
  stopId: string           // Immutable ID ('stop-0', 'stop-1', ...) so re-ordering never loses completion state
  originalIndex: number
  deliverySequence: number // 1..N (1 = first delivery off the van)
  address: string
  postcode: string
  estimatedCubeM3: number  // Used by Mode A ("Clear the Bulk First")
  distanceFromDepotKm: number
  distanceFromHomeKm: number
  lifoLoadSequence: number // 1..N (1 = first item loaded into Zone A Bulkhead)
  vanZone: VanLoadZone
  blackbookAlerts: BlackbookHazard[]
}

export interface BlackbookHazard {
  id: string
  postcode_key: string
  hazard_type: string
  hazard_note: string
  avoid_window_start?: string
  avoid_window_end?: string
  shutter_close_time?: string
}

// Approximate MK outcode coordinates (km relative to MK9 Central) for instant client-side sequencing
const MK_COORDS_KM: Record<string, { x: number; y: number }> = {
  MK9: { x: 0, y: 0 },
  MK11: { x: -4.5, y: 2.2 },
  MK12: { x: -3.2, y: 3.5 },
  MK8: { x: -3.0, y: 0.5 },
  MK5: { x: -2.5, y: -2.0 },
  MK6: { x: 0.8, y: -1.8 },
  MK1: { x: 0.5, y: -5.5 },
  MK2: { x: -0.5, y: -6.0 },
  MK3: { x: -2.2, y: -5.5 },
  MK4: { x: -3.4, y: -4.2 },
  MK7: { x: 3.2, y: -3.6 },
  MK10: { x: 4.2, y: -0.5 },
  MK13: { x: -1.5, y: 2.5 },
  MK14: { x: 0.8, y: 3.0 },
  MK15: { x: 3.2, y: 2.0 },
  MK16: { x: 4.5, y: 5.8 },
  MK17: { x: 6.5, y: -5.2 },
  MK18: { x: -15.0, y: -2.0 },
  MK19: { x: -9.0, y: 7.0 },
  NN1: { x: -8.0, y: 22.0 },
  NN4: { x: -6.5, y: 18.0 },
  MK40: { x: 24.0, y: -3.0 }
}

function extractOutcode(addr: string): string {
  const m = addr.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})?\b/)
  return m ? m[1] : 'MK9'
}

function extractFullPostcode(addr: string): string {
  const m = addr.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/)
  return m ? m[1].replace(/\s+/g, ' ') : extractOutcode(addr)
}

function estimateBulkyCubeM3(addr: string, idx: number): number {
  const lower = addr.toLowerCase()
  if (/corner\s*sofa|wardrobe|range\s*cooker|american\s*fridge|marble/i.test(lower)) return 3.8
  if (/sofa|bed|dining|table/i.test(lower)) return 2.4
  // Deterministic fallback so stops have distinct bulk weights if item metadata isn't attached
  return Number((1.5 + ((idx * 7) % 5) * 0.45).toFixed(2))
}

function distKm(a: string, b: string): number {
  const ca = MK_COORDS_KM[extractOutcode(a)] || { x: 0, y: 0 }
  const cb = MK_COORDS_KM[extractOutcode(b)] || { x: 0, y: 0 }
  return Number(Math.hypot(ca.x - cb.x, ca.y - cb.y).toFixed(1))
}

function assignLifoZone(deliverySeq: number, totalStops: number): VanLoadZone {
  const ratio = deliverySeq / Math.max(1, totalStops)
  // First drops (ratio <= 0.25) go last onto the van at Zone D (Tail-Lift)
  if (ratio <= 0.25) return 'Zone D (Tail-Lift — Load Last / Drop First)'
  if (ratio <= 0.5) return 'Zone C (Mid-Deck Rear)'
  if (ratio <= 0.75) return 'Zone B (Mid-Deck Forward)'
  // Final drops (ratio > 0.75) are loaded first deep against Zone A (Bulkhead)
  return 'Zone A (Bulkhead — Load First / Drop Last)'
}

export function useDriverRoutingEngine(activeJob: any | null) {
  const [routingMode, setRoutingMode] = useState<RoutingMode>(
    activeJob?.routing_mode || 'tightest_loop'
  )
  const [routeInverted, setRouteInverted] = useState<boolean>(
    Boolean(activeJob?.route_inverted)
  )
  const [driverHomePostcode, setDriverHomePostcode] = useState<string>(
    activeJob?.driver_home_postcode || 'MK9'
  )
  const [blackbookMap, setBlackbookMap] = useState<Record<string, BlackbookHazard[]>>({})
  const [syncingRoute, setSyncingRoute] = useState<boolean>(false)

  useEffect(() => {
    if (!activeJob) return
    if (activeJob.routing_mode) setRoutingMode(activeJob.routing_mode)
    if (typeof activeJob.route_inverted === 'boolean') setRouteInverted(activeJob.route_inverted)
    if (activeJob.driver_home_postcode) setDriverHomePostcode(activeJob.driver_home_postcode)
  }, [activeJob?.id])

  // Hydrate Street-Sense Black-Book notes for all postcodes on the active manifest
  useEffect(() => {
    if (!activeJob?.drop_addresses) return
    const rawDrops = parseManifestDrops(activeJob.drop_addresses)
    const keys = Array.from(
      new Set(
        rawDrops.flatMap((d) => [extractFullPostcode(d), extractOutcode(d)])
      )
    )
    if (keys.length === 0) return

    supabase
      .from('location_blackbook')
      .select('*')
      .in('postcode_key', keys)
      .then(({ data }) => {
        if (!data) return
        const grouped: Record<string, BlackbookHazard[]> = {}
        for (const row of data as BlackbookHazard[]) {
          grouped[row.postcode_key] = [...(grouped[row.postcode_key] || []), row]
        }
        setBlackbookMap(grouped)
      })
  }, [activeJob?.id, activeJob?.drop_addresses])

  // Compute sequenced manifest & automatic Reverse-Load (LIFO) sheet
  const { sequencedStops, lifoLoadSheet } = useMemo(() => {
    const rawDrops = parseManifestDrops(activeJob?.drop_addresses)
    const pickup = activeJob?.pickup_address || 'MK11'

    const baseStops = rawDrops.map((addr, idx) => {
      const fullPc = extractFullPostcode(addr)
      const outcode = extractOutcode(addr)
      const hazards = [
        ...(blackbookMap[fullPc] || []),
        ...(fullPc !== outcode ? blackbookMap[outcode] || [] : [])
      ]
      return {
        stopId: `stop-${idx}`,
        originalIndex: idx,
        address: addr,
        postcode: fullPc,
        estimatedCubeM3: estimateBulkyCubeM3(addr, idx),
        distanceFromDepotKm: distKm(pickup, addr),
        distanceFromHomeKm: distKm(driverHomePostcode, addr),
        blackbookAlerts: hazards
      }
    })

    // 1. Apply 3-Mode Sequencing Strategy
    const ordered = [...baseStops]
    if (routingMode === 'clear_bulk_first') {
      // Mode A: Largest volume items first to clear van floor space early
      ordered.sort((a, b) => b.estimatedCubeM3 - a.estimatedCubeM3)
    } else if (routingMode === 'out_and_back') {
      // Mode B: Start furthest from driver's home postcode, finish nearest to home postcode
      ordered.sort((a, b) => b.distanceFromHomeKm - a.distanceFromHomeKm)
    } else {
      // Mode C: Tightest Loop (Nearest-neighbor progression from Depot Origin)
      ordered.sort((a, b) => a.distanceFromDepotKm - b.distanceFromDepotKm)
    }

    // 2. Apply 1-Tap Invert Route toggle (if pre-load is not yet locked)
    if (routeInverted) {
      ordered.reverse()
    }

    // 3. Stamp Delivery Sequence (1..N) & Reverse-Load LIFO Sequence (N..1)
    const total = ordered.length
    const finalStops: RoutedManifestStop[] = ordered.map((stop, idx) => {
      const deliverySequence = idx + 1
      const lifoLoadSequence = total - idx // Last drop (#N) is Loaded #1 into Zone A (Bulkhead)
      return {
        ...stop,
        deliverySequence,
        lifoLoadSequence,
        vanZone: assignLifoZone(deliverySequence, total)
      }
    })

    // 4. LIFO Load Sheet sorted by loading order (1 = Load First into Zone A Bulkhead -> N = Load Last onto Tail-Lift)
    const lifoSheet = [...finalStops].sort((a, b) => a.lifoLoadSequence - b.lifoLoadSequence)

    return { sequencedStops: finalStops, lifoLoadSheet: lifoSheet }
  }, [activeJob?.drop_addresses, activeJob?.pickup_address, routingMode, routeInverted, driverHomePostcode, blackbookMap])

  // Persist selected routing mode & LIFO load plan to `public.jobs`
  const persistRoutingPlan = useCallback(
    async (nextMode: RoutingMode, nextInverted: boolean, nextHomePc: string) => {
      if (!activeJob?.id) return
      setSyncingRoute(true)
      await supabase
        .from('jobs')
        .update({
          routing_mode: nextMode,
          route_inverted: nextInverted,
          driver_home_postcode: nextHomePc,
          ordered_manifest_json: sequencedStops.map((s) => ({
            stopId: s.stopId,
            originalIndex: s.originalIndex,
            deliverySequence: s.deliverySequence,
            address: s.address,
            postcode: s.postcode
          })),
          lifo_load_plan_json: lifoLoadSheet.map((s) => ({
            lifoLoadSequence: s.lifoLoadSequence,
            deliverySequence: s.deliverySequence,
            vanZone: s.vanZone,
            address: s.address
          }))
        })
        .eq('id', activeJob.id)
      setSyncingRoute(false)
    },
    [activeJob?.id, sequencedStops, lifoLoadSheet]
  )

  // Add a persistent Crew Black-Book hazard note from the cab
  const addBlackbookHazard = useCallback(
    async (
      postcodeKey: string,
      hazardType: BlackbookHazard['hazard_type'],
      hazardNote: string,
      avoidWindowStart?: string,
      avoidWindowEnd?: string
    ) => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      const normalizedKey = postcodeKey.toUpperCase().trim()
      const { data, error } = await supabase
        .from('location_blackbook')
        .insert([
          {
            postcode_key: normalizedKey,
            created_by: session.user.id,
            hazard_type: hazardType,
            hazard_note: hazardNote.trim(),
            avoid_window_start: avoidWindowStart || null,
            avoid_window_end: avoidWindowEnd || null
          }
        ])
        .select()

      if (!error && data?.[0]) {
        const created = data[0] as BlackbookHazard
        setBlackbookMap((prev) => ({
          ...prev,
          [normalizedKey]: [...(prev[normalizedKey] || []), created]
        }))
      }
    },
    []
  )

  return {
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
  }
}
