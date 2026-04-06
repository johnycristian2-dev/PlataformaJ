import { prisma } from '@/lib/prisma'

type AttemptChannel = 'EMAIL' | 'IP' | 'TOKEN'

type RecordAttemptInput = {
  action: string
  channel: AttemptChannel
  identifier: string
  userId?: string | null
}

type RecordFailureInput = RecordAttemptInput & {
  errorCode: string
}

export async function recordAuthFailure(input: RecordFailureInput) {
  const now = new Date()

  await prisma.authAttemptStat.upsert({
    where: {
      action_channel_identifier: {
        action: input.action,
        channel: input.channel,
        identifier: input.identifier,
      },
    },
    create: {
      action: input.action,
      channel: input.channel,
      identifier: input.identifier,
      userId: input.userId ?? null,
      failedCount: 1,
      lastError: input.errorCode,
      lastAttemptAt: now,
      lastFailureAt: now,
    },
    update: {
      failedCount: { increment: 1 },
      lastError: input.errorCode,
      lastAttemptAt: now,
      lastFailureAt: now,
      userId: input.userId ?? undefined,
    },
  })
}

export async function recordAuthSuccess(input: RecordAttemptInput) {
  const now = new Date()

  await prisma.authAttemptStat.upsert({
    where: {
      action_channel_identifier: {
        action: input.action,
        channel: input.channel,
        identifier: input.identifier,
      },
    },
    create: {
      action: input.action,
      channel: input.channel,
      identifier: input.identifier,
      userId: input.userId ?? null,
      failedCount: 0,
      successCount: 1,
      lastError: null,
      lastAttemptAt: now,
      lastSuccessAt: now,
    },
    update: {
      failedCount: 0,
      successCount: { increment: 1 },
      lastError: null,
      lastAttemptAt: now,
      lastSuccessAt: now,
      userId: input.userId ?? undefined,
    },
  })
}
