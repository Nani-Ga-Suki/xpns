"use client"

import { useMemo } from "react"
import { DollarSign, TrendingDown, TrendingUp, BarChart3, Percent } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import type { Transaction } from "@/types/supabase"

interface ExpenseStatsProps {
  totalBalance: string
  totalIncome: string
  totalExpenses: string
  transactionCount: number
  transactions: Transaction[]
  isLoading?: boolean
}

export function ExpenseStats({
  totalBalance,
  totalIncome,
  totalExpenses,
  transactionCount,
  transactions,
  isLoading = false,
}: ExpenseStatsProps) {
  // Calculate this month's expenses
  const thisMonthData = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date + 'T00:00:00Z') // Parse as UTC
      return transactionDate.getUTCMonth() === currentMonth && transactionDate.getUTCFullYear() === currentYear
    })

    const thisMonthExpenses = thisMonthTransactions
      .filter((t) => t.type === "expense")
      .reduce((total, t) => total + Number(t.amount), 0)

    const thisMonthIncome = thisMonthTransactions
      .filter((t) => t.type === "income")
      .reduce((total, t) => total + Number(t.amount), 0)

    return {
      expenses: thisMonthExpenses,
      income: thisMonthIncome,
      balance: thisMonthIncome - thisMonthExpenses,
    }
  }, [transactions])

  // Calculate last month's data
  const lastMonthData = useMemo(() => {
    const now = new Date()
    let lastMonth = now.getMonth() - 1
    let lastMonthYear = now.getFullYear()

    if (lastMonth < 0) {
      lastMonth = 11
      lastMonthYear--
    }

    const lastMonthTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date + 'T00:00:00Z') // Parse as UTC
      return transactionDate.getUTCMonth() === lastMonth && transactionDate.getUTCFullYear() === lastMonthYear
    })

    const lastMonthExpenses = lastMonthTransactions
      .filter((t) => t.type === "expense")
      .reduce((total, t) => total + Number(t.amount), 0)

    return {
      expenses: lastMonthExpenses,
    }
  }, [transactions])

  // Calculate month-over-month change
  const monthOverMonthChange = useMemo(() => {
    if (lastMonthData.expenses === 0) return 100 // If last month was 0, consider it 100% increase

    return ((thisMonthData.expenses - lastMonthData.expenses) / lastMonthData.expenses) * 100
  }, [thisMonthData.expenses, lastMonthData.expenses])

  // Calculate savings rate
  const savingsRate = useMemo(() => {
    if (thisMonthData.income === 0) return 0

    const savingsAmount = thisMonthData.income - thisMonthData.expenses
    return (savingsAmount / thisMonthData.income) * 100
  }, [thisMonthData])

  // Find top category
  const topCategory = useMemo(() => {
    // Separate categories by type
    const expenseCategoryTotals: Record<string, number> = {}
    const incomeCategoryTotals: Record<string, number> = {}

    transactions.forEach((transaction) => {
      if (!transaction.category) return

      if (transaction.type === "expense") {
        if (expenseCategoryTotals[transaction.category]) {
          expenseCategoryTotals[transaction.category] += Number(transaction.amount)
        } else {
          expenseCategoryTotals[transaction.category] = Number(transaction.amount)
        }
      } else {
        if (incomeCategoryTotals[transaction.category]) {
          incomeCategoryTotals[transaction.category] += Number(transaction.amount)
        } else {
          incomeCategoryTotals[transaction.category] = Number(transaction.amount)
        }
      }
    })

    // Find top expense category
    let topExpenseCategory = { name: "", amount: 0, type: "expense" as const }
    if (Object.keys(expenseCategoryTotals).length > 0) {
      const [topCategoryId, amount] = Object.entries(expenseCategoryTotals).sort((a, b) => b[1] - a[1])[0]
      topExpenseCategory = {
        name: topCategoryId.charAt(0).toUpperCase() + topCategoryId.slice(1),
        amount,
        type: "expense" as const,
      }
    }

    // Find top income category
    let topIncomeCategory = { name: "", amount: 0, type: "income" as const }
    if (Object.keys(incomeCategoryTotals).length > 0) {
      const [topCategoryId, amount] = Object.entries(incomeCategoryTotals).sort((a, b) => b[1] - a[1])[0]
      topIncomeCategory = {
        name: topCategoryId.charAt(0).toUpperCase() + topCategoryId.slice(1),
        amount,
        type: "income" as const,
      }
    }

    // Return the category with the highest amount
    if (topExpenseCategory.amount > topIncomeCategory.amount) {
      return topExpenseCategory
    } else if (topIncomeCategory.amount > 0) {
      return topIncomeCategory
    }

    return null
  }, [transactions])

  // Animation variants for cards
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  }

  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <Card className="card-transition">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                ${Number(totalBalance) >= 0 ? totalBalance : `(${Math.abs(Number(totalBalance)).toFixed(2)})`}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Lifetime total across all categories</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="card-transition">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold text-foreground">${thisMonthData.expenses.toFixed(2)}</div>
            )}
            <div className="flex items-center pt-1">
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : monthOverMonthChange > 0 ? (
                <>
                  <TrendingUp className="mr-1 h-3 w-3 text-destructive" />
                  <span className="text-xs text-destructive">
                    {Math.abs(monthOverMonthChange).toFixed(1)}% from last month
                  </span>
                </>
              ) : monthOverMonthChange < 0 ? (
                <>
                  <TrendingDown className="mr-1 h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">
                    {Math.abs(monthOverMonthChange).toFixed(1)}% from last month
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No change from last month</span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="card-transition">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-primary"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{topCategory ? topCategory.name : "N/A"}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {isLoading ? (
                <Skeleton className="h-4 w-32 mt-1" />
              ) : topCategory ? (
                topCategory.type === "income" ? (
                  `$${topCategory.amount.toFixed(2)} total received`
                ) : (
                  `$${topCategory.amount.toFixed(2)} total spent`
                )
              ) : (
                "No transactions recorded yet"
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="card-transition">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : thisMonthData.income > 0 ? (
              <>
                <div className="text-3xl font-bold text-foreground">{savingsRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {savingsRate >= 0
                    ? `Saving ${savingsRate.toFixed(1)}% of income this month`
                    : `Spending ${Math.abs(savingsRate).toFixed(1)}% more than income`}
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground">0.0%</div>
                <p className="text-xs text-muted-foreground mt-1">No income recorded this month</p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

