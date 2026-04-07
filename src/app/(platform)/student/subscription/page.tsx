import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  cancelStripeSubscriptionAction,
  changeStripeSubscriptionPlanAction,
  createStripeBillingPortalAction,
  openPremiumCheckoutAction,
} from '@/modules/billing/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { getStripe } from '@/lib/stripe'
import { getSubscriptionAccessSnapshot } from '@/lib/subscriptions'

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

interface StudentSubscriptionPageProps {
  searchParams: Promise<{ previewPlan?: string }>
}

export default async function StudentSubscriptionPage({
  searchParams,
}: StudentSubscriptionPageProps) {
  const session = await auth()
  if (!session?.user?.id || !['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/login')
  }

  const params = await searchParams

  const [latestSubscription, accessSnapshot, availablePlans, billingEvents] =
    await Promise.all([
      prisma.subscription.findFirst({
        where: { userId: session.user.id },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              interval: true,
              isPremium: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      getSubscriptionAccessSnapshot(session.user.id),
      prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      }),
      prisma.billingEvent.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ])

  const activeSubscription = accessSnapshot?.accessLevel === 'FULL'

  const targetPlan =
    params.previewPlan && latestSubscription
      ? availablePlans.find((plan) => plan.slug === params.previewPlan)
      : null

  let prorationPreviewCents = 0

  if (
    latestSubscription?.stripeSubscriptionId &&
    latestSubscription?.stripeCustomerId &&
    targetPlan?.stripePriceId &&
    targetPlan.id !== latestSubscription.planId
  ) {
    try {
      const stripe = getStripe()
      const stripeSubscription = await stripe.subscriptions.retrieve(
        latestSubscription.stripeSubscriptionId,
      )
      const subscriptionItem = stripeSubscription.items.data[0]

      if (subscriptionItem?.id) {
        const preview = await stripe.invoices.createPreview({
          customer: latestSubscription.stripeCustomerId,
          subscription: latestSubscription.stripeSubscriptionId,
          subscription_details: {
            items: [
              {
                id: subscriptionItem.id,
                price: targetPlan.stripePriceId,
              },
            ],
          },
        })

        prorationPreviewCents = preview.amount_due ?? 0
      }
    } catch {
      prorationPreviewCents = 0
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Minha assinatura
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie plano, dunning, cobrança e histórico financeiro.
        </p>
      </div>

      {!latestSubscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4 text-primary" />
              Nenhuma assinatura encontrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assine o plano Premium para desbloquear cursos e lives exclusivos.
            </p>
            <form action={openPremiumCheckoutAction}>
              <input type="hidden" name="planSlug" value="premium" />
              <input
                type="hidden"
                name="successPath"
                value="/student/subscription"
              />
              <input
                type="hidden"
                name="cancelPath"
                value="/student/subscription"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Assinar Premium
              </button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Plano {latestSubscription.plan.name}
              </span>
              <Badge
                variant={
                  STATUS_VARIANT[latestSubscription.status] ?? 'secondary'
                }
              >
                {STATUS_LABEL[latestSubscription.status] ??
                  latestSubscription.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p className="text-muted-foreground">
                Valor:{' '}
                <span className="text-foreground font-medium">
                  {formatCurrency(latestSubscription.plan.price)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Intervalo:{' '}
                <span className="text-foreground font-medium">
                  {latestSubscription.plan.interval}
                </span>
              </p>
              <p className="text-muted-foreground inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Início:{' '}
                <span className="text-foreground font-medium">
                  {formatDate(latestSubscription.currentPeriodStart)}
                </span>
              </p>
              <p className="text-muted-foreground inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Próxima renovação:{' '}
                <span className="text-foreground font-medium">
                  {formatDate(latestSubscription.currentPeriodEnd)}
                </span>
              </p>
            </div>

            {accessSnapshot && accessSnapshot.status !== 'ACTIVE' && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
                <p className="inline-flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Sua assinatura está no fluxo de recuperação.
                </p>
                <p className="mt-1 text-xs">
                  Dia atual do dunning: {accessSnapshot.dunningDay}. Dia 7
                  aplica bloqueio parcial e dia 10 suspensão.
                </p>
              </div>
            )}

            {!activeSubscription && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
                Seu acesso premium não está completo no momento.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <form action={createStripeBillingPortalAction}>
                <input
                  type="hidden"
                  name="returnPath"
                  value="/student/subscription"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors"
                >
                  Gerenciar no Stripe
                </button>
              </form>

              {latestSubscription.status === 'ACTIVE' && (
                <form action={cancelStripeSubscriptionAction}>
                  <input
                    type="hidden"
                    name="subscriptionId"
                    value={latestSubscription.id}
                  />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-md border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 transition-colors"
                  >
                    Cancelar no fim do ciclo
                  </button>
                </form>
              )}

              {!activeSubscription && (
                <form action={openPremiumCheckoutAction}>
                  <input type="hidden" name="planSlug" value="premium" />
                  <input
                    type="hidden"
                    name="successPath"
                    value="/student/subscription"
                  />
                  <input
                    type="hidden"
                    name="cancelPath"
                    value="/student/subscription"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                  >
                    Reativar assinatura
                  </button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {latestSubscription && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Upgrade/downgrade com proration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Política: upgrade aplica imediatamente com proration; downgrade
              pode ser aplicado imediato ou no próximo ciclo.
            </p>

            <form method="GET" className="flex flex-wrap items-center gap-2">
              <select
                name="previewPlan"
                defaultValue={targetPlan?.slug ?? ''}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione um plano para simular</option>
                {availablePlans
                  .filter((plan) => plan.id !== latestSubscription.planId)
                  .map((plan) => (
                    <option key={plan.id} value={plan.slug}>
                      {plan.name} ({formatCurrency(plan.price)})
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="h-9 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors"
              >
                Simular troca
              </button>
            </form>

            {targetPlan && (
              <div className="rounded-lg border border-border bg-accent/20 p-4 space-y-3">
                <p className="text-sm font-semibold">
                  Simulação para plano {targetPlan.name}
                </p>
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                  {prorationPreviewCents >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-warning" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-success" />
                  )}
                  Ajuste estimado agora:{' '}
                  <span className="font-medium text-foreground">
                    {formatCurrency(prorationPreviewCents / 100)}
                  </span>
                </p>

                <form
                  action={changeStripeSubscriptionPlanAction}
                  className="space-y-2"
                >
                  <input
                    type="hidden"
                    name="newPlanSlug"
                    value={targetPlan.slug}
                  />
                  <input
                    type="hidden"
                    name="estimatedProrationCents"
                    value={String(prorationPreviewCents)}
                  />
                  <select
                    name="applyMode"
                    defaultValue={
                      targetPlan.price >= latestSubscription.plan.price
                        ? 'immediate'
                        : 'next_cycle'
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="immediate">
                      Aplicar agora (com proration)
                    </option>
                    <option value="next_cycle">Aplicar no próximo ciclo</option>
                  </select>
                  <div>
                    <button
                      type="submit"
                      className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                    >
                      Confirmar troca de plano
                    </button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico financeiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {billingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem eventos financeiros ainda.
            </p>
          ) : (
            billingEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-border bg-accent/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{event.type}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
                <p className="text-sm mt-1">
                  {event.description ?? 'Sem descrição'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor:{' '}
                  {event.amountCents !== null && event.amountCents !== undefined
                    ? formatCurrency(event.amountCents / 100)
                    : '-'}
                </p>
              </div>
            ))
          )}
          <Link
            href="/student/courses/catalog"
            className="text-sm text-primary hover:underline"
          >
            Voltar ao catálogo
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
