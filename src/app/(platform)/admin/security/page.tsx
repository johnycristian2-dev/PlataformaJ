import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  resetAuthAttemptStatByAdminAction,
  runSecurityHousekeepingByAdminAction,
} from '@/app/actions/admin-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_IP: 'Login (IP)',
  FORGOT_PASSWORD: 'Recuperação de senha',
  FORGOT_PASSWORD_IP: 'Recuperação de senha (IP)',
  RESET_PASSWORD: 'Redefinição de senha',
  RESET_PASSWORD_IP: 'Redefinição de senha (IP)',
}

const ERROR_LABEL: Record<string, string> = {
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  RATE_LIMIT_EMAIL: 'Bloqueio por excesso de tentativas do e-mail',
  RATE_LIMIT_IP: 'Bloqueio por excesso de tentativas do IP',
  RATE_LIMIT_TOKEN: 'Bloqueio por excesso de tentativas do token',
  INVALID_TOKEN: 'Token inválido ou expirado',
}

function getAttemptSeverity(failedCount: number, lastFailureAt: Date | null) {
  const now = Date.now()
  const lastFailureTs = lastFailureAt ? new Date(lastFailureAt).getTime() : 0
  const isLast24h = now - lastFailureTs <= 24 * 60 * 60 * 1000

  if (failedCount >= 20 || (isLast24h && failedCount >= 12)) {
    return {
      label: 'Crítico',
      variant: 'destructive' as const,
    }
  }

  if (failedCount >= 10 || (isLast24h && failedCount >= 6)) {
    return {
      label: 'Alto',
      variant: 'warning' as const,
    }
  }

  return {
    label: 'Moderado',
    variant: 'secondary' as const,
  }
}

