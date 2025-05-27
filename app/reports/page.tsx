"use client" // Required for useState

import { useState, useEffect, useTransition, Suspense } from "react" // Import useState, useEffect, useTransition, Suspense
import type { Metadata } from "next"
import dynamic from "next/dynamic" // Import dynamic
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs" // Use client version
import { DashboardShell } from "@/components/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton" // Import Skeleton for fallback

// Lazy load chart components
const Overview = dynamic(() => import("@/components/overview").then((mod) => mod.Overview), {
  loading: () => <Skeleton className="h-[350px] w-full" />,
  ssr: false, // Charts often rely on browser APIs
})
const CategoryPieChart = dynamic(() => import("@/components/category-pie-chart").then((mod) => mod.CategoryPieChart), {
  loading: () => <Skeleton className="h-[400px] w-full" />,
  ssr: false, // Charts often rely on browser APIs
})
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch" // Import Switch
import { Label } from "@/components/ui/label" // Import Label
import { Button } from "@/components/ui/button" // Import Button
import { useToast } from "@/hooks/use-toast" // Import useToast
import { payInstallment } from "./actions" // Import the server action
import {
  TrendingDownIcon,
  TrendingUpIcon,
  DollarSign,
  BarChart2,
  PieChart,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calendar,
  CreditCard,
  Tag,
  AlertCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react"
import type { Transaction, Database } from "@/types/supabase" // Import Database type
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subDays,
  parseISO,
  differenceInDays,
} from "date-fns"


// Calculate monthly data
function calculateMonthlyData(transactions: Transaction[]) {
  const monthlyData: Record<string, { income: number; expense: number }> = {}

  transactions.forEach((transaction) => {
    // Exclude initial credit purchases from monthly expense totals (only count actual payments)
    if (transaction.is_credit) return;

    const date = new Date(transaction.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expense: 0 }
    }

    if (transaction.type === "income") {
      monthlyData[monthKey].income += Number(transaction.amount)
    } else if (transaction.type === "expense") { // Ensure it's an expense and not a credit purchase entry
      monthlyData[monthKey].expense += Number(transaction.amount)
    }
  })

  return monthlyData
}

// Calculate top categories
function calculateTopCategories(transactions: Transaction[], type: "income" | "expense" | "all" = "all") {
  const categories: Record<string, number> = {}

  transactions.forEach((transaction) => {
    if (!transaction.category) return
    if (type !== "all" && transaction.type !== type) return

    if (categories[transaction.category]) {
      categories[transaction.category] += Number(transaction.amount)
    } else {
      categories[transaction.category] = Number(transaction.amount)
    }
  })

  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }))
}

// Calculate spending trends
function calculateSpendingTrends(transactions: Transaction[]) {
  // Get last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i)
    return {
      month: format(date, "MMM yyyy"),
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
    }
  }).reverse()

  // Calculate monthly totals
  const monthlyTotals = months.map((month) => {
    const monthTransactions = transactions.filter((t) =>
      isWithinInterval(new Date(t.date), { start: month.startDate, end: month.endDate }),
    )

    const income = monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0)

    // Exclude initial credit purchases from expense calculation for trends
    const expense = monthTransactions
      .filter((t) => t.type === "expense" && !t.is_credit)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const savings = income - expense
    const savingsRate = income > 0 ? (savings / income) * 100 : 0

    return {
      month: month.month,
      income,
      expense,
      savings,
      savingsRate,
    }
  })

  // Calculate month-over-month changes
  if (monthlyTotals.length >= 2) {
    const currentMonth = monthlyTotals[monthlyTotals.length - 1]
    const previousMonth = monthlyTotals[monthlyTotals.length - 2]

    const incomeChange =
      previousMonth.income > 0 ? ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100 : 100

    const expenseChange =
      previousMonth.expense > 0 ? ((currentMonth.expense - previousMonth.expense) / previousMonth.expense) * 100 : 100

    return {
      monthlyTotals,
      currentMonth,
      previousMonth,
      incomeChange,
      expenseChange,
    }
  }

  return {
    monthlyTotals,
    currentMonth: monthlyTotals[monthlyTotals.length - 1],
    previousMonth: null,
    incomeChange: 0,
    expenseChange: 0,
  }
}

