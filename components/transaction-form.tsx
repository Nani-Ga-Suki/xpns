"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { CreditCard } from "lucide-react" // Import CreditCard icon

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge" // Import Badge component
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox" // Added Checkbox import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { NewTransaction } from "@/types/supabase"

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
  isCredit: z.boolean().default(false), // Added isCredit
  installments: z.coerce.number().min(1).max(24).optional(), // Added installments
}).refine(data => !data.isCredit || data.installments, { // Added refinement
  message: "Installments are required for credit purchases",
  path: ["installments"]
})

// Explicitly define the form values type
type TransactionFormValues = z.infer<typeof formSchema>;

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

interface TransactionFormProps {
  userId: string
  transaction?: NewTransaction & { id?: string }
  onSuccess?: () => void
}

export function TransactionForm({ userId, transaction, onSuccess }: TransactionFormProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowser()
  const [transactionType, setTransactionType] = useState<"income" | "expense">(transaction?.type || "expense")
  const { forceRefresh } = useAuth()
  const router = useRouter()

  // Use the explicit type alias here
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: transaction?.amount || 0,
      description: transaction?.description || "",
      date: transaction?.date ? new Date(transaction.date) : new Date(),
      type: transaction?.type || "expense",
      category: transaction?.category || "",
      notes: transaction?.notes || "",
      isCredit: transaction?.is_credit || false, // Added default value (check existing transaction)
      installments: transaction?.installments || undefined, // Added default value
    },
  })

  // Update categories when transaction type changes
  useEffect(() => {
    form.setValue("type", transactionType)
    // Only reset category when type changes and it's not an edit
    if (!transaction?.id) {
      form.setValue("category", "")
    }
  }, [transactionType, form, transaction])

  // Clear error when form values change
  useEffect(() => {
    if (error) {
      setError(null)
    }
  }, [form.watch(), error])

  async function onSubmit(values: TransactionFormValues) { // Use the explicit type alias
    setIsLoading(true)
    setError(null)

    // Add null check for supabase client
    if (!supabase) {
      setError("Database connection error. Please try again later.")
      setIsLoading(false)
      return
    }

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

      // Prepare transaction data, handling credit logic
      const isExpense = values.type === "expense";
      const isCreditPurchase = isExpense && values.isCredit;

      // Calculate amount per installment if it's a credit purchase
      const transactionAmount = isCreditPurchase
        ? values.amount / (values.installments || 1)
        : values.amount;

      const newTransaction: NewTransaction = {
        amount: transactionAmount,
        description: values.description,
        date: values.date.toISOString(),
        type: values.type,
        category: values.category || null,
        notes: values.notes || null,
        // Add credit fields if applicable (assuming snake_case in DB)
        is_credit: isCreditPurchase ? true : undefined,
        installments: isCreditPurchase ? values.installments : undefined,
        original_amount: isCreditPurchase ? values.amount : undefined,
        // Note: remaining_installments might need specific handling on update vs create
        // For simplicity here, we'll set it based on the submitted installments
        remaining_installments: isCreditPurchase ? (values.installments || 1) - 1 : undefined,
      }

      // Log the transaction for debugging
      console.log("Submitting transaction:", newTransaction)

      if (transaction?.id) {
        // Update existing transaction
        const { data, error } = await supabase
          .from("transactions")
          .update(newTransaction)
          .eq("id", transaction.id)
          .eq("user_id", userId)
          .select()

        if (error) {
          console.error("Update error:", error)

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
          } else {
            setError(`Error updating transaction: ${error.message}`)
          }

          throw error
        }

        console.log("Updated transaction:", data)

        toast({
          title: "Transaction updated",
          description: "Your transaction has been updated successfully.",
        })
      } else {
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
          } else {
            setError(`Error adding transaction: ${error.message}`)
          }

          throw error
        }

        console.log("Created transaction:", data)

        toast({
          title: "Transaction added",
          description: "Your transaction has been added successfully.",
        })
      }

      // Reset form
      form.reset({
        amount: 0,
        description: "",
        date: new Date(),
        type: "expense",
        category: "",
        notes: "",
        isCredit: false, // Reset credit fields
        installments: undefined, // Reset credit fields
      })

      // Callback if provided
      if (onSuccess) {
        // Callback immediately after successful operation
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

  // Watch the isCredit field value
  const isCreditChecked = form.watch("isCredit");

  return (
    <Form {...form}>
      {error && <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-4 text-sm">{error}</div>}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Form fields remain the same */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"> {/* Added flex container */}
                  Amount
                  {/* Conditionally render badge if editing a credit transaction */}
                  {transaction?.is_credit && (
                    <Badge variant="outline" className="text-xs font-normal">
                      <CreditCard className="mr-1 h-3 w-3" /> Credit
                    </Badge>
                  )}
                </FormLabel>
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
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">Type</FormLabel> {/* Added flex items-center */}
                <Select
                  onValueChange={(value) => {
                    field.onChange(value)
                    setTransactionType(value as "income" | "expense")
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Groceries, Salary, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Wrapper div for the entire Credit Purchase section with transition */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden space-y-3", // Adjusted space-y
            transactionType === "expense"
              ? "max-h-60 opacity-100 pt-2" // Adjust max-h if needed, added pt-2
              : "max-h-0 opacity-0 pt-0"
          )}
        >
            <FormField
              control={form.control}
              name="isCredit"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Credit Purchase
                    </FormLabel>
                    <FormDescription>
                      Check if this is a credit purchase with installments.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Wrapper div for installments field with transition */}
            <div
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isCreditChecked
                  ? "max-h-40 opacity-100" // Adjust max-h if needed
                  : "max-h-0 opacity-0"
              )}
            >
              <FormField
                control={form.control}
                name="installments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installments (1-24)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        placeholder="e.g., 12"
                        {...field}
                        value={field.value ?? ""} // Use nullish coalescing for default
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
        </div> {/* End of the transitioning wrapper div */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem> {/* Removed flex flex-col */}
                <FormLabel>Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Categorize your transaction for better reporting.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional details about this transaction..."
                  className="resize-none"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>Add any additional information about this transaction.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? "Saving..." : transaction?.id ? "Update Transaction" : "Add Transaction"}
        </Button>
      </form>
    </Form>
  )
}

