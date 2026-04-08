'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clearRateLimit, consumeRateLimit } from '@/lib/rate-limit'
import { getRequestIpIdentifier } from '@/lib/request-ip'
import { recordAuthFailure, recordAuthSuccess } from '@/lib/auth-attempts'
import { auth, signIn, signOut } from '@/lib/auth'
import { ROUTES } from '@/lib/constants'
import {
  SignUpSchema,
  SignInSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type SignUpInput,
  type SignInInput,
  type ResetPasswordInput,
} from '@/lib/validations'
import { slugify, getDashboardRoute } from '@/lib/utils'
import {
  sendEmail,
  buildVerifyEmailHtml,
  buildPasswordResetHtml,
  buildAccountLockedHtml,
} from '@/lib/email'

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// Detecta a URL base da aplicação a partir dos headers da requisição.
// Usado para montar links em emails (evita hardcoded localhost).
async function getAppUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const headersList = await headers()
  const host =
    headersList.get('x-forwarded-host') ??
    headersList.get('host') ??
    'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

// Gera token de verificação de email, salva no banco e envia o email.
async function sendVerificationEmail(email: string) {
  const appUrl = await getAppUrl()
  const identifier = `email-verify:${email}`
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashResetToken(token)
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h

  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: { identifier, token: tokenHash, expires },
  })

  const verifyUrl = `${appUrl}/verify-email?token=${token}`
  return sendEmail({
    to: email,
    subject: 'Confirme seu email',
    html: buildVerifyEmailHtml({ verifyUrl }),
  })
}

