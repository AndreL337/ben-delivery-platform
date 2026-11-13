import React from 'react'
import { X } from 'lucide-react'

export type LegalDocType = 'terms' | 'retailer_pilot' | 'gdpr'

export interface LegalModalProps {
  docType: LegalDocType | null
  onClose: () => void
  onAccept?: () => void
}

export const LegalDocumentModal: React.FC<LegalModalProps> = ({
  docType,
  onClose,
  onAccept
}) => {
  if (!docType) return null

  const title =
    docType === 'terms'
      ? 'Platform Terms & Conditions (UK Marketplace Agent)'
      : docType === 'retailer_pilot'
      ? 'Retailer Service Agreement & Pay-on-Success Pilot Terms'
      : 'UK GDPR Privacy & 90-Day Data Retention Notice'

  const subtitle =
    docType === 'terms'
      ? 'Ben Logistics Ltd • Technology Marketplace Agent • Version 2026.1'
      : docType === 'retailer_pilot'
      ? 'Milton Keynes Showroom Pilot • £0.00 Risk Guarantee & 48-Hr SLA'
      : 'UK GDPR & Data Protection Act 2018 • Automated 90-Day PoD Purge Policy'

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[88dvh] flex flex-col shadow-2xl overflow-hidden text-[#0f172a]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/80">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {subtitle}
            </span>
            <h3 className="text-lg font-extrabold text-[#0f172a] mt-1.5">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/70 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0"
            aria-label="Close legal modal"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {docType === 'terms' && (
            <>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="text-[#0f172a] block mb-1">
                  1. Marketplace Agent Status (Not a Carrier or Employer)
                </strong>
                Ben Logistics Ltd (&ldquo;Ben&rdquo;) operates strictly as a B2B technology marketplace
                agent connecting commercial retailers (&ldquo;Principals&rdquo;) with independent,
                self-employed 2-man delivery contractor crews (&ldquo;Carriers&rdquo;). Ben does not
                own delivery vehicles, employ drivers or porters, or act as a common carrier.
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  2. Independent Contractor Status (Outside IR35 / Gate A6)
                </strong>
                Independent crews retain the unfettered right of substitution, operate under their
                own commercial insurance (Goods in Transit £20k–£50k+, Public Liability £1m+
                covering both Lead Driver and Second Man/Porter, and Hire &amp; Reward motor
                cover), and are free to accept or decline runs on the Open Freight Board without
                penalty.
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  3. Day-1 Direct Settlement &amp; Platform Fee Structure
                </strong>
                Completed routes settle on a transparent <strong>87.5% Direct Crew Settlement</strong>{' '}
                / <strong>12.5% Ben Platform Fee</strong> split upon verified Proof of Delivery
                (PoD). During the Milton Keynes pilot, Ben does not hold unregulated client escrow
                funds; retailers settle crew labour directly and Ben Logistics Ltd invoices the 12.5%
                platform fee upon verified PoD.
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  4. 48-Hour Damage &amp; Dispute Protocol
                </strong>
                Pre-existing carton or item defects must be logged at the depot pre-load gate.
                Verified in-transit or in-home property damage reported within 48 hours of PoD is
                claimed directly against the Carrier&rsquo;s active GIT or Public Liability policy.
              </div>
            </>
          )}

          {docType === 'retailer_pilot' && (
            <>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <strong className="block mb-1">
                  1. &ldquo;Pay-on-Success&rdquo; Milton Keynes Showroom Pilot Guarantee
                </strong>
                Participating Milton Keynes showrooms pay the fixed route fee only upon successful
                completion and verified photographic + e-signature Proof of Delivery (PoD). If a
                route fails due to crew error, transit/in-home damage, or platform fault, the
                showroom is invoiced <strong>£0.00</strong> for that run (capped at the first 3
                routes per showroom within a 14-day window).
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  2. 2026 Transparent Flat-Rate Schedule &amp; Direct Split
                </strong>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Standard 2-Man ROC (3.5t Luton Tail-Lift, up to 16 drops):</strong>{' '}
                    £440.00 total (£385.00 Direct Crew Settlement + £55.00 Ben Platform Fee).
                  </li>
                  <li>
                    <strong>Delivery &amp; Assembly (3.5t Luton, up to 8 drops):</strong> £520.00
                    total (£455.00 Direct Crew Settlement + £65.00 Ben Platform Fee).
                  </li>
                  <li>
                    <strong>Single-Item / Overflow Rescue (1–4 drops, ≤3.5 hrs):</strong> £145.00
                    total (£126.87 Direct Crew Settlement + £18.13 Ben Platform Fee).
                  </li>
                </ul>
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  3. Milton Keynes Fair-Use Guardrails
                </strong>
                Standard routes cover a 35-mile radius from Central MK (MK9) (£2.20/mi beyond
                zone), up to 9 operational hours (£50/hr overtime), up to 1,200 kg total payload
                (110 kg max single item), and up to 2nd-floor walk-up (+£25 heavy-access surcharge
                for 3rd floor+ without lift, passed 100% to crew).
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  4. 48-Hour Damage Claim SLA
                </strong>
                All claims for transit or in-home property damage must be submitted via the Dispute
                Desk within <strong>48 hours</strong> of the PoD timestamp, accompanied by photos
                compared against the morning depot pre-load condition record.
              </div>
            </>
          )}

          {docType === 'gdpr' && (
            <>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                <strong className="block mb-1">
                  1. Automated 90-Day PoD Photo &amp; Signature Purge Policy
                </strong>
                Consumer doorstep Proof of Delivery (PoD) photographs, room-of-choice placement
                images, and recipient e-signatures (`signature_svg`) stored in Supabase Storage
                (`pod-images`) are retained strictly for <strong>90 days</strong> from delivery
                completion to satisfy the 48-hour damage SLA and chargeback verification, after
                which they are automatically and permanently purged.
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  2. Lawful Basis &amp; Data Minimisation (UK GDPR)
                </strong>
                Ben Logistics Ltd processes retailer manifest addresses, recipient delivery notes,
                and crew compliance credentials under UK GDPR Article 6(1)(b) (performance of a
                contract) and Article 6(1)(f) (legitimate operational and insurance verification
                interests). Consumer tracking links (`/track/:jobId`) expose only anonymised route
                status and ETA without leaking commercial rates or crew payouts.
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  3. Commercial &amp; Compliance Records
                </strong>
                Financial settlement summaries and Gate A6 contractor audit logs are retained for 6
                years in accordance with HMRC statutory accounting requirements.
              </div>
              <div>
                <strong className="text-[#0f172a] block mb-1">
                  4. Data Subject Requests &amp; DPO Contact
                </strong>
                To request early erasure, access, or rectification under the UK Data Protection Act
                2018, contact <strong>ops@benlogistics.co.uk</strong>.
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          {onAccept && (
            <button
              type="button"
              onClick={() => {
                onAccept()
                onClose()
              }}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
            >
              Accept Terms &amp; Continue
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
