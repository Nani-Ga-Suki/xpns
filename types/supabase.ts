export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          description: string
          date: string
          type: "income" | "expense"
          category: string | null
          notes: string | null
          created_at: string
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

