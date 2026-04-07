'use server'

import { revalidatePath } from 'next/cache'
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

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
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

async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
}) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Plataforma J'
  const subject = 'Redefinição de senha'

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 28px; color: #111; background: #f5f5f5;">
      <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
        <div style="padding: 18px 20px; background: linear-gradient(120deg, #7f1d1d, #dc2626); color: #fff;">
          <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.2px;">${appName}</h2>
        </div>
        <div style="padding: 22px 20px;">
          <p style="margin: 0 0 12px;">Recebemos uma solicitação para redefinir sua senha.</p>
          <p style="margin: 0 0 18px;">Use o botão abaixo para criar uma nova senha. Este link expira em 30 minutos.</p>
          <p style="margin: 0 0 18px;">
            <a href="${params.resetUrl}" style="display: inline-block; padding: 10px 16px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Redefinir senha
            </a>
          </p>
          <p style="margin: 0; font-size: 13px; color: #555;">Se você não solicitou esta alteração, ignore este e-mail.</p>
          <p style="margin: 12px 0 0; font-size: 12px; color: #777; word-break: break-all;">
            Link alternativo: ${params.resetUrl}
          </p>
        </div>
      </div>
    </div>
  `

  if (resendApiKey && from) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject,
          html,
        }),
      })

      if (response.ok) {
        return { success: true }
      }

      const text = await response.text()
      console.warn(
        '[sendPasswordResetEmail] Resend failed, trying SMTP fallback',
        `${response.status} ${text}`,
      )
    } catch (error) {
      console.warn(
        '[sendPasswordResetEmail] Resend exception, trying SMTP',
        error,
      )
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpPortRaw = process.env.SMTP_PORT?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpSecureRaw = process.env.SMTP_SECURE?.trim().toLowerCase()

  if (!from || !smtpHost || !smtpPortRaw || !smtpUser || !smtpPass) {
    return {
      success: false,
      error:
        'Nenhum provedor de e-mail configurado (Resend ou SMTP incompletos)',
    }
  }

  const smtpPort = Number(smtpPortRaw)
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    return { success: false, error: 'SMTP_PORT inválido' }
  }

  const smtpSecure =
    smtpSecureRaw === 'true' || smtpSecureRaw === '1' || smtpPort === 465

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      html,
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

async function sendAccountLockedEmail(params: {
  to: string
  retryAfterMinutes: number
}) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Plataforma J'
  const subject = `${appName} — Conta temporariamente bloqueada`

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 28px; color: #111; background: #f5f5f5;">
      <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
        <div style="padding: 18px 20px; background: linear-gradient(120deg, #7f1d1d, #dc2626); color: #fff;">
          <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.2px;">${appName}</h2>
        </div>
        <div style="padding: 22px 20px;">
          <p style="margin: 0 0 12px; font-weight: 600;">Sua conta foi temporariamente bloqueada.</p>
          <p style="margin: 0 0 12px;">Detectamos múltiplas tentativas malsucedidas nesta conta. Por segurança, novos acessos foram bloqueados por <strong>${params.retryAfterMinutes} minutos</strong>.</p>
          <p style="margin: 0 0 18px;">Após esse período, você poderá tentar novamente normalmente.</p>
          <p style="margin: 0; font-size: 13px; color: #555;"><strong>Se não foi você:</strong> recomendamos redefinir sua senha assim que possível.</p>
        </div>
      </div>
    </div>
  `

  if (resendApiKey && from) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [params.to], subject, html }),
      })
      if (response.ok) return
    } catch {
      // fall through to SMTP
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpPortRaw = process.env.SMTP_PORT?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpSecureRaw = process.env.SMTP_SECURE?.trim().toLowerCase()

  if (!from || !smtpHost || !smtpPortRaw || !smtpUser || !smtpPass) return

  const smtpPort = Number(smtpPortRaw)
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) return

  const smtpSecure =
    smtpSecureRaw === 'true' || smtpSecureRaw === '1' || smtpPort === 465

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    })
    await transporter.sendMail({ from, to: params.to, subject, html })
  } catch {
    // best-effort — silent fail
  }
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

    const user = await prisma.$transaction(async (tx) => {
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

      return createdUser
    })

    await signIn('credentials', {
      email: normalizedEmail,
      password,
      redirectTo: ROUTES.STUDENT.DASHBOARD,
    })

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
      },
    }
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
      void sendAccountLockedEmail({
        to: normalizedEmail,
        retryAfterMinutes: 15,
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
      void sendAccountLockedEmail({
        to: normalizedEmail,
        retryAfterMinutes: 30,
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

  const appUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  const emailResult = await sendPasswordResetEmail({
    to: normalizedEmail,
    resetUrl,
  })

  if (!emailResult.success) {
    console.warn('[forgotPasswordAction] email not sent', emailResult.error)
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
