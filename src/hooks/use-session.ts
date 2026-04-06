'use client'

import { useSession as useNextSession } from 'next-auth/react'
import type { Role } from '@prisma/client'

/**
 * Hook personalizado que encapsula useSession do Next-Auth.
 * Fornece helpers de role para uso nos componentes cliente.
 */
export function useSession() {
  const session = useNextSession()

  const role: Role | null = (session.data?.user?.role as Role) ?? null
  const userId: string | null = session.data?.user?.id ?? null

  return {
    ...session,
    user: session.data?.user ?? null,
    userId,
    role,
    isAdmin: role === 'ADMIN',
    isProfessor: role === 'PROFESSOR' || role === 'ADMIN',
    isStudent: role === 'STUDENT',
    isLoading: session.status === 'loading',
    isLoggedIn: session.status === 'authenticated',
  }
}
