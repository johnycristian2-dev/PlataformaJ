'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROUTES } from '@/lib/constants'
import { sendEmail, buildSupportReplyHtml, buildSupportResolvedHtml } from '@/lib/email'
import type {
  Role,
  SupportConversationCategory,
  SupportConversationStatus,
} from '@prisma/client'

const SUPPORT_CATEGORIES: SupportConversationCategory[] = [
  'BILLING',
  'ACCESS',
  'COURSE',
  'TECHNICAL',
  'OTHER',
]

const SUPPORT_STATUSES: SupportConversationStatus[] = [
  'OPEN',
  'WAITING_USER',
  'RESOLVED',
]

function getSupportPathByRole(role: Role | string) {
  if (role === 'ADMIN') return ROUTES.ADMIN.SUPPORT
  if (role === 'PROFESSOR') return ROUTES.PROFESSOR.SUPPORT
  return ROUTES.STUDENT.SUPPORT
}

function revalidateSupportViews(role: Role | string) {
  revalidatePath(ROUTES.ADMIN.SUPPORT)
  revalidatePath(getSupportPathByRole(role))
}

export async function createSupportConversationAction(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: 'Não autenticado' }
    }

    const subject = String(formData.get('subject') || '').trim()
    const categoryRaw = String(formData.get('category') || '').trim()
    const content = String(formData.get('content') || '').trim()

    if (subject.length < 5 || subject.length > 140) {
      return {
        success: false,
        error: 'Assunto deve ter entre 5 e 140 caracteres',
      }
    }

    if (content.length < 8) {
      return {
        success: false,
        error: 'Descreva melhor o problema (mínimo 8 caracteres)',
      }
    }

    const category = SUPPORT_CATEGORIES.includes(
      categoryRaw as SupportConversationCategory,
    )
      ? (categoryRaw as SupportConversationCategory)
      : 'OTHER'

    const now = new Date()

    const conversation = await prisma.$transaction(async (tx) => {
      const createdConversation = await tx.supportConversation.create({
        data: {
          userId: session.user.id,
          subject,
          category,
          status: 'OPEN',
          lastMessageAt: now,
        },
      })

      await tx.supportMessage.create({
        data: {
          conversationId: createdConversation.id,
          senderId: session.user.id,
          content,
        },
      })

      const admins = await tx.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
          id: { not: session.user.id },
        },
        select: { id: true },
      })

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            title: 'Novo chamado de suporte',
            message: `${session.user.name ?? session.user.email ?? 'Usuário'} abriu um chamado: ${subject}`,
            type: 'ALERT',
            link: ROUTES.ADMIN.SUPPORT,
          })),
        })
      }

      return createdConversation
    })

    revalidateSupportViews(session.user.role)

    return { success: true, data: { conversationId: conversation.id } }
  } catch (error) {
    console.error('[createSupportConversationAction] error', error)
    return { success: false, error: 'Falha ao abrir chamado de suporte' }
  }
}

