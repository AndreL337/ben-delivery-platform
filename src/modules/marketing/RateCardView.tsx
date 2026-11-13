import React from 'react'
import { Printer, ArrowRight, Check, ShieldCheck, Truck } from 'lucide-react'
import { BenLogo } from '../../shared/components/BenLogo'

export interface RateCardViewProps {
  onNavigate?: (to: string) => void
}

const RATE_TIERS = [
  {
    code: 'Tier 01',
    tag: 'Core Multi-Drop Bulky',
    title: 'Standard Room-of-Choice (ROC)',
    price: '£440',
    unit: '/ day',
    summary:
      '2-Man Crew + 3.5t LWB/XLWB or Luton Van • 12–16 drops • ≤9 hrs shift cap. Includes LIFO van-bay loading, pre-load Condition Gate strapping verification, and room-of-choice placement up to 2nd-floor walk-up.',
    crewNet: '£385.00 (87.5%)',
    platformFee: '£55.00 (12.5%)'
  },
  {
    code: 'Tier 02',
    tag: 'Showroom Flagship',
    title: 'Delivery & Assembly (White-Glove)',
    price: '£520',
    unit: '/ day',
    summary:
      '2-Man Crew + 3.5t Van • 5–8 drops • ≤9 hrs shift cap. Full room-of-choice delivery, unboxing, bespoke furniture/bed/wardrobe light assembly, packaging removal, and Side-by-Side AI Damage-Shield PoD.',
    crewNet: '£455.00 (87.5%)',
    platformFee: '£65.00 (12.5%)'
  },
  {
    code: 'Tier 03',
    tag: 'Fleet-Ready Labour Pod',
    title: 'Client Vehicle (2-Man Labour Pod)',
    price: '£350 / £410',
    unit: 'ROC / Assembly',
    summary:
      'Vetted 2-Man Driver & Porter crew operating your showroom or warehouse liveried vehicle under your fleet insurance, equipped with the Ben In-Cab HUD, LIFO load sheet, and live customer tracking.',
    crewNet: '£306.25 ROC / £358.75 Assembly',
    platformFee: '12.5% OS Fee • ≤9 hrs Cap'
  },
  {
    code: 'Tier 04',
    tag: 'Rapid Trade & Urgent Dispatch',
    title: 'Overflow / Rescue Mini-Loop',
    price: '£145',
    unit: 'flat (≤3.5 hrs)',
    summary:
      '1–4 urgent drops within 20 miles, ≤3.5 hrs. Ideal for high-priority showroom customer rescues, trade counter overflow, or rapid inter-branch stock transfers with full photographic Proof of Delivery.',
    crewNet: '£126.87 (87.5%)',
    platformFee: '£18.13 (12.5%)'
  }
]

const FLEET_CLASSES = [
  {
    name: '1. LWB / XLWB High-Roof Panel Van (3.5t)',
    detail: 'Mercedes Sprinter, Ford Transit Jumbo, VW Crafter, Renault Master, Iveco Daily'
  },
  {
    name: '2. 3.5t Luton / Low-Loader Box Van (Tail-Lift)',
    detail: '2-Man Heavy Bulky & White-Glove Room-of-Choice'
  },
  {
    name: '3. MWB / Urban Commercial & EV Van',
    detail: 'Trade Counter & High-Density Multi-Drop'
  },
  {
    name: '4. 7.5t Box Truck (Tail-Lift)',
    detail: 'Heavy Commercial Trunking & High-Cube Consolidation'
  },
  {
    name: '5. On-Roster 2-Man Porter / Assembly Specialist',
    detail: 'Vetted Second Man / Client Vehicle Labour Pod'
  }
]

