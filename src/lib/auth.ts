import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { SignInSchema } from '@/lib/validations'
import type { Role } from '@prisma/client'

const authDebugEnabled =
  process.env.NODE_ENV !== 'production' && process.env.AUTH_DEBUG === 'true'

function maskEmail(email?: string | null) {
  if (!email) return 'unknown'
  const [local, domain] = email.split('@')
  if (!local || !domain) return 'invalid-email'

  const safeLocal =
    local.length <= 2 ? `${local[0] ?? '*'}*` : `${local.slice(0, 2)}***`

  return `${safeLocal}@${domain}`
}

const trustHostEnabled = process.env.AUTH_TRUST_HOST === 'true'

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // JWT strategy permite usar Credentials provider + middleware funcionar
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        // 1. Valida o formato dos dados recebidos
        const validated = SignInSchema.safeParse(credentials)
        if (!validated.success) return null

        const { email, password } = validated.data

        // 2. Busca o usuário no banco
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            password: true,
            isActive: true,
          },
        })

        // 3. Validações de segurança
        if (!user) return null
        if (!user.password) return null // login via OAuth não tem senha
        if (!user.isActive) return null // conta desativada

        // 4. Compara a senha com o hash
        const passwordsMatch = await bcrypt.compare(password, user.password)
        if (!passwordsMatch) return null

        // 5. Retorna objeto seguro (sem a senha!)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    /**
     * jwt(): Executado quando o token é criado/atualizado.
     * Aqui adicionamos campos customizados ao token JWT.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as { id: string; role: Role }).role
      }
      return token
    },

    /**
     * session(): Executado quando a sessão é acessada no cliente.
     * Expõe os campos do token para a sessão.
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },

  // Eventos úteis para debug e auditoria
  events: {
    async signIn({ user }) {
      if (authDebugEnabled) {
        console.log(`[Auth] Login: ${maskEmail(user.email)} (${user.role})`)
      }
    },
    async signOut() {
      if (authDebugEnabled) {
        console.log(`[Auth] Logout`)
      }
    },
  },

  trustHost: trustHostEnabled,
  debug: authDebugEnabled,
})
