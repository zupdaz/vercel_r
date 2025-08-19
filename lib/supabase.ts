import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

// Initialize Supabase client
let supabaseClient: SupabaseClient | null = null

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials not found in environment variables")
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey)
  return supabaseClient
}

export { getSupabaseClient }
