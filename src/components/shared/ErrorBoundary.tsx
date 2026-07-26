import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de la app:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Algo falló al cargar MiniPost</CardTitle>
            <CardDescription>Revisa la consola del navegador o recarga la página.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-red-200">
              {this.state.error.message}
            </pre>
            <Button onClick={() => window.location.assign('/')}>Recargar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
