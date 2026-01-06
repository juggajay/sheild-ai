import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Format currency in AUD
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format ABN with spaces
 */
export function formatABN(abn: string): string {
  const cleaned = abn.replace(/\s/g, "")
  if (cleaned.length !== 11) return abn
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`
}

/**
 * Validate ABN format (basic check)
 */
export function isValidABN(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, "")
  return /^\d{11}$/.test(cleaned)
}

/**
 * Calculate days until a date
 */
export function daysUntil(date: Date | string): number {
  const target = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Get compliance status color
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "compliant":
    case "pass":
      return "text-success"
    case "non_compliant":
    case "fail":
      return "text-error"
    case "exception":
    case "warning":
      return "text-warning"
    case "pending":
    case "review":
      return "text-info"
    default:
      return "text-slate-500"
  }
}

/**
 * Get compliance status badge classes
 */
export function getStatusBadgeClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "compliant":
    case "pass":
      return "bg-success-light text-success border-success/20"
    case "non_compliant":
    case "fail":
      return "bg-error-light text-error border-error/20"
    case "exception":
    case "warning":
      return "bg-warning-light text-warning border-warning/20"
    case "pending":
    case "review":
      return "bg-info-light text-info border-info/20"
    default:
      return "bg-slate-100 text-slate-500 border-slate-200"
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + "..."
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
