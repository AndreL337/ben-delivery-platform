# GOOGLE POMELLI CAMPAIGN 01 — ARCHIVE & VISUAL DNA (`benlogistics.co.uk`)

**Status:** Locked Production Creative Specification (Agent 5 — Brand, UI & Growth Architect)  
**Brand Wordmark:** Concept B Lowercase Connected **`ben.`** (`#004225` British Racing Green + `#F6EB61` Primrose Yellow Waypoint Node)  
**Colour Architecture:** Mobbin 90/8/2 Ratio (`#F8FAFC` / `#FFFFFF` Neutrals • `#004225` British Racing Green • `#F6EB61` Primrose Yellow)

---

## 1. THE 4 POMELLI CAMPAIGN PILLARS

### Pillar 1 — Hero / Direct Dispatch
- **Primary Campaign Headline:** `DIRECT-TO-CREW UK LOGISTICS`
- **Alternate Campaign Headline:** `DIRECT UK DISPATCH. NO 3PL MIDDLEMEN.`
- **Campaign Body Copy:**
  > *"Connect commercial shippers straight to vetted 2-man delivery crews nationwide. Discover how direct-to-crew 2-man logistics cuts your supply chain costs instantly."*
- **Strategic Positioning:** Eliminates multi-layered 3PL agency subcontracting across Hub 01 (M1 Corridor: MK • Bedford • Northampton • Luton) and National UK Regional Hubs.

### Pillar 2 — Commercial Transparency & Escrow Clarity
- **Campaign Headline:** `Zero Broker Markups`
- **Campaign Body Copy:**
  > *"Lock in transparent flat-rate loops across your UK supply chain with total clarity."*
- **Commercial Proof Point:** Fixed 2026 B2B route loops (`£440` Standard ROC / `£520` White-Glove Assembly / `£350–£410` Client Vehicle 2-Man Pod / `£145` Overflow Mini-Loop) with an explicit **87.5% Direct-to-Crew Net Pool** and **12.5% Platform Fee**.

### Pillar 3 — The Damage-Shield / Warehouse-to-Room PoD
- **Campaign Headline:** `Instant Digital Proof of Delivery`
- **Campaign Body Copy:**
  > *"Track live updates and receive instant digital sign-offs right from the warehouse floor."*
- **Operational Mechanism:** Side-by-side AI Condition Gate pairing pre-load van-bay strapping photos with room-of-choice photographic Proof of Delivery and tokenized customer tracking (`/track/:jobId`).

### Pillar 4 — Printable A4 B2B Rate Card & 3-Route Showroom Pilot (`/rate-card`)
- **Campaign Asset:** Executive A4 B2B Rate Card & Pilot Sheet (`/rate-card`) engineered in the Pomelli Card 2 & Card 4 visual system.
- **Commercial Offer:** **The 3-Route "Pay-on-Success" Showroom Pilot** — first 3 routes within a 14-day window billed strictly upon verified photo PoD (`£0.00` if failed due to crew or platform fault).

---

## 2. POMELLI VISUAL MICRO-PATTERNS (`src/index.css`)

Pomelli Campaign 01 introduced 4 signature visual utilities that reinforce our **British Engineering Heritage meets Silicon Valley Mobility OS** archetype:

| Utility Class | Visual Specification | Primary Usage |
| :--- | :--- | :--- |
| `.ben-blueprint-grid` | `24px × 24px` coordinate telemetry grid (`rgba(0, 66, 37, 0.05)` on light surfaces; `rgba(246, 235, 97, 0.07)` on `#004225` dark surfaces) | Hero campaign containers, Pomelli value cards, and the `/rate-card` A4 sheet |
| `.ben-card-offset-yellow` / `.ben-card-offset-green` | Crisp `1.5px solid #0A0F0D` structural border with a hard `4px 4px 0px` neo-tech offset shadow in `#F6EB61` or `#004225` | Featured campaign value pillars, rate-card pricing tiers, and pilot callouts |
| `.ben-callout-left` | Pure white `#FFFFFF` callout container with `1px solid #E2E8F0` perimeter border and a `4px solid #004225` left anchor bar | Pomelli Card 4 executive summaries, SLA guardrails, and pillar descriptions |
| `.ben-Accent-Bar` | `36px × 4px` horizontal signal pill in `#F6EB61` (with `1px solid #004225` optical contrast border on light surfaces) | Placed directly above section & card headlines to anchor visual hierarchy |

### Additional Pomelli Telemetry Accents
- **Viewfinder Corner Marks (`┌ ┐ └ ┘`):** Precision optical framing around A4 rate cards and telemetry matrices.
- **Reusable Inline SVG Wordmark (`<BenLogo />`):** Vector-locked lowercase connected **`ben.`** wordmark (`src/shared/components/BenLogo.tsx`) featuring a continuous horizontal route-bridge from the crossbar of `e` into the left stem of `n` and a `2px` `#004225`-ringed `#F6EB61` circular waypoint node.
