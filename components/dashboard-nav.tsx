"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

interface DashboardNavProps {
  items: NavItem[]
}

export function DashboardNav({ items }: DashboardNavProps) {
  const path = usePathname()

  if (!items?.length) {
    return null
  }

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => {
        const Icon = item.icon
        const isActive = path === item.href

        return (
          <Link
            key={index}
            href={item.href}
            className={cn(
              "dashboard-nav-item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "active" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}

