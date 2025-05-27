import type React from "react"
import type { Metadata } from "next"
import { Rethink_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"
import { TransactionsProvider } from "@/contexts/transactions-context" // Import the provider

const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rethink-sans",
})

export const metadata: Metadata = {
  title: "Personal Finance Manager",
  description: "Manage your personal finances with ease",
  icons: {
    icon: "/icon.svg",
  },
  generator: 'v0.dev',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={rethinkSans.variable} suppressHydrationWarning>
      <body className={rethinkSans.className}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <AuthProvider>
            <TransactionsProvider> {/* Wrap children with TransactionsProvider */}
              {children}
            </TransactionsProvider>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'