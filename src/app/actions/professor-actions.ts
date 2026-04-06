'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { updateThemeSettingsAction } from '@/app/actions/theme-actions'

type SegmentKey =
  | 'AT_RISK'
  | 'BEGINNER'
  | 'ADVANCED'
  | 'PREMIUM'
  | 'LOW_FREQUENCY'
  | 'HIGH_CONSISTENCY'

type BatchActionKey =
  | 'SEND_REMINDER'
  | 'APPLY_MONTHLY_GOAL'
  | 'RECOMMEND_LESSON'
  | 'COLLECTIVE_FEEDBACK'

async function requireProfessorOrAdmin() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Não autenticado')
  if (!['PROFESSOR', 'ADMIN'].includes(session.user.role)) {
    throw new Error('Sem permissão')
  }
  return session.user
}

async function ensureStudentBelongsToProfessor(
  studentId: string,
  professorId: string,
) {
  const enrolled = await prisma.enrollment.findFirst({
    where: {
      userId: studentId,
      course: { professorId },
    },
    select: { id: true },
  })

  return !!enrolled
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

async function getSegmentedStudentIds(
  professorId: string,
  segment: SegmentKey,
): Promise<string[]> {
  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      enrollments: { some: { course: { professorId } } },
    },
    select: {
      id: true,
      studentProfile: { select: { fitnessLevel: true } },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          status: true,
          currentPeriodEnd: true,
          paymentFailedAt: true,
          dunningStage: true,
        },
      },
      enrollments: {
        where: { course: { professorId } },
        select: { enrolledAt: true, progress: true },
      },
    },
  })

  const studentIds = students.map((s) => s.id)
  const now = new Date()
  const last14 = addDays(now, -14)
  const prev14Start = addDays(now, -28)

  const progressEntries =
    studentIds.length === 0
      ? []
      : await prisma.lessonProgress.findMany({
          where: {
            userId: { in: studentIds },
            OR: [
              { watchedAt: { gte: prev14Start } },
              { completedAt: { gte: prev14Start } },
              { updatedAt: { gte: prev14Start } },
            ],
          },
          select: {
            userId: true,
            watchedAt: true,
            completedAt: true,
            updatedAt: true,
          },
        })

  const recentDays = new Map<string, Set<string>>()
  const previousDays = new Map<string, Set<string>>()

  for (const entry of progressEntries) {
    const ref = entry.completedAt ?? entry.watchedAt ?? entry.updatedAt
    if (!ref) continue

    const key = ref.toISOString().slice(0, 10)
    const targetMap = ref >= last14 ? recentDays : previousDays
    const currentSet = targetMap.get(entry.userId) ?? new Set<string>()
    currentSet.add(key)
    targetMap.set(entry.userId, currentSet)
  }

  const matches = students.filter((student) => {
    const fitnessLevel = (student.studentProfile?.fitnessLevel ?? '').toLowerCase()
    const latestSubscription = student.subscriptions[0]
    const days14 = recentDays.get(student.id)?.size ?? 0
    const prevDays14 = previousDays.get(student.id)?.size ?? 0
    const days30 = days14 + prevDays14

    const stoppedAccess = days14 === 0
    const frequencyDrop = prevDays14 >= 2 && days14 <= 1
    const nearCancel =
      latestSubscription &&
      (latestSubscription.status === 'PAST_DUE' ||
        latestSubscription.status === 'RECOVERY' ||
        latestSubscription.status === 'SUSPENDED' ||
        latestSubscription.dunningStage >= 3)

    const delayedTrack = student.enrollments.some(
      (enrollment) =>
        now.getTime() - enrollment.enrolledAt.getTime() > 21 * 24 * 60 * 60 * 1000 &&
        enrollment.progress < 20,
    )

    const atRisk = Boolean(stoppedAccess || frequencyDrop || nearCancel || delayedTrack)

    switch (segment) {
      case 'AT_RISK':
        return atRisk
      case 'BEGINNER':
        return ['iniciante', 'beginner'].some((v) => fitnessLevel.includes(v))
      case 'ADVANCED':
        return ['avancado', 'avançado', 'advanced'].some((v) =>
          fitnessLevel.includes(v),
        )
      case 'PREMIUM':
        return Boolean(
          latestSubscription &&
            ['ACTIVE', 'RECOVERY'].includes(latestSubscription.status) &&
            latestSubscription.currentPeriodEnd > now,
        )
      case 'LOW_FREQUENCY':
        return days14 <= 2
      case 'HIGH_CONSISTENCY':
        return days30 >= 12
      default:
        return false
    }
  })

  return matches.map((student) => student.id)
}

