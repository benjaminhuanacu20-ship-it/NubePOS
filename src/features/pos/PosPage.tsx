import { useMemo, useState } from 'react'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { useCompanyData } from '@/hooks/useCompanyData'
import { registerSale } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { isLowStock, type Product, type SaleItem } from '@/types/models'

export function PosPage() {
  const { companyId } = useAuth()
  const { products, customers, loading } = useCompanyData()

  const [cart, setCart] = useState<SaleItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  )

  const stockById = useMemo(
    () => new Map(products.map((p) => [p.id, p.quantity])),
    [products],
  )

  function addToCart(product: Product) {
    setMessage(null)
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)

      if (!existing) {
        if (product.quantity <= 0) return prev
        return [...prev, {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
        }]
      }

      if (existing.quantity >= product.quantity) return prev
      return prev.map((item) =>
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
      )
    })
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.productId !== productId) return [item]
        const next = item.quantity + delta
        if (next <= 0) return []
        if (next > (stockById.get(productId) ?? 0)) return [item]
        return [{ ...item, quantity: next }]
      }),
    )
  }

  async function checkout() {
    if (!companyId || cart.length === 0) return

    setSaving(true)
    setMessage(null)

    try {
      const customer = customers.find((c) => c.id === customerId)
      await registerSale(companyId, {
        customerId: customer?.id ?? null,
        items: cart,
        total,
      })

      setCart([])
      setCustomerId('')
      setMessage({ text: 'Venta registrada. El inventario ya se actualizó.' })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'No se pudo registrar la venta.',
        error: true,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div>
          <h2 className="text-lg font-semibold">Punto de venta</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Toca un producto para agregarlo al carrito.
          </p>
        </div>

        {products.length === 0 ? (
          <EmptyState title="Sin productos" description="Agrega productos para empezar a vender" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const sinStock = product.quantity <= 0
              return (
                <Card
                  key={product.id}
                  onClick={() => !sinStock && addToCart(product)}
                  className={
                    sinStock
                      ? 'opacity-50'
                      : 'cursor-pointer transition-shadow hover:shadow-md'
                  }
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      {sinStock
                        ? <Badge variant="destructive">Agotado</Badge>
                        : isLowStock(product) && <Badge variant="warning">Bajo</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{formatCurrency(product.price)}</p>
                    <p className="text-sm text-[var(--color-muted-foreground)]">Stock: {product.quantity}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Cliente</p>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente general" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {cart.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">Agrega productos al carrito.</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.productId, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.productId, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setCart((prev) => prev.filter((i) => i.productId !== item.productId))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {message && (
            <p className={`text-sm ${message.error ? 'text-red-600' : 'text-emerald-600'}`}>{message.text}</p>
          )}

          <Button className="w-full" disabled={cart.length === 0 || saving} onClick={() => void checkout()}>
            {saving ? 'Procesando...' : 'Registrar venta'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
