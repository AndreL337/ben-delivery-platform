# ben. — Brand Identity, Visual Design System & National UK Positioning (`docs/BRAND_SYSTEM.md`)

> **Single Source of Truth — Agent 5 (Brand, UI & Growth Architect)**  
> **Domain:** `benlogistics.co.uk`  
> **Locked Wordmark:** Concept B (`ben.` Lowercase Connected Route-Bridge Mark)  
> **Status:** Locked Production Specification (2026)

---

## 1. Brand Archetype & Design Philosophy

**British Engineering Heritage meets Silicon Valley Mobility OS.**

Ben Logistics blends the authoritative, unmistakable palette of iconic British motorsport and commercial engineering (**Team Lotus / Jaguar Heritage British Racing Green & Primrose Yellow**) with the ultra-clean, high-density operational precision of modern mobility and fintech platforms (**Uber, Wise, Linear**).

Every screen—from the public B2B commercial landing experience to the Retailer Dispatch Ledger and the In-Cab Mobile HUD—must feel airy, engineered, trustworthy, and immediately legible in both bright showroom environments and low-light roadside cab conditions.

---

## 2. The "Mobbin 90/8/2" Colour Architecture

To maintain enterprise software clarity and prevent heavy dark-green visual blocking, all interfaces strictly enforce the **90 / 8 / 2 surface ratio**:

### 90% Crisp Neutrals (Structural Canvas, Navbars & Surfaces)
| Token / Usage | Hex | CSS Variable / Utility | Specification |
| :--- | :--- | :--- | :--- |
| **App Canvas** | `#F8FAFC` | `--ben-canvas` / `bg-[#F8FAFC]` | Primary viewport background for reduced glare |
| **Pure White Cards & Light Navbars** | `#FFFFFF` | `--ben-surface` / `bg-white/90 backdrop-blur-md` | Elevated cards, drawers, modals, data tables, and top navigation bars (`border-b border-slate-200`) |
| **Subtle Structural Borders** | `#E2E8F0` | `--ben-border` / `border-[#E2E8F0]` | `1px solid` crisp dividers and card hairlines |
| **Obsidian Tarmac Typography** | `#0A0F0D` | `--ben-ink` / `text-[#0A0F0D]` | Primary display and body copy with subtle deep-green/tarmac undertone |
| **Secondary Metadata Slate** | `#475569` | `.text-meta` / `text-slate-600` | Supporting labels, captions, and secondary telemetry |

> **Anti-Blocking Rule:** Avoid large solid dark-green container backgrounds or heavy dark-green top navigation bars on light pages. Keep headers and cards crisp white (`#FFFFFF`) and reserve British Racing Green (`#004225`) strictly for the `BEN` wordmark lettering, primary CTAs, active tabs, and focused badges.

### 8% Primary Brand Anchor — British Racing Green (`#004225`)
| Token / Usage | Hex | CSS Variable | Specification |
| :--- | :--- | :--- | :--- |
| **British Racing Green (Core)** | `#004225` | `--ben-primary` | `BEN` wordmark lettering on light surfaces, primary CTAs (`.ben-btn-primary`), and active navigation pills |
| **British Racing Green (Hover)** | `#005A34` | `--ben-primary-hover` | Interactive hover and focus elevation state |
| **Heritage Tint Surface** | `#F0F7F4` | `--ben-bg` | Subtle British Racing Green tint for active row highlights and verified badges |

### 2% Signal Accent — Primrose Yellow (`#F6EB61`)
| Token / Usage | Hex | CSS Variable | Specification |
| :--- | :--- | :--- | :--- |
| **Primrose Yellow (Signal)** | `#F6EB61` | `--ben-accent` | Used **strictly** as a high-contrast focal signal: the terminal accent node in the `BEN.` wordmark (ringed with a `1.5px` `#004225` border on light surfaces), live route telemetry lines, and `In Transit` status indicators |
| **Signal Accent Border / Dark** | `#CA8A04` | `--ben-accent-dark` | High-contrast boundary accent for signal badges |
| **Status Pill Fill (WCAG AAA)** | `#FEFCE8` | `.ben-status-alert` (bg) | Soft Primrose surface fill for `In Transit` and active telemetry pills |
| **Status Pill Ink (WCAG AAA)** | `#713F12` | `.ben-status-alert` (color) | Deep bronze-umber text paired with `#FEFCE8` fill to guarantee **WCAG AAA** contrast readability |

---

## 3. Typography, Locked Concept B Wordmark (`ben.`) & Numeric Discipline