export async function createProfessorTrainingAction(formData: FormData) {
  try {
    const user = await requireProfessorOrAdmin()

    const studentId = String(formData.get('studentId') || '')
    const name = String(formData.get('name') || '').trim()
    const objective = String(formData.get('objective') || '').trim()
    const notes = String(formData.get('notes') || '').trim()
    const frequency = String(formData.get('frequency') || '').trim()
    const startDateRaw = String(formData.get('startDate') || '').trim()
    const endDateRaw = String(formData.get('endDate') || '').trim()
    const isRecurring = formData.get('isRecurring') === 'on'
    const repeatWeeksRaw = String(formData.get('repeatWeeks') || '').trim()
    const repeatWeeks = repeatWeeksRaw ? Number(repeatWeeksRaw) : 1

    if (!studentId || !name || !startDateRaw) {
      return { success: false, error: 'Preencha os campos obrigatórios' }
    }

    if (!Number.isFinite(repeatWeeks) || repeatWeeks < 1 || repeatWeeks > 16) {
      return { success: false, error: 'Recorrência deve estar entre 1 e 16 semanas' }
    }

    if (user.role !== 'ADMIN') {
      const allowed = await ensureStudentBelongsToProfessor(studentId, user.id)
      if (!allowed) {
        return { success: false, error: 'Aluno não pertence aos seus cursos' }
      }
    }

    const startDate = new Date(startDateRaw)
    const endDate = endDateRaw ? new Date(endDateRaw) : null
    const totalOccurrences = isRecurring ? repeatWeeks : 1

    for (let index = 0; index < totalOccurrences; index += 1) {
      const offset = index * 7
      await prisma.trainingPlan.create({
        data: {
          studentId,
          coachId: user.id,
          name:
            totalOccurrences > 1 ? `${name} • Semana ${index + 1}` : name,
          objective: objective || null,
          notes: notes || null,
          frequency: frequency || null,
          startDate: addDays(startDate, offset),
          endDate: endDate ? addDays(endDate, offset) : null,
          isActive: true,
        },
      })
    }

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'COURSE_UPDATED',
      targetType: 'TrainingPlan',
      targetId: studentId,
      metadata: {
        operation: 'CREATE_TRAINING_RECURRING',
        totalOccurrences,
      },
    })

    revalidatePath('/professor/trainings')
    revalidatePath('/professor/dashboard')
    revalidatePath('/student/trainings')

    return { success: true }
  } catch (error) {
    console.error('[createProfessorTrainingAction] error', error)
    return { success: false, error: 'Falha ao criar treino' }
  }
}

export async function addTrainingExerciseAction(formData: FormData) {
  try {
    const user = await requireProfessorOrAdmin()

    const trainingId = String(formData.get('trainingId') || '')
    const name = String(formData.get('name') || '').trim()
    const setsRaw = String(formData.get('sets') || '').trim()
    const reps = String(formData.get('reps') || '').trim()

    if (!trainingId || !name) {
      return { success: false, error: 'Treino e nome são obrigatórios' }
    }

    const training = await prisma.trainingPlan.findUnique({
      where: { id: trainingId },
      select: { id: true, coachId: true },
    })

    if (!training) return { success: false, error: 'Treino não encontrado' }
    if (user.role !== 'ADMIN' && training.coachId !== user.id) {
      return { success: false, error: 'Sem permissão' }
    }

    const order =
      (await prisma.trainingExercise.count({ where: { trainingId } })) + 1

    await prisma.trainingExercise.create({
      data: {
        trainingId,
        name,
        sets: setsRaw ? Number(setsRaw) : null,
        reps: reps || null,
        order,
      },
    })

    revalidatePath('/professor/trainings')
    revalidatePath('/student/trainings')

    return { success: true }
  } catch (error) {
    console.error('[addTrainingExerciseAction] error', error)
    return { success: false, error: 'Falha ao adicionar exercício' }
  }
}

