export type ReplyChannel = 'facebook_group' | 'retailer_email'

export type ReplyScenario =
  | 'auto'
  | 'broker_skeptic'
  | 'van_insurance'
  | 'route_volume'
  | 'routing_pay'
  | 'retailer_followup'

export type ResolvedReplyScenario = Exclude<ReplyScenario, 'auto'>

export interface GeneratedReplyResult {
  scenario: ResolvedReplyScenario
  scenarioLabel: string
  channel: ReplyChannel
  draft: string
  matchedSignals: string[]
}

export const REPLY_SCENARIO_OPTIONS: Array<{
  id: ReplyScenario
  label: string
}> = [
  { id: 'auto', label: 'Auto-Detect' },
  { id: 'broker_skeptic', label: 'Broker Skeptic / Troll' },
  { id: 'van_insurance', label: 'Van & Insurance' },
  { id: 'route_volume', label: 'Route Volume' },
  { id: 'routing_pay', label: 'Routing & Pay' },
  { id: 'retailer_followup', label: 'Retailer Follow-Up' }
]

const SCENARIO_LABELS: Record<ResolvedReplyScenario, string> = {
  broker_skeptic: 'Broker Skeptic / Troll',
  van_insurance: 'Van & Insurance',
  route_volume: 'Route Volume',
  routing_pay: 'Routing & Pay',
  retailer_followup: 'Retailer Follow-Up'
}

const SCENARIO_KEYWORDS: Record<ResolvedReplyScenario, string[]> = {
  broker_skeptic: [
    'broker',
    'middleman',
    'wolf',
    'scam',
    'markup',
    'mark-up',
    'shave',
    'commission',
    'agency',
    'cut',
    'rip off',
    'ripoff',
    'cheap',
    '3pl',
    'parasite',
    'rate card',
    'prove'
  ],
  van_insurance: [
    'insurance',
    'git',
    'goods in transit',
    'public liability',
    'hire and reward',
    'hire & reward',
    'luton',
    'tail lift',
    'tail-lift',
    'sprinter',
    'lwb',
    'xlwb',
    'van class',
    'ir35',
    'substitution',
    'compliance',
    'documents',
    'policy'
  ],
  route_volume: [
    'work',
    'volume',
    'available',
    'availability',
    'routes',
    'how many',
    'consistent',
    'full time',
    'standby',
    'waitlist',
    'onboarding',
    'mk',
    'milton keynes',
    'oxford',
    'cambridge',
    'northampton',
    'bedford',
    'luton',
    'busy'
  ],
  routing_pay: [
    'route',
    'routing',
    'lifo',
    'bulk-first',
    'bulk first',
    'out-and-back',
    'out and back',
    'home postcode',
    'bacs',
    'paid',
    'payout',
    'pay',
    'split',
    '87.5',
    '3rd floor',
    'third floor',
    'heavy access',
    'drop cap',
    '12-16',
    'drops'
  ],
  retailer_followup: [
    'tell me more',
    'pricing',
    'quote',
    'overflow',
    'friday rescue',
    'showroom',
    'retailer',
    'sofa',
    'furniture',
    'kbb',
    'staging',
    'pod',
    'proof of delivery',
    'pay on success',
    'pay-on-success',
    'book',
    'dispatch'
  ]
}

export function detectReplyScenario(
  inboundText: string,
  channel: ReplyChannel
): { scenario: ResolvedReplyScenario; matchedSignals: string[] } {
  const normalized = inboundText.toLowerCase().trim()

  if (!normalized) {
    return {
      scenario: channel === 'retailer_email' ? 'retailer_followup' : 'route_volume',
      matchedSignals: []
    }
  }

  let bestScenario: ResolvedReplyScenario =
    channel === 'retailer_email' ? 'retailer_followup' : 'broker_skeptic'
  let bestScore = 0
  let bestSignals: string[] = []

  const candidates: ResolvedReplyScenario[] = [
    'broker_skeptic',
    'van_insurance',
    'route_volume',
    'routing_pay',
    'retailer_followup'
  ]

  for (const candidate of candidates) {
    const signals = SCENARIO_KEYWORDS[candidate].filter((kw) => normalized.includes(kw))
    const channelBonus =
      channel === 'retailer_email' && candidate === 'retailer_followup' ? 0.5 : 0
    const score = signals.length + channelBonus

    if (score > bestScore) {
      bestScore = score
      bestScenario = candidate
      bestSignals = signals
    }
  }

  return {
    scenario: bestScenario,
    matchedSignals: bestSignals
  }
}

