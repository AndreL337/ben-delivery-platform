import type { VehicleSetup, LoopProfile, PricingTier, AgentEventItem } from '../types/logistics'

// 2026 Calibrated Operational Pricing Matrix (12.5% Platform Fee / 87.5% Crew Net Pool)
export const PRICING_MATRIX: Record<VehicleSetup, Record<LoopProfile, PricingTier>> = {
  independent: {
    roc: {
      label: 'Mercedes Sprinter LWB / 3.5t (2-Man) — Standard ROC',
      grossFee: 440,
      platformFee: 55,
      netPool: 385,
      targetVolume: '12–16 Drops (≤9 hrs)',
      maxDrops: 16,
      shiftCap: '≤9 hrs • Hub 01 (M1 Corridor)'
    },
    assembly: {
      label: 'Mercedes Sprinter LWB / 3.5t (2-Man) — Delivery & Assembly',
      grossFee: 520,
      platformFee: 65,
      netPool: 455,
      targetVolume: '5–8 Drops (≤9 hrs)',
      maxDrops: 8,
      shiftCap: '≤9 hrs • Hub 01 (M1 Corridor)'
    },
    overflow: {
      label: 'Mercedes Sprinter LWB Multi-Drop / Overflow Loop (1–4 Drops)',
      grossFee: 145,
      platformFee: 18.13,
      netPool: 126.87,
      targetVolume: '1–4 Drops (≤3.5 hrs)',
      maxDrops: 4,
      shiftCap: '≤3.5 hrs • Hub 01 (M1 Corridor)'
    }
  },
  clientVehicle: {
    roc: {
      label: 'Client Vehicle (2-Man Labour Pod) — Standard ROC',
      grossFee: 350,
      platformFee: 43.75,
      netPool: 306.25,
      targetVolume: '12–16 Drops (≤9 hrs)',
      maxDrops: 16,
      shiftCap: '≤9 hrs • Hub 01 (M1 Corridor)'
    },
    assembly: {
      label: 'Client Vehicle (2-Man Labour Pod) — Delivery & Assembly',
      grossFee: 410,
      platformFee: 51.25,
      netPool: 358.75,
      targetVolume: '5–8 Drops (≤9 hrs)',
      maxDrops: 8,
      shiftCap: '≤9 hrs • Hub 01 (M1 Corridor)'
    },
    overflow: {
      label: 'Half-Day / Overflow Pilot Loop (1–4 Drops)',
      grossFee: 145,
      platformFee: 18.13,
      netPool: 126.87,
      targetVolume: '1–4 Drops (≤3.5 hrs)',
      maxDrops: 4,
      shiftCap: '≤3.5 hrs • Hub 01 (M1 Corridor)'
    }
  }
}

export const DEFAULT_AGENT_EVENTS: AgentEventItem[] = [
  {
    id: 'evt-supply-01',
    agent_name: 'Supply & Compliance Agent',
    event_type: 'CREW_INSURANCE_AUDIT',
    summary:
      'Verified MK Luton 2-Man Crew (Dave & Marcus): £50,000 GIT + £2,000,000 Public Liability (Porter extension active) + DVLA & Gate A6 Right of Substitution signed.',
    payload_meta: 'Luton 3.5t Tail-Lift • Policy #AXA-MK-99412 • IR35 Outside Verified',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString()
  },
  {
    id: 'evt-demand-02',
    agent_name: 'Demand SDR Agent',
    event_type: 'RETAILER_PILOT_QUALIFIED',
    summary:
      'Milton Keynes Bletchley Sofa & Oak Showroom enrolled in "Pay on Success" Pilot: 3x routes within 14-day window (£520/day Assembly | £0.00 if unverified PoD).',
    payload_meta: 'Pay-on-Success Pilot • Zero Unhedged Subsidy • MK9 Catchment',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 32).toISOString()
  },
  {
    id: 'evt-guardrail-03',
    agent_name: 'Dispatch Guardrail Agent',
    event_type: 'FAIR_USE_SURCHARGE_FLAG',
    summary:
      'Flagged Route #MK-409: Drop #7 in Northampton NN4 is 4 miles beyond the 35-mile MK9 radius cap, plus 3rd-floor walk-up without lift.',
    payload_meta: 'Auto-calculated +£8.80 mileage (£2.20/mi) + £25.00 Heavy-Access Fee (100% to crew)',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString()
  },
  {
    id: 'evt-settlement-04',
    agent_name: 'PoD & Settlement Agent',
    event_type: 'ESCROW_RELEASE_READY',
    summary:
      '48-hour post-PoD dispute window cleared with zero damage claims on Route #MK-392 (Independent ROC Loop). Ready to release £385.00 net crew payout.',
    payload_meta: 'Gross: £440.00 • Ben Fee (12.5%): £55.00 • Crew Net (87.5%): £385.00',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString()
  }
]

// Helper to parse multi-drop manifest safely without breaking single UK addresses containing commas
export function parseManifestDrops(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean)
  }
  const str = String(raw).trim()
  if (!str) return []
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean)
      }
    } catch {
      // Fall through to delimiter parsing
    }
  }
  // If user entered newline-separated or semicolon-separated drops, split on those first
  if (str.includes('\n') || str.includes(';')) {
    return str
      .split(/[\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  // Keep a single-line UK address (which naturally contains commas) intact as 1 drop
  return [str]
}
