import { headers } from 'next/headers'

function normalizeIp(raw: string | null) {
  if (!raw) return null

  const first = raw.split(',')[0]?.trim()
  if (!first) return null

  const sanitized = first.slice(0, 100)
  if (!/^[a-fA-F0-9:.]+$/.test(sanitized)) {
    return null
  }

  return sanitized
}

export async function getRequestIpIdentifier() {
  const hdrs = await headers()

  return (
    normalizeIp(hdrs.get('x-forwarded-for')) ??
    normalizeIp(hdrs.get('x-real-ip')) ??
    normalizeIp(hdrs.get('cf-connecting-ip')) ??
    normalizeIp(hdrs.get('x-vercel-forwarded-for'))
  )
}
