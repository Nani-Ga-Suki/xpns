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
    console.log("Force refreshing auth state")
    setIsLoading(true)
    setAuthError(false)

    try {
      // First try to refresh the session
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error("Error refreshing session:", error)
        // Reset the client and try again
        const newClient = resetSupabaseClient()
        const { data: newData, error: newError } = await newClient.auth.refreshSession()

        if (newError) {
          console.error("Error after client reset:", newError)
          setAuthError(true)
          return false
        }

        if (newData.session) {
          setSession(newData.session)
          setUser(newData.user)
          return true
        }
      } else if (data.session) {
        setSession(data.session)
        setUser(data.user)
        return true
      }

      // If we get here with no session, redirect to login
      console.log("No session after refresh attempts, redirecting to login")
      router.push("/login")
      return false
    } catch (error) {
      console.error("Unexpected error in forceRefresh:", error)
      setAuthError(true)
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
        supabase.auth.getUser().then(({ data }) => {
          if (mounted && data.user) {
            setUser(data.user)
          }
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth, router])

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
      await supabase.auth.signOut()

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