export default async function AdminSecurityPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  async function runHousekeeping(formData: FormData) {
    'use server'

    await runSecurityHousekeepingByAdminAction(formData)
  }

  async function resetAttempt(formData: FormData) {
    'use server'

    await resetAuthAttemptStatByAdminAction(formData)
  }

  const now = new Date()
  const staleRateLimitThreshold = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000,
  )
  const staleSubscriptionHistoryThreshold = new Date(
    now.getTime() - 120 * 24 * 60 * 60 * 1000,
  )

  const [
    blockedBuckets,
    recentChanges,
    staleRateLimitCount,
    staleHistoryCount,
    maintenanceRuns,
    authFailures,
    resetRuns,
  ] = await Promise.all([
    prisma.rateLimitBucket.findMany({
      where: {
        blockedUntil: { gt: new Date() },
      },
      orderBy: { blockedUntil: 'desc' },
      take: 30,
    }),
    prisma.subscriptionStatusChange.findMany({
      include: {
        subscription: {
          include: {
            user: { select: { name: true, email: true } },
            plan: { select: { name: true } },
          },
        },
        admin: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.rateLimitBucket.count({
      where: {
        updatedAt: { lt: staleRateLimitThreshold },
        OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
      },
    }),
    prisma.subscriptionStatusChange.count({
      where: {
        createdAt: { lt: staleSubscriptionHistoryThreshold },
      },
    }),
    prisma.securityMaintenanceRun.findMany({
      include: {
        admin: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.authAttemptStat.findMany({
      where: {
        failedCount: { gt: 0 },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: [{ lastFailureAt: 'desc' }, { failedCount: 'desc' }],
      take: 30,
    }),
    prisma.authAttemptResetRun.findMany({
      include: {
        admin: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const highRiskAttempts = authFailures.filter((attempt) => {
    const severity = getAttemptSeverity(
      attempt.failedCount,
      attempt.lastFailureAt ?? null,
    )
    return severity.label === 'Crítico' || severity.label === 'Alto'
  })

  const criticalAttemptsCount = highRiskAttempts.filter(
    (attempt) =>
      getAttemptSeverity(attempt.failedCount, attempt.lastFailureAt ?? null)
        .label === 'Crítico',
  ).length

  const highAttemptsCount = highRiskAttempts.length - criticalAttemptsCount

  const activeIpBlockCount = blockedBuckets.filter((bucket) =>
    bucket.action.endsWith('_IP'),
  ).length

  const activeEmailBlockCount = blockedBuckets.length - activeIpBlockCount

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Segurança
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitoramento de bloqueios de autenticação e alterações sensíveis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas de priorização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="destructive">
              Crítico: {criticalAttemptsCount}
            </Badge>
            <Badge variant="warning">Alto: {highAttemptsCount}</Badge>
            <Badge variant="secondary">
              Bloqueios IP ativos: {activeIpBlockCount}
            </Badge>
            <Badge variant="secondary">
              Bloqueios e-mail/token ativos: {activeEmailBlockCount}
            </Badge>
          </div>

          {highRiskAttempts.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Existem tentativas com risco elevado. Priorize os itens marcados
              como Crítico/Alto na seção de falhas de login.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem alertas de alta prioridade no momento.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Housekeeping de segurança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Limpa buckets antigos de rate limit e histórico antigo de mudanças
            de assinatura.
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">
              Buckets antigos: {staleRateLimitCount}
            </Badge>
            <Badge variant="secondary">
              Histórico antigo: {staleHistoryCount}
            </Badge>
          </div>

          <form
            action={runHousekeeping}
            className="flex flex-wrap items-center gap-2"
          >
            <label className="text-xs text-muted-foreground">
              Rate limit (dias)
            </label>
            <input
              type="number"
              name="keepRateLimitDays"
              min={1}
              max={365}
              defaultValue={14}
              className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
            />

            <label className="text-xs text-muted-foreground ml-2">
              Histórico (dias)
            </label>
            <input
              type="number"
              name="keepSubscriptionHistoryDays"
              min={7}
              max={730}
              defaultValue={120}
              className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
            />

            <Button type="submit" variant="secondary" size="sm">
              Executar limpeza
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Bloqueios ativos de rate limit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockedBuckets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum bloqueio ativo no momento.
              </p>
            ) : (
              blockedBuckets.map((bucket) => (
                <div
                  key={bucket.id}
                  className="rounded-xl border border-border bg-accent/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {ACTION_LABEL[bucket.action] ?? bucket.action}
                    </p>
                    <Badge variant="warning">Bloqueado</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 break-all">
                    Identificador: {bucket.identifier}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Tentativas: {bucket.hits} • até{' '}
                    {formatDateTime(bucket.blockedUntil ?? bucket.updatedAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mudanças recentes de assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma alteração registrada ainda.
              </p>
            ) : (
              recentChanges.map((change) => (
                <div
                  key={change.id}
                  className="rounded-xl border border-border bg-accent/20 p-4"
                >
                  <p className="text-sm font-semibold">
                    {change.subscription.user.name ??
                      change.subscription.user.email}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Plano: {change.subscription.plan.name}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    {change.fromStatus} → {change.toStatus}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Por: {change.admin.name ?? change.admin.email}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Em: {formatDateTime(change.createdAt)}
                  </p>

                  {change.reason && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Motivo: {change.reason}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execuções de housekeeping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {maintenanceRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma execução registrada ainda.
            </p>
          ) : (
            maintenanceRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <p className="text-sm font-semibold">
                  {run.admin.name ?? run.admin.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Retenção: {run.keepRateLimitDays}d (rate limit) •{' '}
                  {run.keepSubscriptionHistoryDays}d (assinaturas)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Removidos: {run.deletedRateLimitBuckets} buckets •{' '}
                  {run.deletedSubscriptionChanges} alterações
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Em: {formatDateTime(run.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tentativas de autenticação mal-sucedidas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {authFailures.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma falha de autenticação registrada no momento.
            </p>
          ) : (
            authFailures.map((attempt) =>
              (() => {
                const severity = getAttemptSeverity(
                  attempt.failedCount,
                  attempt.lastFailureAt ?? null,
                )

                return (
                  <div
                    key={attempt.id}
                    className="rounded-xl border border-border bg-accent/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {attempt.channel === 'EMAIL'
                          ? (attempt.user?.name ??
                            attempt.user?.email ??
                            attempt.identifier)
                          : attempt.identifier}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant={severity.variant}>
                          {severity.label}
                        </Badge>
                        <Badge variant="destructive">
                          {attempt.failedCount} falhas
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1">
                      Ação: {ACTION_LABEL[attempt.action] ?? attempt.action}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Canal:{' '}
                      {attempt.channel === 'EMAIL'
                        ? 'E-mail'
                        : attempt.channel === 'IP'
                          ? 'IP'
                          : 'Token'}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      Identificador: {attempt.identifier}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Último erro:{' '}
                      {ERROR_LABEL[attempt.lastError ?? ''] ??
                        attempt.lastError ??
                        'Não informado'}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Última falha:{' '}
                      {attempt.lastFailureAt
                        ? formatDateTime(attempt.lastFailureAt)
                        : 'N/A'}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Último sucesso:{' '}
                      {attempt.lastSuccessAt
                        ? formatDateTime(attempt.lastSuccessAt)
                        : 'N/A'}
                    </p>

                    <form action={resetAttempt} className="mt-3">
                      <input
                        type="hidden"
                        name="attemptId"
                        value={attempt.id}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Resetar contador
                      </Button>
                    </form>
                  </div>
                )
              })(),
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Histórico de resets manuais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resetRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum reset manual registrado ainda.
            </p>
          ) : (
            resetRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <p className="text-sm font-semibold">
                  {run.admin.name ?? run.admin.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Canal: {run.channel === 'EMAIL' ? 'E-mail' : 'IP'} • Ação:{' '}
                  {ACTION_LABEL[run.action] ?? run.action}
                </p>
                <p className="text-xs text-muted-foreground mt-1 break-all">
                  Identificador: {run.identifier}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Falhas antes do reset: {run.previousFailedCount}
                </p>
                {run.previousLastError && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Último erro antes do reset:{' '}
                    {ERROR_LABEL[run.previousLastError] ??
                      run.previousLastError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Em: {formatDateTime(run.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
