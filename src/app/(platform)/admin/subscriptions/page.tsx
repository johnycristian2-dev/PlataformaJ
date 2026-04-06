import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { updateSubscriptionStatusByAdminAction } from '@/app/actions/admin-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pagamento pendente',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Em atraso',
  RECOVERY: 'Em recuperação',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
}

const STATUS_VARIANT: Record<
  string,
  'secondary' | 'success' | 'warning' | 'destructive'
> = {
  PENDING: 'secondary',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  RECOVERY: 'warning',
  SUSPENDED: 'destructive',
  CANCELED: 'destructive',
  EXPIRED: 'destructive',
}

export default async function AdminSubscriptionsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  async function submitSubscriptionStatus(formData: FormData) {
    'use server'

    await updateSubscriptionStatusByAdminAction(formData)
  }

  const [subscriptions, recentChanges, billingEvents] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
    }),
    prisma.subscriptionStatusChange.findMany({
      include: {
        subscription: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        admin: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.billingEvent.findMany({
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Assinaturas
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestão de status, dunning e histórico financeiro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de assinaturas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma assinatura encontrada.
            </p>
          ) : (
            subscriptions.map((sub) => (
              <form
                key={sub.id}
                action={submitSubscriptionStatus}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <input type="hidden" name="subscriptionId" value={sub.id} />
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {sub.user.name ?? sub.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sub.user.email} • plano {sub.plan.name}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[sub.status] ?? 'secondary'}>
                    {STATUS_LABEL[sub.status] ?? sub.status}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Período: {formatDate(sub.currentPeriodStart)} até{' '}
                  {formatDate(sub.currentPeriodEnd)}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <select
                    name="status"
                    defaultValue={sub.status}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="PENDING">Pagamento pendente</option>
                    <option value="ACTIVE">Ativa</option>
                    <option value="PAST_DUE">Em atraso</option>
                    <option value="RECOVERY">Em recuperação</option>
                    <option value="SUSPENDED">Suspensa</option>
                    <option value="CANCELED">Cancelada</option>
                    <option value="EXPIRED">Expirada</option>
                  </select>
                  <Button type="submit" variant="secondary" size="sm">
                    Atualizar status
                  </Button>
                </div>

                <div className="mt-2">
                  <input
                    name="reason"
                    placeholder="Motivo da mudança (opcional)"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico financeiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {billingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sem eventos financeiros registrados.
            </p>
          ) : (
            billingEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {event.user.name ?? event.user.email}
                  </p>
                  <Badge variant="secondary">{event.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {event.description ?? 'Sem descrição'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {event.amountCents !== null && event.amountCents !== undefined
                    ? formatCurrency(event.amountCents / 100)
                    : '-'}{' '}
                  • {formatDate(event.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Histórico recente de mudanças
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mudança registrada ainda.
            </p>
          ) : (
            recentChanges.map((change) => (
              <div
                key={change.id}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <p className="text-sm font-semibold">
                  {change.subscription.user.name ??
                    change.subscription.user.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {change.fromStatus} → {change.toStatus} • por{' '}
                  {change.admin.name ?? change.admin.email} •{' '}
                  {formatDate(change.createdAt)}
                </p>
                {change.reason && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Motivo: {change.reason}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
