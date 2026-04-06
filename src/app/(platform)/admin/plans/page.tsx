import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

function intervalLabel(interval: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL') {
  if (interval === 'MONTHLY') return 'mês'
  if (interval === 'QUARTERLY') return 'trimestre'
  return 'ano'
}

export default async function AdminPlansPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Planos
        </h1>
        <p className="text-muted-foreground mt-1">
          Baseline de gestão dos planos comerciais.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum plano encontrado.
            </CardContent>
          </Card>
        )}

        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>{plan.name}</span>
                <div className="flex items-center gap-2">
                  {plan.isPremium && <Badge variant="premium">Premium</Badge>}
                  <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(plan.price)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{intervalLabel(plan.interval)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {plan._count.subscriptions} assinaturas vinculadas
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
