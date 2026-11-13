export type VehicleSetup = 'independent' | 'clientVehicle'
export type LoopProfile = 'roc' | 'assembly' | 'overflow'
export type TopNavTab = 'waitlist' | 'retailer' | 'driver' | 'tracking' | 'agents'
export type AppRoute = 'landing' | 'driver-waitlist' | 'portal' | 'cab' | 'track' | 'command' | 'rate-card'
export type ComplianceDocType = 'goods_in_transit' | 'public_liability' | 'hire_and_reward'
export type ComplianceStatus = 'Verified' | 'Pending Review' | 'Action Required'

export interface PricingTier {
  label: string
  grossFee: number
  platformFee: number
  netPool: number
  targetVolume: string
  maxDrops: number
  shiftCap: string
}

export interface AgentEventItem {
  id: string
  agent_name:
    | 'Supply & Compliance Agent'
    | 'Demand SDR Agent'
    | 'Dispatch Guardrail Agent'
    | 'PoD & Settlement Agent'
  event_type: string
  summary: string
  payload_meta: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface ComplianceCredentialItem {
  docType: ComplianceDocType
  title: string
  subtitle: string
  status: ComplianceStatus
  fileUrl?: string
  expiryDate?: string
  uploadedAt?: string
}

export interface JobRecord {
  id: string
  retailer_id?: string
  driver_id?: string
  pickup_address: string
  drop_addresses: string
  status: string
  vehicle_setup?: VehicleSetup
  loop_profile?: LoopProfile
  gross_fee?: number
  platform_fee?: number
  net_pool?: number
  requires_tail_lift?: boolean
  requires_assembly?: boolean
  has_third_floor_no_lift?: boolean
  heavy_access_surcharge?: number
  pre_load_inspected?: boolean
  completed_drops_json?: number[]
  pod_image_url?: string
  signature_svg?: string
  exception_notes?: string
  created_at: string
}
