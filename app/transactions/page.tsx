import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionList } from "@/components/transaction-list"
import { ExportCSV } from "@/components/export-csv"
import { Button } from "@/components/ui/button" // Import Button
import { RefreshCw } from "lucide-react" // Import RefreshCw icon

export const metadata: Metadata = {
  title: "Transactions | Personal Finance Manager",
  description: "View and manage all your transactions",
}

export default async function TransactionsPage() {
  const supabase = createServerComponentClient({ cookies })

  // Get authenticated user
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

  return (
    <DashboardShell>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">View and manage all your financial transactions</p>
          </div>
          <div className="flex items-center gap-2"> {/* Wrap buttons */}
            {/* Refresh button removed */}
            <ExportCSV transactions={transactions || []} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>View, filter, and manage your transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionList transactions={transactions || []} userId={user.id} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

