export interface Expense {
  id: string
  amount: number
  description: string
  date: Date
  category: string
  notes?: string
  isCredit?: boolean
  installments?: number
  remainingInstallments?: number
  originalAmount?: number
}

export interface ExpenseCategory {
  id: string
  name: string
  color: string
}

