import { useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCompanyData } from '@/hooks/useCompanyData'
import { updateProductStock } from '@/lib/db'
import { formatDateTime } from '@/lib/utils'
import { isLowStock } from '@/types/models'

export function InventoryPage() {
  const { products, loading } = useCompanyData()
  const [savingId, setSavingId] = useState<string | null>(null)

  async function saveStock(inventoryId: string, value: string) {
    const quantity = Number(value)
    if (!Number.isFinite(quantity)) return

    setSavingId(inventoryId)
    try {
      await updateProductStock(inventoryId, quantity)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  const lowStock = products.filter(isLowStock)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Inventario</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          El stock se descuenta solo con cada venta registrada en el POS.
          {lowStock.length > 0 && ` ${lowStock.length} producto(s) por debajo del mínimo.`}
        </p>
      </div>

      {products.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ajustar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...products].sort((a, b) => a.quantity - b.quantity).map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku ?? '—'}</TableCell>
                  <TableCell>{product.quantity}</TableCell>
                  <TableCell>{product.minStock}</TableCell>
                  <TableCell>
                    {isLowStock(product)
                      ? <Badge variant="warning">Stock bajo</Badge>
                      : <Badge variant="success">OK</Badge>}
                  </TableCell>
                  <TableCell>
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const value = new FormData(event.currentTarget).get('quantity')
                          void saveStock(product.inventoryId, String(value ?? ''))
                      }}
                    >
                      <Input
                        name="quantity"
                        type="number"
                        min={0}
                        defaultValue={product.quantity}
                        key={product.quantity}
                        className="w-20"
                      />
                      <Button type="submit" size="sm" variant="outline" disabled={savingId === product.inventoryId}>
                        Guardar
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="Sin inventario" description="Agrega productos para ver el inventario" />
      )}

      {products.length > 0 && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Última actualización: {formatDateTime(new Date())}
        </p>
      )}
    </div>
  )
}
