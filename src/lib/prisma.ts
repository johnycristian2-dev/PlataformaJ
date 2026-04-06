import { Prisma, PrismaClient } from '@prisma/client'

// Previne múltiplas instâncias do Prisma Client em desenvolvimento (Next.js hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const enablePrismaQueryLogs = process.env.PRISMA_LOG_QUERIES === 'true'
const prismaLogLevels: Prisma.LogLevel[] = enablePrismaQueryLogs
  ? ['query', 'error', 'warn']
  : ['error']

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogLevels,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
