'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { requireAdminUser, requireAuthUser } from '@/app/actions/_shared/guards'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

// ===========================================================================
// LGPD — Solicitações de dados
// ===========================================================================

export async function createDataRequestAction(formData: FormData) {
  try {
    const user = await requireAuthUser()

    const type = String(formData.get('type') || '').trim()
    const reason = String(formData.get('reason') || '').trim()

    if (!['EXPORT', 'DELETE'].includes(type)) {
      return { success: false, error: 'Tipo de solicitação inválido' }
    }

    // Evitar pedidos duplicados pendentes do mesmo tipo
    const existing = await prisma.dataRequest.findFirst({
      where: {
        userId: user.id,
        type: type as 'EXPORT' | 'DELETE',
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      select: { id: true },
    })

    if (existing) {
      return {
        success: false,
        error:
          'Você já possui uma solicitação pendente deste tipo. Aguarde o processamento.',
      }
    }

    await prisma.dataRequest.create({
      data: {
        userId: user.id,
        type: type as 'EXPORT' | 'DELETE',
        status: 'PENDING',
        reason: reason || null,
      },
    })

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action:
        type === 'EXPORT' ? 'DATA_EXPORT_REQUESTED' : 'DATA_DELETION_REQUESTED',
      targetType: 'DataRequest',
      targetId: user.id,
    })

    revalidatePath('/student/privacy')

    return { success: true }
  } catch (error) {
    console.error('[createDataRequestAction]', error)
    return { success: false, error: 'Falha ao criar solicitação' }
  }
}

// ===========================================================================
// Admin — Processar solicitações de dados
// ===========================================================================

export async function processDataRequestAction(formData: FormData) {
  try {
    const admin = await requireAdminUser()

    const requestId = String(formData.get('requestId') || '').trim()
    const decision = String(formData.get('decision') || '').trim()
    const adminNote = String(formData.get('adminNote') || '').trim()

    if (!requestId || !['COMPLETED', 'DENIED'].includes(decision)) {
      return { success: false, error: 'Dados inválidos' }
    }

    const request = await prisma.dataRequest.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, type: true, status: true },
    })

    if (!request) {
      return { success: false, error: 'Solicitação não encontrada' }
    }

    if (!['PENDING', 'PROCESSING'].includes(request.status)) {
      return { success: false, error: 'Solicitação já foi processada' }
    }

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: {
        status: decision as 'COMPLETED' | 'DENIED',
        adminNote: adminNote || null,
        processedAt: new Date(),
        processedById: admin.id,
      },
    })

    // Registrar notificação para o usuário
    const isExport = request.type === 'EXPORT'
    const isCompleted = decision === 'COMPLETED'

    await prisma.notification.create({
      data: {
        userId: request.userId,
        title: isExport
          ? isCompleted
            ? 'Exportação de dados concluída'
            : 'Exportação de dados negada'
          : isCompleted
            ? 'Solicitação de exclusão processada'
            : 'Solicitação de exclusão negada',
        message:
          adminNote ||
          (isCompleted
            ? 'Sua solicitação foi processada.'
            : 'Sua solicitação foi negada.'),
        type: isCompleted ? 'SUCCESS' : 'WARNING',
        link: '/student/privacy',
      },
    })

    await createAuditLog({
      actorId: admin.id,
      actorRole: admin.role,
      action:
        request.type === 'EXPORT'
          ? isCompleted
            ? 'DATA_EXPORT_COMPLETED'
            : 'DATA_DELETION_DENIED'
          : isCompleted
            ? 'DATA_DELETION_COMPLETED'
            : 'DATA_DELETION_DENIED',
      targetType: 'DataRequest',
      targetId: requestId,
      metadata: { decision, requestType: request.type },
    })

    revalidatePath('/admin/data-requests')

    return { success: true }
  } catch (error) {
    console.error('[processDataRequestAction]', error)
    return { success: false, error: 'Falha ao processar solicitação' }
  }
}

// ===========================================================================
// Exportar dados do usuário (compilação estruturada)
// ===========================================================================

export async function exportUserDataAction() {
  try {
    const user = await requireAuthUser()

    const [
      profile,
      studentProfile,
      subscriptions,
      enrollments,
      certificates,
      feedbacks,
      notifications,
      billingEvents,
      dataRequests,
    ] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id } }),
      prisma.studentProfile.findUnique({ where: { userId: user.id } }),
      prisma.subscription.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          createdAt: true,
          plan: { select: { name: true, slug: true } },
        },
      }),
      prisma.enrollment.findMany({
        where: { userId: user.id },
        select: {
          enrolledAt: true,
          status: true,
          progress: true,
          completedAt: true,
          course: { select: { title: true, slug: true } },
        },
      }),
      prisma.certificate.findMany({
        where: { userId: user.id },
        select: {
          certificateCode: true,
          issuedAt: true,
          course: { select: { title: true } },
        },
      }),
      prisma.teacherFeedback.findMany({
        where: { studentId: user.id },
        select: { title: true, type: true, createdAt: true },
      }),
      prisma.notification.findMany({
        where: { userId: user.id },
        select: { title: true, type: true, isRead: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.billingEvent.findMany({
        where: { userId: user.id },
        select: {
          type: true,
          status: true,
          amountCents: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.dataRequest.findMany({
        where: { userId: user.id },
        select: { type: true, status: true, reason: true, createdAt: true },
      }),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      profile,
      studentProfile,
      subscriptions,
      enrollments,
      certificates,
      feedbacks,
      billingEvents,
      notifications,
      dataRequests,
    }

    return { success: true, data: exportData }
  } catch (error) {
    console.error('[exportUserDataAction]', error)
    return { success: false, error: 'Falha ao exportar dados' }
  }
}

// ===========================================================================
// Preferências de comunicação
// ===========================================================================

export async function updateCommunicationPreferencesAction(formData: FormData) {
  try {
    const user = await requireAuthUser()

    const receiveEmail = formData.get('receiveEmail') === 'on'
    const receiveMarketing = formData.get('receiveMarketing') === 'on'
    const receiveProductAlerts = formData.get('receiveProductAlerts') === 'on'
    const receiveReminders = formData.get('receiveReminders') === 'on'

    await prisma.communicationPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        receiveEmail,
        receiveMarketing,
        receiveProductAlerts,
        receiveReminders,
      },
      update: {
        receiveEmail,
        receiveMarketing,
        receiveProductAlerts,
        receiveReminders,
      },
    })

    revalidatePath('/student/privacy')

    return { success: true }
  } catch (error) {
    console.error('[updateCommunicationPreferencesAction]', error)
    return { success: false, error: 'Falha ao atualizar preferências' }
  }
}
