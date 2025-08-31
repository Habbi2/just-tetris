import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
}

// For backwards compatibility, but components should use createClientComponentClient directly
export const createSupabaseClient = () => {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.warn('Supabase configuration is missing. Please check your environment variables.')
    return null
  }
  
  return createClientComponentClient()
}
