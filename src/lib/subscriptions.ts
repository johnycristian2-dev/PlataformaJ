import { differenceInCalendarDays } from 'date-fns'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

type AccessLevel = 'FULL' | 'PARTIAL' | 'BLOCKED'

type SubscriptionSnapshot = {
  id: string
  status: string
  accessLevel: AccessLevel
  dunningDay: number
  currentPeriodEnd: Date
}

function getAccessLevelByStatus(status: string): AccessLevel {
  if (status === 'ACTIVE') return 'FULL'
  if (status === 'PAST_DUE') return 'FULL'
  if (status === 'RECOVERY') return 'PARTIAL'
  return 'BLOCKED'
}

async function createBillingEvent(params: {
  userId: string
  subscriptionId: string
  type:
    | 'DUNNING_NOTICE'
    | 'RETRY_ATTEMPT'
    | 'RETRY_SUCCESS'
    | 'PARTIAL_BLOCK'
    | 'SUSPENDED'
    | 'REACTIVATED'
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'FAILED'
  description: string
  metadata?: Record<string, unknown>
}) {
  const existing = await prisma.billingEvent.findFirst({
    where: {
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      type: params.type,
      description: params.description,
    },
    select: { id: true },
  })

  if (existing) return

  await prisma.billingEvent.create({
    data: {
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      type: params.type,
      status: params.status,
      description: params.description,
      metadata: params.metadata
        ? (params.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  })
}

async function createNotification(params: {
  userId: string
  title: string
  message: string
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS'
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true },
  })

  if (existing) return

  await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: '/student/subscription',
    },
  })
}

async function tryRetryFailedInvoice(params: {
  userId: string
  subscriptionId: string
  invoiceId: string
  dunningDay: number
}) {
  try {
    const stripe = getStripe()
    const invoice = await stripe.invoices.pay(params.invoiceId)

    if (invoice.status === 'paid') {
      await prisma.subscription.update({
        where: { id: params.subscriptionId },
        data: {
          status: 'ACTIVE',
          paymentFailedAt: null,
          dunningStage: 0,
          dunningLastRetryAt: new Date(),
          partialBlockedAt: null,
          suspendedAt: null,
          lastFailedInvoiceId: null,
        },
      })

      await createBillingEvent({
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        type: 'RETRY_SUCCESS',
        status: 'SUCCESS',
        description: `Recuperação automática no dia ${params.dunningDay}.`,
        metadata: { invoiceId: params.invoiceId },
      })

      await createBillingEvent({
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        type: 'REACTIVATED',
        status: 'SUCCESS',
        description: 'Assinatura reativada após cobrança bem-sucedida.',
      })

      await createNotification({
        userId: params.userId,
        type: 'SUCCESS',
        title: 'Assinatura reativada',
        message:
          'Seu pagamento foi confirmado na nova tentativa e o acesso premium foi restaurado.',
      })

      return true
    }

    await createBillingEvent({
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      type: 'RETRY_ATTEMPT',
      status: 'FAILED',
      description: `Tentativa automática de recuperação no dia ${params.dunningDay} sem confirmação de pagamento.`,
      metadata: { invoiceId: params.invoiceId, stripeStatus: invoice.status },
    })

    return false
  } catch {
    await createBillingEvent({
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      type: 'RETRY_ATTEMPT',
      status: 'FAILED',
      description: `Tentativa automática de recuperação no dia ${params.dunningDay} falhou.`,
      metadata: { invoiceId: params.invoiceId },
    })

    return false
  }
}

