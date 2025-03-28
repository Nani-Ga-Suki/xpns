"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Overview } from "@/components/overview"
import { ExpenseStats } from "@/components/expense-stats"
import { TransactionList } from "@/components/transaction-list"
import { TransactionForm } from "@/components/transaction-form"
import { QuickTransactionForm } from "@/components/quick-transaction-form"
import { CategoryPieChart } from "@/components/category-pie-chart"
import { useTransactions } from "@/hooks/use-transactions"
import { motion } from "framer-motion"
import type { Transaction } from "@/types/supabase"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SWRConfig } from "swr"
import { ExportCSV } from "@/components/export-csv"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

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
    transactions: Transaction[]
    stats: {
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
  const { userId, stats: initialStats, userProfile } = data
  const [activeTab, setActiveTab] = useState("dashboard")
  const { toast } = useToast()
  const [isRetrying, setIsRetrying] = useState(false)
  const { forceRefresh } = useAuth()
  const router = useRouter()

  // Use the custom hook for dynamic transaction data with better error handling
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

  // Calculate stats based on current transactions
  const stats = {
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
    topCategories: initialStats.topCategories || [],
    monthlyData: initialStats.monthlyData || {},
  }

  // Handle successful transaction submission
  const handleTransactionSuccess = () => {
    console.log("Transaction success, triggering data refresh")
    // Add a small delay to allow the database to update
    setTimeout(() => {
      mutate()
    }, 300)
  }

  // Handle manual retry
  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      // First refresh the session
      await forceRefresh()
      // Then retry fetching transactions
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
      // If we have persistent errors, redirect to login
      router.push("/login")
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
            totalBalance={stats.totalBalance}
            totalIncome={stats.totalIncome}
            totalExpenses={stats.totalExpenses}
            transactionCount={stats.transactionCount}
            transactions={transactions}
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
                  className="flex items-center gap-2"
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
                  className="flex items-center gap-2"
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
              <TransactionForm userId={userId} onSuccess={handleTransactionSuccess} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Breakdown</CardTitle>
                <CardDescription>Your income and expenses for each month of the year</CardDescription>
              </CardHeader>
              <CardContent>
                <Overview transactions={transactions} isLoading={isLoading} period="yearly" chartType="bar" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
                <CardDescription>Breakdown of your spending by category</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryPieChart transactions={transactions} isLoading={isLoading} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Spending Categories</CardTitle>
                <CardDescription>Where your money is going</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.topCategories && stats.topCategories.length > 0 ? (
                  <div className="space-y-4">
                    {stats.topCategories.map((category, index) => (
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
                  <div className="h-80 flex items-center justify-center">
                    <p className="text-muted-foreground">No category data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

