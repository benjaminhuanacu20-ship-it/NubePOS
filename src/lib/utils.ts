import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function formatRelativeDays(days: number) {
  if (!Number.isFinite(days)) return 'nunca'
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}
