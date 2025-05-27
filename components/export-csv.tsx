"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { Transaction } from "@/types/supabase"
import { format } from "date-fns"

interface ExportCSVProps {
  transactions: Transaction[]
  filename?: string
}

export function ExportCSV({ transactions, filename = "transactions" }: ExportCSVProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = () => {
    if (transactions.length === 0) return

    setIsExporting(true)

    try {
      // Create CSV header
      const headers = ["Date", "Description", "Category", "Type", "Amount"]

      // Create CSV rows
      const rows = transactions.map((transaction) => [
        format(new Date(transaction.date), "yyyy-MM-dd"),
        transaction.description,
        transaction.category || "Uncategorized",
        transaction.type,
        transaction.amount.toString(),
      ])

      // Combine header and rows
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
      ].join("\n")

      // Create a blob and download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      // Set download attributes
      link.setAttribute("href", url)
      link.setAttribute("download", `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`)
      link.style.visibility = "hidden"

      // Append to document, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error exporting CSV:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || transactions.length === 0}>
      {/* Icon with responsive margin */}
      <Download className="h-4 w-4 sm:mr-2" />
      {/* Text span hidden on mobile, inline on sm+ */}
      <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export CSV"}</span>
    </Button>
  )
}

