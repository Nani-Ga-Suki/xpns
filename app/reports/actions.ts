"use server"

import { revalidatePath } from "next/cache"
import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

export async function payInstallment(transactionId: string): Promise<{ success: boolean; message: string }> {
  const supabase = createServerActionClient<Database>({ cookies })

  // 1. Get user session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user) {
    console.error("Pay Installment: Auth error", sessionError)
    return { success: false, message: "Authentication failed." }
  }
  const userId = session.user.id

  // 2. Fetch the original credit transaction
  const { data: transaction, error: fetchError } = await supabase
    .from("transactions")
    .select("id, amount, description, category, remaining_installments, installments")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .eq("is_credit", true) // Ensure it's a credit transaction
    .maybeSingle() // Expect one or none

  if (fetchError) {
    console.error("Pay Installment: Error fetching transaction", fetchError)
    return { success: false, message: "Failed to fetch transaction details." }
  }

  if (!transaction) {
    return { success: false, message: "Credit transaction not found or access denied." }
  }

  // 3. Check if installments remain
  if (!transaction.remaining_installments || transaction.remaining_installments <= 0) {
    return { success: false, message: "No remaining installments to pay." }
  }

  const newRemainingInstallments = transaction.remaining_installments - 1
  const installmentAmount = transaction.amount // The 'amount' field on the credit record holds the installment amount

  // Use a Supabase transaction (RPC function) if possible for atomicity,
  // otherwise, perform operations sequentially and handle potential partial failures.
  // For simplicity here, we do sequential updates.

  // 4. Update the original transaction (decrement remaining installments)
  const { error: updateError } = await supabase
    .from("transactions")
    .update({ remaining_installments: newRemainingInstallments })
    .eq("id", transactionId)
    .eq("user_id", userId)

  if (updateError) {
    console.error("Pay Installment: Error updating original transaction", updateError)
    return { success: false, message: "Failed to update installment count." }
  }

  // 5. Insert the new expense transaction for the payment
  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: userId,
    amount: installmentAmount,
    description: `Installment Payment for: ${transaction.description}`,
    date: new Date().toISOString(), // Use current date for payment
    type: "expense",
    category: transaction.category,
    is_credit: false, // This is the actual payment expense
    notes: `Payment for original transaction ID: ${transactionId}`,
    // installments, original_amount, remaining_installments are null/default for this payment record
  })

  if (insertError) {
    console.error("Pay Installment: Error inserting payment transaction", insertError)
    // Attempt to rollback the decrement? Difficult without transactions. Log inconsistency.
    return { success: false, message: "Failed to record payment transaction. Installment count might be incorrect." }
  }

  // 6. Revalidate the path to refresh data on the client
  revalidatePath("/reports")

  return { success: true, message: "Installment paid successfully." }
}