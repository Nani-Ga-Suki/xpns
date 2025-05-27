"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
// Removed payment method icons: CreditCard, Landmark, DollarSign, HelpCircle
import { Edit2, Filter, Search, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { motion, AnimatePresence } from "framer-motion"
import type { Transaction } from "@/types/supabase"
import { TransactionForm } from "./transaction-form"
import { useMobile } from "@/hooks/use-mobile"
// Removed Tooltip import
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TransactionListProps {
  transactions: Transaction[]
  userId: string
  isCompact?: boolean
  useModals?: boolean
  isLoading?: boolean
  onTransactionChange?: () => void
}

export function TransactionList({
  transactions,
  userId,
  isCompact = false,
  useModals = true,
  isLoading = false,
  onTransactionChange,
}: TransactionListProps) {
  const { toast } = useToast()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = getSupabaseBrowser()!
  const isMobile = useMobile()
  // Removed expandedCardIds state and toggleCardExpansion function

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date-desc")
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [creditFilter, setCreditFilter] = useState<"all" | "yes" | "no">("all");
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = isCompact ? 5 : 10

  const handleDelete = async () => {
    if (!selectedTransaction) return

    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", selectedTransaction.id)
        .eq("user_id", userId)

      if (error) throw error

      toast({
        title: "Transaction deleted",
        description: "Your transaction has been deleted successfully.",
      })

      setIsDeleteDialogOpen(false)
      setSelectedTransaction(null)

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

    if (onTransactionChange) {
      onTransactionChange()
    }
  }

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => {
        const matchesSearch =
          transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (transaction.category?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "all" || transaction.category === categoryFilter;
        const matchesType = typeFilter === "all" || transaction.type === typeFilter;
        const matchesCredit =
          creditFilter === "all" ||
          (creditFilter === "yes" && transaction.is_credit === true) ||
          (creditFilter === "no" && (transaction.is_credit === false || transaction.is_credit === null));
        return matchesSearch && matchesCategory && matchesType && matchesCredit;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "amount-asc":
            return Number(a.amount) - Number(b.amount)
          case "amount-desc":
            return Number(b.amount) - Number(a.amount)
          case "date-asc":
            return new Date(a.date).getTime() - new Date(b.date).getTime()
          case "date-desc":
          default:
            return new Date(b.date).getTime() - new Date(a.date).getTime()
        }
      })
  }, [transactions, searchTerm, categoryFilter, typeFilter, creditFilter, sortBy]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredTransactions, currentPage, itemsPerPage])

  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>()
    transactions.forEach((t) => {
      if (t.category) uniqueCategories.add(t.category)
    })
    return Array.from(uniqueCategories)
  }, [transactions])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  // Removed PaymentMethodIcon helper component

  if (isLoading) {
    // Reverted skeleton grid cols to original (assuming 6 columns before)
    const skeletonCols = 6;
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-10 w-full md:w-[60%]" />
          <Skeleton className="h-10 w-full md:w-[180px]" />
        </div>

        <div className="rounded-md border">
          <div className="h-10 border-b bg-muted/50">
            <div className={`grid grid-cols-${skeletonCols} h-full px-4`}>
              {Array(skeletonCols)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-4 w-[80%] my-auto" />
                ))}
            </div>
          </div>
          <div className="bg-card">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="border-b h-16 px-4">
                  <div className={`grid grid-cols-${skeletonCols} h-full items-center`}>
                    {Array(skeletonCols)
                      .fill(0)
                      .map((_, j) => (
                        <Skeleton key={j} className="h-4 w-[80%]" />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No transactions found.</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {!isCompact && (
          <div className="flex flex-col gap-4 px-2">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Filter Dialog Removed */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
                  <span>Sort By</span>
                </SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="amount-desc">Amount (Highest)</SelectItem>
                  <SelectItem value="amount-asc">Amount (Lowest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          <AnimatePresence>
            {paginatedTransactions.map((transaction) => {
              // Removed isExpanded check
              return (
                <motion.div key={transaction.id} variants={item} layout className="min-w-[280px]">
                  {/* Card structure completely redesigned based on image */}
                  <Card className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="p-4 space-y-3"> {/* Main container with padding and vertical spacing */}

                      {/* Top Row: Description/Date (Left) & Type Badge (Right) */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <p className="text-2xl font-bold leading-tight break-words"> {/* Description - Made larger and bold */}
                            {transaction.description}
                          </p>
                          <p className="text-sm text-muted-foreground"> {/* Date */}
                            {format(new Date(transaction.date), "MMM d, yyyy")} {/* Using full year format */}
                          </p>
                        </div>
                        {/* Type Badge (Styled like image) */}
                        <Badge
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${
                            transaction.type === 'income'
                              ? 'bg-green-600' // Solid green for income
                              : 'bg-red-600' // Solid red for expense
                          }`}
                          // No variant needed when background color is set directly
                        >
                          {transaction.type === 'income' ? 'Income' : 'Expense'}
                        </Badge>
                      </div>

                      {/* Middle Row: Amount & Category */}
                      <div className="space-y-1">
                         {/* Amount (Large & Bold, Color-coded) */}
                         <p
                           className={`text-base font-medium leading-none ${ // Amount - Made smaller and medium weight
                             transaction.type === 'income' ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'
                           }`}
                         >
                           {/* No +/- sign based on image */}
                           ${Number(transaction.amount).toFixed(2)}
                         </p>
                         {/* Category Badge (Outline) */}
                         {transaction.category ? (
                           <Badge variant="outline" className="py-0 px-1.5 text-xs font-normal">
                             {transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
                           </Badge>
                         ) : (
                           <Badge variant="outline" className="py-0 px-1.5 text-xs font-normal">
                             Uncategorized {/* Display something if no category */}
                           </Badge>
                         )}
                      </div>

                      {/* Notes (Conditional) */}
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground pt-1 break-words">
                          {transaction.notes}
                        </p>
                      )}

                      {/* Bottom Row: Action Buttons (Right Aligned) */}
                      <div className="flex justify-end items-center gap-1 pt-1">
                         <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground" // Adjusted padding/height
                          onClick={() => {
                            setSelectedTransaction(transaction)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" // Adjusted padding/height
                          onClick={() => {
                            setSelectedTransaction(transaction)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>

        {!isCompact && totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(page)
                    }}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[90vw] max-w-md rounded-lg overflow-y-auto max-h-[85vh] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Make changes to your transaction here.</DialogDescription>
            </DialogHeader>
            {selectedTransaction && (
              <TransactionForm
                userId={userId}
                // Reverted transaction object passed to form
                transaction={{
                  ...selectedTransaction,
                  amount: Number(selectedTransaction.amount),
                  is_credit: selectedTransaction.is_credit ?? false,
                  installments: selectedTransaction.installments ?? undefined,
                  original_amount: selectedTransaction.original_amount ?? undefined,
                  remaining_installments: selectedTransaction.remaining_installments ?? undefined, // Fix type mismatch
                }}
                onSuccess={handleEditSuccess}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="w-[90vw] max-w-sm rounded-lg">
            <DialogHeader>
              <DialogTitle>Delete Transaction</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this transaction? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Render as table on desktop
  return (
    <div className="space-y-4">
      {!isCompact && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {/* Filter Dialog Removed */}
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <span>Sort By</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date (Newest)</SelectItem>
              <SelectItem value="date-asc">Date (Oldest)</SelectItem>
              <SelectItem value="amount-desc">Amount (Highest)</SelectItem>
              <SelectItem value="amount-asc">Amount (Lowest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-md border overflow-hidden shadow-sm">
        <Table>
          {/* Reverted Table Header */}
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="hidden md:table-cell">Notes</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              {/* Removed Method Header */}
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          {/* Reverted Table Body Mapping */}
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <TableRow>
                {/* Reverted colSpan to 7 */}
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {paginatedTransactions.map((transaction) => (
                  <motion.tr
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    // Added even:bg-muted/5 for row striping
                    className="border-b hover:bg-muted/10 even:bg-muted/5 transition-colors"
                  >
                    {/* Date */}
                    <TableCell>{format(new Date(transaction.date), "MMM d, yyyy")}</TableCell>
                    {/* Description */}
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    {/* Notes */}
                    <TableCell className="hidden md:table-cell max-w-[150px]">
                      {transaction.notes ? (
                        // Removed Tooltip components
                        <span className="truncate block text-sm text-muted-foreground">{transaction.notes}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    {/* Type */}
                    <TableCell className="hidden md:table-cell">
                      <Badge className={transaction.type === "income" ? "badge-income" : ""} variant={transaction.type === "income" ? "default" : "destructive"}>
                        {transaction.type === "income" ? "Income" : "Expense"}
                      </Badge>
                    </TableCell>
                    {/* Category */}
                    <TableCell className="hidden md:table-cell">
                      {transaction.category ? (
                        <Badge variant="outline" className="truncate">
                          {transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    {/* Removed Method Cell */}
                    {/* Amount */}
                    {/* Added conditional text color and +/- sign for amount */}
                    <TableCell
                      className={`text-right font-medium ${ // Removed font-mono
                        transaction.type === 'income' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}${Number(transaction.amount).toFixed(2)}
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTransaction(transaction)
                              setIsEditDialogOpen(true)
                            }}
                            className="dropdown-menu-item"
                          >
                            <Edit2 className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTransaction(transaction)
                              setIsDeleteDialogOpen(true)
                            }}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 dropdown-menu-item"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>

      {!isCompact && totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (currentPage > 1) setCurrentPage(currentPage - 1)
                }}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(page)
                  }}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                }}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md rounded-lg overflow-y-auto max-h-[85vh] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Make changes to your transaction here.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <TransactionForm
              userId={userId}
              // Reverted transaction object passed to form
              transaction={{
                ...selectedTransaction,
                amount: Number(selectedTransaction.amount),
                is_credit: selectedTransaction.is_credit ?? false,
                installments: selectedTransaction.installments ?? undefined,
                original_amount: selectedTransaction.original_amount ?? undefined,
                remaining_installments: selectedTransaction.remaining_installments ?? undefined, // Fix type mismatch
              }}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[90vw] max-w-sm rounded-lg">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
