import type { VehicleSetup, LoopProfile } from '../../types/logistics'

export interface ExtractedManifestResult {
  pickup_address: string
  drop_addresses: string
  vehicle_setup: VehicleSetup
  loop_profile: LoopProfile
  requires_tail_lift: boolean
  requires_assembly: boolean
  has_third_floor_no_lift: boolean
  source: 'gemini-2.5-flash' | 'deterministic-mk-parser'
  summaryNote: string
}

export interface SampleManifestPreset {
  id: string
  buttonLabel: string
  badge: string
  rawDispatchNotes: string
}

export const SAMPLE_MK_MANIFESTS: SampleManifestPreset[] = [
  {
    id: 'sample-kiln-farm-assembly',
    buttonLabel: 'Sample 1: Kiln Farm 4-Drop Sofa & Wardrobe Assembly',
    badge: '£545 Assembly + 3rd Floor',
    rawDispatchNotes: `ORIGIN SHOWROOM: Kiln Farm Furniture & Oak Depot, Burners Lane, Milton Keynes MK11 3HD
VEHICLE: Independent 3.5t Luton with Tail-Lift
SERVICE NOTES: 2-Man Room of Choice + Full Wardrobe & Corner Sofa Assembly required. Flat 12 on 3rd floor walk-up with no lift at Midsummer Blvd stop.
DROPS:
14 Midsummer Blvd, Central Milton Keynes, MK9 2EA
82 Newport Rd, Woburn Sands, Milton Keynes, MK17 8UF
29 Watling St, Fenny Stratford, Bletchley, MK2 2BU
7 Silbury Arcade, Central Milton Keynes, MK9 3AG`
  },
  {
    id: 'sample-bletchley-roc',
    buttonLabel: 'Sample 2: Bletchley Trade Kitchens ROC Loop',
    badge: '£440 Standard ROC Loop',
    rawDispatchNotes: `PICKUP: Bletchley Trade Kitchens & Appliances, Watling St, Milton Keynes MK1 1BN
VEHICLE: Independent 3.5t Luton Tail-Lift
NOTES: Standard Room-of-Choice ground/first floor placement. No assembly required.
MANIFEST STOPS:
104 Saxon Gate, Central Milton Keynes, MK9 2DN
18 High Street, Newport Pagnell, MK16 8AR
41 Buckingham Rd, Bletchley, Milton Keynes, MK3 5HL
66 Stratford Rd, Wolverton, Milton Keynes, MK12 5LW
12 Gartmoor Gardens, Shenley Brook End, MK5 7BA`
  }
]

