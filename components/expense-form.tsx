"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
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
    if (isEditing && editingExpenseId) {
      onUpdate({
        id: editingExpenseId,
        ...values,
      })
      // Reset form and editing state
      setIsEditing(false)
      setEditingExpenseId(null)
      // Remove the edit parameter from URL if it exists
      if (editId) {
        router.push(window.location.pathname)
      }
    } else {
      onSubmit(values)
    }

    form.reset({
      amount: 0,
      description: "",
      category: "",
      date: new Date(),
      notes: "",
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5">$</span>
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
        </div>

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
      </form>
    </Form>
  )
}

