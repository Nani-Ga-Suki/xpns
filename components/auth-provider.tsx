"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabaseBrowser, resetSupabaseClient } from "@/lib/supabase"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
  forceRefresh: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  forceRefresh: async () => false,
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<boolean>(false)
  const router = useRouter()
  const [supabase] = useState(getSupabaseBrowser())

  // Force refresh function - completely resets everything
  const forceRefresh = async (): Promise<boolean> => {
    console.log("[AUTH_PROVIDER] Attempting force refresh of auth state...")
    setIsLoading(true)
    setAuthError(false)

    try {
      if (!supabase || !supabase.auth) {
        console.error("[AUTH_PROVIDER] Supabase client or supabase.auth is not initialized in forceRefresh.")
        setAuthError(true)
        return false
      }

      // Log current session from Supabase JS library perspective
      const { data: { session: currentSupabaseJsSession }, error: getSessionError } = await supabase.auth.getSession()
      if (getSessionError) {
        console.error("[AUTH_PROVIDER] Error calling supabase.auth.getSession() before refresh:", getSessionError)
      } else {
        console.log("[AUTH_PROVIDER] Session from supabase.auth.getSession() before refresh attempt:", currentSupabaseJsSession)
      }
      console.log("[AUTH_PROVIDER] AuthProvider's current 'session' state before refresh attempt:", session)


      console.log("[AUTH_PROVIDER] Attempting supabase.auth.refreshSession().")
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error("[AUTH_PROVIDER] Error during supabase.auth.refreshSession():", error)
        // If refresh fails, it's crucial to clear local session state as it's likely invalid
        setUser(null)
        setSession(null)
        setAuthError(true) // Indicate an auth error occurred
        // No need to redirect here, let the useEffect for authError handle it or the calling function.
        return false // Indicate refresh failure
      }
      
      if (data.session) {
        console.log("[AUTH_PROVIDER] Session refreshed successfully. New session:", data.session)
        setSession(data.session)
        setUser(data.user)
        return true // Indicate refresh success
      }
      
      // If refreshSession succeeded but returned no session (should be rare if no error)
      console.warn("[AUTH_PROVIDER] supabase.auth.refreshSession() succeeded but returned no session data.")
      setUser(null)
      setSession(null)
      setAuthError(true)
      return false

    } catch (err) {
      console.error("[AUTH_PROVIDER] Unexpected error in forceRefresh:", err)
      setAuthError(true) // Ensure authError is set for any unexpected error
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Initial auth check and subscription setup
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      setIsLoading(true)

      try {
        if (!supabase) {
          console.error("[AUTH_PROVIDER] Supabase client is not initialized in initAuth.")
          if (mounted) {
            setAuthError(true)
            setIsLoading(false)
          }
          return
        }
        // Get the session
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Error getting initial session:", sessionError)
          if (mounted) {
            setAuthError(true)
            setIsLoading(false)
          }
          return
        }

        if (!initialSession) {
          console.log("No initial session found")
          if (mounted) {
            setUser(null)
            setSession(null)
            setIsLoading(false)
          }
          return
        }

        // Get the user
        const {
          data: { user: initialUser },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          console.error("Error getting initial user:", userError)
          if (mounted) {
            setAuthError(true)
            setIsLoading(false)
          }
          return
        }

        if (mounted) {
          setUser(initialUser)
          setSession(initialSession)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Unexpected error in initAuth:", error)
        if (mounted) {
          setAuthError(true)
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Set up auth state change listener
    if (supabase && supabase.auth) { // Ensure supabase.auth is also checked
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        console.log("Auth state changed:", event)

        if (!mounted) return

        if (event === "SIGNED_OUT") {
          setUser(null)
          setSession(null)
          return
        }

        if (newSession) {
          setUser(newSession.user)
          setSession(newSession)
        } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          // For these events, we need to get the latest user data
          // Also check supabase and supabase.auth here
          if (supabase && supabase.auth) {
            supabase.auth.getUser().then(({ data }) => {
              if (mounted && data.user) {
                setUser(data.user)
              }
            })
          }
        }
      })

      return () => {
        mounted = false
        subscription?.unsubscribe()
      }
    } else {
      console.error("[AUTH_PROVIDER] Supabase client or supabase.auth is not initialized, cannot set up auth state listener.")
      // Ensure useEffect cleanup function is always returned
      return () => {
        mounted = false
      }
    }
  }, [supabase, router])

  // Handle auth errors
  useEffect(() => {
    if (authError && !isLoading) {
      console.log("Auth error detected, redirecting to login")
      // Redirect to login after a short delay
      const timer = setTimeout(() => {
        router.push("/login")
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [authError, isLoading, router])

  const signOut = async () => {
    try {
      setIsLoading(true)
      if (supabase && supabase.auth) { // Ensure supabase.auth is also checked
        await supabase.auth.signOut()
      } else {
        console.error("[AUTH_PROVIDER] Supabase client or supabase.auth not initialized, cannot sign out.")
      }

      // Clear state
      setUser(null)
      setSession(null)

      // Force navigation to login page
      window.location.href = "/login"
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const value = {
    user,
    session,
    isLoading,
    signOut,
    forceRefresh,
  }

  // Show auth error recovery UI if needed
  if (authError && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Session Error</h2>
          <p className="text-muted-foreground mb-6">There was a problem with your session. Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

