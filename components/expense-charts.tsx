"use client"

import { useMemo } from "react"
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import type { Expense, ExpenseCategory } from "@/types/expense"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface ExpenseChartsProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  type: "line" | "bar" | "pie" | "radar"
}

export function ExpenseCharts({ expenses, categories, type }: ExpenseChartsProps) {
  // Get category name by ID
  const getCategoryName = (categoryId: string) => {
    return categories.find((cat) => cat.id === categoryId)?.name || "Unknown"
  }

  // Get category color by ID
  const getCategoryColor = (categoryId: string) => {
    const color = categories.find((cat) => cat.id === categoryId)?.color
    if (!color) return "#888888"

    // Convert Tailwind color class to hex color
    switch (color) {
      case "bg-red-500":
        return "#ef4444"
      case "bg-blue-500":
        return "#3b82f6"
      case "bg-green-500":
        return "#22c55e"
      case "bg-yellow-500":
        return "#eab308"
      case "bg-purple-500":
        return "#a855f7"
      case "bg-pink-500":
        return "#ec4899"
      case "bg-indigo-500":
        return "#6366f1"
      case "bg-orange-500":
        return "#f97316"
      case "bg-teal-500":
        return "#14b8a6"
      case "bg-gray-500":
        return "#6b7280"
      default:
        return "#888888"
    }
  }

  // Data for line chart (expenses over time)
  const lineChartData = useMemo(() => {
    if (expenses.length === 0) return []

    // Get date range (last 3 months)
    const endDate = new Date()
    const startDate = subMonths(endDate, 2)

    // Create an array of all days in the range
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    // Initialize data with 0 for each day
    const dailyData = days.map((day) => ({
      date: format(day, "MMM d"),
      amount: 0,
    }))

    // Add expense amounts to the corresponding days
    expenses.forEach((expense) => {
      const expenseDate = new Date(expense.date)
      if (expenseDate >= startDate && expenseDate <= endDate) {
        const dayIndex = dailyData.findIndex((d) => d.date === format(expenseDate, "MMM d"))
        if (dayIndex !== -1) {
          dailyData[dayIndex].amount += expense.amount
        }
      }
    })

    return dailyData
  }, [expenses])

  // Data for bar chart (expenses by month)
  const barChartData = useMemo(() => {
    if (expenses.length === 0) return []

    // Get last 6 months
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), i)
      return {
        month: format(date, "MMM yyyy"),
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
      }
    }).reverse()

    // Initialize data with 0 for each month
    const monthlyData = months.map((month) => ({
      name: month.month,
      total: 0,
    }))

    // Add expense amounts to the corresponding months
    expenses.forEach((expense) => {
      const expenseDate = new Date(expense.date)
      const monthIndex = months.findIndex((m) => expenseDate >= m.startDate && expenseDate <= m.endDate)
      if (monthIndex !== -1) {
        monthlyData[monthIndex].total += expense.amount
      }
    })

    return monthlyData
  }, [expenses])

  // Data for pie chart (expenses by category)
  const pieChartData = useMemo(() => {
    if (expenses.length === 0) return []

    // Calculate total for each category
    const categoryTotals: Record<string, number> = {}

    expenses.forEach((expense) => {
      if (categoryTotals[expense.category]) {
        categoryTotals[expense.category] += expense.amount
      } else {
        categoryTotals[expense.category] = expense.amount
      }
    })

    // Convert to array format for the chart
    return Object.entries(categoryTotals).map(([categoryId, amount]) => ({
      name: getCategoryName(categoryId),
      value: amount,
      color: getCategoryColor(categoryId),
    }))
  }, [expenses, categories])

  // Data for radar chart (expenses by category)
  const radarChartData = useMemo(() => {
    if (expenses.length === 0) return []

    // Calculate total for each category
    const categoryTotals: Record<string, number> = {}

    expenses.forEach((expense) => {
      if (categoryTotals[expense.category]) {
        categoryTotals[expense.category] += expense.amount
      } else {
        categoryTotals[expense.category] = expense.amount
      }
    })

    // Convert to array format for the chart
    return Object.entries(categoryTotals).map(([categoryId, amount]) => ({
      subject: getCategoryName(categoryId),
      A: amount,
      fullMark: Math.max(...Object.values(categoryTotals)) * 1.2,
    }))
  }, [expenses, categories])

  // If there are no expenses, show a message
  if (expenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <p className="text-muted-foreground">No expense data available. Add expenses to see charts.</p>
      </div>
    )
  }

  // Render the appropriate chart based on the type prop
  switch (type) {
    case "line":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={lineChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(value) => value.split(" ")[0]} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line type="monotone" dataKey="amount" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )

    case "bar":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Total"]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Bar dataKey="total" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      )

    case "pie":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={pieChartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {pieChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )

    case "radar":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={30} domain={[0, "auto"]} />
            <Radar name="Expenses" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]} />
          </RadarChart>
        </ResponsiveContainer>
      )

    default:
      return null
  }
}