// Calculate transaction statistics
function calculateTransactionStats(transactions: Transaction[]) {
  const stats = {
    totalTransactions: transactions.length,
    avgTransactionAmount: 0,
    largestExpense: { amount: 0, description: "", date: "", category: "" },
    largestIncome: { amount: 0, description: "", date: "", category: "" },
    recentTransactions: [] as any[],
    frequentCategories: [] as any[],
    weekdayDistribution: {} as Record<string, number>,
    daysSinceFirstTransaction: 0,
  }

  if (transactions.length === 0) return stats

  let totalAmount = 0
  const categoryCount: Record<string, number> = {}
  const weekdayCount: Record<string, number> = {}
  const today = new Date()
  let oldestDate = today

  transactions.forEach((t) => {
    const amount = Number(t.amount)
    totalAmount += amount
    const transactionDate = new Date(t.date)

    // Track oldest transaction
    if (transactionDate < oldestDate) {
      oldestDate = transactionDate
    }

    // Count categories
    if (t.category) {
      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1
    }

    // Count weekdays
    const weekday = format(transactionDate, "EEEE")
    weekdayCount[weekday] = (weekdayCount[weekday] || 0) + 1

    // Exclude initial credit purchases from largest *cash flow* expense stat
    if (t.type === "expense" && !t.is_credit && amount > stats.largestExpense.amount) {
      stats.largestExpense = {
        amount,
        description: t.description,
        date: format(transactionDate, "MMM d, yyyy"),
        category: t.category || "Uncategorized",
      }
    }

    if (t.type === "income" && amount > stats.largestIncome.amount) {
      stats.largestIncome = {
        amount,
        description: t.description,
        date: format(transactionDate, "MMM d, yyyy"),
        category: t.category || "Uncategorized",
      }
    }
  })

  // Calculate days since first transaction
  stats.daysSinceFirstTransaction = differenceInDays(today, oldestDate)

  // Get recent transactions
  stats.recentTransactions = transactions.slice(0, 5).map((t) => ({
    amount: Number(t.amount),
    description: t.description,
    date: format(new Date(t.date), "MMM d, yyyy"),
    type: t.type,
    category: t.category || "Uncategorized",
  }))

  // Get frequent categories
  stats.frequentCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Weekday distribution
  stats.weekdayDistribution = weekdayCount

  // Calculate average based on cash-flow affecting transactions only
  const cashFlowTransactions = transactions.filter(t => !t.is_credit);
  const cashFlowTotalAmount = cashFlowTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  stats.avgTransactionAmount = cashFlowTransactions.length > 0 ? cashFlowTotalAmount / cashFlowTransactions.length : 0;

  return stats
}

// Calculate daily spending for the last 30 days
function calculateDailySpending(transactions: Transaction[]) {
  const thirtyDaysAgo = subDays(new Date(), 30)
  // Filter for non-credit expenses for daily spending calculation
  const recentTransactions = transactions.filter(
    (t) => new Date(t.date) >= thirtyDaysAgo && t.type === "expense" && !t.is_credit,
  )

  const dailySpending: Record<string, number> = {}

  // Initialize all days with zero
  for (let i = 0; i < 30; i++) {
    const date = subDays(new Date(), i)
    const dateKey = format(date, "yyyy-MM-dd")
    dailySpending[dateKey] = 0
  }

  // Fill in actual spending
  recentTransactions.forEach((t) => {
    const dateKey = format(new Date(t.date), "yyyy-MM-dd")
    if (dailySpending[dateKey] !== undefined) {
      dailySpending[dateKey] += Number(t.amount)
    }
  })

  // Convert to array for easier processing
  return Object.entries(dailySpending)
    .map(([date, amount]) => ({
      date: format(parseISO(date), "MMM dd"),
      amount,
    }))
    .reverse()
}

