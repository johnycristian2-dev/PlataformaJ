'use client'

import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="font-heading font-black text-3xl uppercase tracking-tight mb-2">
          Algo deu errado
        </h1>
        <p className="text-muted-foreground mb-8">
          Ocorreu um erro inesperado. Nossa equipe foi notificada e está
          trabalhando para resolver.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre className="text-left text-xs bg-card border border-border rounded-lg p-4 mb-6 overflow-auto text-destructive/80">
            {error.message}
          </pre>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
          <Button asChild>
            <Link href="/">
              <Home className="w-4 h-4" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
