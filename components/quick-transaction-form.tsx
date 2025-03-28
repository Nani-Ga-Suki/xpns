"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { getSupabaseBrowser } from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { NewTransaction } from "@/types/supabase"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  amount: z.coerce.number().positive({
    message: "Amount must be a positive number.",
  }),
  description: z.string().min(2, {
    message: "Description must be at least 2 characters.",
  }),
  date: z.date({
    required_error: "A date is required.",
  }),
  type: z.enum(["income", "expense"], {
    required_error: "Please select a transaction type.",
  }),
  category: z.string().optional(),
  notes: z.string().optional(),
})

// Define categories based on transaction type
const expenseCategories = [
  { value: "food", label: "Food & Dining" },
  { value: "transportation", label: "Transportation" },
  { value: "housing", label: "Housing" },
  { value: "utilities", label: "Utilities" },
  { value: "entertainment", label: "Entertainment" },
  { value: "healthcare", label: "Healthcare" },
  { value: "shopping", label: "Shopping" },
  { value: "personal", label: "Personal Care" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
]

const incomeCategories = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "investment", label: "Investment" },
  { value: "gift", label: "Gift" },
  { value: "refund", label: "Refund" },
  { value: "other", label: "Other" },
]

interface QuickTransactionFormProps {
  userId: string
  onSuccess?: () => void
}

export function QuickTransactionForm({ userId, onSuccess }: QuickTransactionFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowser()
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense")
  const { forceRefresh } = useAuth()
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      description: "",
      date: new Date(),
      type: "expense",
      category: "",
      notes: "",
    },
  })

  // Update categories when transaction type changes
  useEffect(() => {
    form.setValue("type", transactionType)
    form.setValue("category", "") // Reset category when type changes
  }, [transactionType, form])

  // Clear error when form values change
  useEffect(() => {
    if (error) {
      setError(null)
    }
  }, [form.watch(), error])

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

      const newTransaction: NewTransaction = {
        amount: values.amount,
        description: values.description,
        date: values.date.toISOString(),
        type: values.type,
        category: values.category || null,
        notes: values.notes || null,
      }

      console.log("Submitting quick transaction:", newTransaction)

      // Create new transaction
      const { data, error } = await supabase
        .from("transactions")
        .insert([{ ...newTransaction, user_id: userId }])
        .select()

      if (error) {
        console.error("Insert error:", error)

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

        throw error
      }

      console.log("Created transaction:", data)

      toast({
        title: "Transaction added",
        description: "Your transaction has been added successfully.",
      })

      // Reset form
      form.reset({
        amount: 0,
        description: "",
        date: new Date(),
        type: transactionType,
        category: "",
        notes: "",
      })

      // Callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Error saving transaction:", error)
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Get the appropriate categories based on transaction type
  const categories = transactionType === "income" ? incomeCategories : expenseCategories

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    const currentCategory = form.getValues("category")
    // Toggle the category - if it's already selected, deselect it
    if (currentCategory === category) {
      form.setValue("category", "")
    } else {
      form.setValue("category", category)
    }
  }

  return (
    <Form {...form}>
      {error && <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-4 text-sm">{error}</div>}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="w-32">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input placeholder="0.00" type="number" step="0.01" className="pl-7" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={transactionType === "expense" ? "default" : "outline"}
              size="sm"
              onClick={() => setTransactionType("expense")}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={transactionType === "income" ? "default" : "outline"}
              size="sm"
              onClick={() => setTransactionType("income")}
            >
              Income
            </Button>
          </div>

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        size="sm"
                      >
                        {field.value ? format(field.value, "MMM d, yyyy") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {categories.map((category) => (
                  <Button
                    key={category.value}
                    type="button"
                    variant={field.value === category.value ? "default" : "outline"}
                    size="sm"
                    className="h-auto py-1.5 text-xs"
                    onClick={() => handleCategorySelect(category.value)}
                  >
                    {category.label}
                  </Button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Notes (optional)"
                  className="resize-none h-20"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Adding..." : "Add Transaction"}
        </Button>
      </form>
    </Form>
  )
}

