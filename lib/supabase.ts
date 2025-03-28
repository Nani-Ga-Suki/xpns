"use client"

import { createClient } from "@supabase/supabase-js"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// For server components
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Global client instance
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null

export function getSupabaseBrowser() {
  if (typeof window === "undefined") {
    // Server-side - create a new instance
    return createClientComponentClient<Database>()
  }

  if (!clientInstance) {
    console.log("Creating new Supabase client instance")
    clientInstance = createClientComponentClient<Database>({
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
      options: {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    })
  }

  return clientInstance
}

// Function to completely reset the client instance
export function resetSupabaseClient() {
  console.log("Completely resetting Supabase client")
  clientInstance = null
  return getSupabaseBrowser()
}