// Calculate recurring expenses
function calculateRecurringExpenses(transactions: Transaction[]) {
  const expensesByDescription: Record<string, Transaction[]> = {}

  // Group expenses by description
  transactions
    // Filter for non-credit expenses when calculating standard recurring expenses
    .filter((t) => t.type === "expense" && !t.is_credit)
    .forEach((t) => {
      const key = t.description.toLowerCase().trim()
      if (!expensesByDescription[key]) {
        expensesByDescription[key] = []
      }
      expensesByDescription[key].push(t)
    })

  // Find recurring expenses (those with 3+ occurrences)
  const recurring = Object.entries(expensesByDescription)
    .filter(([_, txns]) => txns.length >= 3)
    .map(([description, txns]) => {
      const amounts = txns.map((t) => Number(t.amount))
      const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
      const category = txns[0].category || "Uncategorized"
      const frequency = txns.length >= 12 ? "Monthly" : txns.length >= 4 ? "Quarterly" : "Occasional"

      return {
        description,
        frequency,
        avgAmount,
        category,
        occurrences: txns.length,
      }
    })
    .sort((a, b) => b.avgAmount - a.avgAmount)
    .slice(0, 10)

  return recurring
}

// Calculate credit installments with remaining payments
function calculateCreditInstallments(transactions: Transaction[]) {
  return transactions
    .filter((t) => t.type === "expense" && t.is_credit && t.remaining_installments && t.remaining_installments > 0)
    .map((t) => ({
      id: t.id,
      description: t.description,
      category: t.category || "Uncategorized",
      amount: Number(t.amount), // Installment amount
      remaining: t.remaining_installments || 0,
      total: t.installments || 0,
    }))
    .sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime()) // Sort by creation time or ID if date isn't unique enough
}

// Note: Since we added "use client", this component can no longer be async directly.
// Data fetching needs to happen in a parent Server Component or via client-side fetching (e.g., SWR/useEffect).
// For this example, we'll assume data is passed as props or fetched client-side.
// We'll keep the async structure for now but acknowledge this limitation.
// A better approach would be to refactor data fetching.

