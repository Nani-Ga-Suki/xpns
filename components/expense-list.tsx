"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Edit2, Filter, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Expense, ExpenseCategory } from "@/types/expense"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExpenseForm } from "./expense-form"

interface ExpenseListProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  onDelete: (id: string) => void
  onEdit: (expense: Expense) => void
  isCompact?: boolean
  useModals?: boolean
}

export function ExpenseList({
  expenses,
  categories,
  onDelete,
  onEdit,
  isCompact = false,
  useModals = false,
}: ExpenseListProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date-desc")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = isCompact ? 5 : 10

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  // Get category name by ID
  const getCategoryName = (categoryId: string) => {
    return categories.find((cat) => cat.id === categoryId)?.name || "Unknown"
  }

  // Get category color by ID
  const getCategoryColor = (categoryId: string) => {
    return categories.find((cat) => cat.id === categoryId)?.color || "bg-gray-500"
  }

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        // Filter by search term
        const matchesSearch =
          expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          getCategoryName(expense.category).toLowerCase().includes(searchTerm.toLowerCase())

        // Filter by category
        const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter

        return matchesSearch && matchesCategory
      })
      .sort((a, b) => {
        // Sort by selected option
        switch (sortBy) {
          case "amount-asc":
            return a.amount - b.amount
          case "amount-desc":
            return b.amount - a.amount
          case "date-asc":
            return new Date(a.date).getTime() - new Date(b.date).getTime()
          case "date-desc":
          default:
            return new Date(b.date).getTime() - new Date(a.date).getTime()
        }
      })
  }, [expenses, searchTerm, categoryFilter, sortBy, categories])

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage)
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredExpenses.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredExpenses, currentPage, itemsPerPage])

  // Handle edit
  const handleEdit = (expense: Expense) => {
    onEdit(expense)
    router.push(`?edit=${expense.id}`)
  }

  // Handle delete with modal
  const handleDeleteClick = (expense: Expense) => {
    if (useModals) {
      setSelectedExpense(expense)
      setIsDeleteModalOpen(true)
    } else {
      onDelete(expense.id)
    }
  }

  // Handle edit with modal
  const handleEditClick = (expense: Expense) => {
    if (useModals) {
      setSelectedExpense(expense)
      setIsEditModalOpen(true)
    } else {
      handleEdit(expense)
    }
  }

  // Confirm delete
  const confirmDelete = () => {
    if (selectedExpense) {
      onDelete(selectedExpense.id)
      setIsDeleteModalOpen(false)
      setSelectedExpense(null)
    }
  }

  // If there are no expenses, show a message
  if (expenses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No expenses found. Add your first expense to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!isCompact && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
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
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${category.color}`}></div>
                      {category.name}
                    </div>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {!isCompact && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isCompact ? 4 : 5} className="text-center h-24 text-muted-foreground">
                  No expenses found
                </TableCell>
              </TableRow>
            ) : (
              paginatedExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getCategoryColor(expense.category)} bg-opacity-20 border-0`}>
                      {getCategoryName(expense.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
                  {!isCompact && (
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
                          <DropdownMenuItem onClick={() => handleEditClick(expense)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(expense)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
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

      {/* Delete Confirmation Modal */}
      {useModals && (
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this expense?
                {selectedExpense && (
                  <p className="mt-2 font-medium">
                    {selectedExpense.description} - ${selectedExpense.amount.toFixed(2)}
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {useModals && selectedExpense && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>Make changes to your expense details below.</DialogDescription>
            </DialogHeader>
            <ExpenseForm
              categories={categories}
              onSubmit={() => {}}
              onUpdate={(updatedExpense) => {
                onEdit(updatedExpense)
                setIsEditModalOpen(false)
                setSelectedExpense(null)
              }}
              expenses={expenses}
              initialExpense={selectedExpense}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

