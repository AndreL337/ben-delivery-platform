import React from 'react'
import { BenLogo } from '../../shared/components/BenLogo'

export interface RateCardViewProps {
  onNavigate?: (to: string) => void
}

export const RateCardView: React.FC<RateCardViewProps> = ({ onNavigate }) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* ACTION TOOLBAR (HIDDEN IN PRINT VIA @media print / .no-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#004225] bg-[#F0F7F4] border border-[#004225]/25 px-3 py-1 rounded-full">
            Google Pomelli Campaign 01 • Printable A4 Spec
          </span>
          <span className="hidden sm:inline text-xs text-slate-600 font-semibold">
            2026 Commercial B2B Rate Card &amp; 3-Route Showroom Pilot Sheet
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/portal')}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-extrabold bg-[#F8FAFC] hover:bg-slate-100 text-[#0A0F0D] border border-[#E2E8F0] transition-all"
            >
              🏢 Open Retailer Portal (/portal)
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-extrabold bg-[#004225] hover:bg-[#005A34] text-white shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>🖨️ Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE A4 B2B RATE CARD & PILOT SHEET (POMELLI CARD 2 & CARD 4 AESTHETIC) */}
      <section className="relative bg-[#FFFFFF] ben-blueprint-grid border-2 border-[#0A0F0D] rounded-2xl p-6 sm:p-10 shadow-md space-y-8">
        {/* VIEWFINDER CORNER MARKS: ┌ ┐ └ ┘ */}
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute top-3 left-3.5 font-mono text-lg font-extrabold text-[#004225] leading-none"
        >
          ┌
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute top-3 right-3.5 font-mono text-lg font-extrabold text-[#004225] leading-none"
        >
          ┐
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute bottom-3 left-3.5 font-mono text-lg font-extrabold text-[#004225] leading-none"
        >
          └
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute bottom-3 right-3.5 font-mono text-lg font-extrabold text-[#004225] leading-none"
        >
          ┘
        </span>

        {/* 1. EXECUTIVE RATE CARD HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-[#0A0F0D] pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <BenLogo variant="light" size="xl" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded bg-[#FEFCE8] text-[#713F12] border border-[#004225] tabular-nums">
                2026 UK B2B RATE CARD • REV 01
              </span>
            </div>
            <div className="ben-Accent-Bar" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0A0F0D] uppercase">
              Direct-to-Crew UK Logistics — Zero Broker Markups
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-2xl">
              Connect commercial shippers straight to vetted 2-man delivery crews nationwide. Lock in transparent flat-rate loops across your UK supply chain with total clarity.
            </p>
          </div>

          <div className="bg-[#004225] text-white p-4 rounded-xl border border-[#0A0F0D] md:text-right shrink-0 tabular-nums">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#F6EB61] block">
              Escrow Settlement Split
            </span>
            <div className="text-xl font-extrabold mt-0.5">87.5% Direct to Crew</div>
            <div className="text-[11px] text-emerald-100 mt-0.5">
              12.5% Platform OS Fee • Zero 3PL Margin Stacking
            </div>
          </div>
        </div>

        {/* 2. FOUR CORE 2026 FLAT-RATE LOOP TIERS (POMELLI OFFSET CARDS + TABULAR-NUMS) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="ben-Accent-Bar mb-1" />
              <h2 className="text-lg font-extrabold text-[#0A0F0D] uppercase tracking-tight">
                1. 2026 Calibrated Flat-Rate B2B Loop Tariffs
              </h2>
            </div>
            <span className="text-xs font-extrabold text-[#004225] tabular-nums">
              Hub 01 (MK • Bedford • Northampton • Luton) &amp; National UK Hubs
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 tabular-nums">
            {/* TIER 1: STANDARD ROOM-OF-CHOICE (ROC) */}
            <div className="ben-card-offset-green rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#004225] bg-[#F0F7F4] px-2 py-0.5 rounded border border-[#004225]/25">
                    Tier 01 • Core Multi-Drop Bulky
                  </span>
                  <h3 className="text-base font-extrabold text-[#0A0F0D] mt-1.5">
                    Standard Room-of-Choice (ROC)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-[#004225] tabular-nums">
                    £440
                  </span>
                  <span className="text-xs font-bold text-slate-600 block">/ day</span>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>2-Man Crew + 3.5t LWB/XLWB or Luton Van</strong> •{' '}
                <strong>12–16 drops</strong> • <strong>≤9 hrs</strong> shift cap. Includes LIFO van-bay loading, pre-load Condition Gate strapping verification, and room-of-choice placement up to 2nd-floor walk-up.
              </p>
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Net Crew Pool (87.5%): £385.00</span>
                <span>Ben OS Fee (12.5%): £55.00</span>
              </div>
            </div>

            {/* TIER 2: DELIVERY & ASSEMBLY (WHITE-GLOVE) */}
            <div className="ben-card-offset-yellow rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#713F12] bg-[#FEFCE8] px-2 py-0.5 rounded border border-[#004225]">
                    Tier 02 • Showroom Flagship
                  </span>
                  <h3 className="text-base font-extrabold text-[#0A0F0D] mt-1.5">
                    Delivery &amp; Assembly (White-Glove)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-[#0A0F0D] tabular-nums">
                    £520
                  </span>
                  <span className="text-xs font-bold text-slate-600 block">/ day</span>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>2-Man Crew + 3.5t Van</strong> • <strong>5–8 drops</strong> •{' '}
                <strong>≤9 hrs</strong> shift cap. Full room-of-choice delivery, unboxing, bespoke furniture/bed/wardrobe light assembly, packaging removal, and Side-by-Side AI Damage-Shield PoD.
              </p>
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Net Crew Pool (87.5%): £455.00</span>
                <span>Ben OS Fee (12.5%): £65.00</span>
              </div>
            </div>

            {/* TIER 3: CLIENT VEHICLE (2-MAN LABOUR POD) */}
            <div className="ben-card-offset-green rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#004225] bg-[#F0F7F4] px-2 py-0.5 rounded border border-[#004225]/25">
                    Tier 03 • Fleet-Ready Labour Pod
                  </span>
                  <h3 className="text-base font-extrabold text-[#0A0F0D] mt-1.5">
                    Client Vehicle (2-Man Labour Pod)
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-[#004225] tabular-nums">
                    £350 ROC / £410 Assembly
                  </span>
                  <span className="text-xs font-bold text-slate-600 block">per daily shift</span>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Vetted 2-Man Driver &amp; Porter crew operating your showroom or warehouse liveried vehicle under your fleet insurance, equipped with the Ben In-Cab HUD, LIFO load sheet, and live customer tracking.
              </p>
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Net Crew Pool: £306.25 (ROC) / £358.75 (Assembly)</span>
                <span>≤9 hrs Shift Cap</span>
              </div>
            </div>

            {/* TIER 4: OVERFLOW / RESCUE MINI-LOOP */}
            <div className="ben-card-offset-yellow rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#713F12] bg-[#FEFCE8] px-2 py-0.5 rounded border border-[#004225]">
                    Tier 04 • Rapid Trade &amp; Urgent Dispatch
                  </span>
                  <h3 className="text-base font-extrabold text-[#0A0F0D] mt-1.5">
                    Overflow / Rescue Mini-Loop
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-[#0A0F0D] tabular-nums">
                    £145 flat
                  </span>
                  <span className="text-xs font-bold text-slate-600 block">≤3.5 hrs</span>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>1–4 urgent drops within 20 miles, ≤3.5 hrs</strong>. Ideal for high-priority showroom customer rescues, trade counter overflow, or rapid inter-branch stock transfers with full photo PoD.
              </p>
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Net Crew Pool (87.5%): £126.87</span>
                <span>Ben OS Fee (12.5%): £18.13</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 5-CLASS INCLUSIVE UK FLEET STANDARD & GUARDRAILS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT 7 COLS: 5-CLASS INCLUSIVE UK FLEET TAXONOMY */}
          <div className="lg:col-span-7 ben-callout-left rounded-xl p-5 space-y-3">
            <div className="ben-Accent-Bar" />
            <h3 className="text-base font-extrabold text-[#0A0F0D] uppercase tracking-tight">
              2. 5-Class Inclusive UK Commercial Fleet Taxonomy
            </h3>
            <p className="text-xs text-slate-600">
              Make-and-model agnostic matching across independent UK owner-operators holding verified Goods in Transit (£20k–£50k+), Public Liability (£1m+ covering 2-Man Crew), and Hire &amp; Reward cover:
            </p>
            <ol className="text-xs text-[#0A0F0D] space-y-2 leading-relaxed tabular-nums">
              <li>
                <strong>1. LWB / XLWB High-Roof Panel Van (3.5t)</strong> —{' '}
                <span className="text-slate-600">
                  e.g., Mercedes Sprinter, Ford Transit Jumbo, VW Crafter, Renault Master, Iveco Daily
                </span>
              </li>
              <li>
                <strong>2. 3.5t Luton / Low-Loader Box Van (with Tail-Lift)</strong> —{' '}
                <span className="text-slate-600">
                  2-Man Heavy Bulky &amp; White-Glove Room-of-Choice
                </span>
              </li>
              <li>
                <strong>3. MWB / Urban Commercial &amp; EV Van</strong> —{' '}
                <span className="text-slate-600">
                  Trade Counter &amp; High-Density Multi-Drop
                </span>
              </li>
              <li>
                <strong>4. 7.5t Box Truck (with Tail-Lift)</strong> —{' '}
                <span className="text-slate-600">
                  Heavy Commercial Trunking &amp; High-Cube Consolidation
                </span>
              </li>
              <li>
                <strong>5. On-Roster 2-Man Porter / Assembly Specialist</strong> —{' '}
                <span className="text-slate-600">
                  Vetted Second Man / Client Vehicle Labour Pod
                </span>
              </li>
            </ol>
          </div>

          {/* RIGHT 5 COLS: FAIR-USE SLA & ACCESS SURCHARGES */}
          <div className="lg:col-span-5 ben-callout-left rounded-xl p-5 flex flex-col justify-between space-y-3 tabular-nums">
            <div className="space-y-2.5">
              <div className="ben-Accent-Bar" />
              <h3 className="text-base font-extrabold text-[#0A0F0D] uppercase tracking-tight">
                3. Fair-Use Guardrails &amp; Surcharges
              </h3>
              <ul className="text-xs text-slate-700 space-y-2 leading-relaxed">
                <li>
                  • <strong>Active Hub Radius:</strong> ≤35 miles included per full-day loop |{' '}
                  <strong>£2.20 / mile</strong> beyond 35-mile zone.
                </li>
                <li>
                  • <strong>Heavy-Access Walk-Up:</strong> Ground, 1st &amp; 2nd floor included |{' '}
                  <strong>+£25.00 flat</strong> for 3rd floor+ without lift (100% passed to crew).
                </li>
                <li>
                  • <strong>Payload &amp; Overtime Cap:</strong> ≤1,200 kg total manifest / 110 kg max two-man single lift |{' '}
                  <strong>£50.00 / hr</strong> overtime beyond 9 hrs.
                </li>
                <li>
                  • <strong>Instant Digital PoD:</strong> Side-by-side Pre-Load vs. Room-of-Choice photo verification + customer e-signature.
                </li>
              </ul>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-[11px] font-bold text-[#004225]">
              🔒 Zero Disputed Damage Guarantee: 48-hr escrow hold verifies pre-load strapping against delivery room photo before settlement.
            </div>
          </div>
        </div>

        {/* 4. THE 3-ROUTE "PAY-ON-SUCCESS" SHOWROOM PILOT CTA BANNER */}
        <div className="bg-[#004225] ben-blueprint-grid-dark text-white rounded-xl p-6 border-2 border-[#0A0F0D] flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-[#F6EB61] text-[#0A0F0D] px-2.5 py-0.5 rounded tabular-nums">
              Risk-Free Commercial Onboarding • Hub 01 &amp; National UK
            </span>
            <h3 className="text-xl font-extrabold text-white">
              The 3-Route &ldquo;Pay-on-Success&rdquo; Showroom Pilot
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed tabular-nums">
              Test Ben on your next <strong>3 commercial or showroom delivery loops</strong> (within a 14-day pilot window). You are billed <strong>strictly upon verified photographic Proof of Delivery</strong> — £0.00 fee if a route fails due to crew or platform fault.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            {onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate('/portal')}
                className="no-print min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F6EB61] hover:bg-yellow-300 text-[#0A0F0D] text-xs font-extrabold uppercase tracking-wider border border-[#0A0F0D] shadow-sm transition-all"
              >
                Activate 3-Route Pilot (/portal) →
              </button>
            ) : null}
            <div className="text-[11px] font-mono text-[#F6EB61] text-center tabular-nums">
              benlogistics.co.uk/portal • ops@benlogistics.co.uk
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RateCardView
