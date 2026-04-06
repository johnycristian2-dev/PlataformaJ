import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { revalidateTag } from 'next/cache'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

function mapStripeStatus(
  status: Stripe.Subscription.Status,
):
  | 'PENDING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'RECOVERY'
  | 'SUSPENDED'
  | 'CANCELED'
  | 'EXPIRED' {
  if (status === 'active' || status === 'trialing') return 'ACTIVE'
  if (status === 'past_due' || status === 'unpaid') return 'PAST_DUE'
  if (status === 'canceled' || status === 'incomplete_expired')
    return 'CANCELED'
  return 'PENDING'
}

async function createBillingEvent(params: {
  userId: string
  subscriptionId?: string
  type:
    | 'SUBSCRIPTION_CREATED'
    | 'SUBSCRIPTION_RENEWED'
    | 'SUBSCRIPTION_CANCELED'
    | 'PAYMENT_APPROVED'
    | 'PAYMENT_FAILED'
    | 'DUNNING_NOTICE'
    | 'INVOICE_ISSUED'
    | 'REFUND'
    | 'CHARGEBACK'
    | 'TRIAL_ENDING'
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'FAILED'
  amountCents?: number | null
  currency?: string | null
  description?: string
  gatewayEventId?: string
  gatewayInvoiceId?: string
  metadata?: Record<string, unknown>
}) {
  await prisma.billingEvent.create({
    data: {
      userId: params.userId,
      subscriptionId: params.subscriptionId ?? null,
      type: params.type,
      status: params.status,
      amountCents: params.amountCents ?? null,
      currency: params.currency ?? 'BRL',
      description: params.description ?? null,
      gatewayEventId: params.gatewayEventId ?? null,
      gatewayInvoiceId: params.gatewayInvoiceId ?? null,
      metadata: params.metadata
        ? (params.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  })
}

async function resolveUserAndSubscription(params: {
  subscriptionId?: string | null
  customerId?: string | null
  metadata?: Record<string, string>
}) {
  if (params.subscriptionId) {
    const existingBySubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: params.subscriptionId },
      select: { id: true, userId: true },
    })

    if (existingBySubscription) {
      return existingBySubscription
    }
  }

  if (params.customerId) {
    const existingByCustomer = await prisma.subscription.findFirst({
      where: {
        stripeCustomerId: params.customerId,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true },
    })

    if (existingByCustomer) {
      return existingByCustomer
    }
  }

  const metadataUserId = params.metadata?.userId
  if (metadataUserId) {
    const latest = await prisma.subscription.findFirst({
      where: { userId: metadataUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true },
    })

    if (latest) {
      return latest
    }
  }

  return null
}

