'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROUTES } from '@/lib/constants'

export async function updateStudentProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Não autenticado' }
  }

  const userId = session.user.id

  const name = String(formData.get('name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const city = String(formData.get('city') || '').trim()
  const state = String(formData.get('state') || '').trim()
  const bio = String(formData.get('bio') || '').trim()
  const fitnessLevel = String(formData.get('fitnessLevel') || '').trim()
  const primaryGoal = String(formData.get('primaryGoal') || '').trim()
  const preferredTrack = String(formData.get('preferredTrack') || '').trim()
  const weeklyCommitmentRaw = String(
    formData.get('weeklyCommitment') || '',
  ).trim()
  const monthlyGoalTargetRaw = String(
    formData.get('monthlyGoalTarget') || '',
  ).trim()
  const goals = String(formData.get('goals') || '').trim()
  const medicalNotes = String(formData.get('medicalNotes') || '').trim()

  const heightRaw = String(formData.get('height') || '').trim()
  const weightRaw = String(formData.get('weight') || '').trim()
  const height = heightRaw ? Number(heightRaw) : null
  const weight = weightRaw ? Number(weightRaw) : null
  const weeklyCommitment = weeklyCommitmentRaw
    ? Number(weeklyCommitmentRaw)
    : null
  const monthlyGoalTarget = monthlyGoalTargetRaw
    ? Number(monthlyGoalTargetRaw)
    : null

  if (!name || name.length < 2) {
    return { success: false, error: 'Nome inválido' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { name },
      })

      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          phone: phone || null,
          city: city || null,
          state: state || null,
          bio: bio || null,
        },
        update: {
          phone: phone || null,
          city: city || null,
          state: state || null,
          bio: bio || null,
        },
      })

      await tx.studentProfile.upsert({
        where: { userId },
        create: {
          userId,
          fitnessLevel: fitnessLevel || null,
          primaryGoal: primaryGoal || null,
          preferredTrack: preferredTrack || null,
          weeklyCommitment,
          monthlyGoalTarget,
          monthlyGoalSetBy: monthlyGoalTarget ? 'SELF' : null,
          monthlyGoalReason: null,
          monthlyGoalUpdatedAt: monthlyGoalTarget ? new Date() : null,
          onboardingCompleted:
            Boolean(
              fitnessLevel || primaryGoal || preferredTrack || weeklyCommitment,
            ) || Boolean(goals),
          goals: goals || null,
          medicalNotes: medicalNotes || null,
          height,
          weight,
        },
        update: {
          fitnessLevel: fitnessLevel || null,
          primaryGoal: primaryGoal || null,
          preferredTrack: preferredTrack || null,
          weeklyCommitment,
          monthlyGoalTarget,
          monthlyGoalSetBy: monthlyGoalTarget ? 'SELF' : null,
          monthlyGoalReason: null,
          monthlyGoalUpdatedAt: monthlyGoalTarget ? new Date() : null,
          onboardingCompleted:
            Boolean(
              fitnessLevel || primaryGoal || preferredTrack || weeklyCommitment,
            ) || Boolean(goals),
          goals: goals || null,
          medicalNotes: medicalNotes || null,
          height,
          weight,
        },
      })
    })

    revalidatePath('/student/profile')
    revalidatePath('/student/dashboard')

    return { success: true }
  } catch (error) {
    console.error('[updateStudentProfileAction] error', error)
    return { success: false, error: 'Falha ao atualizar perfil' }
  }
}

export async function completeStudentOnboardingAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Não autenticado' }
  }

  const primaryGoal = String(formData.get('primaryGoal') || '').trim()
  const fitnessLevel = String(formData.get('fitnessLevel') || '').trim()
  const preferredTrack = String(formData.get('preferredTrack') || '').trim()
  const weeklyCommitmentRaw = String(
    formData.get('weeklyCommitment') || '',
  ).trim()
  const monthlyGoalTargetRaw = String(
    formData.get('monthlyGoalTarget') || '',
  ).trim()
  const goals = String(formData.get('goals') || '').trim()

  const weeklyCommitment = Number(weeklyCommitmentRaw)
  const monthlyGoalTarget = Number(monthlyGoalTargetRaw || weeklyCommitment * 4)

  if (!primaryGoal || !fitnessLevel || !preferredTrack) {
    return { success: false, error: 'Preencha os campos principais da jornada' }
  }

  if (
    !Number.isFinite(weeklyCommitment) ||
    weeklyCommitment < 1 ||
    weeklyCommitment > 7
  ) {
    return {
      success: false,
      error: 'Compromisso semanal deve estar entre 1 e 7 sessões',
    }
  }

  if (
    !Number.isFinite(monthlyGoalTarget) ||
    monthlyGoalTarget < 4 ||
    monthlyGoalTarget > 31
  ) {
    return {
      success: false,
      error: 'Meta mensal deve estar entre 4 e 31 dias ativos',
    }
  }

  try {
    await prisma.studentProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        primaryGoal,
        fitnessLevel,
        preferredTrack,
        weeklyCommitment,
        monthlyGoalTarget,
        monthlyGoalSetBy: 'SELF',
        monthlyGoalReason: null,
        monthlyGoalUpdatedAt: new Date(),
        goals: goals || null,
        onboardingCompleted: true,
      },
      update: {
        primaryGoal,
        fitnessLevel,
        preferredTrack,
        weeklyCommitment,
        monthlyGoalTarget,
        monthlyGoalSetBy: 'SELF',
        monthlyGoalReason: null,
        monthlyGoalUpdatedAt: new Date(),
        goals: goals || null,
        onboardingCompleted: true,
      },
    })

    revalidatePath(ROUTES.STUDENT.ONBOARDING)
    revalidatePath(ROUTES.STUDENT.DASHBOARD)
    revalidatePath(ROUTES.STUDENT.PROFILE)

    return { success: true }
  } catch (error) {
    console.error('[completeStudentOnboardingAction] error', error)
    return { success: false, error: 'Falha ao salvar onboarding' }
  }
}
