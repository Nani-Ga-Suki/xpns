"use client"

import type React from "react"
// Removed DashboardNav import as it's no longer used directly here
import { UserNav } from "@/components/user-nav"
import { ModeToggle } from "@/components/mode-toggle"
// Removed unused icons and components
import { Button } from "@/components/ui/button"
// Removed Sheet imports
// Removed VisuallyHidden import
import { useState } from "react"
import { Chatbot } from "@/components/chatbot" // Import the Chatbot component

interface DashboardShellProps {
  children?: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  // Removed isMobileMenuOpen state as mobile menu is gone
  // Removed navItems array as navigation is gone

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between py-4">
          {/* Mobile menu removed */}
          <div className="flex items-center gap-2">
            {/* Logo and Title */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-primary"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span className="hidden font-bold sm:inline-block">Finance Manager</span>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <UserNav />
          </div>
        </div>
      </header>
      {/* Updated layout: Main content on left, Chatbot placeholder on right */}
      <div className="container flex flex-1 gap-8 px-4 py-4 md:px-6 md:py-6 max-w-[1900px]"> {/* Added max-width */}
        {/* Main content area */}
        {/* Main content area takes remaining space */}
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>

        {/* Chatbot Panel */}
        {/* Use flex-none to prevent shrinking, define width, ensure full height */}
        <aside className="hidden w-[300px] shrink-0 flex-col md:flex lg:w-[350px] h-[calc(100vh-4rem)] sticky top-16">
             <Chatbot />
        </aside>
      </div>
    </div>
  )
}