export const RateCardView: React.FC<RateCardViewProps> = ({ onNavigate }) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* ACTION TOOLBAR (HIDDEN IN PRINT VIA @media print / .no-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#004225] bg-[#F0F7F4] px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>2026 Enterprise Rate Card</span>
          </span>
          <span className="hidden sm:inline text-xs text-slate-500 font-medium">
            Printable A4 B2B Tariff &amp; 3-Route Showroom Pilot Specification
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/portal')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-all inline-flex items-center gap-1.5"
            >
              <span>Open Retailer Portal</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#004225] hover:bg-[#005A34] text-white shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" strokeWidth={1.75} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* SWISS-GRID / STRIPE ENTERPRISE PRICING SHEET */}
      <section className="bg-white ben-blueprint-grid border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* 1. HEADER */}
        <div className="px-6 sm:px-10 py-8 border-b border-slate-200/80 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <BenLogo variant="light" size="xl" />
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 tabular-nums">
                2026 UK B2B Rate Card • Rev 01
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Direct-to-Crew UK Logistics — Zero Broker Markups
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Connect commercial shippers straight to vetted 2-man delivery crews nationwide. Lock in transparent flat-rate loops across your UK supply chain with total clarity.
            </p>
          </div>

          <div className="bg-[#004225] text-white px-5 py-4 rounded-xl md:text-right shrink-0 tabular-nums">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F6EB61] block">
              Escrow Settlement Split
            </span>
            <div className="text-xl font-bold mt-0.5">87.5% Direct to Crew</div>
            <div className="text-xs text-emerald-100/90 mt-0.5">
              12.5% Platform OS Fee • Zero 3PL Margin Stacking
            </div>
          </div>
        </div>

        {/* 2. FLAT-RATE TARIFF MATRIX (SWISS-GRID HAIRLINE DIVIDERS) */}
        <div className="px-6 sm:px-10 py-8 border-b border-slate-200/80 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              1. 2026 Calibrated Flat-Rate B2B Loop Tariffs
            </h2>
            <span className="text-xs font-medium text-[#004225] tabular-nums">
              Hub 01 (MK • Bedford • Northampton • Luton) &amp; National UK Hubs
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border border-slate-200/80 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200/80 bg-white">
            {RATE_TIERS.map((tier, idx) => (
              <div
                key={tier.code}
                className={`p-6 flex flex-col justify-between space-y-4 tabular-nums ${
                  idx >= 2 ? 'md:border-t md:border-slate-200/80' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#004225] block">
                      {tier.code} • {tier.tag}
                    </span>
                    <h3 className="text-base font-bold text-slate-950 mt-1">{tier.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-bold text-slate-950">{tier.price}</span>
                    <span className="text-xs font-medium text-slate-500 block">{tier.unit}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{tier.summary}</p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Crew Net: {tier.crewNet}</span>
                  <span>Ben Fee: {tier.platformFee}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. INCLUSIVE FLEET TAXONOMY & FAIR-USE GUARDRAILS (2-COLUMN EDITORIAL SPLIT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 border-b border-slate-200/80">
          <div className="lg:col-span-7 px-6 sm:px-10 py-8 space-y-4">
            <div className="flex items-center gap-2 text-slate-950">
              <Truck className="w-4 h-4 text-[#004225]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                2. 5-Class Inclusive UK Commercial Fleet Taxonomy
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Make-and-model agnostic matching across vetted owner-operators holding verified Goods in Transit (£20k–£50k+), Public Liability (£1m+ covering 2-Man Crew), and Hire &amp; Reward cover:
            </p>
            <ul className="divide-y divide-slate-100 text-xs">
              {FLEET_CLASSES.map((fc) => (
                <li key={fc.name} className="py-2.5 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#004225] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div>
                    <span className="font-semibold text-slate-900">{fc.name}</span>
                    <span className="text-slate-500 block mt-0.5">{fc.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 px-6 sm:px-10 py-8 flex flex-col justify-between space-y-6 tabular-nums">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#004225]" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  3. Fair-Use Guardrails &amp; Surcharges
                </h3>
              </div>
              <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#004225] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>
                    <strong className="text-slate-900">Active Hub Radius:</strong> ≤35 miles included per full-day loop | <strong className="text-slate-900">£2.20 / mile</strong> beyond 35-mile zone.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#004225] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>
                    <strong className="text-slate-900">Heavy-Access Walk-Up:</strong> Ground, 1st &amp; 2nd floor included | <strong className="text-slate-900">+£25.00 flat</strong> for 3rd floor+ without lift (100% passed to crew).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#004225] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>
                    <strong className="text-slate-900">Payload &amp; Overtime Cap:</strong> ≤1,200 kg total / 110 kg max two-man single lift | <strong className="text-slate-900">£50.00 / hr</strong> overtime beyond 9 hrs.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#004225] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>
                    <strong className="text-slate-900">Instant Digital PoD:</strong> Side-by-side Pre-Load vs. Room-of-Choice photo verification + customer e-signature.
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-[#004225] block mb-0.5">
                Zero Disputed Damage Guarantee
              </span>
              48-hour escrow hold verifies pre-load strapping against delivery room-of-choice photo before settlement.
            </div>
          </div>
        </div>

        {/* 4. 3-ROUTE SHOWROOM PILOT CTA FOOTER */}
        <div className="bg-[#004225] ben-blueprint-grid-dark text-white px-6 sm:px-10 py-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#F6EB61]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F6EB61]" />
              <span>Risk-Free Commercial Onboarding • Hub 01 &amp; National UK</span>
            </span>
            <h3 className="text-xl font-bold text-white">
              The 3-Route &ldquo;Pay-on-Success&rdquo; Showroom Pilot
            </h3>
            <p className="text-xs text-emerald-100/90 leading-relaxed tabular-nums">
              Test Ben on your next <strong className="text-white">3 commercial or showroom delivery loops</strong> (within a 14-day pilot window). Billed <strong className="text-white">strictly upon verified photographic Proof of Delivery</strong> — £0.00 fee if a route fails due to crew or platform fault.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/portal')}
                className="no-print min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F6EB61] hover:bg-yellow-300 text-[#0A0F0D] text-xs font-bold inline-flex items-center justify-center gap-2 transition-all"
              >
                <span>Activate 3-Route Pilot</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            <div className="text-[11px] font-mono text-emerald-100/80 text-center tabular-nums">
              benlogistics.co.uk/portal • ops@benlogistics.co.uk
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RateCardView