export async function createProfessorFeedbackAction(formData: FormData) {
  try {
    const user = await requireProfessorOrAdmin()

    const studentId = String(formData.get('studentId') || '')
    const trainingId = String(formData.get('trainingId') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    const type = String(formData.get('type') || 'GENERAL').trim()
    const isImportant = formData.get('isImportant') === 'on'

    if (!studentId || !title || !content) {
      return { success: false, error: 'Preencha os campos obrigatórios' }
    }

    if (user.role !== 'ADMIN') {
      const allowed = await ensureStudentBelongsToProfessor(studentId, user.id)
      if (!allowed) {
        return { success: false, error: 'Aluno não pertence aos seus cursos' }
      }
    }

    await prisma.teacherFeedback.create({
      data: {
        teacherId: user.id,
        studentId,
        trainingId: trainingId || null,
        title,
        content,
        type: ['GENERAL', 'COURSE', 'TRAINING', 'ASSESSMENT'].includes(type)
          ? (type as 'GENERAL' | 'COURSE' | 'TRAINING' | 'ASSESSMENT')
          : 'GENERAL',
        isImportant,
      },
    })

    revalidatePath('/professor/feedback')
    revalidatePath('/professor/dashboard')
    revalidatePath('/student/feedback')

    return { success: true }
  } catch (error) {
    console.error('[createProfessorFeedbackAction] error', error)
    return { success: false, error: 'Falha ao criar feedback' }
  }
}

export async function updateStudentMonthlyGoalByProfessorAction(
  formData: FormData,
) {
  try {
    const user = await requireProfessorOrAdmin()

    const studentId = String(formData.get('studentId') || '').trim()
    const monthlyGoalTargetRaw = String(
      formData.get('monthlyGoalTarget') || '',
    ).trim()
    const monthlyGoalReason = String(
      formData.get('monthlyGoalReason') || '',
    ).trim()
    const monthlyGoalTarget = Number(monthlyGoalTargetRaw)

    if (!studentId || !Number.isFinite(monthlyGoalTarget)) {
      return { success: false, error: 'Dados inválidos para meta mensal' }
    }

    if (monthlyGoalTarget < 4 || monthlyGoalTarget > 31) {
      return {
        success: false,
        error: 'Meta mensal deve estar entre 4 e 31 dias ativos',
      }
    }

    if (monthlyGoalReason.length > 280) {
      return {
        success: false,
        error: 'Observação da meta deve ter até 280 caracteres',
      }
    }

    if (user.role !== 'ADMIN') {
      const allowed = await ensureStudentBelongsToProfessor(studentId, user.id)
      if (!allowed) {
        return { success: false, error: 'Aluno não pertence aos seus cursos' }
      }
    }

    await prisma.studentProfile.upsert({
      where: { userId: studentId },
      create: {
        userId: studentId,
        monthlyGoalTarget,
        monthlyGoalSetBy: user.role === 'ADMIN' ? 'ADMIN' : 'PROFESSOR',
        monthlyGoalReason: monthlyGoalReason || null,
        monthlyGoalUpdatedAt: new Date(),
      },
      update: {
        monthlyGoalTarget,
        monthlyGoalSetBy: user.role === 'ADMIN' ? 'ADMIN' : 'PROFESSOR',
        monthlyGoalReason: monthlyGoalReason || null,
        monthlyGoalUpdatedAt: new Date(),
      },
    })

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'STUDENT_GOAL_UPDATED',
      targetType: 'StudentProfile',
      targetId: studentId,
      after: {
        monthlyGoalTarget,
        monthlyGoalReason: monthlyGoalReason || null,
        setBy: user.role,
      },
    })

    revalidatePath('/professor/students')
    revalidatePath('/professor/dashboard')
    revalidatePath('/student/dashboard')
    revalidatePath('/student/profile')

    return { success: true }
  } catch (error) {
    console.error('[updateStudentMonthlyGoalByProfessorAction] error', error)
    return { success: false, error: 'Falha ao atualizar meta mensal do aluno' }
  }
}

