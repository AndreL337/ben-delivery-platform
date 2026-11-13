import React, { useEffect } from 'react'
import {
  MapPin,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Navigation,
  Camera,
  Wrench,
  Building2,
  Clock
} from 'lucide-react'
import { REGIONAL_HUBS, getRegionalHubBySlug } from '../../config/regionalHubs'

export interface RegionalHubViewProps {
  hubSlug?: string | null
  onNavigate: (to: string) => void
}

const HUB_RATES = [
  {
    tier: 'Tier 01 • Core Bulky',
    title: 'Standard 2-Man ROC',
    price: '£440',
    unit: '/ day (≤9 hrs)',
    detail: '12–16 drops • 3.5t LWB/XLWB or Luton Tail-Lift • Room-of-Choice to 2nd floor',
    crewPayout: '£385.00 net to crew (87.5%)',
    featured: true
  },
  {
    tier: 'Tier 02 • White-Glove',
    title: 'Delivery & Assembly',
    price: '£520',
    unit: '/ day (≤9 hrs)',
    detail: '5–8 drops • Unboxing, beds/tables/wardrobes assembly & packaging removal',
    crewPayout: '£455.00 net to crew (87.5%)',
    featured: false
  },
  {
    tier: 'Tier 03 • Urgent Rescue',
    title: 'Overflow Rescue Mini-Loop',
    price: '£145',
    unit: 'flat (≤3.5 hrs)',
    detail: '1–4 drops within 20 miles • Same/next-day showroom & trade rescue',
    crewPayout: '£126.88 net to crew (87.5%)',
    featured: false
  },
  {
    tier: 'Tier 04 • Your Fleet',
    title: 'Client Vehicle Pod',
    price: '£350 / £410',
    unit: 'ROC / Assembly',
    detail: 'Vetted 2-man Driver & Porter operating your liveried showroom van',
    crewPayout: '12.5% OS fee • Full Ben HUD',
    featured: false
  }
]

