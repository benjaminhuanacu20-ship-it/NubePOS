import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'

interface AppShellProps {
  title: string
  description?: string
}

export function AppShell({ title, description }: AppShellProps) {
  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title={title} description={description} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
