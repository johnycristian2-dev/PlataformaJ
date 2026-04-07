'use server'

import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { addMonths, addYears } from 'date-fns'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_SLUGS } from '@/lib/constants'
import { getStripe } from '@/lib/stripe'

async function getAppUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

function periodEndByInterval(interval: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL') {
  const now = new Date()
  if (interval === 'ANNUAL') return addYears(now, 1)
  if (interval === 'QUARTERLY') return addMonths(now, 3)
  return addMonths(now, 1)
}

export async function createStripeCheckoutAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDENT') {
    throw new Error('Apenas alunos podem assinar planos')
  }

  const planSlug = String(formData.get('planSlug') || PLAN_SLUGS.PREMIUM)
  const successPath = String(
    formData.get('successPath') || '/student/courses/catalog',
  )
  const cancelPath = String(
    formData.get('cancelPath') || '/student/courses/catalog',
  )

  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
  if (!plan?.stripePriceId) {
    throw new Error('Plano indisponível para pagamento no momento')
  }

  const stripe = getStripe()

  let stripeCustomerId = (
    await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        stripeCustomerId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { stripeCustomerId: true },
    })
  )?.stripeCustomerId

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { userId: session.user.id },
    })
    stripeCustomerId = customer.id
  }

  await prisma.subscription.create({
    data: {
      userId: session.user.id,
      planId: plan.id,
      status: 'PENDING',
      stripeCustomerId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEndByInterval(plan.interval),
      metadata: {
        source: 'stripe_checkout',
      },
    },
  })

  const appUrl = await getAppUrl()

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    payment_method_types: String(
      process.env.STRIPE_PAYMENT_METHOD_TYPES || 'card',
    )
      .split(',')
      .map((value) => value.trim())
      .filter(
        Boolean,
      ) as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}${successPath}?payment=success`,
    cancel_url: `${appUrl}${cancelPath}?payment=canceled`,
    client_reference_id: session.user.id,
    metadata: {
      userId: session.user.id,
      planId: plan.id,
      planSlug: plan.slug,
    },
  })

  if (!checkout.url) throw new Error('Falha ao iniciar checkout')

  redirect(checkout.url)
}

export async function openPremiumCheckoutAction(formData: FormData) {
  await createStripeCheckoutAction(formData)
}

export async function createStripeBillingPortalAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDENT') {
    throw new Error('Apenas alunos podem acessar o portal de assinatura')
  }

  const returnPath = String(
    formData.get('returnPath') || '/student/subscription',
  )

  const latest = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { stripeCustomerId: true },
  })

  if (!latest?.stripeCustomerId) {
    throw new Error('Nenhuma assinatura Stripe encontrada para este usuário')
  }

  const appUrl = await getAppUrl()
  const stripe = getStripe()
  const portal = await stripe.billingPortal.sessions.create({
    customer: latest.stripeCustomerId,
    return_url: `${appUrl}${returnPath}`,
  })

  if (!portal.url) {
    throw new Error('Falha ao abrir portal de assinatura')
  }

  redirect(portal.url)
}

export async function cancelStripeSubscriptionAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDENT') {
    throw new Error('Apenas alunos podem cancelar assinatura')
  }

  const subscriptionId = String(formData.get('subscriptionId') || '')
  if (!subscriptionId) throw new Error('Assinatura inválida')

  const localSubscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId: session.user.id,
    },
    select: {
      id: true,
      stripeSubscriptionId: true,
    },
  })

  if (!localSubscription) {
    throw new Error('Assinatura não encontrada')
  }

  if (localSubscription.stripeSubscriptionId) {
    const stripe = getStripe()
    await stripe.subscriptions.update(localSubscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: localSubscription.id },
      data: {
        canceledAt: new Date(),
      },
    })

    await tx.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: localSubscription.id,
        type: 'SUBSCRIPTION_CANCELED',
        status: 'INFO',
        description: 'Cancelamento solicitado para o fim do ciclo.',
      },
    })
  })

  revalidateTag('subscriptions')
  revalidatePath('/student/subscription')
  revalidatePath('/student/courses/catalog')
}

export async function changeStripeSubscriptionPlanAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDENT') {
    throw new Error('Apenas alunos podem alterar plano')
  }

  const newPlanSlug = String(formData.get('newPlanSlug') || '').trim()
  const applyMode = String(formData.get('applyMode') || 'immediate').trim()
  const estimatedProrationCents = Number(
    String(formData.get('estimatedProrationCents') || '0'),
  )

  if (!newPlanSlug) {
    throw new Error('Plano alvo inválido')
  }

  const targetPlan = await prisma.plan.findUnique({
    where: { slug: newPlanSlug },
  })
  if (!targetPlan?.stripePriceId) {
    throw new Error('Plano alvo indisponível para alteração')
  }

  const localSubscription = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ['ACTIVE', 'PAST_DUE', 'RECOVERY'] },
      stripeSubscriptionId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      planId: true,
      stripeSubscriptionId: true,
    },
  })

  if (!localSubscription?.stripeSubscriptionId) {
    throw new Error('Nenhuma assinatura Stripe ativa para alteração')
  }

  if (localSubscription.planId === targetPlan.id) {
    throw new Error('Você já está neste plano')
  }

  const stripe = getStripe()
  const stripeSubscription = await stripe.subscriptions.retrieve(
    localSubscription.stripeSubscriptionId,
  )

  const currentItem = stripeSubscription.items.data[0]
  if (!currentItem?.id) {
    throw new Error('Item de assinatura não encontrado no Stripe')
  }

  await stripe.subscriptions.update(localSubscription.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: targetPlan.stripePriceId }],
    proration_behavior:
      applyMode === 'next_cycle' ? 'none' : 'create_prorations',
    metadata: {
      ...(stripeSubscription.metadata ?? {}),
      userId: session.user.id,
      planId: targetPlan.id,
      planSlug: targetPlan.slug,
      changedAt: new Date().toISOString(),
      applyMode,
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: localSubscription.id },
      data: {
        planId: targetPlan.id,
        metadata: {
          changedVia: 'manual_plan_change',
          applyMode,
          estimatedProrationCents,
        },
      },
    })

    await tx.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: localSubscription.id,
        type: estimatedProrationCents >= 0 ? 'PLAN_UPGRADE' : 'PLAN_DOWNGRADE',
        status: 'INFO',
        amountCents: Number.isFinite(estimatedProrationCents)
          ? estimatedProrationCents
          : null,
        description:
          applyMode === 'next_cycle'
            ? `Troca de plano para ${targetPlan.name} com efeito no próximo ciclo.`
            : `Troca imediata de plano para ${targetPlan.name} com proration.`,
        metadata: {
          toPlanSlug: targetPlan.slug,
          applyMode,
        },
      },
    })
  })

  revalidateTag('subscriptions')
  revalidatePath('/student/subscription')
  revalidatePath('/student/courses')
  revalidatePath('/student/courses/catalog')
}
