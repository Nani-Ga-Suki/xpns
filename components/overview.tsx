"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Line,
  LineChart,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import type { Transaction } from "@/types/supabase"
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from "date-fns"

interface OverviewProps {
  transactions: Transaction[]
  isLoading?: boolean
  monthlyData?: Record<string, { income: number; expense: number }>
  period?: "last14days" | "monthly" | "yearly"
  chartType?: "bar" | "line"
}

export function Overview({
  transactions,
  isLoading = false,
  monthlyData,
  period = "last14days",
  chartType = "bar",
}: OverviewProps) {
  const data = useMemo(() => {
    if (period === "last14days") {
      // Get last 14 days
      const days = Array.from({ length: 14 }, (_, i) => {
        const date = subDays(new Date(), 13 - i)
        return {
          date,
          name: format(date, "MMM dd"),
          income: 0,
          expense: 0,
        }
      })

      // Add transaction amounts to the corresponding days
      transactions.forEach((transaction) => {
        const transactionDate = new Date(transaction.date)

        // Find the day index if it's within the last 14 days
        const dayIndex = days.findIndex((day) => isSameDay(day.date, transactionDate))

        if (dayIndex !== -1) {
          if (transaction.type === "income") {
            days[dayIndex].income += Number(transaction.amount)
          } else {
            days[dayIndex].expense += Number(transaction.amount)
          }
        }
      })

      return days
    } else if (period === "monthly" && monthlyData && Object.keys(monthlyData).length > 0) {
      // Sort the keys first, then map to the data format
      const sortedKeys = Object.keys(monthlyData).sort()
      return sortedKeys.slice(-6).map((key) => {
        const [year, month] = key.split("-").map(Number)
        const date = new Date(year, month - 1)
        return {
          name: format(date, "MMM yyyy"),
          income: monthlyData[key].income,
          expense: monthlyData[key].expense,
          savings: monthlyData[key].income - monthlyData[key].expense,
          savingsRate:
            monthlyData[key].income > 0
              ? ((monthlyData[key].income - monthlyData[key].expense) / monthlyData[key].income) * 100
              : 0,
        }
      })
    } else if (period === "yearly") {
      // Get all months in the current year
      const currentYear = new Date().getFullYear()
      const months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(currentYear, i, 1)
        return {
          month: i,
          name: format(date, "MMM"),
          income: 0,
          expense: 0,
        }
      })

      // Add transaction amounts to the corresponding months
      transactions.forEach((transaction) => {
        const transactionDate = new Date(transaction.date)

        // Only include transactions from the current year
        if (transactionDate.getFullYear() === currentYear) {
          const monthIndex = transactionDate.getMonth()

          if (transaction.type === "income") {
            months[monthIndex].income += Number(transaction.amount)
          } else {
            months[monthIndex].expense += Number(transaction.amount)
          }
        }
      })

      return months
    } else {
      // Default to last 6 months calculation from transactions
      const months = Array.from({ length: 6 }, (_, i) => {
        const date = subDays(new Date(), i * 30)
        return {
          month: format(date, "MMM yyyy"),
          startDate: startOfMonth(date),
          endDate: endOfMonth(date),
        }
      }).reverse()

      // Initialize data with 0 for each month
      const monthlyDataCalculated = months.map((month) => ({
        name: month.month,
        income: 0,
        expense: 0,
      }))

      // Add transaction amounts to the corresponding months
      transactions.forEach((transaction) => {
        const transactionDate = new Date(transaction.date)
        const monthIndex = months.findIndex((m) =>
          isWithinInterval(transactionDate, { start: m.startDate, end: m.endDate }),
        )

        if (monthIndex !== -1) {
          if (transaction.type === "income") {
            monthlyDataCalculated[monthIndex].income += Number(transaction.amount)
          } else {
            monthlyDataCalculated[monthIndex].expense += Number(transaction.amount)
          }
        }
      })

      return monthlyDataCalculated
    }
  }, [transactions, monthlyData, period])

  if (isLoading) {
    return <Skeleton className="h-[350px] w-full" />
  }

  // Render line chart for daily data
  if (chartType === "line" || period === "last14days") {
    return (
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              dy={10}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => `$${value}`}
              dx={-10}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderRadius: "var(--radius)",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--card-foreground))",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Income"
              animationDuration={1500}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Expense"
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Render bar chart for monthly/yearly data
  return (
    <div className="h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            dy={10}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(value) => `$${value}`}
            dx={-10}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
            labelFormatter={(label) => `Month: ${label}`}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderRadius: "var(--radius)",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--card-foreground))",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
          />
          <Bar
            dataKey="income"
            fill="hsl(var(--chart-2))"
            radius={[4, 4, 0, 0]}
            name="Income"
            animationDuration={1500}
          />
          <Bar
            dataKey="expense"
            fill="hsl(var(--chart-1))"
            radius={[4, 4, 0, 0]}
            name="Expense"
            animationDuration={1500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

