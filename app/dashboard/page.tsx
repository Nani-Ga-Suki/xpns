import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { DashboardShell } from "@/components/dashboard-shell"
import { DashboardContent } from "@/components/dashboard-content"
import type { Transaction } from "@/types/supabase"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Dashboard | Personal Finance Manager",
  description: "View your financial overview, recent transactions, and spending trends",
  openGraph: {
    title: "Finance Dashboard",
    description: "Manage your personal finances with our intuitive dashboard",
    type: "website",
  },
}

// Dashboard loading component
function DashboardLoading() {
  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex flex-col space-y-1">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-4 w-[350px]" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-6">
                <Skeleton className="h-5 w-[120px] mb-2" />
                <Skeleton className="h-8 w-[100px]" />
                <Skeleton className="h-4 w-[160px] mt-2" />
              </div>
            ))}
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
          <div className="lg:col-span-4 rounded-lg border bg-card">
            <div className="p-6 border-b">
              <Skeleton className="h-6 w-[150px] mb-2" />
              <Skeleton className="h-4 w-[250px]" />
            </div>
            <div className="p-6">
              <Skeleton className="h-[350px] w-full" />
            </div>
          </div>
          <div className="lg:col-span-3 rounded-lg border bg-card">
            <div className="p-6 border-b">
              <Skeleton className="h-6 w-[180px] mb-2" />
              <Skeleton className="h-4 w-[220px]" />
            </div>
            <div className="p-6 space-y-6">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="flex items-center">
                    <Skeleton className="h-12 w-12 rounded-full mr-4" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-4 w-[80px]" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

// Calculate financial statistics
function calculateFinancialStats(transactions: Transaction[]) {
  // Use reduce once to calculate multiple values for better performance
  const stats = transactions.reduce(
    (acc, transaction) => {
      const amount = Number(transaction.amount)

      // Update total balance
      if (transaction.type === "income") {
        acc.totalBalance += amount
        acc.totalIncome += amount
      } else {
        acc.totalBalance -= amount
        acc.totalExpenses += amount
      }

      // Track categories for analysis
      const category = transaction.category || "uncategorized"
      if (!acc.categories[category]) {
        acc.categories[category] = 0
      }
      acc.categories[category] += amount

      // Track monthly data
      const date = new Date(transaction.date)
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`

      if (!acc.monthlyData[monthKey]) {
        acc.monthlyData[monthKey] = { income: 0, expense: 0 }
      }

      if (transaction.type === "income") {
        acc.monthlyData[monthKey].income += amount
      } else {
        acc.monthlyData[monthKey].expense += amount
      }

      return acc
    },
    {
      totalBalance: 0,
      totalIncome: 0,
      totalExpenses: 0,
      categories: {} as Record<string, number>,
      monthlyData: {} as Record<string, { income: number; expense: number }>,
    },
  )

  // Find top categories
  const topCategories = Object.entries(stats.categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }))

  return {
    totalBalance: stats.totalBalance.toFixed(2),
    totalIncome: stats.totalIncome.toFixed(2),
    totalExpenses: stats.totalExpenses.toFixed(2),
    transactionCount: transactions.length,
    topCategories,
    monthlyData: stats.monthlyData,
  }
}

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies })

  // Get authenticated user using getUser() for security
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  // Fetch transactions
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })

  if (error) {
    console.error("Error fetching transactions:", error)
  }

  // Fetch user profile
  const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Calculate financial statistics
  const stats = calculateFinancialStats(transactions || [])

  // Serialize transactions for client components
  const serializedTransactions = (transactions || []).map((t) => ({
    ...t,
    amount: Number(t.amount), // Ensure amount is a number, not a Decimal
  }))

  // Pass data to client components
  const dashboardData = {
    userId: user.id,
    transactions: serializedTransactions,
    stats,
    userProfile,
  }

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardShell>
        <DashboardContent data={dashboardData} />
      </DashboardShell>
    </Suspense>
  )
}

