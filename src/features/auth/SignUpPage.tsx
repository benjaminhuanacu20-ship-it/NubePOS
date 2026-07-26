import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  fullName: z.string().min(2, 'Nombre requerido'),
  companyName: z.string().min(2, 'Nombre de empresa requerido'),
  email: z.email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

export function SignUpPage() {
  const { signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    try {
      await signUp(data.email, data.password, data.fullName, data.companyName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
            <Bot className="h-6 w-6" />
          </div>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>Tu negocio se crea con productos, clientes y ventas de ejemplo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && <p className="text-sm text-red-600">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre del negocio</Label>
              <Input id="companyName" placeholder="Cafetería Demo" {...register('companyName')} />
              {errors.companyName && <p className="text-sm text-red-600">{errors.companyName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Registrarse'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-medium text-[var(--color-primary)] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