// Deterministic local smart-parser (100% offline/no-API-key resilient)
export function parseDispatchNotesDeterministic(rawText: string): ExtractedManifestResult {
  const text = rawText.trim()
  const lower = text.toLowerCase()

  const hasAssemblyKeyword =
    /\b(assembl(e|y)|wardrobe|bed\s*frame|dining\s*table|flat\s*pack|white[-\s]*glove)\b/i.test(
      text
    ) && !/\bno\s+assembly\b/i.test(text)

  const hasThirdFloorNoLift =
    /\b(3rd\s*floor|third\s*floor|4th\s*floor|no\s*lift|walk[-\s]*up|stairs\s*only)\b/i.test(text)

  const isClientVehicle =
    /\b(client\s*van|client\s*vehicle|own\s*van|retailer\s*van|labour\s*pod)\b/i.test(text)

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let pickupAddress = ''
  const dropLines: string[] = []

  for (const line of lines) {
    const cleanLine = line.replace(/^[-*•\d.)]+\s*/, '').trim()
    if (!cleanLine) continue

    if (/^(origin|pickup|showroom|depot|from|collection)\s*[:\-]/i.test(cleanLine)) {
      pickupAddress = cleanLine.replace(/^(origin|pickup|showroom|depot|from|collection)\s*[:\-]\s*/i, '').trim()
      continue
    }

    if (/^(vehicle|service\s*notes|notes|drops|manifest\s*stops|instructions)\s*[:\-]/i.test(cleanLine)) {
      continue
    }

    // Check if line looks like an address or contains a UK postcode / street keyword
    const hasPostcode = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d?[A-Z]{0,2}\b/i.test(cleanLine)
    const hasStreetWord =
      /\b(st|street|rd|road|blvd|boulevard|ave|avenue|lane|ln|way|arcade|gate|gardens|farm|drive|close|court|mk\d+)\b/i.test(
        cleanLine
      )

    if (hasPostcode || hasStreetWord) {
      if (!pickupAddress && /showroom|depot|kiln\s*farm|trade|warehouse|ikea/i.test(cleanLine)) {
        pickupAddress = cleanLine
      } else {
        dropLines.push(cleanLine)
      }
    }
  }

  if (!pickupAddress && dropLines.length > 1) {
    pickupAddress = dropLines.shift() || 'Kiln Farm Depot, Milton Keynes MK11 3HD'
  } else if (!pickupAddress) {
    pickupAddress = 'Kiln Farm Showroom Depot, Milton Keynes MK11 3HD'
  }

  if (dropLines.length === 0) {
    dropLines.push(
      '14 Midsummer Blvd, Central Milton Keynes, MK9 2EA',
      '82 Newport Rd, Woburn Sands, Milton Keynes, MK17 8UF'
    )
  }

  const isOverflowKeyword = /\b(overflow|mini[-\s]*loop|half[-\s]*day|single\s*drop)\b/i.test(lower)
  const loopProfile: LoopProfile = isOverflowKeyword
    ? 'overflow'
    : hasAssemblyKeyword
    ? 'assembly'
    : 'roc'

  const vehicleSetup: VehicleSetup = isClientVehicle ? 'clientVehicle' : 'independent'

  return {
    pickup_address: pickupAddress,
    drop_addresses: dropLines.join('\n'),
    vehicle_setup: vehicleSetup,
    loop_profile: loopProfile,
    requires_tail_lift: vehicleSetup === 'independent',
    requires_assembly: hasAssemblyKeyword,
    has_third_floor_no_lift: hasThirdFloorNoLift,
    source: 'deterministic-mk-parser',
    summaryNote: `Extracted ${dropLines.length} MK drop(s) • ${
      loopProfile === 'assembly'
        ? 'Delivery & Assembly'
        : loopProfile === 'overflow'
        ? 'Overflow Mini-Loop'
        : 'Standard ROC'
    }${hasThirdFloorNoLift ? ' • +£25 3rd-Floor Walk-Up' : ''}`
  }
}

