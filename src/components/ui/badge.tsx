import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  destructive: 'bg-red-100 text-red-800',
  outline: 'border border-[var(--color-border)] text-[var(--color-foreground)]',
}

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
