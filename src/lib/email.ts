/**
 * lib/email.ts — Módulo central de envio de emails
 *
 * Estratégia de envio (em ordem de prioridade):
 *   1. Resend (API HTTP — preferido em produção)
 *   2. SMTP via Nodemailer (fallback para quem usa Gmail, Brevo, etc.)
 *   3. Ethereal (somente desenvolvimento, para testes locais)
 *
 * Variáveis de ambiente necessárias:
 *   EMAIL_FROM          — ex: "Plataforma J <noreply@seudominio.com>"
 *   RESEND_API_KEY      — se usar Resend
 *   SMTP_HOST           — se usar SMTP
 *   SMTP_PORT           — ex: 587 ou 465
 *   SMTP_USER           — usuário SMTP
 *   SMTP_PASS           — senha SMTP
 *   SMTP_SECURE         — "true" para porta 465
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type SendEmailParams = {
  to: string
  subject: string
  html: string
}

type SendEmailResult = { success: true } | { success: false; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: layout base com header colorido
// Todos os emails compartilham este visual para consistência de marca.
// ─────────────────────────────────────────────────────────────────────────────

export function emailLayout(content: string): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Plataforma J'
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;color:#111;background:#f5f5f5;">
      <div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <div style="padding:18px 20px;background:linear-gradient(120deg,#7f1d1d,#dc2626);color:#fff;">
          <h2 style="margin:0;font-size:20px;letter-spacing:0.2px;">${appName}</h2>
        </div>
        <div style="padding:22px 20px;">
          ${content}
        </div>
        <div style="padding:12px 20px;background:#f9f9f9;border-top:1px solid #e5e5e5;font-size:12px;color:#999;">
          Este é um email automático. Por favor, não responda diretamente.
        </div>
      </div>
    </div>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL: sendEmail
// Tenta Resend primeiro; se falhar ou não estiver configurado, tenta SMTP.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const isProduction = process.env.NODE_ENV === 'production'
  const from =
    process.env.EMAIL_FROM?.trim() ||
    (!isProduction ? 'Plataforma J <no-reply@plataforma-j.local>' : '')

  if (!from) {
    return { success: false, error: 'EMAIL_FROM não configurado' }
  }

  // ── Tentativa 1: Resend ───────────────────────────────────────────────────
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (resendApiKey) {
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
          subject: params.subject,
          html: params.html,
        }),
      })

      if (response.ok) return { success: true }

      const text = await response.text()
      console.warn(
        '[email] Resend falhou, tentando SMTP:',
        response.status,
        text,
      )
    } catch (err) {
      console.warn('[email] Resend exception, tentando SMTP:', err)
    }
  }

  // ── Tentativa 2: SMTP ─────────────────────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpPortRaw = process.env.SMTP_PORT?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpSecureRaw = process.env.SMTP_SECURE?.trim().toLowerCase()

  if (!smtpHost || !smtpPortRaw || !smtpUser || !smtpPass) {
    if (isProduction) {
      return {
        success: false,
        error: 'Nenhum provedor de email configurado (Resend ou SMTP)',
      }
    }

    // Fallback local para desenvolvimento: cria caixa de teste temporária.
    try {
      const nodemailer = await import('nodemailer')
      const testAccount = await nodemailer.createTestAccount()
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      })

      const info = await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      })

      const previewUrl = nodemailer.getTestMessageUrl(info)
      if (previewUrl) {
        console.info('[email] Preview URL (Ethereal):', previewUrl)
      }

      return { success: true }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? `Falha no fallback Ethereal: ${err.message}`
            : 'Falha no fallback Ethereal',
      }
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
      auth: { user: smtpUser, pass: smtpPass },
    })
    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido no SMTP',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES — cada função monta o HTML de um tipo de email
// ─────────────────────────────────────────────────────────────────────────────

export function buildVerifyEmailHtml(params: { verifyUrl: string }): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Plataforma J'
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá! Bem-vindo(a) à <strong>${appName}</strong>.</p>
    <p style="margin:0 0 18px;">Clique no botão abaixo para confirmar seu endereço de email. O link expira em <strong>24 horas</strong>.</p>
    <p style="margin:0 0 18px;">
      <a href="${params.verifyUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Confirmar meu email
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#555;">Se você não criou uma conta, ignore este email.</p>
    <p style="margin:12px 0 0;font-size:12px;color:#777;word-break:break-all;">Link alternativo: ${params.verifyUrl}</p>
  `)
}

export function buildPasswordResetHtml(params: { resetUrl: string }): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Recebemos uma solicitação para redefinir sua senha.</p>
    <p style="margin:0 0 18px;">Use o botão abaixo para criar uma nova senha. Este link expira em <strong>30 minutos</strong>.</p>
    <p style="margin:0 0 18px;">
      <a href="${params.resetUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Redefinir senha
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#555;">Se você não solicitou esta alteração, ignore este email.</p>
    <p style="margin:12px 0 0;font-size:12px;color:#777;word-break:break-all;">Link alternativo: ${params.resetUrl}</p>
  `)
}

export function buildAccountLockedHtml(params: {
  retryAfterMinutes: number
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;font-weight:600;">Sua conta foi temporariamente bloqueada.</p>
    <p style="margin:0 0 12px;">Detectamos múltiplas tentativas malsucedidas. Por segurança, novos acessos foram bloqueados por <strong>${params.retryAfterMinutes} minutos</strong>.</p>
    <p style="margin:0 0 18px;">Após esse período, você poderá tentar novamente normalmente.</p>
    <p style="margin:0;font-size:13px;color:#555;"><strong>Se não foi você:</strong> recomendamos redefinir sua senha assim que possível.</p>
  `)
}

export function buildSubscriptionCreatedHtml(params: {
  userName: string
  planName: string
  periodEnd: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá, <strong>${params.userName}</strong>! 🎉</p>
    <p style="margin:0 0 12px;">Sua assinatura do plano <strong>${params.planName}</strong> foi ativada com sucesso.</p>
    <p style="margin:0 0 18px;">Próxima renovação: <strong>${params.periodEnd}</strong>.</p>
    <p style="margin:0 0 18px;">
      <a href="/student/courses/catalog" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Explorar cursos
      </a>
    </p>
  `)
}

export function buildSubscriptionCanceledHtml(params: {
  userName: string
  planName: string
  accessUntil: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá, <strong>${params.userName}</strong>.</p>
    <p style="margin:0 0 12px;">Sua assinatura do plano <strong>${params.planName}</strong> foi cancelada.</p>
    <p style="margin:0 0 18px;">Você mantém acesso ao conteúdo até <strong>${params.accessUntil}</strong>.</p>
    <p style="margin:0;font-size:13px;color:#555;">Se mudar de ideia, você pode reativar a qualquer momento pela área de assinatura.</p>
  `)
}

export function buildPaymentFailedHtml(params: {
  userName: string
  planName: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá, <strong>${params.userName}</strong>.</p>
    <p style="margin:0 0 12px;font-weight:600;color:#dc2626;">Houve uma falha no pagamento da sua assinatura <strong>${params.planName}</strong>.</p>
    <p style="margin:0 0 18px;">Por favor, atualize seu método de pagamento para evitar a suspensão do acesso.</p>
    <p style="margin:0 0 18px;">
      <a href="/student/subscription" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Atualizar pagamento
      </a>
    </p>
  `)
}

export function buildEnrollmentHtml(params: {
  userName: string
  courseTitle: string
  courseUrl: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá, <strong>${params.userName}</strong>! 🎓</p>
    <p style="margin:0 0 18px;">Sua matrícula no curso <strong>${params.courseTitle}</strong> foi confirmada. Bons estudos!</p>
    <p style="margin:0 0 18px;">
      <a href="${params.courseUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Acessar curso
      </a>
    </p>
  `)
}

export function buildCertificateHtml(params: {
  userName: string
  courseTitle: string
  certificateUrl: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Parabéns, <strong>${params.userName}</strong>! 🏆</p>
    <p style="margin:0 0 18px;">Você concluiu o curso <strong>${params.courseTitle}</strong> e seu certificado está disponível.</p>
    <p style="margin:0 0 18px;">
      <a href="${params.certificateUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Ver meu certificado
      </a>
    </p>
  `)
}

export function buildSupportReplyHtml(params: {
  userName: string
  subject: string
  supportUrl: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá, <strong>${params.userName}</strong>.</p>
    <p style="margin:0 0 18px;">Há uma nova resposta no seu chamado de suporte: <strong>${params.subject}</strong>.</p>
    <p style="margin:0 0 18px;">
      <a href="${params.supportUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Ver resposta
      </a>
    </p>
  `)
}

export function buildSupportResolvedHtml(params: {
  userName: string
  subject: string
}): string {
  return emailLayout(`
    <p style="margin:0 0 12px;">Olá, <strong>${params.userName}</strong>.</p>
    <p style="margin:0 0 18px;">Seu chamado de suporte <strong>${params.subject}</strong> foi marcado como resolvido.</p>
    <p style="margin:0;font-size:13px;color:#555;">Se o problema persistir, abra um novo chamado a qualquer momento.</p>
  `)
}
