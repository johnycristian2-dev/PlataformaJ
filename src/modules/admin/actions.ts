'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { requireAdminUser } from '@/modules/_shared/guards'
import type { Role, SubscriptionStatus } from '@prisma/client'

const allowedRoles: Role[] = ['ADMIN', 'PROFESSOR', 'STUDENT']
const allowedSubscriptionStatuses: SubscriptionStatus[] = [
  'PENDING',
  'ACTIVE',
  'PAST_DUE',
  'RECOVERY',
  'SUSPENDED',
  'CANCELED',
  'EXPIRED',
]

export async function updateUserRoleByAdminAction(formData: FormData) {
  try {
    const admin = await requireAdminUser()

    const userId = String(formData.get('userId') || '').trim()
    const role = String(formData.get('role') || '').trim() as Role

    if (!userId || !allowedRoles.includes(role)) {
      return {
        success: false,
        error: 'Dados inválidos para atualização de perfil',
      }
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role },
      })

      if (role === 'PROFESSOR') {
        await tx.professorProfile.upsert({
          where: { userId },
          create: {
            userId,
            certifications: [],
          },
          update: {},
        })
      }

      if (role === 'STUDENT') {
        await tx.studentProfile.upsert({
          where: { userId },
          create: {
            userId,
          },
          update: {},
        })
      }
    })

    await createAuditLog({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: userId,
      before: { role: currentUser?.role },
      after: { role },
    })

    revalidatePath('/admin/users')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('[updateUserRoleByAdminAction] error', error)
    return { success: false, error: 'Falha ao atualizar perfil do usuário' }
  }
}

export async function updateSubscriptionStatusByAdminAction(
  formData: FormData,
) {
  try {
    const admin = await requireAdminUser()

    const subscriptionId = String(formData.get('subscriptionId') || '').trim()
    const status = String(
      formData.get('status') || '',
    ).trim() as SubscriptionStatus
    const reason = String(formData.get('reason') || '').trim()

    if (!subscriptionId || !allowedSubscriptionStatuses.includes(status)) {
      return { success: false, error: 'Dados inválidos para assinatura' }
    }

    const currentSubscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    })

    if (!currentSubscription) {
      return { success: false, error: 'Assinatura não encontrada' }
    }

    const now = new Date()
    const shouldRenewPeriod =
      status === 'ACTIVE' && currentSubscription.currentPeriodEnd <= now

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status,
          currentPeriodStart: shouldRenewPeriod
            ? now
            : currentSubscription.currentPeriodStart,
          currentPeriodEnd: shouldRenewPeriod
            ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            : currentSubscription.currentPeriodEnd,
          canceledAt:
            status === 'CANCELED' || status === 'EXPIRED' ? now : null,
        },
      })

      if (currentSubscription.status !== status) {
        await tx.subscriptionStatusChange.create({
          data: {
            subscriptionId,
            adminId: admin.id,
            fromStatus: currentSubscription.status,
            toStatus: status,
            reason: reason || null,
          },
        })
      }
    })

    if (currentSubscription.status !== status) {
      await createAuditLog({
        actorId: admin.id,
        actorRole: admin.role,
        action: 'SUBSCRIPTION_STATUS_CHANGED',
        targetType: 'Subscription',
        targetId: subscriptionId,
        before: { status: currentSubscription.status },
        after: { status },
        metadata: { reason: reason || null },
      })
    }

    revalidateTag('subscriptions')
    revalidatePath('/admin/subscriptions')
    revalidatePath('/admin/dashboard')
    revalidatePath('/student/subscription')
    revalidatePath('/student/courses')
    revalidatePath('/student/courses/catalog')

    return { success: true }
  } catch (error) {
    console.error('[updateSubscriptionStatusByAdminAction] error', error)
    return { success: false, error: 'Falha ao atualizar assinatura' }
  }
}

export async function updateCourseStatusByAdminAction(formData: FormData) {
  try {
    await requireAdminUser()

    const courseId = String(formData.get('courseId') || '').trim()
    const publishStateRaw = String(formData.get('publishState') || '').trim()
    const premiumStateRaw = String(formData.get('premiumState') || '').trim()
    const isPublishedRaw = String(formData.get('isPublished') || '').trim()
    const isPremiumRaw = String(formData.get('isPremium') || '').trim()

    const publishState =
      publishStateRaw || (isPublishedRaw === 'true' ? 'published' : 'draft')
    const premiumState =
      premiumStateRaw || (isPremiumRaw === 'true' ? 'premium' : 'free')

    if (!courseId) {
      return { success: false, error: 'Curso inválido' }
    }

    if (!['published', 'draft'].includes(publishState)) {
      return { success: false, error: 'Estado de publicação inválido' }
    }

    if (!['premium', 'free'].includes(premiumState)) {
      return { success: false, error: 'Estado de acesso inválido' }
    }

    await prisma.course.update({
      where: { id: courseId },
      data: {
        isPublished: publishState === 'published',
        isPremium: premiumState === 'premium',
      },
    })

    revalidatePath('/admin/courses')
    revalidatePath('/admin/dashboard')
    revalidatePath('/professor/courses')
    revalidatePath('/student/courses')
    revalidatePath('/student/courses/catalog')

    return { success: true }
  } catch (error) {
    console.error('[updateCourseStatusByAdminAction] error', error)
    return { success: false, error: 'Falha ao atualizar status do curso' }
  }
}

