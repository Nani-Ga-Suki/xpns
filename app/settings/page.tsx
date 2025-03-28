import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { DashboardShell } from "@/components/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserSettingsForm } from "@/components/user-settings-form"

export const metadata: Metadata = {
  title: "Settings | Personal Finance Manager",
  description: "Manage your account settings and preferences",
}

export default async function SettingsPage() {
  const supabase = createServerComponentClient({ cookies })

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  // Fetch user profile
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching profile:", error)
  }

  return (
    <DashboardShell>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsForm user={user} profile={profile} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

