import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://taqwjalqflxxuskschzc.supabase.co'
export const supabaseAnonKey = 'sb_publishable_O6UTqJSmaEUl0ua23lh0zw_TUblF7U5'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
