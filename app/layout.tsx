import type React from "react"
import type { Metadata } from "next"
import { Rethink_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"

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
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={rethinkSans.variable}>
      <body className={rethinkSans.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'