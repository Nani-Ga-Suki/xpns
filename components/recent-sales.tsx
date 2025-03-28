"use client"

import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import { Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { TransactionForm } from "./transaction-form"
import type { Transaction } from "@/types/supabase"

interface RecentSalesProps {
  transactions: Transaction[]
  isLoading?: boolean
  onTransactionChange?: () => void
}

export function RecentSales({ transactions, isLoading = false, onTransactionChange }: RecentSalesProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = getSupabaseBrowser()
  const { toast } = useToast()

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { x: -20, opacity: 0 },
    show: { x: 0, opacity: 1 },
  }

  const handleDelete = async () => {
    if (!selectedTransaction) return

    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", selectedTransaction.id)
        .eq("user_id", selectedTransaction.user_id)

      if (error) throw error

      toast({
        title: "Transaction deleted",
        description: "Your transaction has been deleted successfully.",
      })

      // Close dialog
      setIsDeleteDialogOpen(false)
      setSelectedTransaction(null)

      // Notify parent component to refresh data
      if (onTransactionChange) {
        onTransactionChange()
      }
    } catch (error) {
      console.error("Error deleting transaction:", error)
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false)
    setSelectedTransaction(null)

    // Notify parent component to refresh data
    if (onTransactionChange) {
      onTransactionChange()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="h-12 w-12 rounded-full mr-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
              <Skeleton className="h-4 w-[80px]" />
            </div>
          ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-muted-foreground">No recent transactions found</p>
      </div>
    )
  }

  return (
    <>
      <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
        {transactions.map((transaction) => (
          <motion.div key={transaction.id} className="flex items-center group" variants={item}>
            <div
              className={`mr-4 rounded-full p-2 ${
                transaction.type === "income" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              {transaction.type === "income" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-green-500 dark:text-green-400"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-destructive"
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none text-foreground">{transaction.description}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(transaction.date), "PPP")}</p>
              {transaction.notes && <p className="text-xs text-muted-foreground line-clamp-1">{transaction.notes}</p>}
            </div>
            <div
              className={`font-medium ${
                transaction.type === "income" ? "text-green-500 dark:text-green-400" : "text-destructive"
              }`}
            >
              {transaction.type === "income" ? "+" : "-"}${Number(transaction.amount).toFixed(2)}
            </div>
            <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSelectedTransaction(transaction)
                  setIsEditDialogOpen(true)
                }}
              >
                <Edit2 className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSelectedTransaction(transaction)
                  setIsDeleteDialogOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Make changes to your transaction here.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <TransactionForm
              userId={selectedTransaction.user_id}
              transaction={{
                id: selectedTransaction.id,
                amount: Number(selectedTransaction.amount),
                description: selectedTransaction.description,
                date: selectedTransaction.date,
                type: selectedTransaction.type,
                category: selectedTransaction.category,
                notes: selectedTransaction.notes, // Add this line to pass the notes
              }}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