export async function createProfessorLiveAction(formData: FormData) {
  try {
    const user = await requireProfessorOrAdmin()

    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const scheduledAtRaw = String(formData.get('scheduledAt') || '').trim()
    const durationRaw = String(formData.get('duration') || '').trim()
    const link = String(formData.get('link') || '').trim()
    const platform = String(formData.get('platform') || '').trim()
    const thumbnail = String(formData.get('thumbnail') || '').trim()
    const isPremium = formData.get('isPremium') === 'on'
    const isRecurring = formData.get('isRecurring') === 'on'
    const repeatWeeksRaw = String(formData.get('repeatWeeks') || '').trim()
    const repeatWeeks = repeatWeeksRaw ? Number(repeatWeeksRaw) : 1

    if (!title || !scheduledAtRaw) {
      return { success: false, error: 'Título e data são obrigatórios' }
    }

    if (!Number.isFinite(repeatWeeks) || repeatWeeks < 1 || repeatWeeks > 16) {
      return { success: false, error: 'Recorrência deve estar entre 1 e 16 semanas' }
    }

    const scheduledAt = new Date(scheduledAtRaw)
    const totalOccurrences = isRecurring ? repeatWeeks : 1

    for (let index = 0; index < totalOccurrences; index += 1) {
      await prisma.liveSession.create({
        data: {
          professorId: user.id,
          title,
          description: description || null,
          scheduledAt: addDays(scheduledAt, index * 7),
          duration: durationRaw ? Number(durationRaw) : null,
          link: link || null,
          platform: platform || null,
          thumbnail: thumbnail || null,
          isPremium,
          status: 'SCHEDULED',
        },
      })
    }

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'COURSE_UPDATED',
      targetType: 'LiveSession',
      targetId: user.id,
      metadata: {
        operation: 'CREATE_LIVE_RECURRING',
        totalOccurrences,
      },
    })

    revalidatePath('/professor/lives')
    revalidatePath('/professor/dashboard')
    revalidatePath('/student/lives')

    return { success: true }
  } catch (error) {
    console.error('[createProfessorLiveAction] error', error)
    return { success: false, error: 'Falha ao criar live' }
  }
}

