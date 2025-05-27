"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card" // Added CardFooter
import { Overview } from "@/components/overview"
import { ExpenseStats } from "@/components/expense-stats"
import { TransactionList } from "@/components/transaction-list"
import { TransactionForm } from "@/components/transaction-form"
import { ExpenseForm } from "@/components/expense-form"
import type { Expense } from "@/types/expense"
import { QuickTransactionForm } from "@/components/quick-transaction-form"
import { CategoryPieChart } from "@/components/category-pie-chart"
import { useTransactions } from "@/hooks/use-transactions"
import { motion } from "framer-motion"
import type { Transaction } from "@/types/supabase"
import {
  AlertCircle,
  RefreshCw,
  TrendingDownIcon, // Added
  TrendingUpIcon, // Added
  DollarSign, // Added
  BarChart2, // Added
  PieChart, // Added
  LineChart, // Added
  ArrowUpRight, // Added
  ArrowDownRight, // Added
  Clock, // Added
  Calendar, // Added
  CreditCard, // Added
  Tag, // Added
  CheckCircle2, // Added
  Wallet, // Added
} from "lucide-react" // Added icons
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SWRConfig } from "swr"
import { ExportCSV } from "@/components/export-csv"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subDays,
  parseISO,
  differenceInDays,
} from "date-fns" // Added date-fns functions

// --- Helper Functions from app/reports/page.tsx ---

// Calculate monthly data
function calculateMonthlyData(transactions: Transaction[]) {
  const monthlyData: Record<string, { income: number; expense: number }> = {}

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date)
    // Ensure month is zero-padded for consistent keys if needed, though current usage seems fine
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expense: 0 }
    }

    if (transaction.type === "income") {
      monthlyData[monthKey].income += Number(transaction.amount)
    } else {
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

    const categoryKey = transaction.category.toLowerCase() // Normalize category names
    if (categories[categoryKey]) {
      categories[categoryKey] += Number(transaction.amount)
    } else {
      categories[categoryKey] = Number(transaction.amount)
    }
  })

  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }))
}

// Calculate spending trends
function calculateSpendingTrends(transactions: Transaction[]) {
  // Get last 6 months including the current one
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
    const monthTransactions = transactions.filter((t) => {
      try {
        return isWithinInterval(new Date(t.date), { start: month.startDate, end: month.endDate })
      } catch (e) {
        console.error("Invalid date encountered in transaction:", t)
        return false // Skip transactions with invalid dates
      }
    })

    const income = monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0)
    const expense = monthTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0)
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
  let incomeChange = 0
  let expenseChange = 0
  const currentMonth = monthlyTotals[monthlyTotals.length - 1]
  const previousMonth = monthlyTotals.length >= 2 ? monthlyTotals[monthlyTotals.length - 2] : null

  if (previousMonth) {
    incomeChange =
      previousMonth.income > 0 ? ((currentMonth.income - previousMonth.income) / previousMonth.income) * 100 : currentMonth.income > 0 ? 100 : 0
    expenseChange =
      previousMonth.expense > 0 ? ((currentMonth.expense - previousMonth.expense) / previousMonth.expense) * 100 : currentMonth.expense > 0 ? 100 : 0
  } else if (currentMonth) {
      // Handle case where there's only one month of data
      incomeChange = currentMonth.income > 0 ? 100 : 0;
      expenseChange = currentMonth.expense > 0 ? 100 : 0;
  }


  return {
    monthlyTotals,
    currentMonth,
    previousMonth,
    incomeChange,
    expenseChange,
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
    totalAmount += amount // Consider if this should only be expenses or all types
    let transactionDate: Date
    try {
      transactionDate = new Date(t.date)
      if (isNaN(transactionDate.getTime())) {
          throw new Error("Invalid date")
      }
    } catch (e) {
      console.error("Invalid date encountered in transaction:", t)
      return // Skip this transaction
    }


    // Track oldest transaction
    if (transactionDate < oldestDate) {
      oldestDate = transactionDate
    }

    // Count categories
    if (t.category) {
      const categoryKey = t.category.toLowerCase() // Normalize
      categoryCount[categoryKey] = (categoryCount[categoryKey] || 0) + 1
    }

    // Count weekdays
    const weekday = format(transactionDate, "EEEE")
    weekdayCount[weekday] = (weekdayCount[weekday] || 0) + 1

    if (t.type === "expense" && amount > stats.largestExpense.amount) {
      stats.largestExpense = {
        amount,
        description: t.description || "N/A",
        date: format(transactionDate, "MMM d, yyyy"),
        category: t.category || "Uncategorized",
      }
    }

    if (t.type === "income" && amount > stats.largestIncome.amount) {
      stats.largestIncome = {
        amount,
        description: t.description || "N/A",
        date: format(transactionDate, "MMM d, yyyy"),
        category: t.category || "Uncategorized",
      }
    }
  })

  // Calculate days since first transaction
  stats.daysSinceFirstTransaction = differenceInDays(today, oldestDate)

  // Get recent transactions
  stats.recentTransactions = transactions.slice(0, 5).map((t) => {
     let formattedDate = "Invalid Date";
     try {
         formattedDate = format(new Date(t.date), "MMM d, yyyy");
     } catch (e) {
         console.error("Invalid date for recent transaction:", t);
     }
     return {
        amount: Number(t.amount),
        description: t.description || "N/A",
        date: formattedDate,
        type: t.type,
        category: t.category || "Uncategorized",
     }
  })

  // Get frequent categories
  stats.frequentCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Weekday distribution
  stats.weekdayDistribution = weekdayCount

  // Calculate average transaction amount (consider if this should be expense-only or all)
  stats.avgTransactionAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;


  return stats
}

