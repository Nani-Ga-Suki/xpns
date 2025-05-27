"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Expense, ExpenseCategory } from "@/types/expense"

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive" }),
  description: z.string().min(2, { message: "Description must be at least 2 characters" }),
  category: z.string({ required_error: "Please select a category" }),
  date: z.date({ required_error: "Please select a date" }),
  notes: z.string().optional(),
  isCredit: z.boolean().default(false),
  installments: z.coerce.number().min(1).max(24).optional()
}).refine(data => !data.isCredit || data.installments, {
  message: "Installments are required for credit purchases",
  path: ["installments"]
})

interface ExpenseFormProps {
  categories: ExpenseCategory[]
  onSubmit: (expense: Omit<Expense, "id">) => void
  onUpdate: (expense: Expense) => void
  expenses: Expense[]
  initialExpense?: Expense | null
}

export function ExpenseForm({ categories, onSubmit, onUpdate, expenses, initialExpense = null }: ExpenseFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get("edit")

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      description: "",
      category: "",
      date: new Date(),
      notes: "",
    },
  })

  // Check if we're editing an expense (either from URL param or state)
  useEffect(() => {
    const id = editId || editingExpenseId
    const expenseToEdit = initialExpense || (id ? expenses.find((expense) => expense.id === id) : null)

    if (expenseToEdit) {
      setIsEditing(true)
      setEditingExpenseId(expenseToEdit.id)

      form.reset({
        amount: expenseToEdit.amount,
        description: expenseToEdit.description,
        category: expenseToEdit.category,
        date: new Date(expenseToEdit.date),
        notes: expenseToEdit.notes || "",
      })
    }
  }, [editId, editingExpenseId, expenses, form, initialExpense])

  function handleSubmit(values: z.infer<typeof formSchema>) {
    const expenseData = {
      ...values,
      amount: values.isCredit ? values.amount / (values.installments || 1) : values.amount,
      originalAmount: values.isCredit ? values.amount : undefined,
      remainingInstallments: values.isCredit ? (values.installments || 1) - 1 : undefined,
    }

    if (isEditing && editingExpenseId) {
      onUpdate({
        id: editingExpenseId,
        ...expenseData,
      })
      // Reset form and editing state
      setIsEditing(false)
      setEditingExpenseId(null)
      // Remove the edit parameter from URL if it exists
      if (editId) {
        router.push(window.location.pathname)
      }
    } else {
      onSubmit(expenseData)
    }

    form.reset({
      amount: 0,
      description: "",
      category: "",
      date: new Date(),
      notes: "",
      isCredit: false,
      installments: undefined,
    })
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditingExpenseId(null)
    form.reset()
    // Remove the edit parameter from URL if it exists
    if (editId) {
      router.push(window.location.pathname)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6"> {/* Increased spacing */}
        {/* Credit Purchase Checkbox and Installments */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="isCredit"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-1">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Credit Purchase</FormLabel>
                  <FormDescription>
                    Check if this is a credit purchase with installments.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {form.watch("isCredit") && (
            <FormField
              control={form.control}
              name="installments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Installments (1-24)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="24" placeholder="e.g., 12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Amount and Date - Added md:items-start for top alignment */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                    <Input placeholder="0.00" type="number" step="0.01" className="pl-7" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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

        {/* Description, Category, Notes */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Grocery shopping, dinner, etc." {...field} />
              </FormControl>
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${category.color}`}></div>
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional details about this expense..." className="resize-none" {...field} />
              </FormControl>
              <FormDescription>Add any additional information about this expense.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          {isEditing && (
            <Button variant="outline" type="button" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
          <Button type="submit">{isEditing ? "Update Expense" : "Add Expense"}</Button>
        </div>

        {expenses.filter(e => e.isCredit && (e.remainingInstallments || 0) > 0).length > 0 && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Active Credit Purchases</h3>
            <div className="space-y-4">
              {expenses
                .filter(e => e.isCredit && (e.remainingInstallments || 0) > 0)
                .map(expense => (
                  <div key={expense.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {expense.remainingInstallments} of {expense.installments} installments remaining
                        </p>
                        <p className="text-sm">
                          Original amount: ${expense.originalAmount?.toFixed(2)} |
                          Current installment: ${expense.amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingExpenseId(expense.id)
                            form.reset({
                              amount: expense.originalAmount || expense.amount,
                              description: expense.description,
                              category: expense.category,
                              date: new Date(expense.date),
                              notes: expense.notes || "",
                              isCredit: true,
                              installments: expense.installments,
                            })
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </form>
    </Form>
  )
}

