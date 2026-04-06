import Link from 'next/link'
import { Flame, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Número grande */}
        <div className="relative mb-8">
          <p className="font-heading font-black text-[180px] leading-none text-primary/10 select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="glass border border-primary/20 rounded-2xl px-6 py-3">
              <p className="font-heading font-black text-2xl uppercase tracking-tight text-gradient-red">
                Página não encontrada
              </p>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          Essa página não existe ou foi removida. Verifique o endereço ou volte
          ao início.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="javascript:history.back()">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/">
              <Flame className="w-4 h-4" />
              Início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
