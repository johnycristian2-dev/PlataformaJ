import { prisma } from '@/lib/prisma'

type ConsumeRateLimitInput = {
  action: string
  identifier: string
  maxAttempts: number
  windowMs: number
  blockMs: number
}

type ConsumeRateLimitResult = {
  allowed: boolean
  retryAfterSeconds?: number
  isNewBlock?: boolean
}

function buildKey(action: string, identifier: string) {
  return `${action}:${identifier}`
}

export async function consumeRateLimit(
  input: ConsumeRateLimitInput,
): Promise<ConsumeRateLimitResult> {
  const now = new Date()
  const key = buildKey(input.action, input.identifier)

  const result = await prisma.$transaction(async (tx) => {
    const bucket = await tx.rateLimitBucket.findUnique({
      where: { key },
    })

    if (!bucket) {
      await tx.rateLimitBucket.create({
        data: {
          key,
          action: input.action,
          identifier: input.identifier,
          hits: 1,
          windowStart: now,
        },
      })
      return { allowed: true } satisfies ConsumeRateLimitResult
    }

    if (bucket.blockedUntil && bucket.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.blockedUntil.getTime() - now.getTime()) / 1000),
        ),
      } satisfies ConsumeRateLimitResult
    }

    const insideWindow =
      now.getTime() - bucket.windowStart.getTime() <= input.windowMs

    const nextHits = insideWindow ? bucket.hits + 1 : 1
    const nextWindowStart = insideWindow ? bucket.windowStart : now

    if (nextHits > input.maxAttempts) {
      const blockedUntil = new Date(now.getTime() + input.blockMs)

      await tx.rateLimitBucket.update({
        where: { key },
        data: {
          hits: nextHits,
          windowStart: nextWindowStart,
          blockedUntil,
        },
      })

      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000),
        ),
        isNewBlock: nextHits === input.maxAttempts + 1,
      } satisfies ConsumeRateLimitResult
    }

    await tx.rateLimitBucket.update({
      where: { key },
      data: {
        hits: nextHits,
        windowStart: nextWindowStart,
        blockedUntil: null,
      },
    })

    return { allowed: true } satisfies ConsumeRateLimitResult
  })

  return result
}

export async function clearRateLimit(action: string, identifier: string) {
  const key = buildKey(action, identifier)
  await prisma.rateLimitBucket.deleteMany({ where: { key } })
}
