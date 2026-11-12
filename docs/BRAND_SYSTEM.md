# BEN. — Brand Identity, Visual Design System & National UK Positioning (`docs/BRAND_SYSTEM.md`)

> **Single Source of Truth — Agent 5 (Brand, UI & Growth Architect)**  
> **Domain:** `benlogistics.co.uk`  
> **Status:** Locked Production Specification (2026)

---

## 1. Brand Archetype & Design Philosophy

**British Engineering Heritage meets Silicon Valley Mobility OS.**

Ben Logistics blends the authoritative, unmistakable palette of iconic British motorsport and commercial engineering (**Team Lotus / Jaguar Heritage British Racing Green & Primrose Yellow**) with the ultra-clean, high-density operational precision of modern mobility and fintech platforms (**Uber, Wise, Linear**).

Every screen—from the public B2B commercial landing experience to the Retailer Dispatch Ledger and the In-Cab Mobile HUD—must feel engineered, trustworthy, and immediately legible in both bright showroom environments and low-light roadside cab conditions.

---

## 2. The "Mobbin 90/8/2" Colour Architecture

To maintain enterprise software clarity and prevent visual fatigue, all interfaces strictly enforce the **90 / 8 / 2 surface ratio**:

### 90% Crisp Neutrals (Structural Canvas & Surfaces)
| Token / Usage | Hex | CSS Variable / Utility | Specification |
| :--- | :--- | :--- | :--- |
| **App Canvas** | `#F8FAFC` | `--ben-canvas` / `bg-[#F8FAFC]` | Primary viewport background for reduced glare |
| **Pure White Cards** | `#FFFFFF` | `--ben-surface` / `bg-[#FFFFFF]` | Elevated cards, drawers, modals, and data tables |
| **Subtle Structural Borders** | `#E2E8F0` | `--ben-border` / `border-[#E2E8F0]` | `1px solid` crisp dividers and card hairlines |
| **Obsidian Tarmac Typography** | `#0A0F0D` | `--ben-ink` / `text-[#0A0F0D]` | Primary display and body copy with subtle deep-green/tarmac undertone |
| **Secondary Metadata Slate** | `#475569` | `.text-meta` / `text-slate-600` | Supporting labels, captions, and secondary telemetry |

### 8% Primary Brand Anchor — British Racing Green (`#004225`)
| Token / Usage | Hex | CSS Variable | Specification |
| :--- | :--- | :--- | :--- |
| **British Racing Green (Core)** | `#004225` | `--ben-primary` | Primary CTAs (`.ben-btn-primary`), top brand headers, app squircle icon, and active navigation states |
| **British Racing Green (Hover)** | `#005A34` | `--ben-primary-hover` | Interactive hover and focus elevation state |
| **Heritage Tint Surface** | `#F0F7F4` | `--ben-bg` | Subtle British Racing Green tint for active row highlights and verified badges |

### 2% Signal Accent — Primrose Yellow (`#F6EB61`)
| Token / Usage | Hex | CSS Variable | Specification |
| :--- | :--- | :--- | :--- |
| **Primrose Yellow (Signal)** | `#F6EB61` | `--ben-accent` | Used **strictly** as a high-contrast focal signal: the terminal dot in the `BEN.` wordmark, live route telemetry lines, and `In Transit` status indicators |
| **Signal Accent Border / Dark** | `#CA8A04` | `--ben-accent-dark` | High-contrast boundary accent for signal badges |
| **Status Pill Fill (WCAG AAA)** | `#FEFCE8` | `.ben-status-alert` (bg) | Soft Primrose surface fill for `In Transit` and active telemetry pills |
| **Status Pill Ink (WCAG AAA)** | `#713F12` | `.ben-status-alert` (color) | Deep bronze-umber text paired with `#FEFCE8` fill to guarantee **WCAG AAA** contrast readability |

---

## 3. Typography & Numeric Discipline

### Wordmark & Display Headers (`Outfit`)
- **Font Family:** `'Outfit', sans-serif`
- **Weight:** `800 ExtraBold`
- **Letter Spacing:** Tight `-0.04em` tracking (`tracking-[-0.04em]`)
- **The `BEN.` Wordmark Construction:**
  - Rendered in uppercase `Outfit 800 ExtraBold` (`BEN`) in either crisp white (`#FFFFFF` on dark/British Racing Green surfaces) or British Racing Green / Obsidian (`#004225` / `#0A0F0D` on light surfaces).
  - Terminated immediately by a high-contrast **Primrose Yellow (`#F6EB61`)** square/period mark (`.`).