export async function sendSupportMessageAction(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: 'Não autenticado' }
    }

    const conversationId = String(formData.get('conversationId') || '').trim()
    const content = String(formData.get('content') || '').trim()

    if (!conversationId) {
      return { success: false, error: 'Conversa inválida' }
    }

    if (content.length < 1) {
      return { success: false, error: 'Mensagem vazia' }
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          select: { id: true, role: true, email: true, name: true },
        },
      },
    })

    if (!conversation) {
      return { success: false, error: 'Conversa não encontrada' }
    }

    const isAdmin = session.user.role === 'ADMIN'
    if (!isAdmin && conversation.userId !== session.user.id) {
      return { success: false, error: 'Sem permissão para responder' }
    }

    const now = new Date()
    const nextStatus: SupportConversationStatus = isAdmin
      ? 'WAITING_USER'
      : 'OPEN'

    await prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: {
          conversationId,
          senderId: session.user.id,
          content,
        },
      })

      await tx.supportConversation.update({
        where: { id: conversationId },
        data: {
          status: nextStatus,
          lastMessageAt: now,
        },
      })

      if (isAdmin) {
        await tx.notification.create({
          data: {
            userId: conversation.user.id,
            title: 'Nova resposta do suporte',
            message: `Seu chamado "${conversation.subject}" recebeu uma resposta.`,
            type: 'INFO',
            link: getSupportPathByRole(conversation.user.role),
          },
        })
      } else {
        const admins = await tx.user.findMany({
          where: {
            role: 'ADMIN',
            isActive: true,
          },
          select: { id: true },
        })

        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              title: 'Nova mensagem no suporte',
              message: `${session.user.name ?? session.user.email ?? 'Usuário'} respondeu o chamado "${conversation.subject}".`,
              type: 'INFO',
              link: ROUTES.ADMIN.SUPPORT,
            })),
          })
        }
      }
    })

    revalidateSupportViews(session.user.role)
    revalidateSupportViews(conversation.user.role)

    // Notificar por email quando admin responde
    if (isAdmin && conversation.user.email) {
      void sendEmail({
        to: conversation.user.email,
        subject: `Resposta no seu chamado: ${conversation.subject}`,
        html: buildSupportReplyHtml({
          userName: conversation.user.name ?? 'Aluno',
          subject: conversation.subject,
          supportUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${getSupportPathByRole(conversation.user.role)}`,
        }),
      })
    }

    return { success: true }
  } catch (error) {
    console.error('[sendSupportMessageAction] error', error)
    return { success: false, error: 'Falha ao enviar mensagem de suporte' }
  }
}

export async function updateSupportConversationStatusAction(
  formData: FormData,
) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.role) {
      return { success: false, error: 'Não autenticado' }
    }

    const conversationId = String(formData.get('conversationId') || '').trim()
    const statusRaw = String(formData.get('status') || '').trim()

    if (!conversationId) {
      return { success: false, error: 'Conversa inválida' }
    }

    if (!SUPPORT_STATUSES.includes(statusRaw as SupportConversationStatus)) {
      return { success: false, error: 'Status inválido' }
    }

    const status = statusRaw as SupportConversationStatus

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: { user: { select: { id: true, role: true, email: true, name: true } } },
    })

    if (!conversation) {
      return { success: false, error: 'Conversa não encontrada' }
    }

    const isAdmin = session.user.role === 'ADMIN'
    const isOwner = conversation.userId === session.user.id

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'Sem permissão para atualizar conversa' }
    }

    if (!isAdmin && status !== 'OPEN') {
      return {
        success: false,
        error:
          'Apenas o suporte pode marcar conversa como aguardando/resolvida',
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.supportConversation.update({
        where: { id: conversationId },
        data: { status },
      })

      if (isAdmin && status === 'RESOLVED') {
        await tx.notification.create({
          data: {
            userId: conversation.user.id,
            title: 'Chamado de suporte resolvido',
            message: `Seu chamado "${conversation.subject}" foi marcado como resolvido.`,
            type: 'SUCCESS',
            link: getSupportPathByRole(conversation.user.role),
          },
        })
      }

      if (!isAdmin && status === 'OPEN') {
        const admins = await tx.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true },
        })

        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              title: 'Chamado reaberto pelo usuário',
              message: `${session.user.name ?? session.user.email ?? 'Usuário'} reabriu o chamado "${conversation.subject}".`,
              type: 'WARNING',
              link: ROUTES.ADMIN.SUPPORT,
            })),
          })
        }
      }
    })

    revalidateSupportViews(session.user.role)
    revalidateSupportViews(conversation.user.role)

    // Notificar por email quando admin resolve o chamado
    if (isAdmin && status === 'RESOLVED' && conversation.user.email) {
      void sendEmail({
        to: conversation.user.email,
        subject: `Seu chamado foi resolvido: ${conversation.subject}`,
        html: buildSupportResolvedHtml({
          userName: conversation.user.name ?? 'Aluno',
          subject: conversation.subject,
        }),
      })
    }

    return { success: true }
  } catch (error) {
    console.error('[updateSupportConversationStatusAction] error', error)
    return { success: false, error: 'Falha ao atualizar status do chamado' }
  }
}
