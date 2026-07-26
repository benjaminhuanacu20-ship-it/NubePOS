import { NavLink } from 'react-router-dom'
import {
  Bot,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/products', label: 'Productos', icon: Package },
  { to: '/inventory', label: 'Inventario', icon: Warehouse },
  { to: '/customers', label: 'Clientes', icon: Users },
  { to: '/agent', label: 'Agente IA', icon: Bot },
]

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex h-16 items-center border-b border-[var(--color-border)] px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">MiniPost</p>
          <p className="text-sm font-medium">Agente Comercial</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
