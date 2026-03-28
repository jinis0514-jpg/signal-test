import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('SUPABASE URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('SUPABASE ANON EXISTS:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabase = (url && anon)
  ? createClient(url, anon)
  : null

export function isSupabaseConfigured() {
  return !!supabase
}

