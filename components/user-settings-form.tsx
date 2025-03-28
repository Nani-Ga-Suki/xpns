"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { getSupabaseBrowser } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import type { User } from "@supabase/auth-helpers-nextjs"
import type { Profile } from "@/types/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  full_name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 2 characters.",
    })
    .optional(),
})

interface UserSettingsFormProps {
  user: User
  profile: Profile | null
}

export function UserSettingsForm({ user, profile }: UserSettingsFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowser()
  const { forceRefresh } = useAuth()
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      username: profile?.username || "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setError(null)

    try {
      // First check if we have a valid session
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        console.warn("No active session, attempting to refresh...")
        const success = await forceRefresh()
        if (!success) {
          setError("Authentication error - please log in again")
          router.push("/login")
          return
        }
      }

      console.log("Updating profile with values:", values)

      // First check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking profile:", checkError)

        // If we get an auth error, try to refresh the session
        if (
          checkError.code === "PGRST301" ||
          checkError.message.includes("JWT") ||
          checkError.message.includes("auth")
        ) {
          console.log("Auth error detected, forcing refresh...")
          const success = await forceRefresh()
          if (!success) {
            setError("Authentication error - please log in again")
            router.push("/login")
            return
          }
          setError("Please try again after session refresh")
          return
        }

        throw checkError
      }

      // If profile doesn't exist, insert it, otherwise update it
      const operation = existingProfile ? "update" : "insert"
      console.log(`Performing ${operation} operation for profile`)

      const profileData = {
        id: user.id,
        full_name: values.full_name,
        username: values.username,
        updated_at: new Date().toISOString(),
      }

      let result
      if (operation === "insert") {
        // Insert new profile
        result = await supabase.from("profiles").insert(profileData)
      } else {
        // Update existing profile with WHERE clause
        result = await supabase.from("profiles").update(profileData).eq("id", user.id) // Add the WHERE clause
      }

      const { data, error } = result

      if (error) {
        console.error(`Error ${operation} profile:`, error)

        // If we get an auth error, try to refresh the session
        if (error.code === "PGRST301" || error.message.includes("JWT") || error.message.includes("auth")) {
          console.log("Auth error detected, forcing refresh...")
          const success = await forceRefresh()
          if (!success) {
            setError("Authentication error - please log in again")
            router.push("/login")
            return
          }
          setError("Please try again after session refresh")
          return
        }

        setError(`Error updating profile: ${error.message}`)
        throw error
      }

      console.log(`Profile ${operation} result:`, data)

      // Update user metadata
      const { data: userData, error: metadataError } = await supabase.auth.updateUser({
        data: { full_name: values.full_name },
      })

      if (metadataError) {
        console.error("Error updating user metadata:", metadataError)
        // Don't throw here, just log it - we still want to show success for the profile update
      } else {
        console.log("User metadata updated:", userData)
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      })

      // Force a page reload after a short delay to ensure all state is refreshed
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormDescription>This is your public display name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>This is your public username.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <h3 className="text-sm font-medium">Email</h3>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-1">Your email cannot be changed.</p>
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </Form>
  )
}