### Wordmark & Display Headers (`Outfit`)
- **Font Family:** `'Outfit', sans-serif`
- **Weight:** `800 ExtraBold`
- **Letter Spacing:** Bespoke geometric cut with tight `-0.05em` tracking (`tracking-[-0.05em]`)
- **The Locked Concept B (`ben.`) Wordmark Specification:**
  1. **Case:** Strictly lowercase **`ben.`** (sleek, approachable UK mobility/fintech unicorn aesthetic inspired by *wise*, *monzo*, and *deliveroo*).
  2. **Lettering Colour on Light Surfaces:** Deep British Racing Green (`#004225`) on `#FFFFFF` and `#F8FAFC` surfaces (`#FFFFFF` lettering on dark In-Cab HUD overlays).
  3. **Signature Route-Bridge Ligature (`e–n`):** Rendered via `<BenWordmark />` (`src/shared/components/BenWordmark.tsx`) with a horizontal connecting route-bridge stroke linking the crossbar of the `e` directly into the stem of the `n`.
  4. **Terminal Route-Pin Node (`.`):** Circular waypoint dot (`border-radius: 9999px`) filled in **Primrose Yellow (`#F6EB61`)** with a **`2px solid #004225`** British Racing Green outer ring (`.ben-wordmark-dot`) so it pops with crisp optical contrast against white and light-slate surfaces.
  5. **Favicon & App Icon (`public/favicon.svg`):** Lowercase geometric **`b.`** in `#004225` paired with the `2px`-ringed `#F6EB61` circular waypoint dot on a crisp white squircle framed in `#004225`.

### UI, Ledger & Telemetry Typography (`Inter`)
- **Font Family:** `'Inter', sans-serif`
- **Weights:** `400 Regular`, `500 Medium`, `600 SemiBold`, `700 Bold`
- **Mandatory Tabular Numerics:**
  - `font-variant-numeric: tabular-nums` (`tabular-nums`) is enforced across **all** pricing figures (`£440.00`), crew payout splits (`87.5%` / `£385.00`), UK postcodes (`MK9 2EA`), stop counters (`STOP 1 OF 8`), and SLA timestamps.

---

## 4. National UK Positioning & Hub Architecture

Ben Logistics (`benlogistics.co.uk`) is positioned as a **National UK Logistics Operating System** scaling systematically through high-density regional corridors—never restricted to a single town or a single vehicle manufacturer.

### Core Messaging Lock
- **Primary Tagline:**
  > *"The UK’s Direct-to-Crew Logistics Operating System."*
- **Sub-headline:**
  > *"Connecting retailers and commercial shippers directly with vetted 3.5t LWB, XLWB & Luton 2-man crews. Zero 3PL middlemen. Driver-first routing. Instant photographic Proof of Delivery."*
- **Network Descriptor:**
  > *"3.5t LWB, XLWB & Luton 2-Man Specialist Network — UK M1 Corridor & National Hubs"*

### Regional Density Hub Architecture
- **Hub 01 — M1 South / Central Corridor (Live Active Zone):**
  - **Coverage:** `Milton Keynes • Bedford • Northampton • Luton` (MK9 core + 35-mile M1 operational catchment).
  - **Status:** Live commercial dispatch, Pay-on-Success Showroom Pilots, and active 2-man crew loops.
- **National UK Expansion Hubs (Registration & Fleet Onboarding Open):**
  - **Hub 02 — Greater London & M25 Orbital**
  - **Hub 03 — Midlands Golden Triangle (`Birmingham • Coventry • Leicester • Magna Park`)**
  - **Hub 04 — Northern Powerhouse (`Manchester • Leeds • Warrington M62 Corridor`)**

---

## 5. Inclusive UK Commercial Fleet Taxonomy (Make & Model Agnostic)

Ben is make-and-model agnostic across the UK commercial fleet—welcoming owner-operators running **Ford Transit, Mercedes-Benz Sprinter, VW Crafter, Renault Master, Iveco Daily, Vauxhall Movano, Peugeot Boxer, Citroën Relay, and Nissan Interstar** assets across five standardized capability classes:

1. **LWB / XLWB High-Roof Panel Van (3.5t)** — *e.g., Sprinter, Transit Jumbo, Crafter, Master*
2. **3.5t Luton / Low-Loader Box Van (with Tail-Lift)** — *2-Man Heavy Bulky & White-Glove*
3. **MWB / Urban Commercial & EV Van** — *Trade Counter & High-Density Multi-Drop*
4. **7.5t Box Truck (with Tail-Lift)** — *Heavy Commercial Trunking*
5. **No Vehicle (On-Roster 2-Man Porter / Assembly Specialist)** — *Paired with Independent or Client Fleet Vehicles*

---

## 6. Component & Token Reference (`src/index.css`)

```css
:root {
  --ben-canvas: #F8FAFC;        /* 90% Crisp Neutral Canvas */
  --ben-surface: #FFFFFF;       /* Pure White Cards & Navbars */
  --ben-ink: #0A0F0D;           /* Obsidian Tarmac Typography */
  --ben-primary: #004225;       /* 8% British Racing Green Anchor */
  --ben-primary-hover: #005A34; /* British Racing Green Hover State */
  --ben-accent: #F6EB61;        /* 2% Primrose Yellow Signal Accent */
  --ben-accent-dark: #CA8A04;   /* Signal Contrast Border */
  --ben-bg: #F0F7F4;            /* Subtle Heritage Green Tint */
  --ben-border: #E2E8F0;        /* Crisp Structural Border */
}
```