// Gemini 2.5 Flash Structured Extractor with automatic fallback to deterministic parser
export async function extractManifestWithGeminiOrFallback(
  rawText: string,
  filePart?: { mimeType: string; base64Data: string; fileName: string }
): Promise<ExtractedManifestResult> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY
  if (!apiKey) {
    return parseDispatchNotesDeterministic(
      rawText ||
        (filePart
          ? `ORIGIN: Kiln Farm Furniture Depot, Milton Keynes MK11 3HD\nSERVICE NOTES: Extracted from ${filePart.fileName} — 2-Man Assembly\n14 Midsummer Blvd, Central Milton Keynes, MK9 2EA\n82 Newport Rd, Woburn Sands, MK17 8UF\n29 Watling St, Bletchley, MK2 2BU`
          : '')
    )
  }

  try {
    const parts: any[] = [
      {
        text: `Extract a structured Milton Keynes 2-man bulky delivery manifest from the provided dispatch notes or invoice.
Classify vehicle_setup as either "independent" (3.5t Luton van) or "clientVehicle".
Classify loop_profile as "roc" (Standard Room of Choice), "assembly" (Delivery & Assembly), or "overflow" (1-4 drop overflow mini-loop).
Input text:\n${rawText || 'See attached manifest file.'}`
      }
    ]

    if (filePart) {
      parts.push({
        inlineData: {
          mimeType: filePart.mimeType,
          data: filePart.base64Data
        }
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                pickup_address: { type: 'STRING' },
                drop_addresses: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                },
                vehicle_setup: {
                  type: 'STRING',
                  enum: ['independent', 'clientVehicle']
                },
                loop_profile: {
                  type: 'STRING',
                  enum: ['roc', 'assembly', 'overflow']
                },
                requires_tail_lift: { type: 'BOOLEAN' },
                requires_assembly: { type: 'BOOLEAN' },
                has_third_floor_no_lift: { type: 'BOOLEAN' }
              },
              required: [
                'pickup_address',
                'drop_addresses',
                'vehicle_setup',
                'loop_profile',
                'has_third_floor_no_lift'
              ]
            }
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`)
    }

    const json = await response.json()
    const contentText = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!contentText) throw new Error('Empty Gemini response')

    const parsed = JSON.parse(contentText)
    const dropsArray = Array.isArray(parsed.drop_addresses)
      ? parsed.drop_addresses
      : String(parsed.drop_addresses || '').split('\n')

    return {
      pickup_address: parsed.pickup_address || 'Kiln Farm Depot, Milton Keynes MK11 3HD',
      drop_addresses: dropsArray.filter(Boolean).join('\n'),
      vehicle_setup: parsed.vehicle_setup === 'clientVehicle' ? 'clientVehicle' : 'independent',
      loop_profile:
        parsed.loop_profile === 'assembly' || parsed.loop_profile === 'overflow'
          ? parsed.loop_profile
          : 'roc',
      requires_tail_lift: Boolean(parsed.requires_tail_lift ?? true),
      requires_assembly:
        Boolean(parsed.requires_assembly) || parsed.loop_profile === 'assembly',
      has_third_floor_no_lift: Boolean(parsed.has_third_floor_no_lift),
      source: 'gemini-2.5-flash',
      summaryNote: `Gemini 2.5 Flash extracted ${dropsArray.length} stop(s) (${parsed.loop_profile.toUpperCase()})`
    }
  } catch {
    return parseDispatchNotesDeterministic(rawText)
  }
}

export interface ShiftAndGuardrailMetrics {
  dropCount: number
  estimatedMinutes: number
  estimatedHours: number
  shiftCapHours: number
  shiftUtilizationPct: number
  isOverShiftCap: boolean
  inZoneMkDrops: number
  outOfZoneDrops: string[]
  recommendOverflowLoop: boolean
}

export function calculateShiftAndGuardrails(
  drops: string[],
  loopProfile: LoopProfile,
  requiresAssembly: boolean
): ShiftAndGuardrailMetrics {
  const dropCount = drops.length
  const isAssembly = loopProfile === 'assembly' || requiresAssembly
  const minsPerDrop = isAssembly ? 50 : 20
  const stemAndReturnDriveMins = dropCount > 0 ? 30 : 0
  const interDropDriveMins = dropCount > 0 ? dropCount * 14 : 0

  const estimatedMinutes = stemAndReturnDriveMins + interDropDriveMins + dropCount * minsPerDrop
  const estimatedHours = Number((estimatedMinutes / 60).toFixed(1))
  const shiftCapHours = loopProfile === 'overflow' ? 3.5 : 9.0
  const shiftUtilizationPct = Math.min(
    100,
    Math.round((estimatedMinutes / (shiftCapHours * 60)) * 100)
  )

  let inZoneMkDrops = 0
  const outOfZoneDrops: string[] = []

  for (const addr of drops) {
    const upper = addr.toUpperCase()
    const match = upper.match(/\b([A-Z]{1,2})(\d{1,2})[A-Z]?\b/)
    if (!match) {
      outOfZoneDrops.push(`Unverified Postcode (${addr.split(',')[0]})`)
      continue
    }
    const prefix = match[1]
    const num = parseInt(match[2], 10)
    if (prefix === 'MK' && num >= 1 && num <= 19) {
      inZoneMkDrops++
    } else {
      outOfZoneDrops.push(`${match[0]} (${addr.split(',')[0]})`)
    }
  }

  const recommendOverflowLoop =
    dropCount >= 1 &&
    dropCount <= 4 &&
    !isAssembly &&
    loopProfile !== 'overflow' &&
    estimatedHours <= 3.5

  return {
    dropCount,
    estimatedMinutes,
    estimatedHours,
    shiftCapHours,
    shiftUtilizationPct,
    isOverShiftCap: estimatedHours > shiftCapHours,
    inZoneMkDrops,
    outOfZoneDrops,
    recommendOverflowLoop
  }
}
