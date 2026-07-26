import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { SetupRequired } from '@/components/shared/SetupRequired'
import { AgentPage } from '@/features/agent/AgentPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { PosPage } from '@/features/pos/PosPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { AuthProvider } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { DashboardPage } from '@/pages/DashboardPage'

export default function App() {
  if (!isSupabaseConfigured) {
    return <SetupRequired />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell title="Dashboard" description="Resumen de tu negocio en tiempo real" />}>
              <Route index element={<DashboardPage />} />
            </Route>
            <Route element={<AppShell title="Punto de venta" description="Registra ventas y descuenta stock" />}>
              <Route path="pos" element={<PosPage />} />
            </Route>
            <Route element={<AppShell title="Productos" description="Catálogo de productos" />}>
              <Route path="products" element={<ProductsPage />} />
            </Route>
            <Route element={<AppShell title="Inventario" description="Control de stock" />}>
              <Route path="inventory" element={<InventoryPage />} />
            </Route>
            <Route element={<AppShell title="Clientes" description="Base de clientes" />}>
              <Route path="customers" element={<CustomersPage />} />
            </Route>
            <Route element={<AppShell title="Agente IA" description="Análisis y acciones automáticas" />}>
              <Route path="agent" element={<AgentPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
