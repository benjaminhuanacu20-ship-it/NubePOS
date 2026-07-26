import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useCompanyData } from '@/hooks/useCompanyData'
import { createProduct } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { isLowStock } from '@/types/models'

const productSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  sku: z.string().optional(),
  price: z.number({ message: 'Precio requerido' }).min(0, 'Precio inválido'),
  quantity: z.number({ message: 'Cantidad requerida' }).min(0, 'Cantidad inválida'),
  minStock: z.number({ message: 'Stock mínimo requerido' }).min(0, 'Stock mínimo inválido'),
})

type ProductForm = z.infer<typeof productSchema>

export function ProductsPage() {
  const { companyId } = useAuth()
  const { products, loading } = useCompanyData()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { quantity: 0, minStock: 5 },
  })

  async function onSubmit(data: ProductForm) {
    if (!companyId) return
    setError(null)

    try {
      await createProduct(companyId, data)
      reset({ name: '', sku: '', price: 0, quantity: 0, minStock: 5 })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.')
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Productos</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">Catálogo y stock de tu negocio</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar producto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...register('sku')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio</Label>
                  <Input id="price" type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
                  {errors.price && <p className="text-sm text-red-600">{errors.price.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Stock</Label>
                  <Input id="quantity" type="number" {...register('quantity', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Mínimo</Label>
                  <Input id="minStock" type="number" {...register('minStock', { valueAsNumber: true })} />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku ?? '—'}</TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>{product.quantity}</TableCell>
                  <TableCell>{product.minStock}</TableCell>
                  <TableCell>
                    {isLowStock(product)
                      ? <Badge variant="warning">Stock bajo</Badge>
                      : <Badge variant="success">OK</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="Sin productos" description="Agrega tu primer producto para comenzar" />
      )}
    </div>
  )
}
