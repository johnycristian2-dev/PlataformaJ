/**
 * Augmentação dos tipos do NextAuth / Auth.js v5
 * Adiciona campos customizados (id, role) ao token JWT e à sessão.
 */

import type { Role } from '@prisma/client'
import type { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
  }
}