// Calculate daily spending for the last 30 days
function calculateDailySpending(transactions: Transaction[]) {
  const thirtyDaysAgo = subDays(new Date(), 30)
  const recentTransactions = transactions.filter((t) => {
      try {
          const transactionDate = new Date(t.date);
          return !isNaN(transactionDate.getTime()) && transactionDate >= thirtyDaysAgo && t.type === "expense";
      } catch (e) {
          console.error("Invalid date for daily spending calculation:", t);
          return false;
      }
  });


  const dailySpending: Record<string, number> = {}

  // Initialize all days with zero
  for (let i = 0; i < 30; i++) {
    const date = subDays(new Date(), i)
    const dateKey = format(date, "yyyy-MM-dd")
    dailySpending[dateKey] = 0
  }

  // Fill in actual spending
  recentTransactions.forEach((t) => {
    try {
        const dateKey = format(new Date(t.date), "yyyy-MM-dd")
        if (dailySpending[dateKey] !== undefined) {
          dailySpending[dateKey] += Number(t.amount)
        }
    } catch (e) {
        console.error("Invalid date processing daily spending:", t);
    }
  })

  // Convert to array for easier processing
  return Object.entries(dailySpending)
    .map(([date, amount]) => ({
      date: format(parseISO(date), "MMM dd"), // Use parseISO for reliability
      amount,
    }))
    .reverse() // Ensure chronological order for charts
}

// Calculate recurring expenses
function calculateRecurringExpenses(transactions: Transaction[]) {
  const expensesByDescription: Record<string, Transaction[]> = {}

  // Group expenses by description (case-insensitive and trimmed)
  transactions
    .filter((t) => t.type === "expense" && t.description) // Ensure description exists
    .forEach((t) => {
      const key = t.description!.toLowerCase().trim()
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
      // Simple frequency estimation - could be improved
      const frequency = txns.length >= 12 ? "Monthly (est.)" : txns.length >= 4 ? "Quarterly (est.)" : "Occasional"

      return {
        description: txns[0].description, // Use original description casing
        frequency,
        avgAmount,
        category,
        occurrences: txns.length,
      }
    })
    .sort((a, b) => b.avgAmount - a.avgAmount) // Sort by average amount
    .slice(0, 10) // Limit to top 10

  return recurring
}

// --- End Helper Functions ---

// Define the SWR configuration here in the client component
const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 0, // Disable automatic polling
  dedupingInterval: 2000,
  errorRetryCount: 3,
}

interface DashboardContentProps {
  data: {
    userId: string
    transactions: Transaction[] // Initial transactions from server
    stats: { // Initial stats from server (might be less relevant now)
      totalBalance: string
      totalIncome: string
      totalExpenses: string
      transactionCount: number
      topCategories?: Array<{ name: string; amount: number }>
      monthlyData?: Record<string, { income: number; expense: number }>
    }
    userProfile?: {
      full_name?: string
      username?: string
    } | null
  }
}

export function DashboardContent({ data }: DashboardContentProps) {
  return (
    <SWRConfig value={swrConfig}>
      <DashboardContentInner data={data} />
    </SWRConfig>
  )
}

