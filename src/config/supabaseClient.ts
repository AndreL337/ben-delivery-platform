import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://taqwjalqflxxuskschzc.supabase.co'
export const supabaseAnonKey = 'sb_publishable_O6UTqJSmaEUl0ua23lh0zw_TUblF7U5'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      if (!response.ok && response.status >= 500) {
        try {
          const clone = response.clone()
          const body = await clone.json()
          const extractedMsg =
            body?.message || body?.msg || body?.error_description || body?.error
          if (extractedMsg) {
            Object.defineProperty(response, 'message', {
              value: `${extractedMsg}${body?.code ? ` (${body.code})` : ''}`,
              configurable: true,
              enumerable: true
            })
          }
        } catch {
          // ignore non-JSON 5xx bodies
        }
      }
      return response
    }
  }
})
