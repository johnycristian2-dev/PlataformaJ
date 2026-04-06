'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { ThemeSettings } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { UpdateThemeSchema, type UpdateThemeInput } from '@/lib/validations'

export async function getCurrentThemeSettings(): Promise<ThemeSettings | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  return prisma.themeSettings.findUnique({
    where: { userId: session.user.id },
  })
}

export async function updateThemeSettingsAction(input: UpdateThemeInput) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Não autenticado' }
  }

  if (session.user.role !== 'PROFESSOR' && session.user.role !== 'ADMIN') {
    return { success: false, error: 'Sem permissão' }
  }

  const validated = UpdateThemeSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message ?? 'Dados inválidos',
    }
  }

  try {
    const theme = await prisma.themeSettings.upsert({
      where: { userId: session.user.id },
      update: validated.data,
      create: {
        userId: session.user.id,
        ...validated.data,
      },
    })

    revalidatePath('/professor/dashboard')
    revalidatePath('/')

    return { success: true, data: theme }
  } catch (error) {
    console.error('[updateThemeSettingsAction] error', error)
    return {
      success: false,
      error: 'Não foi possível salvar as configurações de tema',
    }
  }
}
