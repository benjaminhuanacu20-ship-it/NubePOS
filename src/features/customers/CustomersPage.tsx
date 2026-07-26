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
import { createCustomer } from '@/lib/db'
import { formatDate, formatRelativeDays } from '@/lib/utils'
import { daysSince, isInactiveCustomer } from '@/types/models'

const customerSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().optional(),
  phone: z.string().optional(),
})

type CustomerForm = z.infer<typeof customerSchema>

export function CustomersPage() {
  const { companyId } = useAuth()
  const { customers, loading } = useCompanyData()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  })

  async function onSubmit(data: CustomerForm) {
    if (!companyId) return
    setError(null)

    try {
      await createCustomer(companyId, data)
      reset({ name: '', email: '', phone: '' })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  const inactive = customers.filter(isInactiveCustomer)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Clientes</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {inactive.length > 0
              ? `${inactive.length} cliente(s) llevan más de 30 días sin comprar.`
              : 'Todos tus clientes han comprado en el último mes.'}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" {...register('phone')} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {customers.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Última compra</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.email ?? '—'}</TableCell>
                  <TableCell>{customer.phone ?? '—'}</TableCell>
                  <TableCell>
                    {formatDate(customer.lastPurchaseAt)}
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                      {formatRelativeDays(daysSince(customer.lastPurchaseAt))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isInactiveCustomer(customer)
                      ? <Badge variant="destructive">Inactivo</Badge>
                      : <Badge variant="success">Activo</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="Sin clientes" description="Agrega clientes para tu negocio" />
      )}
    </div>
  )
}
