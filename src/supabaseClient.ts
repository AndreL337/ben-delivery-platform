const supabaseUrl = 'https://taqwjalqflxxuskschzc.supabase.co'
const supabaseKey = 'sb_publishable_O6UTqJSmaEUl0ua23lh0zw_TUblF7U5'

export const supabase = (window as any).supabase.createClient(supabaseUrl, supabaseKey)