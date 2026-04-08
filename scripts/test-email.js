#!/usr/bin/env node
/**
 * Script de teste — dispara um email usando a mesma estrategia da app
 * Use: node scripts/test-email.js seu@email.com
 */

const https = require('https')
const nodemailer = require('nodemailer')

const testEmail = process.argv[2] || 'jotaxitado2@gmail.com'
const resendApiKey = process.env.RESEND_API_KEY
const isProduction = process.env.NODE_ENV === 'production'
const emailFrom =
  process.env.EMAIL_FROM ||
  (!isProduction ? 'Plataforma J <no-reply@plataforma-j.local>' : '')
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!emailFrom) {
  console.error('❌ EMAIL_FROM não definida')
  process.exit(1)
}

const payload = JSON.stringify({
  from: emailFrom,
  to: [testEmail],
  subject: '[TESTE] Redefinição de senha',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Teste de Email</h2>
      <p>Este é um email de teste do Resend.</p>
      <p>Se você recebeu, o sistema de email está funcionando! ✅</p>
      <p><small>RESEND_API_KEY: ${resendApiKey ? `${resendApiKey.slice(0, 10)}...` : 'não configurada'}</small></p>
      <p><small>EMAIL_FROM: ${emailFrom}</small></p>
      <p><small>APP_URL: ${appUrl}</small></p>
    </div>
  `,
})

function sendViaResend() {
  return new Promise((resolve, reject) => {
    if (!resendApiKey) {
      resolve(false)
      return
    }

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Email enviado com Resend!')
          try {
            const json = JSON.parse(data)
            console.log(`ID: ${json.id}`)
          } catch (_) {}
          resolve(true)
          return
        }

        console.warn('⚠️ Resend falhou, tentando SMTP/Ethereal...')
        try {
          const json = JSON.parse(data)
          console.warn(json)
        } catch (_) {
          console.warn(data)
        }
        resolve(false)
      })
    })

    req.on('error', (error) => {
      console.warn(
        '⚠️ Resend exception, tentando SMTP/Ethereal:',
        error.message,
      )
      resolve(false)
    })

    req.write(payload)
    req.end()
  })
}

async function sendViaSmtpOrEthereal() {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || '587')
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpSecure =
    (process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: emailFrom,
      to: testEmail,
      subject: '[TESTE] Redefinição de senha',
      html: JSON.parse(payload).html,
    })

    console.log('✅ Email enviado com SMTP!')
    return
  }

  if (isProduction) {
    throw new Error('Nenhum provedor configurado em produção (Resend/SMTP)')
  }

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
    from: emailFrom,
    to: testEmail,
    subject: '[TESTE] Redefinição de senha',
    html: JSON.parse(payload).html,
  })

  console.log('✅ Email enviado com Ethereal (desenvolvimento)!')
  console.log(`🔎 Preview URL: ${nodemailer.getTestMessageUrl(info)}`)
}

console.log(`📧 Enviando teste para: ${testEmail}`)
console.log(`📨 De: ${emailFrom}`)
console.log(`🌐 APP_URL: ${appUrl}`)
;(async () => {
  try {
    const sentWithResend = await sendViaResend()
    if (!sentWithResend) {
      await sendViaSmtpOrEthereal()
    }
  } catch (error) {
    console.error('❌ Erro ao enviar email de teste:')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
})()