function DashboardContentInner({ data }: DashboardContentProps) {
  const { userId, userProfile } = data
  const [activeTab, setActiveTab] = useState("dashboard")
  const { toast } = useToast()
  const [isRetrying, setIsRetrying] = useState(false)
  const { forceRefresh } = useAuth()
  const router = useRouter()

  // Use the custom hook for dynamic transaction data
  const { transactions, isLoading, isError, mutate, retry } = useTransactions(userId, data.transactions)

  // Handle transaction loading errors
  useEffect(() => {
    if (isError) {
      toast({
        title: "Error loading data",
        description: "There was a problem loading your transactions. Please try refreshing the page.",
        variant: "destructive",
      })
      console.error("Transaction loading error detected")
    }
  }, [isError, toast])

  // --- Calculate Stats and Report Data Client-Side ---
  const calculatedStats = {
    totalBalance: transactions
      .reduce((acc, t) => (t.type === "income" ? acc + Number(t.amount) : acc - Number(t.amount)), 0)
      .toFixed(2),
    totalIncome: transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + Number(t.amount), 0)
      .toFixed(2),
    totalExpenses: transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + Number(t.amount), 0)
      .toFixed(2),
    transactionCount: transactions.length,
  }

  // Calculate report-specific data using the helper functions
  const monthlyData = calculateMonthlyData(transactions || [])
  const topExpenseCategories = calculateTopCategories(transactions || [], "expense")
  const topIncomeCategories = calculateTopCategories(transactions || [], "income")
  const spendingTrends = calculateSpendingTrends(transactions || [])
  const transactionStats = calculateTransactionStats(transactions || [])
  const dailySpending = calculateDailySpending(transactions || [])
  const recurringExpenses = calculateRecurringExpenses(transactions || [])
  // --- End Data Calculation ---


  // Handle successful transaction submission
  const handleTransactionSuccess = () => {
    console.log("Transaction success, triggering data refresh")
    setTimeout(() => {
      mutate() // Re-fetch data via SWR hook
    }, 300)
  }

  // Handle manual retry
  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await forceRefresh()
      await retry()
      toast({
        title: "Data refreshed",
        description: "Your financial data has been refreshed.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data. Please try again later.",
        variant: "destructive",
      })
      // Consider redirecting only on specific auth errors
      // router.push("/login")
    } finally {
      setIsRetrying(false)
    }
  }

  // Get user's first name for personalized greeting
  const firstName = userProfile?.full_name?.split(" ")[0] || userProfile?.username || "there"

  // Get time of day for greeting
  const getTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {getTimeOfDay()}, {firstName}
        </h1>
        <p className="text-muted-foreground">Here's an overview of your finances</p>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>There was an error loading your transaction data.</p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit flex items-center gap-2"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Refreshing..." : "Refresh Data"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="border-b">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="dashboard"
              className="main-tabs-trigger relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="main-tabs-trigger relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Transactions
            </TabsTrigger>
            <TabsTrigger
              value="add"
              className="main-tabs-trigger relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Add New
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="main-tabs-trigger relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Reports
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-8">
          <ExpenseStats
            totalBalance={calculatedStats.totalBalance}
            totalIncome={calculatedStats.totalIncome}
            totalExpenses={calculatedStats.totalExpenses}
            transactionCount={calculatedStats.transactionCount}
            transactions={transactions} // Pass current transactions
            isLoading={isLoading}
          />

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Finance Trends</CardTitle>
                <CardDescription>Your spending over the last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <Overview transactions={transactions} isLoading={isLoading} period="last14days" chartType="line" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Quick Add</CardTitle>
                <CardDescription>Add a new transaction</CardDescription>
              </CardHeader>
              <CardContent>
                <QuickTransactionForm userId={userId} onSuccess={handleTransactionSuccess} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>View, filter, and manage your transactions</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 hidden" // Added hidden
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                  {isRetrying ? "Refreshing..." : "Refresh"}
                </Button>
                <ExportCSV transactions={transactions} />
              </div>
            </CardHeader>
            <CardContent>
              <TransactionList
                transactions={transactions}
                userId={userId}
                onTransactionChange={handleTransactionSuccess}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>View, filter, and manage your transactions</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 hidden" // Added hidden
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                  {isRetrying ? "Refreshing..." : "Refresh"}
                </Button>
                <ExportCSV transactions={transactions} />
              </div>
            </CardHeader>
            <CardContent>
              <TransactionList
                transactions={transactions}
                userId={userId}
                onTransactionChange={handleTransactionSuccess}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add Transaction</CardTitle>
              <CardDescription>Enter the details of your transaction</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Using TransactionForm directly might be simpler if ExpenseForm is complex */}
              <TransactionForm userId={userId} onSuccess={handleTransactionSuccess} />
              {/*
              <ExpenseForm
                categories={[ // Consider fetching categories dynamically
                  { id: "food", name: "Food", color: "bg-red-500" },
                  { id: "transportation", name: "Transportation", color: "bg-blue-500" },
                  // ... other categories
                ]}
                onSubmit={(expense: Omit<Expense, "id">) => {
                  // Convert and save logic...
                  handleTransactionSuccess()
                }}
                onUpdate={(expense) => {
                  // Convert and update logic...
                  handleTransactionSuccess()
                }}
                expenses={[]} // This seems incorrect, ExpenseForm might not be suitable here
              />
              */}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Replaced Reports Tab Content --- */}
        <TabsContent value="reports" className="space-y-6">
          {/* Use client-side calculated data */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 h-auto">
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
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${spendingTrends.currentMonth?.income.toFixed(2) || "0.00"}</div>
                    {spendingTrends.previousMonth && spendingTrends.incomeChange !== 0 && ( // Check if previous month exists
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
                     {spendingTrends.previousMonth && spendingTrends.expenseChange !== 0 && ( // Check if previous month exists
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
                  {/* Pass client-side transactions and monthlyData */}
                  <Overview transactions={transactions || []} monthlyData={monthlyData} period="yearly" chartType="bar" isLoading={isLoading} />
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                   {/* Use calculated days */}
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
                        <div key={index} className="flex items-center justify-between border-b pb-2 last:border-b-0">
                          <div className="flex items-center">
                            {transaction.type === "income" ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-destructive mr-2 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-medium truncate" title={transaction.description}>{transaction.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {transaction.date} • <span className="capitalize">{transaction.category}</span>
                              </p>
                            </div>
                          </div>
                          <span
                            className={`font-medium whitespace-nowrap ${transaction.type === "income" ? "text-green-500" : "text-destructive"}`}
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
                        <p className="text-muted-foreground truncate" title={transactionStats.largestExpense.description}>{transactionStats.largestExpense.description}</p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>{transactionStats.largestExpense.date}</span>
                          <Tag className="h-3 w-3 ml-2 mr-1" />
                          <span className="capitalize">{transactionStats.largestExpense.category}</span>
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
                        <p className="text-muted-foreground truncate" title={transactionStats.largestIncome.description}>{transactionStats.largestIncome.description}</p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>{transactionStats.largestIncome.date}</span>
                          <Tag className="h-3 w-3 ml-2 mr-1" />
                          <span className="capitalize">{transactionStats.largestIncome.category}</span>
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
                  <CategoryPieChart transactions={transactions?.filter((t) => t.type === "income") || []} isLoading={isLoading} />
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
                    period="yearly" // Or adjust period as needed
                    chartType="line"
                    isLoading={isLoading}
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
                          .map(([day, count]) => {
                              // Calculate income for this day
                              const dayIncome =
                                transactions
                                  ?.filter((t) => t.type === "income" && format(new Date(t.date), "EEEE") === day)
                                  .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
                              // Calculate total income transactions for percentage calculation
                              const totalIncomeTransactions = transactions?.filter(t => t.type === 'income').length || 1; // Avoid division by zero
                              const dayIncomeTransactions = transactions?.filter(t => t.type === 'income' && format(new Date(t.date), "EEEE") === day).length || 0;

                              return { day, dayIncome, count: dayIncomeTransactions, totalIncomeTransactions };
                          })
                          .filter(item => item.dayIncome > 0) // Only show days with income
                          .sort((a, b) => b.dayIncome - a.dayIncome) // Sort by income amount
                          .map((item, index) => (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{item.day}</span>
                                <span>${item.dayIncome.toFixed(2)}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    // Base width on transaction count for that day relative to total income transactions
                                    width: `${Math.min(100, (item.count / item.totalIncomeTransactions) * 100)}%`,
                                  }}
                                ></div>
                              </div>
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
                  <CategoryPieChart transactions={transactions?.filter((t) => t.type === "expense") || []} isLoading={isLoading} />
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
                    period="yearly" // Or adjust period
                    chartType="line"
                    isLoading={isLoading}
                  />
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <LineChart className="h-4 w-4 mr-2" />
                  Tracking your expense patterns over time
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recurring Expenses</CardTitle>
                  <CardDescription>Regular payments detected</CardDescription>
                </CardHeader>
                <CardContent>
                  {recurringExpenses.length > 0 ? (
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
                            <tr key={index} className="border-b last:border-b-0">
                              <td className="py-2 px-2 truncate" title={expense.description}>{expense.description}</td>
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
                  )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  Based on transaction patterns (3+ occurrences)
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
                    isLoading={isLoading}
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
                <CardContent className="h-[300px] overflow-x-auto">
                  {dailySpending.length > 0 ? (
                    <div className="h-full min-w-[600px]"> {/* Ensure minimum width for visibility */}
                      <div className="grid grid-cols-30 gap-1 h-[250px] items-end">
                        {dailySpending.map((day, index) => {
                          const maxAmount = Math.max(...dailySpending.map((d) => d.amount), 1); // Avoid division by zero
                          const height =
                            day.amount > 0
                              ? Math.max(
                                  2, // Min height for visibility
                                  Math.min(100, (day.amount / maxAmount) * 100),
                                )
                              : 0

                          return (
                            <div key={index} className="flex flex-col items-center h-full justify-end group relative">
                               <div
                                  className="w-full bg-primary rounded-t-sm transition-all duration-300 hover:bg-primary/80"
                                  style={{ height: `${height}%` }}
                                  title={`$${day.amount.toFixed(2)}`}
                                ></div>
                                <div className="text-[10px] text-muted-foreground mt-1 text-center absolute -bottom-4 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    {day.date}
                                </div>
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
                    Hover over bars for details
                 </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Savings</CardTitle>
                  <CardDescription>Your savings rate over time (last 6 months)</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <div className="h-full">
                    {spendingTrends.monthlyTotals.length > 0 ? (
                      <div className="h-full flex flex-col">
                        <div className="grid grid-cols-6 gap-2 h-full items-end">
                          {spendingTrends.monthlyTotals.map((month, index) => {
                            const savingsRate = month.savingsRate
                            // Scale height based on absolute value, max 100%
                            const maxHeight = Math.max(...spendingTrends.monthlyTotals.map(m => Math.abs(m.savingsRate)), 1); // Avoid division by zero
                            const height = Math.max(2, Math.min(100, (Math.abs(savingsRate) / maxHeight) * 100))
                            const isPositive = savingsRate >= 0

                            return (
                              <div key={index} className="flex flex-col items-center justify-end h-full group relative">
                                <div
                                  className={`w-full ${isPositive ? "bg-green-500" : "bg-red-500"} rounded-t-sm transition-all duration-500 hover:opacity-80`}
                                  style={{ height: `${height}%` }}
                                  title={`${savingsRate.toFixed(1)}%`}
                                ></div>
                                <div className="text-xs font-medium mt-2 text-center">{month.month}</div>
                                <div className={`text-xs ${isPositive ? "text-green-500" : "text-red-500"} opacity-0 group-hover:opacity-100 transition-opacity`}>
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
                  Monthly savings as a percentage of income
                </CardFooter>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Income vs Expenses</CardTitle>
                    <CardDescription>Monthly comparison (last 6 months)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Overview
                      transactions={transactions || []}
                      monthlyData={monthlyData} // Use client-calculated monthly data
                      period="monthly" // Corrected period value
                      chartType="bar"
                      isLoading={isLoading}
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
                    <CardDescription>Number of transactions (last 6 months)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {spendingTrends.monthlyTotals.length > 0 ? (
                      <div className="space-y-4">
                        {spendingTrends.monthlyTotals.map((month, index) => {
                          // Find transactions for this specific month
                          const monthTransactions =
                            transactions?.filter((t) => {
                              try {
                                const date = new Date(t.date)
                                const monthStr = format(date, "MMM yyyy")
                                return monthStr === month.month
                              } catch (e) { return false; }
                            }) || []

                          const incomeCount = monthTransactions.filter((t) => t.type === "income").length
                          const expenseCount = monthTransactions.filter((t) => t.type === "expense").length
                          const totalCount = monthTransactions.length;

                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{month.month}</span>
                                <span>{totalCount} transaction{totalCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2.5 relative">
                                {/* Income portion */}
                                <div
                                  className="bg-green-500 h-2.5 rounded-l-full absolute left-0 top-0"
                                  style={{ width: `${(incomeCount / Math.max(1, totalCount)) * 100}%` }}
                                  title={`${incomeCount} Income`}
                                ></div>
                                 {/* Expense portion */}
                                <div
                                  className="bg-red-500 h-2.5 rounded-r-full absolute right-0 top-0"
                                  style={{ width: `${(expenseCount / Math.max(1, totalCount)) * 100}%` }}
                                   title={`${expenseCount} Expenses`}
                                ></div>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span className="text-green-500">{incomeCount} income</span>
                                <span className="text-red-500">{expenseCount} expenses</span>
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
        </TabsContent>
        {/* --- End Replaced Reports Tab Content --- */}

      </Tabs>
    </motion.div>
  )
}
