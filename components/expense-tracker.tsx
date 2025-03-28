"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExpenseForm } from "@/components/expense-form"
import { ExpenseList } from "@/components/expense-list"
import { ExpenseStats } from "@/components/expense-stats"
import { ExpenseCharts } from "@/components/expense-charts"
import type { Expense, ExpenseCategory } from "@/types/expense"

// Sample expense categories
export const expenseCategories: ExpenseCategory[] = [
  { id: "food", name: "Food & Dining", color: "bg-red-500" },
  { id: "transportation", name: "Transportation", color: "bg-blue-500" },
  { id: "housing", name: "Housing", color: "bg-green-500" },
  { id: "utilities", name: "Utilities", color: "bg-yellow-500" },
  { id: "entertainment", name: "Entertainment", color: "bg-purple-500" },
  { id: "healthcare", name: "Healthcare", color: "bg-pink-500" },
  { id: "shopping", name: "Shopping", color: "bg-indigo-500" },
  { id: "personal", name: "Personal Care", color: "bg-orange-500" },
  { id: "education", name: "Education", color: "bg-teal-500" },
  { id: "other", name: "Other", color: "bg-gray-500" },
]

// Sample initial expenses
const initialExpenses: Expense[] = [
  {
    id: "1",
    amount: 45.99,
    description: "Grocery shopping",
    date: new Date("2023-12-01"),
    category: "food",
  },
  {
    id: "2",
    amount: 30.0,
    description: "Gas",
    date: new Date("2023-12-02"),
    category: "transportation",
  },
  {
    id: "3",
    amount: 1200.0,
    description: "Rent",
    date: new Date("2023-12-01"),
    category: "housing",
  },
  {
    id: "4",
    amount: 15.99,
    description: "Movie tickets",
    date: new Date("2023-12-05"),
    category: "entertainment",
  },
  {
    id: "5",
    amount: 120.5,
    description: "Electricity bill",
    date: new Date("2023-12-10"),
    category: "utilities",
  },
]

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [activeTab, setActiveTab] = useState("dashboard")

  // Load expenses from localStorage on component mount
  useEffect(() => {
    const savedExpenses = localStorage.getItem("expenses")
    if (savedExpenses) {
      try {
        // Parse the JSON string and convert date strings back to Date objects
        const parsedExpenses = JSON.parse(savedExpenses).map((expense: any) => ({
          ...expense,
          date: new Date(expense.date),
        }))
        setExpenses(parsedExpenses)
      } catch (error) {
        console.error("Error parsing saved expenses:", error)
        setExpenses(initialExpenses)
      }
    } else {
      setExpenses(initialExpenses)
    }
  }, [])

  // Save expenses to localStorage whenever they change
  useEffect(() => {
    if (expenses.length > 0) {
      localStorage.setItem("expenses", JSON.stringify(expenses))
    }
  }, [expenses])

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense = {
      ...expense,
      id: crypto.randomUUID(),
    }
    setExpenses([...expenses, newExpense])
  }

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter((expense) => expense.id !== id))
  }

  const updateExpense = (updatedExpense: Expense) => {
    setExpenses(expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Expense Tracker</h1>
        <p className="text-muted-foreground">Manage, visualize, and analyze your expenses</p>
      </div>

      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 md:w-[400px]">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="add">Add Expense</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <ExpenseStats expenses={expenses} categories={expenseCategories} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Expense Trends</CardTitle>
                <CardDescription>Your spending over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ExpenseCharts expenses={expenses} categories={expenseCategories} type="line" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Expense Distribution</CardTitle>
                <CardDescription>Breakdown by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ExpenseCharts expenses={expenses} categories={expenseCategories} type="pie" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Add New Expense</CardTitle>
              <CardDescription>Enter the details of your expense</CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseForm
                categories={expenseCategories}
                onSubmit={addExpense}
                onUpdate={updateExpense}
                expenses={expenses}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Your latest transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseList
                expenses={expenses.slice(0, 5)}
                categories={expenseCategories}
                onDelete={deleteExpense}
                onEdit={updateExpense}
                isCompact
                useModals
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>All Expenses</CardTitle>
              <CardDescription>View, filter, and manage your expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseList
                expenses={expenses}
                categories={expenseCategories}
                onDelete={deleteExpense}
                onEdit={(expense) => {
                  setActiveTab("add")
                  // We'll handle this in the ExpenseForm component
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add Expense</CardTitle>
              <CardDescription>Enter the details of your expense</CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseForm
                categories={expenseCategories}
                onSubmit={addExpense}
                onUpdate={updateExpense}
                expenses={expenses}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Expense Reports</CardTitle>
              <CardDescription>Detailed analysis of your spending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpenseCharts expenses={expenses} categories={expenseCategories} type="bar" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ExpenseCharts expenses={expenses} categories={expenseCategories} type="pie" />
                  </div>
                  <div>
                    <ExpenseCharts expenses={expenses} categories={expenseCategories} type="radar" />
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