export default function ReportsPage() {
  // TODO: Refactor data fetching to be client-side or passed from Server Component parent
  // For now, simulate fetched data (replace with actual fetching logic)
  const [transactions, setTransactions] = useState<Transaction[]>([]) // Example state
  const [isLoading, setIsLoading] = useState(true) // Data loading state
  const [isPending, startTransition] = useTransition() // Server action pending state
  const { toast } = useToast() // Toast hook

  // --- Client-Side Data Fetching ---
  useEffect(() => {
    const supabase = createClientComponentClient<Database>() // Initialize client Supabase
    let isMounted = true // Prevent state update on unmounted component

    const fetchData = async () => {
      setIsLoading(true)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        console.error("Error getting session or no user:", sessionError)
        // Optionally redirect or show login prompt
        // redirect('/login') // Redirect might not work directly in useEffect depending on Next.js version/setup
        if (isMounted) setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        // Select only necessary columns for report calculations
        .select('id, amount, date, type, category, description, notes, is_credit, installments, remaining_installments')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })

      if (isMounted) {
        if (error) {
          console.error("Error fetching transactions:", error)
          // Handle error state in UI if needed
        } else {
          setTransactions(data || [])
        }
        setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false // Cleanup function to set flag when component unmounts
    }
  }, []) // Empty dependency array ensures this runs once on mount
  // --- END Client-Side Data Fetching ---

  const [showCreditInstallments, setShowCreditInstallments] = useState(false)
  // --- Calculate derived data (will re-run when 'transactions' state changes) ---
  // Note: Consider useMemo for performance optimization if calculations are heavy and transactions list is large
  const monthlyData = calculateMonthlyData(transactions)
  const topExpenseCategories = calculateTopCategories(transactions, "expense")
  const topIncomeCategories = calculateTopCategories(transactions, "income")
  const spendingTrends = calculateSpendingTrends(transactions)
  const transactionStats = calculateTransactionStats(transactions)
  const dailySpending = calculateDailySpending(transactions)
  const recurringExpenses = calculateRecurringExpenses(transactions)
  const creditInstallments = calculateCreditInstallments(transactions)

  return (
    <DashboardShell>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground">Comprehensive analysis of your financial activity</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="main-tabs-trigger py-2">
              <BarChart2 className="h-4 w-4 mr-2" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="income" className="main-tabs-trigger py-2">
              <TrendingUpIcon className="h-4 w-4 mr-2" />
              <span>Income</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="main-tabs-trigger py-2">
              <TrendingDownIcon className="h-4 w-4 mr-2" />
              <span>Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="main-tabs-trigger py-2">
              <LineChart className="h-4 w-4 mr-2" />
              <span>Trends</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Financial Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Month Income</CardTitle>
                  <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${spendingTrends.currentMonth?.income.toFixed(2) || "0.00"}</div>
                  {spendingTrends.incomeChange !== 0 && (
                    <p className="text-xs flex items-center mt-1">
                      {spendingTrends.incomeChange > 0 ? (
                        <>
                          <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                          <span className="text-green-500">+{Math.abs(spendingTrends.incomeChange).toFixed(1)}%</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="mr-1 h-3 w-3 text-destructive" />
                          <span className="text-destructive">-{Math.abs(spendingTrends.incomeChange).toFixed(1)}%</span>
                        </>
                      )}
                      <span className="text-muted-foreground ml-1">from last month</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Month Expenses</CardTitle>
                  <DollarSign className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${spendingTrends.currentMonth?.expense.toFixed(2) || "0.00"}</div>
                  {spendingTrends.expenseChange !== 0 && (
                    <p className="text-xs flex items-center mt-1">
                      {spendingTrends.expenseChange > 0 ? (
                        <>
                          <ArrowUpRight className="mr-1 h-3 w-3 text-destructive" />
                          <span className="text-destructive">
                            +{Math.abs(spendingTrends.expenseChange).toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="mr-1 h-3 w-3 text-green-500" />
                          <span className="text-green-500">-{Math.abs(spendingTrends.expenseChange).toFixed(1)}%</span>
                        </>
                      )}
                      <span className="text-muted-foreground ml-1">from last month</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                  <Wallet className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {spendingTrends.currentMonth?.savingsRate.toFixed(1) || "0.0"}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {spendingTrends.currentMonth?.income > 0
                      ? `Saving ${spendingTrends.currentMonth?.savingsRate.toFixed(1)}% of income`
                      : "No income recorded this month"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transaction Stats</CardTitle>
                  <CreditCard className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{transactionStats.totalTransactions}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: ${transactionStats.avgTransactionAmount.toFixed(2)} per transaction
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Breakdown Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Breakdown</CardTitle>
                <CardDescription>Your income and expenses for each month of the year</CardDescription>
              </CardHeader>
              <CardContent>
                <Overview transactions={transactions || []} monthlyData={monthlyData} period="yearly" chartType="bar" />
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                Data from the past {transactionStats.daysSinceFirstTransaction} days
              </CardFooter>
            </Card>

            {/* Top Categories */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Expense Categories</CardTitle>
                  <CardDescription>Where your money is going</CardDescription>
                </CardHeader>
                <CardContent>
                  {topExpenseCategories.length > 0 ? (
                    <div className="space-y-4">
                      {topExpenseCategories.map((category, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full bg-chart-${(index % 5) + 1} mr-2`}></div>
                            <span className="capitalize">{category.name}</span>
                          </div>
                          <span className="font-medium">${category.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No expense data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <PieChart className="h-4 w-4 mr-2" />
                  Based on your spending patterns
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Income Sources</CardTitle>
                  <CardDescription>Where your money is coming from</CardDescription>
                </CardHeader>
                <CardContent>
                  {topIncomeCategories.length > 0 ? (
                    <div className="space-y-4">
                      {topIncomeCategories.map((category, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full bg-chart-${(index % 5) + 1} mr-2`}></div>
                            <span className="capitalize">{category.name}</span>
                          </div>
                          <span className="font-medium">${category.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No income data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <PieChart className="h-4 w-4 mr-2" />
                  Based on your income sources
                </CardFooter>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest financial activity</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionStats.recentTransactions.length > 0 ? (
                  <div className="space-y-4">
                    {transactionStats.recentTransactions.map((transaction, index) => (
                      <div key={index} className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center">
                          {transaction.type === "income" ? (
                            <ArrowUpRight className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-destructive mr-2" />
                          )}
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {transaction.date} • {transaction.category}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-medium ${transaction.type === "income" ? "text-green-500" : "text-destructive"}`}
                        >
                          {transaction.type === "income" ? "+" : "-"}${transaction.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center">
                    <p className="text-muted-foreground">No transaction data available</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-2" />
                Most recent transactions first
              </CardFooter>
            </Card>

            {/* Largest Transactions */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Largest Expense</CardTitle>
                  <CardDescription>Your biggest spending</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactionStats.largestExpense.amount > 0 ? (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">${transactionStats.largestExpense.amount.toFixed(2)}</div>
                      <p className="text-muted-foreground">{transactionStats.largestExpense.description}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{transactionStats.largestExpense.date}</span>
                        <Tag className="h-3 w-3 ml-2 mr-1" />
                        <span>{transactionStats.largestExpense.category}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center">
                      <p className="text-muted-foreground">No expense data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Your highest single expense
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Largest Income</CardTitle>
                  <CardDescription>Your biggest income</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactionStats.largestIncome.amount > 0 ? (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">${transactionStats.largestIncome.amount.toFixed(2)}</div>
                      <p className="text-muted-foreground">{transactionStats.largestIncome.description}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{transactionStats.largestIncome.date}</span>
                        <Tag className="h-3 w-3 ml-2 mr-1" />
                        <span>{transactionStats.largestIncome.category}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center">
                      <p className="text-muted-foreground">No income data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Your highest single income
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="income" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Income Distribution</CardTitle>
                <CardDescription>Breakdown of your income sources</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <CategoryPieChart transactions={transactions?.filter((t) => t.type === "income") || []} />
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <PieChart className="h-4 w-4 mr-2" />
                Visualizing your income by category
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income Trends</CardTitle>
                <CardDescription>Your income over time</CardDescription>
              </CardHeader>
              <CardContent>
                <Overview
                  transactions={transactions?.filter((t) => t.type === "income") || []}
                  period="yearly"
                  chartType="line"
                />
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <LineChart className="h-4 w-4 mr-2" />
                Tracking your income patterns over time
              </CardFooter>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Income Frequency</CardTitle>
                  <CardDescription>When you receive income</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactionStats.weekdayDistribution &&
                  Object.keys(transactionStats.weekdayDistribution).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(transactionStats.weekdayDistribution)
                        .filter(([_, count]) => {
                          // Only show days with income transactions
                          const dayTransactions = transactions?.filter(
                            (t) => t.type === "income" && format(new Date(t.date), "EEEE") === _,
                          )
                          return dayTransactions && dayTransactions.length > 0
                        })
                        .sort((a, b) => b[1] - a[1])
                        .map(([day, count], index) => {
                          // Calculate income for this day
                          const dayIncome =
                            transactions
                              ?.filter((t) => t.type === "income" && format(new Date(t.date), "EEEE") === day)
                              .reduce((sum, t) => sum + Number(t.amount), 0) || 0

                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{day}</span>
                                <span>${dayIncome.toFixed(2)}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(100, (count / Math.max(...Object.values(transactionStats.weekdayDistribution))) * 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No income data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Days when you typically receive income
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Income Sources</CardTitle>
                  <CardDescription>Where your money is coming from</CardDescription>
                </CardHeader>
                <CardContent>
                  {topIncomeCategories.length > 0 ? (
                    <div className="space-y-4">
                      {topIncomeCategories.map((category, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full bg-chart-${(index % 5) + 1} mr-2`}></div>
                            <span className="capitalize">{category.name}</span>
                          </div>
                          <span className="font-medium">${category.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No income data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <Tag className="h-4 w-4 mr-2" />
                  Your primary sources of income
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expense Distribution</CardTitle>
                <CardDescription>Breakdown of your spending by category</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <CategoryPieChart transactions={transactions?.filter((t) => t.type === "expense") || []} />
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <PieChart className="h-4 w-4 mr-2" />
                Visualizing your spending patterns
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Trends</CardTitle>
                <CardDescription>Your spending over time</CardDescription>
              </CardHeader>
              <CardContent>
                <Overview
                  transactions={transactions?.filter((t) => t.type === "expense") || []}
                  period="yearly"
                  chartType="line"
                />
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <LineChart className="h-4 w-4 mr-2" />
                Tracking your expense patterns over time
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{showCreditInstallments ? "Credit Installments" : "Recurring Expenses"}</CardTitle>
                    <CardDescription>
                      {showCreditInstallments ? "Upcoming credit payments" : "Regular payments detected"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="recurring-toggle"
                      checked={showCreditInstallments}
                      onCheckedChange={setShowCreditInstallments}
                    />
                    <Label htmlFor="recurring-toggle">Show Installments</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showCreditInstallments ? (
                  // Credit Installments View
                  creditInstallments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 font-medium">Description</th>
                            <th className="text-left py-2 px-2 font-medium">Category</th>
                            <th className="text-right py-2 px-2 font-medium">Installment</th>
                            <th className="text-center py-2 px-2 font-medium">Remaining</th>
                            <th className="text-center py-2 px-2 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditInstallments.map((installment) => (
                            <tr key={installment.id} className="border-b">
                              <td className="py-2 px-2">{installment.description}</td>
                              <td className="py-2 px-2 capitalize">{installment.category}</td>
                              <td className="py-2 px-2 text-right">${installment.amount.toFixed(2)}</td>
                              <td className="py-2 px-2 text-center">
                                {installment.remaining}/{installment.total}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending} // Disable button while action is pending
                                  onClick={() => {
                                    startTransition(async () => {
                                      const result = await payInstallment(installment.id)
                                      toast({
                                        title: result.success ? "Success" : "Error",
                                        description: result.message,
                                        variant: result.success ? "default" : "destructive",
                                      })
                                      // Data should refresh automatically due to revalidatePath in action
                                    })
                                  }}
                                >
                                  {isPending ? "Paying..." : "Pay"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No active credit installments found</p>
                    </div>
                  )
                ) : (
                  // Regular Recurring Expenses View
                  recurringExpenses.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 font-medium">Description</th>
                            <th className="text-left py-2 px-2 font-medium">Category</th>
                            <th className="text-left py-2 px-2 font-medium">Frequency</th>
                            <th className="text-right py-2 px-2 font-medium">Avg. Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recurringExpenses.map((expense, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2 px-2">{expense.description}</td>
                              <td className="py-2 px-2 capitalize">{expense.category}</td>
                              <td className="py-2 px-2">{expense.frequency}</td>
                              <td className="py-2 px-2 text-right">${expense.avgAmount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No recurring expenses detected</p>
                    </div>
                  )
                )}
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-2" />
                {showCreditInstallments
                  ? "Credit purchases with outstanding payments"
                  : "Based on transaction patterns over time"}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Expense Categories</CardTitle>
                <CardDescription>Where your money is going</CardDescription>
              </CardHeader>
              <CardContent>
                {topExpenseCategories.length > 0 ? (
                  <div className="space-y-4">
                    {topExpenseCategories.map((category, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full bg-chart-${(index % 5) + 1} mr-2`}></div>
                          <span className="capitalize">{category.name}</span>
                        </div>
                        <span className="font-medium">${category.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center">
                    <p className="text-muted-foreground">No expense data available</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <Tag className="h-4 w-4 mr-2" />
                Categories where you spend the most
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Spending</CardTitle>
                <CardDescription>Your spending over the last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <Overview
                  transactions={transactions?.filter((t) => t.type === "expense") || []}
                  period="last14days"
                  chartType="line"
                />
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                Recent daily spending patterns
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>30-Day Spending Trend</CardTitle>
                <CardDescription>Your daily expenses for the past month</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {dailySpending.length > 0 ? (
                  <div className="h-full">
                    <div className="grid grid-cols-30 gap-1 h-[250px] items-end">
                      {dailySpending.map((day, index) => {
                        const height =
                          day.amount > 0
                            ? Math.max(
                                5,
                                Math.min(100, (day.amount / Math.max(...dailySpending.map((d) => d.amount))) * 100),
                              )
                            : 0

                        return (
                          <div key={index} className="flex flex-col items-center">
                            <div className="w-full flex justify-center items-end h-[200px]">
                              <div
                                className="w-full bg-primary rounded-t-sm transition-all duration-300"
                                style={{ height: `${height}%` }}
                              ></div>
                            </div>
                            <div className="text-[8px] sm:text-xs mt-1 rotate-45 origin-left">{day.date}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No daily spending data available</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <LineChart className="h-4 w-4 mr-2" />
                Visualizing your daily spending patterns
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Savings</CardTitle>
                <CardDescription>Your savings rate over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <div className="h-full">
                  {spendingTrends.monthlyTotals.length > 0 ? (
                    <div className="h-full flex flex-col">
                      <div className="grid grid-cols-6 gap-2 h-full">
                        {spendingTrends.monthlyTotals.map((month, index) => {
                          const savingsRate = month.savingsRate
                          const height = Math.max(5, Math.min(100, Math.abs(savingsRate)))
                          const isPositive = savingsRate >= 0

                          return (
                            <div key={index} className="flex flex-col items-center justify-end h-full">
                              <div className="w-full flex justify-center items-end h-[300px]">
                                <div
                                  className={`w-full ${isPositive ? "bg-green-500" : "bg-red-500"} rounded-t-sm transition-all duration-500`}
                                  style={{ height: `${height}%` }}
                                ></div>
                              </div>
                              <div className="text-xs font-medium mt-2">{month.month}</div>
                              <div className={`text-xs ${isPositive ? "text-green-500" : "text-red-500"}`}>
                                {savingsRate.toFixed(1)}%
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">No data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <Wallet className="h-4 w-4 mr-2" />
                Your monthly savings as a percentage of income
              </CardFooter>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Income vs Expenses</CardTitle>
                  <CardDescription>Monthly comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  <Overview
                    transactions={transactions || []}
                    monthlyData={monthlyData}
                    period="monthly"
                    chartType="bar"
                  />
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Comparing your monthly income and expenses
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transaction Volume</CardTitle>
                  <CardDescription>Number of transactions over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {spendingTrends.monthlyTotals.length > 0 ? (
                    <div className="space-y-4">
                      {spendingTrends.monthlyTotals.map((month, index) => {
                        const monthTransactions =
                          transactions?.filter((t) => {
                            const date = new Date(t.date)
                            const monthStr = format(date, "MMM yyyy")
                            return monthStr === month.month
                          }) || []

                        const incomeCount = monthTransactions.filter((t) => t.type === "income").length
                        const expenseCount = monthTransactions.filter((t) => t.type === "expense").length

                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{month.month}</span>
                              <span>{monthTransactions.length} transactions</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2.5">
                              <div
                                className="bg-primary h-2.5 rounded-full"
                                style={{ width: `${(incomeCount / Math.max(1, monthTransactions.length)) * 100}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{incomeCount} income</span>
                              <span>{expenseCount} expenses</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-muted-foreground">No transaction data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Transaction frequency by month
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  )
}