async function applyDunningRules(subscription: {
  id: string
  userId: string
  status: string
  paymentFailedAt: Date | null
  dunningStage: number
  lastFailedInvoiceId: string | null
}) {
  if (!['PAST_DUE', 'RECOVERY', 'SUSPENDED'].includes(subscription.status)) {
    return
  }

  const now = new Date()
  const failureDate = subscription.paymentFailedAt ?? now

  if (!subscription.paymentFailedAt && subscription.status !== 'SUSPENDED') {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { paymentFailedAt: now },
    })
  }

  const dunningDay = Math.max(0, differenceInCalendarDays(now, failureDate))
  let nextStatus = subscription.status
  let nextStage = subscription.dunningStage

  if (dunningDay >= 1 && nextStage < 1) {
    await createNotification({
      userId: subscription.userId,
      type: 'WARNING',
      title: 'Pagamento em aberto',
      message:
        'Detectamos falha no pagamento. Atualize seu método para evitar restrições de acesso.',
    })
    await createBillingEvent({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      type: 'DUNNING_NOTICE',
      status: 'WARNING',
      description: 'Aviso de recuperação enviado no dia 1 após falha.',
    })
    nextStage = 1
  }

  if (dunningDay >= 3 && nextStage < 2) {
    if (subscription.lastFailedInvoiceId) {
      const recovered = await tryRetryFailedInvoice({
        userId: subscription.userId,
        subscriptionId: subscription.id,
        invoiceId: subscription.lastFailedInvoiceId,
        dunningDay,
      })
      if (recovered) {
        return
      }
    }

    await createBillingEvent({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      type: 'RETRY_ATTEMPT',
      status: 'WARNING',
      description: 'Nova tentativa automática de cobrança executada no dia 3.',
    })

    nextStage = 2
  }

  if (dunningDay >= 5 && nextStage < 3) {
    await createNotification({
      userId: subscription.userId,
      type: 'WARNING',
      title: 'Pagamento ainda pendente',
      message:
        'Ainda não conseguimos confirmar o pagamento. Faça a regularização para manter o acesso completo.',
    })
    await createBillingEvent({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      type: 'DUNNING_NOTICE',
      status: 'WARNING',
      description: 'Segundo aviso de recuperação enviado no dia 5.',
    })
    nextStage = 3
  }

  if (dunningDay >= 7 && nextStage < 4) {
    nextStatus = 'RECOVERY'

    await createNotification({
      userId: subscription.userId,
      type: 'ALERT',
      title: 'Bloqueio parcial ativado',
      message:
        'Seu acesso premium entrou em modo de recuperação. Regularize o pagamento para restaurar tudo.',
    })

    await createBillingEvent({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      type: 'PARTIAL_BLOCK',
      status: 'WARNING',
      description: 'Bloqueio parcial aplicado no dia 7 de inadimplência.',
    })

    nextStage = 4
  }

  if (dunningDay >= 10 && nextStage < 5) {
    nextStatus = 'SUSPENDED'

    await createNotification({
      userId: subscription.userId,
      type: 'ALERT',
      title: 'Assinatura suspensa',
      message:
        'Sua assinatura foi suspensa por inadimplência. Reative em poucos cliques para voltar ao premium.',
    })

    await createBillingEvent({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      type: 'SUSPENDED',
      status: 'FAILED',
      description: 'Suspensão aplicada no dia 10 de inadimplência.',
    })

    nextStage = 5
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: nextStatus as
        | 'PENDING'
        | 'ACTIVE'
        | 'PAST_DUE'
        | 'RECOVERY'
        | 'SUSPENDED'
        | 'CANCELED'
        | 'EXPIRED',
      dunningStage: nextStage,
      dunningLastRetryAt: nextStage >= 2 ? new Date() : undefined,
      partialBlockedAt: nextStage >= 4 ? new Date() : null,
      suspendedAt: nextStage >= 5 ? new Date() : null,
    },
  })
}

export async function getSubscriptionAccessSnapshot(
  userId: string,
): Promise<SubscriptionSnapshot | null> {
  const latest = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      userId: true,
      currentPeriodEnd: true,
      paymentFailedAt: true,
      dunningStage: true,
      lastFailedInvoiceId: true,
    },
  })

  if (!latest) return null

  await applyDunningRules(latest)

  const refreshed = await prisma.subscription.findUnique({
    where: { id: latest.id },
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true,
      paymentFailedAt: true,
    },
  })

  if (!refreshed) return null

  const dunningDay = refreshed.paymentFailedAt
    ? Math.max(
        0,
        differenceInCalendarDays(new Date(), refreshed.paymentFailedAt),
      )
    : 0

  return {
    id: refreshed.id,
    status: refreshed.status,
    accessLevel: getAccessLevelByStatus(refreshed.status),
    dunningDay,
    currentPeriodEnd: refreshed.currentPeriodEnd,
  }
}

export async function hasActiveSubscription(userId: string) {
  const snapshot = await getSubscriptionAccessSnapshot(userId)

  if (!snapshot) return false

  if (snapshot.status === 'ACTIVE') {
    return snapshot.currentPeriodEnd > new Date()
  }

  return snapshot.accessLevel === 'FULL'
}
