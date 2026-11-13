export interface RegionalHubConfig {
  slug: string
  city: string
  hubName: string
  corridorTag: string
  industrialEstates: string[]
  postcodePrefixes: string[]
  seoTitle: string
  seoDescription: string
  heroSubtitle: string
  localAdvantages: string[]
  latitude: number
  longitude: number
}

export const REGIONAL_HUBS: RegionalHubConfig[] = [
  {
    slug: 'milton-keynes',
    city: 'Milton Keynes',
    hubName: 'Milton Keynes & Bletchley Hub',
    corridorTag: 'Kiln Farm, Stacey Bushes, Winterhill, Central MK — M1 J13/J14',
    industrialEstates: ['Kiln Farm (MK11)', 'Stacey Bushes (MK12)', 'Winterhill Retail Park (MK6)', 'Bletchley (MK2)', 'Central MK (MK9)'],
    postcodePrefixes: ['MK1–MK19', 'MK40–MK46', 'LU7'],
    seoTitle: '2-Man Bulky Goods & White-Glove Delivery in Milton Keynes | ben.',
    seoDescription:
      'Direct-to-crew 2-man sofa, furniture, KBB & white-glove delivery across Milton Keynes, Kiln Farm, Stacey Bushes & Bletchley. £440 ROC, £520 Assembly, £145 Friday Rescue.',
    heroSubtitle:
      'Flagship Hub 01 dispatch node covering Kiln Farm, Stacey Bushes, Winterhill, Bletchley & Newport Pagnell with vetted 3.5t Luton tail-lift and LWB/XLWB 2-man crews.',
    localAdvantages: [
      'Rapid 60-second dispatch from Kiln Farm, Stacey Bushes, Winterhill & Bletchley showrooms across a 35-mile MK9 radius.',
      'Zero 3PL broker markups — connect directly with £20k–£50k GIT & £1m+ PL insured 2-man crews.',
      'Driver-First LIFO van-bay loading sheet + local MK grid & tight-access Street-Sense hazard notes.'
    ],
    latitude: 52.0406,
    longitude: -0.7594
  },
  {
    slug: 'oxford',
    city: 'Oxford',
    hubName: 'Oxford & Bicester Hub',
    corridorTag: 'A34 / M40 Corridor, Botley, Cowley, Bicester Retail & Trade Parks',
    industrialEstates: ['Botley & Seacourt (OX2)', 'Cowley Business Park (OX4)', 'Bicester Launton Rd (OX26)', 'Kidlington (OX5)', 'Abingdon (OX14)'],
    postcodePrefixes: ['OX1–OX5', 'OX14', 'OX20', 'OX25–OX27'],
    seoTitle: '2-Man Bulky Goods & White-Glove Delivery in Oxford & Bicester | ben.',
    seoDescription:
      'Direct-to-crew 2-man furniture, bed & bespoke KBB delivery across Oxford, Bicester, Botley & Cowley (A34/M40). Zero 3PL lock-in, live SMS tracking & photographic PoD.',
    heroSubtitle:
      'Serving Oxford, Bicester, Botley, Cowley & Abingdon showrooms along the A34/M40 corridor with damage-shielded 2-man Room-of-Choice and white-glove assembly crews.',
    localAdvantages: [
      '35-mile hub radius linking Bicester, Oxford City, Cowley, Kidlington & Abingdon without double-handling.',
      'Ideal for period Oxford townhouses, narrow streets & bespoke KBB cabinetry requiring 2-man care.',
      'Live 3-stage customer SMS /track links + Condition Gate pre-load strapping verification.'
    ],
    latitude: 51.752,
    longitude: -1.2577
  },
  {
    slug: 'cambridge',
    city: 'Cambridge',
    hubName: 'Cambridge & Fenland Hub',
    corridorTag: 'A14 / M11 Corridor, Newmarket Road, Bar Hill, Huntingdon',
    industrialEstates: ['Newmarket Rd Retail Park (CB5)', 'Bar Hill (CB23)', 'Cambridge Science Park (CB4)', 'Huntingdon (PE29)', 'St Neots (PE19)'],
    postcodePrefixes: ['CB1–CB5', 'CB21–CB24', 'PE19', 'PE29'],
    seoTitle: '2-Man Bulky Goods & White-Glove Delivery in Cambridge | ben.',
    seoDescription:
      'Direct-to-crew 2-man bulky goods, furniture & BTR assembly across Cambridge, Bar Hill, Newmarket Road & Huntingdon (A14/M11). Transparent flat rates & live PoD.',
    heroSubtitle:
      'East-arc Hub 01 corridor covering Cambridge, Newmarket Road, Bar Hill, St Neots & Huntingdon via the A14/M11 with zero-retainer 2-man dispatch.',
    localAdvantages: [
      'Direct A428 / A14 / M11 trunking and multi-drop coverage linking Cambridge, St Neots & Huntingdon.',
      'White-glove £520/day Delivery & Assembly tier built for BTR developments, serviced apartments & studios.',
      'Instant photographic + e-signature Proof of Delivery archived for 90 days under UK GDPR.'
    ],
    latitude: 52.2053,
    longitude: 0.1218
  },
  {
    slug: 'northampton',
    city: 'Northampton',
    hubName: 'Northampton & Golden Triangle Hub',
    corridorTag: 'M1 J15/J16, Brackmills, Lodge Farm, Wellingborough',
    industrialEstates: ['Brackmills Industrial Estate (NN4)', 'Lodge Farm (NN5)', 'Kingsthorpe (NN2)', 'Wellingborough (NN8)', 'Kettering (NN15)'],
    postcodePrefixes: ['NN1–NN8', 'NN15–NN16', 'NN29'],
    seoTitle: '2-Man Bulky Goods & White-Glove Delivery in Northampton | ben.',
    seoDescription:
      'Direct-to-crew 2-man furniture, KBB & warehouse overflow delivery across Northampton, Brackmills, Lodge Farm & Wellingborough (M1 J15/J16).',
    heroSubtitle:
      'Golden Triangle dispatch node serving Brackmills, Lodge Farm, Kingsthorpe & Wellingborough with 3.5t Luton tail-lift, LWB/XLWB Sprinter & 7.5t crews.',
    localAdvantages: [
      'Direct M1 J15/J16 access for Brackmills & Lodge Farm trade counters, KBB studios & furniture depots.',
      '£145 Overflow Rescue Mini-Loop (1–4 drops, ≤3.5 hrs) clears missed pallet or failed 3PL drops fast.',
      'Asset-gated matching automatically restricts >100 kg loads to verified tail-lift 2-man crews.'
    ],
    latitude: 52.2405,
    longitude: -0.9027
  },
  {
    slug: 'bedford',
    city: 'Bedford',
    hubName: 'Bedford & A421 Corridor Hub',
    corridorTag: 'Elstow, Kempston, Wixams, Biggleswade',
    industrialEstates: ['Kempston / Interchange Park (MK42)', 'Elstow (MK42)', 'Wixams (MK42)', 'Cardington / Priors Hall (MK44)', 'Biggleswade (SG18)'],
    postcodePrefixes: ['MK40–MK45', 'SG18–SG19'],
    seoTitle: '2-Man Bulky Goods & White-Glove Delivery in Bedford | ben.',
    seoDescription:
      'Direct-to-crew 2-man sofa, bed & trade delivery across Bedford, Kempston, Elstow, Wixams & Biggleswade (A421 corridor). Pay-on-Success showroom pilot.',
    heroSubtitle:
      'A421 corridor coverage linking Bedford, Kempston, Elstow, Wixams & Biggleswade straight to Milton Keynes & Cambridge with vetted 2-man bulky crews.',
    localAdvantages: [
      'Seamless A421 east–west routing connecting Bedfordshire independents with MK & Cambridge buyers.',
      'Pay-on-Success Pilot for showrooms: £0.00 fee if a run fails due to crew error or platform fault.',
      'Client Vehicle Labour Pod (£350 ROC / £410 Assembly) lets you put our 2-man crews in your own van.'
    ],
    latitude: 52.136,
    longitude: -0.4667
  },
  {
    slug: 'luton',
    city: 'Luton',
    hubName: 'Luton & Dunstable M1 South Hub',
    corridorTag: 'M1 J10/J11, Woodside, Leighton Buzzard',
    industrialEstates: ['Woodside Industrial Estate (LU5)', 'Dunstable (LU5/LU6)', 'Luton Sundon Park (LU3)', 'Leighton Buzzard (LU7)', 'Houghton Regis (LU5)'],
    postcodePrefixes: ['LU1–LU7'],
    seoTitle: '2-Man Bulky Goods & White-Glove Delivery in Luton & Dunstable | ben.',
    seoDescription:
      'Direct-to-crew 2-man bulky goods & white-glove delivery across Luton, Dunstable, Woodside & Leighton Buzzard (M1 J10/J11). Zero 3PL middlemen.',
    heroSubtitle:
      'Southern Hub 01 gateway at M1 J10/J11 serving Luton, Dunstable, Woodside & Leighton Buzzard with ULEZ-compliant 3.5t LWB, XLWB & Luton 2-man crews.',
    localAdvantages: [
      'Fast M1 J10/J11 dispatch across Luton, Dunstable, Woodside & Leighton Buzzard plus North London spillover.',
      '5-Class Inclusive UK Commercial Fleet Taxonomy — Sprinters, Transits, Crafters, Tail-Lift Lutons & 7.5t trucks.',
      'Side-by-side AI Damage-Shield PoD + 48-hour damage SLA protects high-value showroom goods.'
    ],
    latitude: 51.8787,
    longitude: -0.42
  }
]

export function getRegionalHubBySlug(slug?: string | null): RegionalHubConfig {
  const normalized = (slug || '').trim().toLowerCase()
  return (
    REGIONAL_HUBS.find((h) => h.slug === normalized) || REGIONAL_HUBS[0]
  )
}