function getPrismaConnectionMessage(
  error: Prisma.PrismaClientInitializationError,
) {
  const message = error.message ?? ''

  if (message.includes('Environment variable not found: DATABASE_URL')) {
    return 'DATABASE_URL não está definida no ambiente de produção (Vercel). Configure e faça novo deploy.'
  }

  if (message.includes('P1013')) {
    return 'DATABASE_URL inválida (P1013). Verifique formato postgresql:// e parâmetros SSL.'
  }

  if (message.includes('P1000')) {
    return 'Falha de autenticação no banco (P1000). Revise usuário/senha do DATABASE_URL.'
  }

  if (message.includes('P1001')) {
    return 'Não foi possível alcançar o servidor do banco (P1001). Verifique host, porta e rede.'
  }

  if (message.includes('P1002')) {
    return 'Tempo de conexão com o banco excedido (P1002). Verifique latência e limites do provedor.'
  }

  if (message.includes('P1003')) {
    return 'Banco informado no DATABASE_URL não existe (P1003). Verifique o nome do database.'
  }

  if (message.includes('P1010')) {
    return 'Acesso negado para este usuário no banco (P1010). Revise permissões e credenciais.'
  }

  if (message.includes('P1017')) {
    return 'A conexão com o banco foi encerrada (P1017). Tente novamente e revise o pool/concurrency.'
  }

  if (message.includes("Can't reach database server")) {
    return 'Não foi possível alcançar o banco. Verifique host/porta no DATABASE_URL e regras de rede.'
  }

  return 'Falha de conexão com o banco de dados. Verifique o DATABASE_URL e o Prisma.'
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────

export async function registerAction(input: SignUpInput) {
  try {
    const validated = SignUpSchema.safeParse(input)
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? 'Dados inválidos',
      }
    }

    const { name, email, password } = validated.data
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existing) {
      return {
        success: false,
        error: 'Já existe uma conta com este e-mail',
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: 'STUDENT',
        },
        select: {
          id: true,
          email: true,
        },
      })

      await tx.profile.upsert({
        where: { userId: createdUser.id },
        update: {},
        create: { userId: createdUser.id },
      })

      await tx.studentProfile.upsert({
        where: { userId: createdUser.id },
        update: {},
        create: {
          userId: createdUser.id,
          fitnessLevel: 'iniciante',
        },
      })
    })

    const verificationSendResult = await sendVerificationEmail(normalizedEmail)
    if (!verificationSendResult.success) {
      console.warn(
        '[registerAction] verification email not sent',
        verificationSendResult.error,
      )
    }

    // Redireciona para página de aviso — o usuário ainda não está logado
    const { redirect } = await import('next/navigation')
    redirect(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`)
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      typeof (error as { digest?: string }).digest === 'string' &&
      (error as { digest: string }).digest.includes('NEXT_REDIRECT')
    ) {
      throw error
    }

    console.error('[registerAction] error', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return {
          success: false,
          error: 'Já existe uma conta com este e-mail',
        }
      }

      if (error.code === 'P2021' || error.code === 'P2022') {
        return {
          success: false,
          error:
            'Banco sem schema atualizado. Execute Prisma DB Push/Migrate no banco de produção e faça novo deploy.',
        }
      }

      if (error.code === 'P2024') {
        return {
          success: false,
          error:
            'Tempo esgotado ao obter conexão do pool (P2024). Verifique limites de conexão do banco.',
        }
      }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return {
        success: false,
        error: getPrismaConnectionMessage(error),
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      const message = error.message ?? ''

      if (message.includes('Environment variable not found: DATABASE_URL')) {
        return {
          success: false,
          error:
            'DATABASE_URL não está definida no ambiente de produção (Vercel). Configure e faça novo deploy.',
        }
      }

      if (message.includes('the URL must start with the protocol')) {
        return {
          success: false,
          error:
            'DATABASE_URL inválida. Use postgresql:// (ou postgres://) e revise a string de conexão.',
        }
      }

      return {
        success: false,
        error:
          'Falha interna no Prisma Client. Rode prisma generate e faça novo deploy.',
      }
    }

    return {
      success: false,
      error: 'Não foi possível criar a conta. Tente novamente.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

export async function loginAction(
  input: SignInInput & { callbackUrl?: string },
) {
  const validated = SignInSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message ?? 'Credenciais inválidas',
    }
  }

  const normalizedEmail = validated.data.email.toLowerCase().trim()
  const clientIp = await getRequestIpIdentifier()
  const userForRedirect = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, role: true },
  })
  const userId = userForRedirect?.id ?? null

  if (clientIp) {
    const ipLimit = await consumeRateLimit({
      action: 'LOGIN_IP',
      identifier: clientIp,
      maxAttempts: 25,
      windowMs: 10 * 60 * 1000,
      blockMs: 15 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      await Promise.all([
        recordAuthFailure({
          action: 'LOGIN',
          channel: 'EMAIL',
          identifier: normalizedEmail,
          userId,
          errorCode: 'RATE_LIMIT_IP',
        }),
        recordAuthFailure({
          action: 'LOGIN',
          channel: 'IP',
          identifier: clientIp,
          userId,
          errorCode: 'RATE_LIMIT_IP',
        }),
      ])

      return {
        success: false,
        error: `Muitas tentativas de login. Tente novamente em ${ipLimit.retryAfterSeconds ?? 60}s.`,
      }
    }
  }

  const loginRateLimit = await consumeRateLimit({
    action: 'LOGIN',
    identifier: normalizedEmail,
    maxAttempts: 8,
    windowMs: 10 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  })

  if (!loginRateLimit.allowed) {
    await recordAuthFailure({
      action: 'LOGIN',
      channel: 'EMAIL',
      identifier: normalizedEmail,
      userId,
      errorCode: 'RATE_LIMIT_EMAIL',
    })

    if (clientIp) {
      await recordAuthFailure({
        action: 'LOGIN',
        channel: 'IP',
        identifier: clientIp,
        userId,
        errorCode: 'RATE_LIMIT_EMAIL',
      })
    }

    if (loginRateLimit.isNewBlock) {
      void sendEmail({
        to: normalizedEmail,
        subject: 'Conta temporariamente bloqueada',
        html: buildAccountLockedHtml({ retryAfterMinutes: 15 }),
      })
    }

    return {
      success: false,
      error: `Muitas tentativas de login. Tente novamente em ${loginRateLimit.retryAfterSeconds ?? 60}s.`,
    }
  }

  try {
    const safeCallback = input.callbackUrl?.startsWith('/')
      ? input.callbackUrl
      : null
    const redirectTo =
      safeCallback ??
      (userForRedirect
        ? getDashboardRoute(userForRedirect.role)
        : ROUTES.STUDENT.DASHBOARD)

    await signIn('credentials', {
      email: normalizedEmail,
      password: validated.data.password,
      redirectTo,
    })

    return { success: true }
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      typeof (error as { digest?: string }).digest === 'string' &&
      (error as { digest: string }).digest.includes('NEXT_REDIRECT')
    ) {
      await Promise.all([
        clearRateLimit('LOGIN', normalizedEmail),
        recordAuthSuccess({
          action: 'LOGIN',
          channel: 'EMAIL',
          identifier: normalizedEmail,
          userId,
        }),
        ...(clientIp
          ? [
              recordAuthSuccess({
                action: 'LOGIN',
                channel: 'IP',
                identifier: clientIp,
                userId,
              }),
            ]
          : []),
      ])
      throw error
    }

    await recordAuthFailure({
      action: 'LOGIN',
      channel: 'EMAIL',
      identifier: normalizedEmail,
      userId,
      errorCode: 'INVALID_CREDENTIALS',
    })

    if (clientIp) {
      await recordAuthFailure({
        action: 'LOGIN',
        channel: 'IP',
        identifier: clientIp,
        userId,
        errorCode: 'INVALID_CREDENTIALS',
      })
    }

    return {
      success: false,
      error: 'Email ou senha inválidos',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

export async function logoutAction() {
  await signOut({ redirectTo: ROUTES.HOME })
}

// ─────────────────────────────────────────────────────────────────────────────
// RECUPERAÇÃO DE SENHA
// ─────────────────────────────────────────────────────────────────────────────

export async function forgotPasswordAction(email: string) {
  const validated = ForgotPasswordSchema.safeParse({ email })
  if (!validated.success) {
    return { success: false, error: 'Email inválido' }
  }

  const normalizedEmail = validated.data.email.toLowerCase().trim()
  const clientIp = await getRequestIpIdentifier()

  if (clientIp) {
    const ipLimit = await consumeRateLimit({
      action: 'FORGOT_PASSWORD_IP',
      identifier: clientIp,
      maxAttempts: 12,
      windowMs: 30 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      void recordAuthFailure({
        action: 'FORGOT_PASSWORD',
        channel: 'IP',
        identifier: clientIp,
        userId: null,
        errorCode: 'RATE_LIMIT_IP',
      })
      return {
        success: false,
        error: `Limite de solicitações atingido. Tente novamente em ${ipLimit.retryAfterSeconds ?? 60}s.`,
      }
    }
  }

  const forgotRateLimit = await consumeRateLimit({
    action: 'FORGOT_PASSWORD',
    identifier: normalizedEmail,
    maxAttempts: 5,
    windowMs: 30 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  })

  if (!forgotRateLimit.allowed) {
    void recordAuthFailure({
      action: 'FORGOT_PASSWORD',
      channel: 'EMAIL',
      identifier: normalizedEmail,
      userId: null,
      errorCode: 'RATE_LIMIT_EMAIL',
    })
    if (forgotRateLimit.isNewBlock) {
      void sendEmail({
        to: normalizedEmail,
        subject: 'Conta temporariamente bloqueada',
        html: buildAccountLockedHtml({ retryAfterMinutes: 30 }),
      })
    }
    return {
      success: false,
      error: `Limite de solicitações atingido. Tente novamente em ${forgotRateLimit.retryAfterSeconds ?? 60}s.`,
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (!user) {
    return {
      success: true,
      message:
        'Se o e-mail existir, você receberá instruções para redefinir a senha.',
    }
  }

  const identifier = `password-reset:${normalizedEmail}`
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashResetToken(token)
  const expires = new Date(Date.now() + 1000 * 60 * 30)

  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires,
    },
  })

  const appUrl = await getAppUrl()
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: 'Redefinição de senha',
    html: buildPasswordResetHtml({ resetUrl }),
  })

  if (!emailResult.success) {
    console.warn('[forgotPasswordAction] email not sent', emailResult.error)

    void recordAuthFailure({
      action: 'FORGOT_PASSWORD',
      channel: 'EMAIL',
      identifier: normalizedEmail,
      userId: user.id,
      errorCode: 'EMAIL_DELIVERY_FAILED',
    })

    // Em produção mantemos resposta genérica para evitar enumeração de usuários.
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: false,
        error: `Falha no envio do e-mail: ${emailResult.error}`,
      }
    }

    return {
      success: true,
      message:
        'Se o e-mail existir, você receberá instruções para redefinir a senha.',
    }
  }

  void recordAuthSuccess({
    action: 'FORGOT_PASSWORD',
    channel: 'EMAIL',
    identifier: normalizedEmail,
    userId: user.id,
  })

  if (process.env.NODE_ENV !== 'production') {
    return {
      success: true,
      message: 'Link de redefinição gerado para ambiente local.',
      resetUrl,
    }
  }

  return {
    success: true,
    message:
      'Se o e-mail existir, você receberá instruções para redefinir a senha.',
  }
}

export async function resetPasswordAction(input: ResetPasswordInput) {
  const validated = ResetPasswordSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message ?? 'Dados inválidos',
    }
  }

  const tokenKey = validated.data.token.trim()
  const tokenHash = hashResetToken(tokenKey)
  const clientIp = await getRequestIpIdentifier()

  if (clientIp) {
    const ipLimit = await consumeRateLimit({
      action: 'RESET_PASSWORD_IP',
      identifier: clientIp,
      maxAttempts: 12,
      windowMs: 30 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      void recordAuthFailure({
        action: 'RESET_PASSWORD',
        channel: 'IP',
        identifier: clientIp,
        userId: null,
        errorCode: 'RATE_LIMIT_IP',
      })
      return {
        success: false,
        error: `Muitas tentativas. Tente novamente em ${ipLimit.retryAfterSeconds ?? 60}s.`,
      }
    }
  }

  const resetRateLimit = await consumeRateLimit({
    action: 'RESET_PASSWORD',
    identifier: tokenHash,
    maxAttempts: 6,
    windowMs: 30 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  })

  if (!resetRateLimit.allowed) {
    void recordAuthFailure({
      action: 'RESET_PASSWORD',
      channel: 'TOKEN',
      identifier: tokenHash,
      userId: null,
      errorCode: 'RATE_LIMIT_TOKEN',
    })
    return {
      success: false,
      error: `Muitas tentativas. Tente novamente em ${resetRateLimit.retryAfterSeconds ?? 60}s.`,
    }
  }

  const now = new Date()
  const recordByHash = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  })
  const record =
    recordByHash ??
    (await prisma.verificationToken.findUnique({
      where: { token: tokenKey },
    }))

  if (
    !record ||
    !record.identifier.startsWith('password-reset:') ||
    record.expires < now
  ) {
    void recordAuthFailure({
      action: 'RESET_PASSWORD',
      channel: 'TOKEN',
      identifier: tokenHash,
      userId: null,
      errorCode: 'INVALID_TOKEN',
    })
    return {
      success: false,
      error: 'Token inválido ou expirado',
    }
  }

  const email = record.identifier.replace('password-reset:', '').trim()
  if (!email) {
    void recordAuthFailure({
      action: 'RESET_PASSWORD',
      channel: 'TOKEN',
      identifier: tokenHash,
      userId: null,
      errorCode: 'INVALID_TOKEN',
    })
    return {
      success: false,
      error: 'Token inválido ou expirado',
    }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!user) {
    return {
      success: false,
      error: 'Token inválido ou expirado',
    }
  }

  const hashedPassword = await bcrypt.hash(validated.data.password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    await tx.verificationToken.deleteMany({
      where: { identifier: record.identifier },
    })
  })

  await clearRateLimit('RESET_PASSWORD', tokenHash)

  void recordAuthSuccess({
    action: 'RESET_PASSWORD',
    channel: 'TOKEN',
    identifier: email,
    userId: user.id,
  })

  return {
    success: true,
    message: 'Senha redefinida com sucesso. Faça login com a nova senha.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE BÁSICO
// ─────────────────────────────────────────────────────────────────────────────

export async function updateUserNameAction(name: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
    })

    revalidatePath('/student/dashboard')
    revalidatePath('/professor/dashboard')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('[updateUserNameAction] error', error)
    return {
      success: false,
      error: 'Não foi possível atualizar o nome',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: gerar slug único para cursos/plataforma
// ─────────────────────────────────────────────────────────────────────────────

export async function generateUniqueSlug(
  base: string,
  table: 'course' | 'professor',
) {
  const original = slugify(base)
  let slug = original
  let counter = 1

  while (true) {
    if (table === 'course') {
      const exists = await prisma.course.findUnique({
        where: { slug },
        select: { id: true },
      })
      if (!exists) break
    }

    if (table === 'professor') {
      const exists = await prisma.professorProfile.findUnique({
        where: { platformSlug: slug },
        select: { id: true },
      })
      if (!exists) break
    }

    slug = `${original}-${counter}`
    counter++
  }

  return slug
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICAÇÃO DE EMAIL
// ─────────────────────────────────────────────────────────────────────────────

// Chamado quando o usuário clica no link do email — valida o token e marca
// emailVerified no banco. Depois faz login automático e redireciona.
export async function verifyEmailAction(token: string) {
  if (!token?.trim()) {
    return { success: false, error: 'Token inválido' }
  }

  const tokenHash = hashResetToken(token.trim())
  const now = new Date()

  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  })

  if (
    !record ||
    !record.identifier.startsWith('email-verify:') ||
    record.expires < now
  ) {
    return { success: false, error: 'Link de verificação inválido ou expirado' }
  }

  const email = record.identifier.replace('email-verify:', '').trim()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true, emailVerified: true },
  })

  if (!user) {
    return { success: false, error: 'Usuário não encontrado' }
  }

  if (user.emailVerified) {
    // já verificado — apenas redireciona
    const { redirect } = await import('next/navigation')
    redirect(ROUTES.STUDENT.DASHBOARD)
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: now },
    })
    await tx.verificationToken.deleteMany({
      where: { identifier: record.identifier },
    })
  })

  // Login automático após verificação
  // Só é possível se o usuário tem senha (cadastro por credentials)
  if (user.password) {
    const { redirect } = await import('next/navigation')
    // Não temos a senha em texto aqui — redirecionamos para login com mensagem
    redirect(`${ROUTES.LOGIN}?verified=1`)
  }

  return { success: true }
}

// Reenvia o email de verificação (botão "reenviar" na página /verify-email)
export async function resendVerificationEmailAction(email: string) {
  const validated = ForgotPasswordSchema.safeParse({ email })
  if (!validated.success) {
    return { success: false, error: 'Email inválido' }
  }

  const normalizedEmail = validated.data.email.toLowerCase().trim()
  const clientIp = await getRequestIpIdentifier()

  if (clientIp) {
    const ipLimit = await consumeRateLimit({
      action: 'RESEND_VERIFY_EMAIL_IP',
      identifier: clientIp,
      maxAttempts: 10,
      windowMs: 30 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      return {
        success: false,
        error: `Muitas tentativas. Tente novamente em ${ipLimit.retryAfterSeconds ?? 60}s.`,
      }
    }
  }

  const resendLimit = await consumeRateLimit({
    action: 'RESEND_VERIFY_EMAIL',
    identifier: normalizedEmail,
    maxAttempts: 5,
    windowMs: 30 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  })

  if (!resendLimit.allowed) {
    return {
      success: false,
      error: `Muitas tentativas. Tente novamente em ${resendLimit.retryAfterSeconds ?? 60}s.`,
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerified: true },
  })

  // Resposta genérica — não revela se o email existe no banco (segurança)
  if (!user || user.emailVerified) {
    return {
      success: true,
      message:
        'Se o e-mail existir e não estiver verificado, você receberá um novo link.',
    }
  }

  const emailResult = await sendVerificationEmail(normalizedEmail)
  if (!emailResult.success) {
    return {
      success: false,
      error:
        'Não foi possível enviar o email agora. Tente novamente em instantes.',
    }
  }

  return {
    success: true,
    message:
      'Novo link de verificação enviado. Verifique sua caixa de entrada.',
  }
}
