export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number // For installments, this might be the installment amount
          description: string
          date: string
          type: "income" | "expense"
          category: string | null
          notes: string | null
          created_at: string
          // Credit-related fields
          is_credit?: boolean | null
          installments?: number | null
          original_amount?: number | null // The total original amount of the purchase
          remaining_installments?: number | null
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          description: string
          date: string
          type: "income" | "expense"
          category?: string | null
          notes?: string | null
          created_at?: string
          // Add optional credit-related fields
          is_credit?: boolean
          installments?: number
          original_amount?: number
          remaining_installments?: number
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          description?: string
          date?: string
          type?: "income" | "expense"
          category?: string | null
          notes?: string | null
          created_at?: string
          // Credit-related fields
          is_credit?: boolean | null
          installments?: number | null
          original_amount?: number | null
          remaining_installments?: number | null
        }
      }
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
export type NewTransaction = Omit<
  Database["public"]["Tables"]["transactions"]["Insert"],
  "id" | "user_id" | "created_at"
>
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]