async function upsertFromStripeSubscription(
  subscription: Stripe.Subscription,
  customerId: string,
  metadata: Record<string, string>,
) {
  const userId = metadata.userId
  let planId: string | undefined = metadata.planId

  if (!planId) {
    const priceId = subscription.items.data[0]?.price?.id
    if (priceId) {
      const plan = await prisma.plan.findFirst({
        where: { stripePriceId: priceId },
        select: { id: true },
      })
      planId = plan?.id
    }
  }

  if (!userId || !planId) return null

  const currentPeriodStart = new Date(
    Number(
      (subscription as { current_period_start?: number })
        .current_period_start ?? 0,
    ) * 1000,
  )
  const currentPeriodEnd = new Date(
    Number(
      (subscription as { current_period_end?: number }).current_period_end ?? 0,
    ) * 1000,
  )
  const mappedStatus = mapStripeStatus(subscription.status)

  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, userId: true },
  })

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: mappedStatus,
        stripeCustomerId: customerId,
        currentPeriodStart,
        currentPeriodEnd,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        metadata: toJson(subscription),
      },
    })

    return existing
  }

  const created = await prisma.subscription.create({
    data: {
      userId,
      planId,
      status: mappedStatus,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      metadata: toJson(subscription),
    },
    select: { id: true, userId: true },
  })

  return created
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET não configurada' },
      { status: 500 },
    )
  }

  const stripe = getStripe()
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = session.subscription as string | null
        const customerId = session.customer as string | null
        if (!subscriptionId || !customerId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const local = await upsertFromStripeSubscription(
          subscription,
          customerId,
          (session.metadata as Record<string, string>) ?? {},
        )

        if (local) {
          await createBillingEvent({
            userId: local.userId,
            subscriptionId: local.id,
            type: 'SUBSCRIPTION_CREATED',
            status: 'SUCCESS',
            description: 'Assinatura criada com checkout concluído.',
            gatewayEventId: event.id,
          })
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = String(subscription.customer)
        const local = await upsertFromStripeSubscription(
          subscription,
          customerId,
          (subscription.metadata as Record<string, string>) ?? {},
        )

        if (local && event.type === 'customer.subscription.created') {
          await createBillingEvent({
            userId: local.userId,
            subscriptionId: local.id,
            type: 'SUBSCRIPTION_CREATED',
            status: 'SUCCESS',
            description: 'Assinatura criada no gateway.',
            gatewayEventId: event.id,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const existing = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true, userId: true },
        })

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: 'CANCELED',
              canceledAt: new Date(),
              metadata: toJson(subscription),
            },
          })

          await createBillingEvent({
            userId: existing.userId,
            subscriptionId: existing.id,
            type: 'SUBSCRIPTION_CANCELED',
            status: 'INFO',
            description: 'Assinatura cancelada no gateway.',
            gatewayEventId: event.id,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionRaw = (invoice as { subscription?: unknown })
          .subscription
        const subscriptionId =
          typeof subscriptionRaw === 'string' ? subscriptionRaw : null

        if (!subscriptionId) break

        const local = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true, userId: true },
        })

        if (!local) break

        const now = new Date()

        await prisma.subscription.update({
          where: { id: local.id },
          data: {
            status: 'PAST_DUE',
            paymentFailedAt: now,
            dunningStage: 0,
            lastFailedInvoiceId: invoice.id,
            metadata: toJson(invoice),
          },
        })

        await prisma.notification.create({
          data: {
            userId: local.userId,
            type: 'WARNING',
            title: 'Falha no pagamento',
            message:
              'Não conseguimos processar sua cobrança. Vamos tentar novamente automaticamente.',
            link: '/student/subscription',
          },
        })

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'PAYMENT_FAILED',
          status: 'FAILED',
          amountCents: invoice.amount_due,
          currency: invoice.currency?.toUpperCase(),
          description: 'Pagamento recusado pelo gateway.',
          gatewayEventId: event.id,
          gatewayInvoiceId: invoice.id,
        })

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'DUNNING_NOTICE',
          status: 'WARNING',
          description: 'Início do fluxo de recuperação (dia 0).',
          gatewayEventId: event.id,
          gatewayInvoiceId: invoice.id,
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionRaw = (invoice as { subscription?: unknown })
          .subscription
        const subscriptionId =
          typeof subscriptionRaw === 'string' ? subscriptionRaw : null

        if (!subscriptionId) break

        const local = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true, userId: true },
        })

        if (!local) break

        await prisma.subscription.update({
          where: { id: local.id },
          data: {
            status: 'ACTIVE',
            paymentFailedAt: null,
            dunningStage: 0,
            dunningLastRetryAt: null,
            partialBlockedAt: null,
            suspendedAt: null,
            lastFailedInvoiceId: null,
            metadata: toJson(invoice),
          },
        })

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'PAYMENT_APPROVED',
          status: 'SUCCESS',
          amountCents: invoice.amount_paid,
          currency: invoice.currency?.toUpperCase(),
          description: 'Pagamento aprovado.',
          gatewayEventId: event.id,
          gatewayInvoiceId: invoice.id,
        })

        const billingReason = (invoice as { billing_reason?: string })
          .billing_reason
        if (billingReason === 'subscription_cycle') {
          await createBillingEvent({
            userId: local.userId,
            subscriptionId: local.id,
            type: 'SUBSCRIPTION_RENEWED',
            status: 'SUCCESS',
            amountCents: invoice.amount_paid,
            currency: invoice.currency?.toUpperCase(),
            description: 'Assinatura renovada automaticamente.',
            gatewayEventId: event.id,
            gatewayInvoiceId: invoice.id,
          })
        }

        await prisma.notification.create({
          data: {
            userId: local.userId,
            type: 'SUCCESS',
            title: 'Pagamento confirmado',
            message:
              'Seu pagamento foi aprovado e seu acesso premium está ativo.',
            link: '/student/subscription',
          },
        })
        break
      }

      case 'invoice.finalized': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionRaw = (invoice as { subscription?: unknown })
          .subscription
        const subscriptionId =
          typeof subscriptionRaw === 'string' ? subscriptionRaw : null

        const local = await resolveUserAndSubscription({
          subscriptionId,
          customerId: (invoice.customer as string | null) ?? null,
        })

        if (!local) break

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'INVOICE_ISSUED',
          status: 'INFO',
          amountCents: invoice.amount_due,
          currency: invoice.currency?.toUpperCase(),
          description: 'Nova fatura emitida.',
          gatewayEventId: event.id,
          gatewayInvoiceId: invoice.id,
        })
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const local = await resolveUserAndSubscription({
          customerId: (charge.customer as string | null) ?? null,
        })

        if (!local) break

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'REFUND',
          status: 'WARNING',
          amountCents: charge.amount_refunded,
          currency: charge.currency?.toUpperCase(),
          description: 'Reembolso registrado no gateway.',
          gatewayEventId: event.id,
        })
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId =
          typeof dispute.charge === 'string'
            ? dispute.charge
            : dispute.charge?.id

        let local = null

        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId)
          local = await resolveUserAndSubscription({
            customerId: (charge.customer as string | null) ?? null,
          })
        }

        if (!local) break

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'CHARGEBACK',
          status: 'FAILED',
          amountCents: dispute.amount,
          currency: dispute.currency?.toUpperCase(),
          description: 'Chargeback/disputa aberta no gateway.',
          gatewayEventId: event.id,
        })
        break
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        const local = await resolveUserAndSubscription({
          subscriptionId: subscription.id,
          customerId: String(subscription.customer),
          metadata: (subscription.metadata as Record<string, string>) ?? {},
        })

        if (!local) break

        await prisma.notification.create({
          data: {
            userId: local.userId,
            type: 'INFO',
            title: 'Trial próximo do fim',
            message:
              'Seu período de teste está terminando. Revise seu método de pagamento para evitar interrupções.',
            link: '/student/subscription',
          },
        })

        await createBillingEvent({
          userId: local.userId,
          subscriptionId: local.id,
          type: 'TRIAL_ENDING',
          status: 'INFO',
          description: 'Aviso de término de trial recebido do gateway.',
          gatewayEventId: event.id,
        })

        break
      }

      default:
        break
    }

    revalidateTag('subscriptions')

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json(
      { error: 'Webhook processing error' },
      { status: 500 },
    )
  }
}
