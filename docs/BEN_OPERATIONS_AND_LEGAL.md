# Ben Logistics — Milton Keynes 2-Man Bulky Delivery Platform
**Operations & UK Legal Compliance Framework (2026)**

---

## 1. 2026 Pricing Matrix (12.5% Platform Fee / 87.5% Crew Net Pool)

All routes operate on transparent flat-rate daily or half-day structures with an **87.5% Net Dispatched Labour Pool** allocated directly to the 2-man crew and a **12.5% Platform Fee** retained by Ben Logistics.

| Service Tier | Vehicle Setup | Route Profile | Gross Rate | Ben Fee (12.5%) | Crew Net Pool (87.5%) | Capacity & Shift Cap |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Independent 3.5t Luton (2-Man) — Standard ROC** | Independent Van | Room of Choice (ROC) | **£440.00 / day** | £55.00 | **£385.00** | Max 12–16 drops / ≤9 hrs |
| **Independent 3.5t Luton (2-Man) — Delivery & Assembly** | Independent Van | White-Glove & Assembly | **£520.00 / day** | £65.00 | **£455.00** | Max 5–8 drops / ≤9 hrs |
| **Client Vehicle (2-Man Labour Pod) — Standard ROC** | Client Vehicle | Room of Choice (ROC) | **£350.00 / day** | £43.75 | **£306.25** | Max 12–16 drops / ≤9 hrs |
| **Client Vehicle (2-Man Labour Pod) — Delivery & Assembly** | Client Vehicle | White-Glove & Assembly | **£410.00 / day** | £51.25 | **£358.75** | Max 5–8 drops / ≤9 hrs |
| **Half-Day / Overflow Pilot Loop (1–4 Drops)** | Independent or Client | Overflow / Mini-Loop | **£145.00 flat** | £18.13 | **£126.87** | Max 1–4 drops / ≤3.5 hrs / ≤20 miles |

---

## 2. Introductory Commercial Offer: "Pay on Success" Showroom Pilot

To eliminate unhedged financial exposure (discontinuing legacy "3 Free Routes Outright" offers that risked up to £1,155 in unhedged subsidies), Ben Logistics operates a standardized **"Pay on Success" Pilot** for Milton Keynes showrooms:

* **Pay Only Upon Verified Completion:** The participating showroom pays the fixed route rate (**£440.00 Standard ROC / £520.00 Delivery & Assembly**) **only upon successful route completion and verified photographic Proof of Delivery (PoD)**.
* **Zero-Risk Performance Guarantee:** If a delivery fails due to crew error, transit/in-home damage, or platform fault, the retailer is invoiced **£0.00** for that route.
* **Pilot Scope & Window:** Capped at the **first 3 routes per showroom within a 14-day window** across the Milton Keynes catchment.

---

## 3. Strict Milton Keynes Fair-Use Guardrails & Aptean-Grade Route Constraints

To protect 2-man crews from predatory overloading and volumetric mismatches, all manifests dispatched through the Milton Keynes Hub enforce strict physical, geographic, and vehicle-matching guardrails:

* **Radius Cap:** Route origin must be within Milton Keynes; all drops must fall within a **35-mile radius of Central Milton Keynes (MK9)**.
  * *Out-of-Zone Surcharge:* **£2.20 / mile** beyond the 35-mile boundary.
* **Shift Cap:** Maximum **9 operational hours** (measured from depot loading arrival to final Proof of Delivery timestamp).
  * *Overtime Surcharge:* **£50.00 / hour** billed pro-rata for retailer-caused delays or excessive manifest run-over.
* **Payload Cap:** Maximum **1,200 kg total payload** or **12m³ volume** (standard 3.5t Luton legal limit). Maximum single-item weight: **110 kg** for a 2-man crew.
* **Aptean-Inspired Asset Constraint Tags:**
  * `requires_tail_lift`: Mandatory for marble tables, range cookers, American fridge-freezers, or heavy multi-drop runs over 100kg. Restricted on the Open Freight Board so only crews with verified 3.5t Tail-Lift Luton vans can claim the route.
  * `requires_assembly`: Flags room-of-choice bed frame/dining table assembly and automatically caps the manifest at **5–8 drops/day**.
* **Access Rule:** Standard delivery includes up to **2nd-floor walk-up** access.
  * *Heavy-Access Surcharge:* **3rd floor or higher without an operational lift incurs a £25.00 heavy-access fee** (passed **100% to the crew**).

---

## 4. UK Legal & Compliance Framework (UK Ltd Marketplace)

### A. Marketplace Role & Agency Status
* **Role:** **Ben Logistics** acts strictly as a **technology marketplace agent** connecting Retailers (Principals) and Independent Contractor Crews (Carriers/Service Providers). Ben Logistics is neither a common carrier nor an employer of delivery personnel.

### B. IR35 & Self-Employed Status Protections (Gate A6 Audit Trail)
To maintain genuine B2B self-employed contractor status outside IR35, every Crew Lead signs a timestamped digital agreement (`v1.0-pilot-outside-ir35`) recorded in `public.contractor_agreements`:
* **Unfettered Right of Substitution:** Crews retain an absolute, unfettered right to provide a suitably vetted, insured, and qualified substitute driver or porter for any claimed route at their own discretion and expense.
* **Autonomy & Control:** Crews have full freedom to accept or reject any route on the Open Freight Board without penalty, algorithmic downgrading, or exclusivity requirements.
* **Equipment & Multi-Client Operations:** Independent crews supply their own vehicles, tools, PPE, and blankets/straps, bear their own operational profit/loss risk, and remain free to operate for competing logistics platforms or direct clients concurrently.

### C. Mandatory Crew Insurance & Compliance Locker (`public.compliance_documents`)
Before claiming routes on the Ben Logistics platform, every Crew Lead must upload and maintain verified certificates in the `compliance-docs` vault for:
1. **Goods in Transit (GIT) Insurance:** Minimum **£20,000 – £50,000+** coverage per load for furniture/bulky household goods (`doc_type = 'goods_in_transit'`).
2. **Public Liability (PL) Insurance:** Minimum **£1,000,000+** coverage explicitly covering in-home property damage and both the **Lead Driver and Second Man / Porter** (`doc_type = 'public_liability'`).
3. **Hire & Reward Motor Insurance:** Comprehensive commercial motor policy valid for courier/haulage operations (`doc_type = 'hire_and_reward'`).
4. **UK Right to Work & Licensing:** Valid UK Driving Licence (DVLA check code) and verified UK Right to Work for both crew members.

### D. 48-Hour Dispute & Damage SLA
* **Escrow & Settlement Hold:** Route payouts are held in pending settlement for **48 hours post-PoD** to allow retailers and end-customers to report transit or property damage.
* **Depot Pre-Load Inspection:** Any pre-existing carton or item damage at the depot must be photographed and logged prior to loading onto the vehicle; unlogged pre-load damage defaults to carrier responsibility once signed out.
* **Claims Resolution:** Verified in-transit or in-home damage is claimed directly against the Crew's **GIT or Public Liability insurance policy**, with the independent crew liable for their policy excess (capped at up to **£250.00** per incident through the platform dispute resolution protocol).