export async function runSegmentBatchAction(formData: FormData) {
  try {
    const user = await requireProfessorOrAdmin()

    const segment = String(formData.get('segment') || '').trim() as SegmentKey
    const action = String(formData.get('action') || '').trim() as BatchActionKey

    const monthlyGoalTarget = Number(
      String(formData.get('monthlyGoalTarget') || '').trim(),
    )
    const monthlyGoalReason = String(
      formData.get('monthlyGoalReason') || '',
    ).trim()
    const lessonTitle = String(formData.get('lessonTitle') || '').trim()
    const lessonLink = String(formData.get('lessonLink') || '').trim()
    const feedbackTitle = String(formData.get('feedbackTitle') || '').trim()
    const feedbackContent = String(formData.get('feedbackContent') || '').trim()

    const allowedSegments: SegmentKey[] = [
      'AT_RISK',
      'BEGINNER',
      'ADVANCED',
      'PREMIUM',
      'LOW_FREQUENCY',
      'HIGH_CONSISTENCY',
    ]
    const allowedActions: BatchActionKey[] = [
      'SEND_REMINDER',
      'APPLY_MONTHLY_GOAL',
      'RECOMMEND_LESSON',
      'COLLECTIVE_FEEDBACK',
    ]

    if (!allowedSegments.includes(segment) || !allowedActions.includes(action)) {
      return { success: false, error: 'Segmento ou ação inválido' }
    }

    const targetStudentIds =
      user.role === 'ADMIN'
        ? (
            await prisma.user.findMany({
              where: { role: 'STUDENT' },
              select: { id: true },
            })
          ).map((s) => s.id)
        : await getSegmentedStudentIds(user.id, segment)

    if (targetStudentIds.length === 0) {
      return { success: false, error: 'Nenhum aluno encontrado para este segmento' }
    }

    if (action === 'SEND_REMINDER') {
      await prisma.notification.createMany({
        data: targetStudentIds.map((studentId) => ({
          userId: studentId,
          title: 'Lembrete do professor',
          message: 'Mantenha sua consistência esta semana. Seu progresso importa.',
          type: 'INFO',
          link: '/student/dashboard',
        })),
      })
    }

    if (action === 'APPLY_MONTHLY_GOAL') {
      if (!Number.isFinite(monthlyGoalTarget) || monthlyGoalTarget < 4 || monthlyGoalTarget > 31) {
        return { success: false, error: 'Meta mensal deve estar entre 4 e 31 dias' }
      }

      await prisma.$transaction(async (tx) => {
        for (const studentId of targetStudentIds) {
          await tx.studentProfile.upsert({
            where: { userId: studentId },
            create: {
              userId: studentId,
              monthlyGoalTarget,
              monthlyGoalSetBy: user.role,
              monthlyGoalReason: monthlyGoalReason || 'Meta aplicada em lote',
              monthlyGoalUpdatedAt: new Date(),
            },
            update: {
              monthlyGoalTarget,
              monthlyGoalSetBy: user.role,
              monthlyGoalReason: monthlyGoalReason || 'Meta aplicada em lote',
              monthlyGoalUpdatedAt: new Date(),
            },
          })
        }
      })
    }

    if (action === 'RECOMMEND_LESSON') {
      if (!lessonTitle) {
        return { success: false, error: 'Informe o título da recomendação' }
      }

      await prisma.notification.createMany({
        data: targetStudentIds.map((studentId) => ({
          userId: studentId,
          title: 'Aula recomendada',
          message: `Seu professor recomendou: ${lessonTitle}`,
          type: 'NEW_CONTENT',
          link: lessonLink || '/student/courses',
        })),
      })
    }

    if (action === 'COLLECTIVE_FEEDBACK') {
      if (!feedbackTitle || !feedbackContent) {
        return { success: false, error: 'Título e conteúdo do feedback são obrigatórios' }
      }

      await prisma.teacherFeedback.createMany({
        data: targetStudentIds.map((studentId) => ({
          teacherId: user.id,
          studentId,
          title: feedbackTitle,
          content: feedbackContent,
          type: 'GENERAL',
          isImportant: true,
        })),
      })
    }

    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'STUDENT_GOAL_UPDATED',
      targetType: 'ProfessorBatch',
      targetId: user.id,
      metadata: {
        segment,
        action,
        totalTargeted: targetStudentIds.length,
      },
    })

    revalidatePath('/professor/students')
    revalidatePath('/professor/dashboard')
    revalidatePath('/student/dashboard')
    revalidatePath('/student/feedback')

    return { success: true, totalTargeted: targetStudentIds.length }
  } catch (error) {
    console.error('[runSegmentBatchAction] error', error)
    return { success: false, error: 'Falha ao executar ação em lote' }
  }
}

export async function updateProfessorSettingsAction(formData: FormData) {
  try {
    await requireProfessorOrAdmin()

    const result = await updateThemeSettingsAction({
      primaryColor: String(formData.get('primaryColor') || '#dc2626'),
      secondaryColor: String(formData.get('secondaryColor') || '#7f1d1d'),
      accentColor: String(formData.get('accentColor') || '#ef4444'),
      backgroundColor: String(formData.get('backgroundColor') || '#0a0a0a'),
      surfaceColor: String(formData.get('surfaceColor') || '#111111'),
      textColor: String(formData.get('textColor') || '#ffffff'),
      fontFamily: String(formData.get('fontFamily') || 'Inter'),
      headingFont: String(formData.get('headingFont') || 'Oswald'),
      niche: String(formData.get('niche') || 'default'),
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    revalidatePath('/professor/settings')
    return { success: true }
  } catch (error) {
    console.error('[updateProfessorSettingsAction] error', error)
    return { success: false, error: 'Falha ao salvar settings' }
  }
}
