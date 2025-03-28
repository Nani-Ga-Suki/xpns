"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import type { Transaction } from "@/types/supabase"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

export function useTransactions(userId: string, initialData?: Transaction[]) {
  const supabase = getSupabaseBrowser()
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<Error | null>(null)
  const { forceRefresh } = useAuth()
  const router = useRouter()

  // Define the fetcher function inside the hook
  const fetchTransactions = async () => {
    try {
      console.log("Fetching transactions for user:", userId)

      // Check if we have a valid session before fetching
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        console.warn("No active session, attempting to refresh...")
        const success = await forceRefresh()
        if (!success) {
          console.error("Session refresh failed, redirecting to login")
          router.push("/login")
          throw new Error("Authentication error - please log in again")
        }
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })

      if (error) {
        console.error("Error fetching transactions:", error)

        // If we get an auth error, try to refresh the session
        if (error.code === "PGRST301" || error.message.includes("JWT") || error.message.includes("auth")) {
          console.log("Auth error detected, forcing refresh...")
          const success = await forceRefresh()
          if (!success) {
            router.push("/login")
            throw new Error("Authentication error - please log in again")
          }
          throw new Error("Please try again after session refresh")
        }

        setLastError(new Error(error.message))
        throw error
      }

      if (!data) {
        console.warn("No data returned from transactions query")
        return []
      }

      console.log(`Fetched ${data.length} transactions`)

      // Reset retry count on successful fetch
      setRetryCount(0)
      setLastError(null)

      return data.map((t) => ({
        ...t,
        amount: Number(t.amount),
      }))
    } catch (err) {
      console.error("Transaction fetch error:", err)
      throw err
    }
  }

  // Auto-retry logic for persistent errors
  useEffect(() => {
    if (lastError && retryCount < 3) {
      const timer = setTimeout(
        () => {
          console.log(`Retry attempt ${retryCount + 1} for transactions fetch`)
          setRetryCount((prev) => prev + 1)
          mutate()
        },
        3000 * (retryCount + 1),
      ) // Exponential backoff

      return () => clearTimeout(timer)
    }

    // If we've tried 3 times and still have errors, redirect to login
    if (lastError && retryCount >= 3) {
      console.log("Max retries reached, redirecting to login")
      router.push("/login")
    }
  }, [lastError, retryCount, router])

  const { data, error, isLoading, mutate } = useSWR(userId ? `transactions-${userId}` : null, fetchTransactions, {
    fallbackData: initialData,
    onError: (err) => {
      console.error("SWR error in useTransactions:", err)
      setLastError(err)
    },
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    errorRetryCount: 3,
  })

  return {
    transactions: data || [],
    isLoading,
    isError: !!error,
    mutate,
    retry: async () => {
      setRetryCount(0)
      setLastError(null)
      // Try to refresh the session before retrying
      await forceRefresh()
      return mutate()
    },
  }
}