function buildReplyText(
  scenario: ResolvedReplyScenario,
  channel: ReplyChannel
): string {
  switch (scenario) {
    case 'broker_skeptic':
      if (channel === 'retailer_email') {
        return [
          'Hi,',
          '',
          'Totally fair question — we publish our exact 2026 numbers openly so there are zero hidden broker markups.',
          '',
          'Every run on ben. operates on a flat 87.5% net crew split (12.5% platform fee): £440 Standard ROC (£385 net to crew), £520 White-Glove Assembly (£455 net to crew), and £145 Overflow / Friday Rescue (£126.88 net to crew), plus 100% of any £25 3rd-floor/no-lift heavy-access fee goes straight to the crew.',
          '',
          'ben. was built by an ex-multi-drop and 2-man driver specifically to strip out opaque 3PL middleman margins. You can verify the full tariff directly at https://www.benlogistics.co.uk/rate-card.',
          '',
          'Best,',
          'Andre',
          'Ben Logistics UK (ben.)'
        ].join('\n')
      }
      return [
        'Fair challenge — no smoke and mirrors here. ben. was built by an ex-multi-drop and 2-man driver because 3PLs shaving 35-40% off day rates is broken.',
        '',
        'Our public 2026 rate card (https://www.benlogistics.co.uk/rate-card) shows the exact split: 87.5% net straight to the 2-man crew (12.5% platform fee). That is £385 net on a £440 ROC day (12-16 drops), £455 net on a £520 Assembly day, and £126.88 net on a £145 Rescue Mini-Loop — plus 100% of the £25 3rd-floor/no-lift fee goes to the crew.',
        '',
        'No hidden broker markup, no agency lock-in. Full breakdown is on https://www.benlogistics.co.uk/driver.'
      ].join('\n')

    case 'van_insurance':
      if (channel === 'retailer_email') {
        return [
          'Hi,',
          '',
          'Every 2-man crew dispatched through ben. is vetted before going live on Hub 01:',
          '- Vehicle: 3.5t LWB/XLWB panel van or 3.5t Tail-Lift Luton',
          '- Insurance: Active Hire & Reward, £20k+ Goods-in-Transit (GIT), and £1m+ Public Liability',
          '- Compliance: Outside-IR35 commercial contractor terms with full Right of Substitution',
          '',
          'You can also view our full 2026 tariff and Condition Gate / Damage-Shield PoD standards at https://www.benlogistics.co.uk/rate-card.',
          '',
          'Best,',
          'Andre',
          'Ben Logistics UK (ben.)'
        ].join('\n')
      }
      return [
        'Good question — here is the exact compliance checklist for Hub 01:',
        '- Vehicle: 3.5t LWB/XLWB Sprinter/Transit/Crafter or 3.5t Tail-Lift Luton',
        '- Insurance: Hire & Reward, £20k+ Goods-in-Transit (GIT), and £1m+ Public Liability',
        '- Status: Outside-IR35 commercial terms with full Right of Substitution',
        '',
        'Takes 60 seconds to upload docs and join the standby board at https://www.benlogistics.co.uk/driver.'
      ].join('\n')

    case 'route_volume':
      if (channel === 'retailer_email') {
        return [
          'Hi,',
          '',
          'We are actively running founding Hub 01 coverage across Milton Keynes, Oxford, Cambridge, Northampton, Bedford, and Luton (35-mile hub radius, 12-16 drop cap on full-day ROC manifests).',
          '',
          'There is no retainer or minimum commitment — you can keep us on file for overflow or Friday rescue runs whenever your schedule tightens. Full tariff: https://www.benlogistics.co.uk/rate-card.',
          '',
          'Best,',
          'Andre',
          'Ben Logistics UK (ben.)'
        ].join('\n')
      }
      return [
        'We are onboarding founding 2-man crews across Hub 01 (Milton Keynes, Oxford, Cambridge, and the M1 corridor — 35-mile radius, 12-16 drop cap on ROC days).',
        '',
        'It is £0 to sit on the standby roster with zero exclusivity — keep all your current work and only pick up runs that fit your week (£385 net ROC, £455 net Assembly, £126.88 net Rescue Mini-Loop).',
        '',
        'Register your vehicle and availability in 60 seconds at https://www.benlogistics.co.uk/driver.'
      ].join('\n')

    case 'routing_pay':
      if (channel === 'retailer_email') {
        return [
          'Hi,',
          '',
          'Our Driver-First Routing Engine sequences each manifest either Bulk-First or Out-and-Back toward the crew home postcode, paired with a Reverse-Load LIFO van-bay sheet so heavy items come off cleanly in order.',
          '',
          'Crews receive 87.5% net (£385 ROC / £455 Assembly / £126.88 Rescue Mini-Loop) plus 100% of any £25 3rd-floor/no-lift fees via Friday BACS settlement. Full 2026 rate card: https://www.benlogistics.co.uk/rate-card.',
          '',
          'Best,',
          'Andre',
          'Ben Logistics UK (ben.)'
        ].join('\n')
      }
      return [
        'We built the routing and payout flow around how 2-man crews actually work:',
        '- Driver-First Routing Engine: Pick Bulk-First (clear heavy sofas early) or Out-and-Back toward your home postcode, locked onto a Reverse-Load LIFO van-bay sheet.',
        '- Transparent 87.5% Net Split: £385 ROC (12-16 drop cap, 35-mile Hub 01 radius), £455 Assembly, £126.88 Rescue Mini-Loop, plus 100% of any £25 3rd-floor/no-lift fee.',
        '- Settlement: Clean Friday BACS payout.',
        '',
        'Full details and signup: https://www.benlogistics.co.uk/driver'
      ].join('\n')

    case 'retailer_followup':
    default:
      if (channel === 'facebook_group') {
        return [
          'Happy to share the commercial breakdown — we cover Hub 01 (MK, Oxford, Cambridge, Northampton, Bedford & Luton within a 35-mile radius) with vetted, £20k+ GIT / £1m+ PL insured 2-man crews.',
          '',
          'Flat rates: £145 Overflow / Friday Rescue (1-4 drops), £440 Standard 2-Man ROC (12-16 drops), and £520 White-Glove Delivery & Assembly. Every run includes Damage-Shield photo PoD and our Pay-on-Success guarantee (£0.00 fee on your first 3 runs if we fail).',
          '',
          'Full 2026 rate card: https://www.benlogistics.co.uk/rate-card'
        ].join('\n')
      }
      return [
        'Hi,',
        '',
        'Thanks for replying — no pressure to change your current carrier setup, we work best as your Hub 01 overflow and Friday rescue backup (35-mile radius across MK, Oxford, Cambridge, Northampton, Bedford & Luton).',
        '',
        'Transparent 2026 flat rates (https://www.benlogistics.co.uk/rate-card):',
        '- Overflow / Friday Rescue: £145 flat (1-4 urgent drops)',
        '- Standard 2-Man Room-of-Choice: £440 / day (12-16 drop cap)',
        '- White-Glove Delivery & Assembly: £520 / day (unboxing, assembly & packaging removal)',
        '',
        'Every job includes Pre-Load Condition Gate photos, Damage-Shield photo + e-signature PoD, and our Pay-on-Success guarantee: your first 3 runs are £0.00 if we fail due to crew error or platform fault.',
        '',
        'Just reply with a collection/drop postcode and target date whenever you need cover.',
        '',
        'Best,',
        'Andre',
        'Ben Logistics UK (ben.)'
      ].join('\n')
  }
}

export function generateCommunityReply(
  inboundText: string,
  channel: ReplyChannel,
  selectedScenario: ReplyScenario = 'auto'
): GeneratedReplyResult {
  const detection =
    selectedScenario === 'auto'
      ? detectReplyScenario(inboundText, channel)
      : { scenario: selectedScenario, matchedSignals: [] }

  return {
    scenario: detection.scenario,
    scenarioLabel: SCENARIO_LABELS[detection.scenario],
    channel,
    draft: buildReplyText(detection.scenario, channel),
    matchedSignals: detection.matchedSignals
  }
}