### UI, Ledger & Telemetry Typography (`Inter`)
- **Font Family:** `'Inter', sans-serif`
- **Weights:** `400 Regular`, `500 Medium`, `600 SemiBold`, `700 Bold`
- **Mandatory Tabular Numerics:**
  - `font-variant-numeric: tabular-nums` (`tabular-nums`) is enforced across **all** pricing figures (`£440.00`), crew payout splits (`87.5%` / `£385.00`), UK postcodes (`MK9 2EA`), stop counters (`STOP 1 OF 8`), and SLA timestamps.

---

## 4. National UK Positioning & Hub Architecture

Ben Logistics (`benlogistics.co.uk`) is positioned as a **National UK Logistics Operating System** scaling systematically through high-density regional corridors—never marketed as a restricted "single-town" or "Luton-van-only" local courier.

### Core Messaging Lock
- **Primary Tagline:**
  > *"The UK’s Direct-to-Crew Logistics Operating System."*
- **Sub-headline:**
  > *"Connecting retailers and commercial shippers directly with vetted Mercedes Sprinter & 2-man crews. Zero 3PL middlemen. Driver-first routing. Instant photographic Proof of Delivery."*
- **NetworkDescriptor:**
  > *"Mercedes Sprinter LWB & 2-Man Specialist Network — UK M1 Corridor & National Hubs"*

### Regional Density Hub Architecture
- **Hub 01 — M1 South / Central Corridor (Live Active Zone):**
  - **Coverage:** `Milton Keynes • Bedford • Northampton • Luton` (MK9 core + 35-mile M1 operational catchment).
  - **Status:** Live commercial dispatch, Pay-on-Success Showroom Pilots, and active 2-man crew loops.
- **National UK Expansion Hubs (Registration & Fleet Onboarding Open):**
  - **Hub 02 — Greater London & M25 Orbital**
  - **Hub 03 — Midlands Golden Triangle (`Birmingham • Coventry • Leicester • Magna Park`)**
  - **Hub 04 — Northern Powerhouse (`Manchester • Leeds • Warrington M62 Corridor`)**
  - Retailers and independent fleet operators across the UK can register and onboard directly into their regional hub queue.

---

## 5. Fleet Standard Specification

Ben standardizes on modern, high-reliability UK commercial vehicles engineered for urban access and bulky freight efficiency:

1. **Primary Fleet Standard — UK Mercedes-Benz Sprinter (LWB High-Roof):**
   - High-capacity Long Wheelbase (`LWB High-Roof`) vans forming the backbone of both **2-Man Bulky Room-of-Choice** loops and **Commercial Multi-Drop** dispatch.
   - Equipped with heavy-duty load-lashing rails, protective transit blankets, sack barrows, and LIFO (`Zone A` Bulkhead to `Zone D` Rear Doors) bay demarcation.
2. **Heavy-Lift Specialist Tier — 3.5t Tail-Lift Box Vans:**
   - Deployed where heavy mechanical lift (`>110 kg` single item or commercial palletized/crated stock) is explicitly specified on the retailer manifest.
3. **Client Vehicle 2-Man Pods:**
   - Vetted Lead Driver + Second Man Porter teams dispatched to operate retailer-owned Mercedes Sprinter or 3.5t fleet assets under Outside-IR35 substitution rules.

---

## 6. Component & Token Reference (`src/index.css`)

```css
:root {
  --ben-canvas: #F8FAFC;        /* 90% Crisp Neutral Canvas */
  --ben-surface: #FFFFFF;       /* Pure White Cards */
  --ben-ink: #0A0F0D;           /* Obsidian Tarmac Typography */
  --ben-primary: #004225;       /* 8% British Racing Green Anchor */
  --ben-primary-hover: #005A34; /* British Racing Green Hover State */
  --ben-accent: #F6EB61;        /* 2% Primrose Yellow Signal Accent */
  --ben-accent-dark: #CA8A04;   /* Signal Contrast Border */
  --ben-bg: #F0F7F4;            /* Subtle Heritage Green Tint */
  --ben-border: #E2E8F0;        /* Crisp Structural Border */
}
```
