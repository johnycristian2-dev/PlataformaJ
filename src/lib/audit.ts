import { Prisma } from '@prisma/client'
import type { AuditLogAction, Role } from '@prisma/client'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateAuditLogParams {
  actorId: string
  actorRole: Role
  action: AuditLogAction
  targetType: string
  targetId?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function getRequestContext() {
  try {
    const headersList = await headers()
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      null
    const userAgent = headersList.get('user-agent') ?? null
    return { ip, userAgent }
  } catch {
    return { ip: null, userAgent: null }
  }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Records a structured audit log entry.
 * Never throws — failures are silently logged so they can't break core flows.
 */
export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    const { ip, userAgent } = await getRequestContext()

    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        before: params.before
          ? (params.before as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        after: params.after
          ? (params.after as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ipAddress: ip,
        userAgent,
      },
    })
  } catch (err) {
    console.error('[createAuditLog] failed silently', err)
  }
}
