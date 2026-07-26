import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center">
      <Inbox className="mb-4 h-10 w-10 text-[var(--color-muted-foreground)]" />
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{description}</p>}
    </div>
  )
}