export const RegionalHubView: React.FC<RegionalHubViewProps> = ({ hubSlug, onNavigate }) => {
  const hub = getRegionalHubBySlug(hubSlug)

  useEffect(() => {
    const previousTitle = document.title
    document.title = hub.seoTitle

    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    const previousDesc = metaDesc?.content || ''
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content = hub.seoDescription

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    const previousCanonical = canonical?.href || ''
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = `https://benlogistics.co.uk/hubs/${hub.slug}`

    const existingJsonLd = document.getElementById('ben-hub-jsonld')
    if (existingJsonLd) existingJsonLd.remove()

    const script = document.createElement('script')
    script.id = 'ben-hub-jsonld'
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'DeliveryService',
      name: `ben. — ${hub.hubName}`,
      serviceType: ['2-Man Bulky Goods Delivery', 'White-Glove Furniture & Assembly', 'LogisticsService'],
      provider: {
        '@type': 'Organization',
        name: 'Ben Logistics Ltd',
        url: 'https://benlogistics.co.uk',
        email: 'andre@benlogistics.co.uk'
      },
      areaServed: {
        '@type': 'City',
        name: hub.city,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: hub.latitude,
          longitude: hub.longitude
        }
      },
      url: `https://benlogistics.co.uk/hubs/${hub.slug}`,
      description: hub.seoDescription,
      offers: [
        {
          '@type': 'Offer',
          name: 'Standard 2-Man Room-of-Choice (ROC)',
          price: '440.00',
          priceCurrency: 'GBP'
        },
        {
          '@type': 'Offer',
          name: 'White-Glove Delivery & Assembly',
          price: '520.00',
          priceCurrency: 'GBP'
        },
        {
          '@type': 'Offer',
          name: 'Overflow Rescue Mini-Loop',
          price: '145.00',
          priceCurrency: 'GBP'
        }
      ]
    })
    document.head.appendChild(script)

    return () => {
      document.title = previousTitle
      if (metaDesc && previousDesc) metaDesc.content = previousDesc
      if (canonical && previousCanonical) canonical.href = previousCanonical
      const added = document.getElementById('ben-hub-jsonld')
      if (added) added.remove()
    }
  }, [hub])

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* HERO */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-10 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004225] bg-[#F0F7F4] px-3 py-1 rounded-full border border-[#004225]/15">
            <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{hub.hubName}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-[#F6EB61] px-3 py-1 rounded-full">
            <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{hub.corridorTag}</span>
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight max-w-4xl">
          2-Man Bulky Goods &amp; White-Glove Delivery in {hub.city} — Direct-to-Crew
        </h1>

        <p className="mt-4 text-base text-slate-600 max-w-3xl leading-relaxed">
          {hub.heroSubtitle}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/portal')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#004225] hover:bg-[#005A34] text-white text-sm font-semibold shadow-sm transition-all inline-flex items-center gap-2"
          >
            <span>Book a {hub.city} Run</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/driver')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#F0F7F4] hover:bg-[#e1efe9] text-[#004225] border border-[#004225]/20 text-sm font-semibold transition-all inline-flex items-center gap-2"
          >
            <Truck className="w-4 h-4" strokeWidth={1.75} />
            <span>Join as a {hub.city} Crew (87.5% Net)</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/rate-card')}
            className="min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-all"
          >
            View Printable Rate Card
          </button>
        </div>

        {/* LOCAL ESTATES & POSTCODES */}
        <div className="mt-7 pt-6 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Active Trade Parks &amp; Showrooms Covered
            </span>
            <div className="flex flex-wrap gap-1.5">
              {hub.industrialEstates.map((estate) => (
                <span
                  key={estate}
                  className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md"
                >
                  {estate}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Primary Postcode Catchment (35-Mile Hub Radius)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {hub.postcodePrefixes.map((pc) => (
                <span
                  key={pc}
                  className="text-xs font-semibold text-[#004225] bg-[#F0F7F4] px-2.5 py-1 rounded-md tabular-nums"
                >
                  {pc}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CORRIDOR ADVANTAGES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hub.localAdvantages.map((adv, index) => {
          const Icon = index === 0 ? Building2 : index === 1 ? ShieldCheck : Camera
          const titles = [
            '35-Mile Zero-3PL Corridor',
            'Vetted & Insured 2-Man Crews',
            'Damage-Shield & Live /track'
          ]
          return (
            <div
              key={titles[index]}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-2.5"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F0F7F4] text-[#004225] flex items-center justify-center">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-bold text-slate-950">{titles[index]}</h2>
              <p className="text-xs text-slate-600 leading-relaxed">{adv}</p>
            </div>
          )
        })}
      </section>

      {/* EMBEDDED 2026 FLAT-RATE MATRIX */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#004225]">
              2026 Transparent Tariff • Pay-on-Success Pilot
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-950 mt-1">
              {hub.city} Flat-Rate Dispatch Schedule
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#004225]" strokeWidth={1.75} />
            <span>£0.00 fee if a pilot run fails</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
          {HUB_RATES.map((rate) => (
            <div
              key={rate.title}
              className={`rounded-xl p-5 border flex flex-col justify-between ${
                rate.featured
                  ? 'border-[#004225] bg-[#F0F7F4]/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#004225]">
                  {rate.tier}
                </span>
                <h3 className="text-sm font-bold text-slate-950 mt-1">{rate.title}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-slate-950">{rate.price}</span>
                  <span className="text-xs font-medium text-slate-500">{rate.unit}</span>
                </div>
                <p className="mt-3 text-xs text-slate-600 leading-relaxed">{rate.detail}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center gap-1.5 text-[11px] font-semibold text-[#004225]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span>{rate.crewPayout}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#004225] text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F6EB61]">
              <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>5-Class Inclusive UK Commercial Fleet</span>
            </div>
            <p className="text-xs text-emerald-50/90 max-w-2xl leading-relaxed">
              Open to LWB/XLWB Sprinters, Transits, Crafters, Masters, 3.5t Tail-Lift Lutons, MWB/EV vans, 7.5t trucks, and vetted 2-man assembly porters across {hub.city}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/portal')}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#F6EB61] hover:bg-[#efe248] text-slate-950 text-xs font-bold transition-all"
            >
              Book a Run
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/driver')}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/20"
            >
              Join as a {hub.city} Crew
            </button>
          </div>
        </div>
      </section>

      {/* OTHER HUB 01 CORRIDORS */}
      <section className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Hub 01 M1 / Ox–MK–Cam Corridors:
        </span>
        <div className="flex flex-wrap gap-2">
          {REGIONAL_HUBS.map((item) => (
            <a
              key={item.slug}
              href={`/hubs/${item.slug}`}
              onClick={(e) => {
                e.preventDefault()
                onNavigate(`/hubs/${item.slug}`)
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                item.slug === hub.slug
                  ? 'bg-[#004225] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-[#004225] hover:text-[#004225]'
              }`}
            >
              {item.city}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

export default RegionalHubView
