import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  className?: string
}

export function StatCard({ title, value, description, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">{title}</CardTitle>
        <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>}
      </CardContent>
    </Card>
  )
}
