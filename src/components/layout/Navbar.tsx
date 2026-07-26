import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

interface NavbarProps {
  title: string
  description?: string
}

export function Navbar({ title, description }: NavbarProps) {
  const { profile, signOut } = useAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-6">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="font-medium">{profile?.full_name}</p>
          <p className="text-[var(--color-muted-foreground)]">{profile?.role}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </div>
    </header>
  )
}
