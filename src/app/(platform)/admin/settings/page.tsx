import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const [users, courses, activeSubscriptions, plans] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.plan.count(),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Configurações Admin
        </h1>
        <p className="text-muted-foreground mt-1">
          Baseline de configurações globais e status da plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo rápido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Usuários totais</span>
            <Badge variant="secondary">{users}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Cursos cadastrados</span>
            <Badge variant="secondary">{courses}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Assinaturas ativas</span>
            <Badge variant="success">{activeSubscriptions}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Planos disponíveis</span>
            <Badge variant="secondary">{plans}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos incrementos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Ajustes globais de feature flags.</p>
          <p>2. Configuração de notificações administrativas.</p>
          <p>3. Auditoria e logs de ações críticas.</p>
        </CardContent>
      </Card>
    </div>
  )
}
