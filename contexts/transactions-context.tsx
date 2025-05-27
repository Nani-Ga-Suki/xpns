"use client"

import React, { createContext, useContext, useState, ReactNode, useMemo } from "react"
import { useTransactions } from "@/hooks/use-transactions"
import { useAuth } from "@/components/auth-provider"
import type { Transaction } from "@/types/supabase"

interface TransactionsContextType {
  transactions: Transaction[]
  isLoading: boolean
  isError: boolean
  mutate: () => Promise<any> // Adjust the return type if needed
  retry: () => Promise<any>
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined)

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth() // Corrected alias
  const userId = user?.id

  // Pass initialData as undefined, let SWR handle caching
  const {
    transactions,
    isLoading: transactionsLoading,
    isError,
    mutate,
    retry,
  } = useTransactions(userId || "", undefined) // Pass empty string if no userId yet, hook handles null key

  // Combine auth loading and transactions loading
  const isLoading = authLoading || (!!userId && transactionsLoading)

  const value = useMemo(() => ({
    transactions,
    isLoading,
    isError,
    mutate,
    retry,
  }), [transactions, isLoading, isError, mutate, retry])

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  )
}

export function useTransactionsContext() {
  const context = useContext(TransactionsContext)
  if (context === undefined) {
    throw new Error("useTransactionsContext must be used within a TransactionsProvider")
  }
  return context
}