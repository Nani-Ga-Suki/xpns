"use client"

import { useState, useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useMobile } from "@/hooks/use-mobile" // Import useMobile
import type { Transaction } from "@/types/supabase"

interface CategoryPieChartProps {
  transactions: Transaction[]
  isLoading?: boolean
}

export function CategoryPieChart({ transactions, isLoading = false }: CategoryPieChartProps) {
  const isMobile = useMobile() // Use the hook

  const data = useMemo(() => {
    if (transactions.length === 0) return []

    // Filter transactions based on the toggle
    const filteredTransactions = transactions // Process all passed transactions

    // Calculate total for each category
    const categoryTotals: Record<string, { value: number; type: "income" | "expense" }> = {}

    filteredTransactions.forEach((transaction) => {
      const category = transaction.category || "Uncategorized"

      if (!categoryTotals[category]) {
        categoryTotals[category] = {
          value: 0,
          type: transaction.type,
        }
      }

      categoryTotals[category].value += Number(transaction.amount)
    })

    // Convert to array format for the chart
    return Object.entries(categoryTotals).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: data.value,
      type: data.type,
    }))
  }, [transactions])

  // Define colors for the chart
  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
  ]

  // Standard color assignment
  const getColor = (_entry: any, index: number) => {
    return COLORS[index % COLORS.length]
  }

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">No category data available</p>
      </div>
    )
  }

  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={!isMobile} // Hide label line on mobile
            outerRadius={isMobile ? 100 : 150} // Smaller radius on mobile
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={isMobile ? false : ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} // Hide labels on mobile
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Amount"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderRadius: "var(--radius)",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--card-foreground))",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          />
          {!isMobile && <Legend />} {/* Hide legend on mobile */}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

