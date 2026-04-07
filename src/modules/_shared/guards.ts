import { auth } from '@/lib/auth'
import type { Role } from '@prisma/client'

type SessionUser = {
  id: string
  role: Role
  email?: string | null
  name?: string | null
}

export async function requireAuthUser(): Promise<SessionUser> {
  const session = await auth()

  if (!session?.user?.id || !session.user.role) {
    throw new Error('Não autenticado')
  }

  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
  }
}

export async function requireAdminUser(): Promise<SessionUser> {
  const user = await requireAuthUser()

  if (user.role !== 'ADMIN') {
    throw new Error('Sem permissão de administrador')
  }

  return user
}

export async function requireProfessorOrAdminUser(): Promise<SessionUser> {
  const user = await requireAuthUser()

  if (!['PROFESSOR', 'ADMIN'].includes(user.role)) {
    throw new Error('Sem permissão')
  }

  return user
}

export async function requireStudentOrAdminUser(): Promise<SessionUser> {
  const user = await requireAuthUser()

  if (!['STUDENT', 'ADMIN'].includes(user.role)) {
    throw new Error('Sem permissão')
  }

  return user
}
