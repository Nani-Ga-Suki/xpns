"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { Edit2, Filter, Search, Trash2 } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = getSupabaseBrowser()
  const isMobile = useMobile()

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date-desc")
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

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => {
        // Filter by search term
        const matchesSearch =
          transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (transaction.category?.toLowerCase() || "").includes(searchTerm.toLowerCase())

        // Filter by category
        const matchesCategory = categoryFilter === "all" || transaction.category === categoryFilter

        return matchesSearch && matchesCategory
      })
      .sort((a, b) => {
        // Sort by selected option
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
  }, [transactions, searchTerm, categoryFilter, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredTransactions, currentPage, itemsPerPage])

  // Get unique categories for filter
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>()
    transactions.forEach((t) => {
      if (t.category) uniqueCategories.add(t.category)
    })
    return Array.from(uniqueCategories)
  }, [transactions])

  // Animation variants
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

  // If loading, show skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-10 w-full md:w-[60%]" />
          <Skeleton className="h-10 w-full md:w-[180px]" />
        </div>

        <div className="rounded-md border">
          <div className="h-10 border-b bg-muted/50">
            <div className="grid grid-cols-6 h-full px-4">
              {Array(6)
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
                  <div className="grid grid-cols-6 h-full items-center">
                    {Array(6)
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

  // If there are no transactions, show a message
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No transactions found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            if (onTransactionChange) {
              onTransactionChange()
            }
          }}
        >
          Refresh
        </Button>
      </div>
    )
  }

  // Render as cards on mobile
  if (isMobile) {
    return (
      <div className="space-y-4">
        {!isCompact && (
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>Category</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
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
          </div>
        )}

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          <AnimatePresence>
            {paginatedTransactions.map((transaction) => (
              <motion.div key={transaction.id} variants={item} layout>
                <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300">
                  <CardHeader className="pb-2 bg-muted/5">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">{transaction.description}</CardTitle>
                      <Badge variant={transaction.type === "income" ? "default" : "destructive"} className="ml-2">
                        {transaction.type === "income" ? "Income" : "Expense"}
                      </Badge>
                    </div>
                    <CardDescription>{format(new Date(transaction.date), "PPP")}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2 pt-4">
                    <p className="text-2xl font-bold">${Number(transaction.amount).toFixed(2)}</p>
                    {transaction.category && (
                      <Badge variant="outline" className="mt-2">
                        {transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
                      </Badge>
                    )}
                    {transaction.notes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{transaction.notes}</p>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2 pt-0 pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
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
                      onClick={() => {
                        setSelectedTransaction(transaction)
                        setIsDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Make changes to your transaction here.</DialogDescription>
            </DialogHeader>
            {selectedTransaction && (
              <TransactionForm
                userId={userId}
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Category</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center">{category.charAt(0).toUpperCase() + category.slice(1)}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[150px]">Category</TableHead>
              <TableHead className="w-[150px]">Notes</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
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
                    className="border-b hover:bg-muted/5 transition-colors"
                  >
                    <TableCell className="font-medium">{format(new Date(transaction.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>
                      {transaction.category ? (
                        <Badge variant="outline">
                          {transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {transaction.notes ? (
                        <span className="text-sm text-muted-foreground line-clamp-1">{transaction.notes}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.type === "income" ? "default" : "destructive"}>
                        {transaction.type === "income" ? "Income" : "Expense"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">${Number(transaction.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <span className="sr-only">Open menu</span>
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 15 15"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                            >
                              <path
                                d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
                                fill="currentColor"
                                fillRule="evenodd"
                                clipRule="evenodd"
                              ></path>
                            </svg>
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
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTransaction(transaction)
                              setIsDeleteDialogOpen(true)
                            }}
                            className="dropdown-menu-item"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Make changes to your transaction here.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <TransactionForm
              userId={userId}
              transaction={{
                id: selectedTransaction.id,
                amount: Number(selectedTransaction.amount),
                description: selectedTransaction.description,
                date: selectedTransaction.date,
                type: selectedTransaction.type,
                category: selectedTransaction.category,
                notes: selectedTransaction.notes,
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
    </div>
  )
}

