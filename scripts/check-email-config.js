#!/usr/bin/env node
/*
 * Valida configuracao de envio de email para producao.
 * Uso:
 *   node scripts/check-email-config.js
 */

const fs = require('fs')
const path = require('path')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const content = fs.readFileSync(filePath, 'utf8')
  const out = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const idx = line.indexOf('=')
    if (idx === -1) continue

    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    out[key] = value
  }

  return out
}

function loadConfig() {
  const cwd = process.cwd()
  const env = parseEnvFile(path.join(cwd, '.env'))
  const envLocal = parseEnvFile(path.join(cwd, '.env.local'))

  return {
    ...env,
    ...envLocal,
    ...process.env,
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidEmailFrom(value) {
  if (!hasValue(value)) return false
  return (
    /.+<[^@\s]+@[^@\s]+\.[^@\s]+>/.test(value) ||
    /[^@\s]+@[^@\s]+\.[^@\s]+/.test(value)
  )
}

function getEmailDomain(emailFrom) {
  if (!hasValue(emailFrom)) return ''

  const bracketMatch = emailFrom.match(/<([^>]+)>/)
  const email = bracketMatch ? bracketMatch[1] : emailFrom
  const parts = email.split('@')
  return parts.length === 2 ? parts[1].toLowerCase() : ''
}

function printResult(kind, label, details) {
  const detailsText = details ? ` - ${details}` : ''
  console.log(`[${kind}] ${label}${detailsText}`)
}

function main() {
  const cfg = loadConfig()
  const nodeEnv = (cfg.NODE_ENV || 'development').toLowerCase()
  const isProduction =
    process.argv.includes('--production') || nodeEnv === 'production'

  const appUrl = cfg.NEXT_PUBLIC_APP_URL || ''
  const emailFrom = cfg.EMAIL_FROM || ''
  const resendApiKey = cfg.RESEND_API_KEY || ''
  const smtpHost = cfg.SMTP_HOST || ''
  const smtpPort = cfg.SMTP_PORT || ''
  const smtpUser = cfg.SMTP_USER || ''
  const smtpPass = cfg.SMTP_PASS || ''

  const hasResend = hasValue(resendApiKey)
  const hasSmtp =
    hasValue(smtpHost) &&
    hasValue(smtpPort) &&
    hasValue(smtpUser) &&
    hasValue(smtpPass)

  const failures = []

  console.log('Email configuration check')
  console.log(`Environment: ${nodeEnv}`)

  if (!hasValue(appUrl)) {
    failures.push('NEXT_PUBLIC_APP_URL nao definida')
    printResult(
      'FAIL',
      'NEXT_PUBLIC_APP_URL',
      'defina a URL publica da aplicacao',
    )
  } else {
    const needsHttps = isProduction && !appUrl.startsWith('https://')
    if (needsHttps) {
      failures.push('NEXT_PUBLIC_APP_URL deve usar https em producao')
      printResult('FAIL', 'NEXT_PUBLIC_APP_URL', appUrl)
    } else {
      printResult('OK', 'NEXT_PUBLIC_APP_URL', appUrl)
    }
  }

  if (!isValidEmailFrom(emailFrom)) {
    if (isProduction) {
      failures.push('EMAIL_FROM invalido')
      printResult(
        'FAIL',
        'EMAIL_FROM',
        'use formato endereco@dominio.com ou Nome <endereco@dominio.com>',
      )
    } else {
      printResult(
        'WARN',
        'EMAIL_FROM',
        'nao configurado (em dev a app usa remetente local de fallback)',
      )
    }
  } else {
    printResult('OK', 'EMAIL_FROM', emailFrom)
  }

  if (!hasResend && !hasSmtp) {
    if (isProduction) {
      failures.push('nenhum provedor de email configurado')
      printResult(
        'FAIL',
        'Provider',
        'configure RESEND_API_KEY ou SMTP_* completo',
      )
    } else {
      printResult(
        'WARN',
        'Provider',
        'nao configurado (em dev usa fallback Ethereal)',
      )
    }
  } else {
    if (hasResend) {
      printResult('OK', 'Resend', 'RESEND_API_KEY presente')
    } else {
      printResult('WARN', 'Resend', 'nao configurado')
    }

    if (hasSmtp) {
      printResult('OK', 'SMTP', 'SMTP_HOST/PORT/USER/PASS presentes')
    } else {
      const partiallyConfigured =
        hasValue(smtpHost) ||
        hasValue(smtpPort) ||
        hasValue(smtpUser) ||
        hasValue(smtpPass)

      if (partiallyConfigured) {
        failures.push('SMTP parcialmente configurado')
        printResult('FAIL', 'SMTP', 'faltam campos para conexao completa')
      } else {
        printResult('WARN', 'SMTP', 'nao configurado')
      }
    }
  }

  if (hasValue(smtpPort)) {
    const parsedPort = Number(smtpPort)
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      failures.push('SMTP_PORT invalido')
      printResult('FAIL', 'SMTP_PORT', smtpPort)
    }
  }

  const domain = getEmailDomain(emailFrom)
  if (isProduction && domain.endsWith('.local')) {
    failures.push('EMAIL_FROM usa dominio local em producao')
    printResult('FAIL', 'EMAIL_FROM domain', domain)
  }

  if (isProduction && hasResend && hasValue(domain)) {
    printResult(
      'WARN',
      'Resend domain',
      `garanta que o dominio ${domain} esta verificado no Resend`,
    )
  }

  if (failures.length > 0) {
    console.log('')
    console.log('Configuration failed:')
    for (const item of failures) {
      console.log(`- ${item}`)
    }
    process.exit(1)
  }

  console.log('')
  console.log('Configuration looks good.')
}

main()