export async function setProfessorApprovalByAdminAction(formData: FormData) {
  try {
    const admin = await requireAdminUser()

    const professorProfileId = String(
      formData.get('professorProfileId') || '',
    ).trim()
    const approvedRaw = String(formData.get('approved') || '').trim()
    const reasonRaw = String(formData.get('reason') || '').trim()

    if (!professorProfileId || !['true', 'false'].includes(approvedRaw)) {
      return { success: false, error: 'Dados inválidos para aprovação' }
    }

    const approved = approvedRaw === 'true'

    if (!approved && reasonRaw.length < 10) {
      return {
        success: false,
        error: 'Informe um motivo com pelo menos 10 caracteres para rejeição',
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.professorProfile.update({
        where: { id: professorProfileId },
        data: { isApproved: approved },
      })

      await tx.professorApprovalDecision.create({
        data: {
          professorProfileId,
          adminId: admin.id,
          approved,
          reason: reasonRaw || null,
        },
      })
    })

    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/users')

    return { success: true }
  } catch (error) {
    console.error('[setProfessorApprovalByAdminAction] error', error)
    return {
      success: false,
      error: 'Falha ao atualizar aprovação do professor',
    }
  }
}

export async function runSecurityHousekeepingByAdminAction(formData: FormData) {
  try {
    const admin = await requireAdminUser()

    const keepRateLimitDaysRaw = Number(
      String(formData.get('keepRateLimitDays') || '14'),
    )
    const keepSubscriptionHistoryDaysRaw = Number(
      String(formData.get('keepSubscriptionHistoryDays') || '120'),
    )

    const keepRateLimitDays = Number.isFinite(keepRateLimitDaysRaw)
      ? Math.min(365, Math.max(1, Math.floor(keepRateLimitDaysRaw)))
      : 14

    const keepSubscriptionHistoryDays = Number.isFinite(
      keepSubscriptionHistoryDaysRaw,
    )
      ? Math.min(730, Math.max(7, Math.floor(keepSubscriptionHistoryDaysRaw)))
      : 120

    const now = new Date()
    const rateLimitThreshold = new Date(
      now.getTime() - keepRateLimitDays * 24 * 60 * 60 * 1000,
    )
    const subscriptionHistoryThreshold = new Date(
      now.getTime() - keepSubscriptionHistoryDays * 24 * 60 * 60 * 1000,
    )

    const result = await prisma.$transaction(async (tx) => {
      const rateLimitCleanup = await tx.rateLimitBucket.deleteMany({
        where: {
          updatedAt: { lt: rateLimitThreshold },
          OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
        },
      })

      const subscriptionHistoryCleanup =
        await tx.subscriptionStatusChange.deleteMany({
          where: {
            createdAt: { lt: subscriptionHistoryThreshold },
          },
        })

      await tx.securityMaintenanceRun.create({
        data: {
          adminId: admin.id,
          keepRateLimitDays,
          keepSubscriptionHistoryDays,
          deletedRateLimitBuckets: rateLimitCleanup.count,
          deletedSubscriptionChanges: subscriptionHistoryCleanup.count,
        },
      })

      return {
        deletedRateLimitBuckets: rateLimitCleanup.count,
        deletedSubscriptionChanges: subscriptionHistoryCleanup.count,
      }
    })

    revalidatePath('/admin/security')
    revalidatePath('/admin/subscriptions')

    return {
      success: true,
      deletedRateLimitBuckets: result.deletedRateLimitBuckets,
      deletedSubscriptionChanges: result.deletedSubscriptionChanges,
    }
  } catch (error) {
    console.error('[runSecurityHousekeepingByAdminAction] error', error)
    return {
      success: false,
      error: 'Falha ao executar limpeza de segurança',
    }
  }
}

export async function resetAuthAttemptStatByAdminAction(formData: FormData) {
  try {
    const admin = await requireAdminUser()

    const attemptId = String(formData.get('attemptId') || '').trim()
    if (!attemptId) {
      return { success: false, error: 'Registro de tentativa inválido' }
    }

    const attempt = await prisma.authAttemptStat.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        action: true,
        channel: true,
        identifier: true,
        failedCount: true,
        lastError: true,
      },
    })

    if (!attempt) {
      return { success: false, error: 'Tentativa não encontrada' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.authAttemptStat.update({
        where: { id: attempt.id },
        data: {
          failedCount: 0,
          lastError: null,
          lastFailureAt: null,
        },
      })

      await tx.authAttemptResetRun.create({
        data: {
          adminId: admin.id,
          action: attempt.action,
          channel: attempt.channel,
          identifier: attempt.identifier,
          previousFailedCount: attempt.failedCount,
          previousLastError: attempt.lastError,
        },
      })
    })

    revalidatePath('/admin/security')

    return { success: true }
  } catch (error) {
    console.error('[resetAuthAttemptStatByAdminAction] error', error)
    return {
      success: false,
      error: 'Falha ao resetar tentativas de autenticação',
    }
  }
}
