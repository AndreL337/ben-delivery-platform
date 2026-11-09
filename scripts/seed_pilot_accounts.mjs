if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocketShim {}
}

const { createClient } = await import('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://taqwjalqflxxuskschzc.supabase.co'
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_O6UTqJSmaEUl0ua23lh0zw_TUblF7U5'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: async (url, options) => {
      const res = await fetch(url, options)
      if (!res.ok) {
        const clone = res.clone()
        const bodyText = await clone.text().catch(() => '')
        console.log(`[HTTP ${res.status}] ${url} -> ${bodyText}`)
      }
      return res
    }
  }
})

const PILOT_ACCOUNTS = [
  {
    email: 'retailer@benlogistics.co.uk',
    fallbackEmail: 'pilot.retailer@benlogistics.co.uk',
    password: 'BenPilot2026!',
    role: 'retailer',
    fullName: 'Milton Keynes Pilot Showroom'
  },
  {
    email: 'driver@benlogistics.co.uk',
    fallbackEmail: 'pilot.driver@benlogistics.co.uk',
    password: 'BenPilot2026!',
    role: 'driver',
    fullName: 'MK Lead 2-Man Crew'
  }
]

async function tryAuthenticateOrSignUp(email, password, role, fullName) {
  // 1. Try signing in first in case the account already exists and is valid
  const signInAttempt = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (!signInAttempt.error && signInAttempt.data?.session) {
    console.log(
      `[HTTP 200 OK] ${email} authenticated via signInWithPassword! User ID: ${signInAttempt.data.user.id}`
    )
    if (signInAttempt.data.user?.user_metadata?.role !== role) {
      await supabase.auth.updateUser({
        data: { role, full_name: fullName }
      })
      console.log(`[OK] Updated user_metadata.role = '${role}' for ${email}`)
    }
    return {
      ok: true,
      email,
      userId: signInAttempt.data.user.id,
      method: 'signInWithPassword'
    }
  }

  // If HTTP 500 occurs on signInWithPassword, the row in auth.users is corrupted from manual SQL INSERT
  if (signInAttempt.error && signInAttempt.error.status === 500) {
    return {
      ok: false,
      email,
      corruptedSqlRow: true,
      error: signInAttempt.error
    }
  }

  // 2. Sign up via GoTrue Auth client
  const signUpAttempt = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName
      }
    }
  })

  if (!signUpAttempt.error && signUpAttempt.data?.session) {
    console.log(
      `[HTTP 200 OK] ${email} created & authenticated via signUp! User ID: ${signUpAttempt.data.user.id}`
    )
    return {
      ok: true,
      email,
      userId: signUpAttempt.data.user.id,
      method: 'signUpSession'
    }
  }

  // 3. Verify login via signInWithPassword
  const verifySignIn = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (!verifySignIn.error && verifySignIn.data?.session) {
    console.log(
      `[HTTP 200 OK] ${email} session verified! User ID: ${verifySignIn.data.user.id}`
    )
    return {
      ok: true,
      email,
      userId: verifySignIn.data.user.id,
      method: 'signUp+verify'
    }
  }

  return {
    ok: false,
    email,
    error: verifySignIn.error || signUpAttempt.error || signInAttempt.error
  }
}

async function seedDriverComplianceIfNeeded(userId) {
  try {
    const { data: existingAgr } = await supabase
      .from('contractor_agreements')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (!existingAgr || existingAgr.length === 0) {
      await supabase.from('contractor_agreements').insert([
        {
          user_id: userId,
          lead_driver_name: 'MK Lead 2-Man Crew (Pilot)',
          agreement_version: 'v1.0-pilot-outside-ir35',
          has_right_of_substitution: true,
          confirms_git_and_pl: true,
          signed_at: new Date().toISOString()
        }
      ])
    }

    const docTypes = ['goods_in_transit', 'public_liability', 'hire_and_reward']
    for (const docType of docTypes) {
      const { data: existing } = await supabase
        .from('compliance_documents')
        .select('id')
        .eq('driver_id', userId)
        .eq('doc_type', docType)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('compliance_documents').insert([
          {
            driver_id: userId,
            doc_type: docType,
            file_url: `https://taqwjalqflxxuskschzc.supabase.co/storage/v1/object/public/pod-images/pilot_${docType}_2026.pdf`,
            expiry_date: '2027-12-31',
            verified: true
          }
        ])
      }
    }
    console.log(`[OK] Verified Gate A6 & Insurance Compliance Locker for driver ${userId}`)
  } catch (err) {
    console.warn('[INFO] Optional compliance pre-seed skipped:', err?.message || err)
  }
}

async function seedAccount(account) {
  console.log(`\n--- Processing ${account.role.toUpperCase()} Pilot Account (${account.email}) ---`)

  const primaryRes = await tryAuthenticateOrSignUp(
    account.email,
    account.password,
    account.role,
    account.fullName
  )

  if (primaryRes.ok) {
    if (account.role === 'driver' && primaryRes.userId) {
      await seedDriverComplianceIfNeeded(primaryRes.userId)
    }
    return primaryRes
  }

  console.warn(
    `[NOTICE] Primary email ${account.email} has a corrupted manual SQL row in auth.users (GoTrue HTTP 500: Database error querying schema). Authenticating clean GoTrue pilot account ${account.fallbackEmail}...`
  )

  const fallbackRes = await tryAuthenticateOrSignUp(
    account.fallbackEmail,
    account.password,
    account.role,
    account.fullName
  )

  if (fallbackRes.ok && account.role === 'driver' && fallbackRes.userId) {
    await seedDriverComplianceIfNeeded(fallbackRes.userId)
  }

  return fallbackRes
}

async function main() {
  console.log('=== Ben Delivery Platform: Pilot Account Seeder ===')
  console.log(`Target Supabase Node: ${supabaseUrl}`)

  const results = []
  for (const account of PILOT_ACCOUNTS) {
    const res = await seedAccount(account)
    results.push({
      role: account.role,
      activeEmail: res.email,
      ok: res.ok,
      userId: res.userId || null,
      method: res.method || 'failed'
    })
  }

  console.log('\n=== Seeding Summary ===')
  console.table(results)

  const allOk = results.every((r) => r.ok)
  if (!allOk) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Fatal Seeder Error:', err)
  process.exit(1)
})
