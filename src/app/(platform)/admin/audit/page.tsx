import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  ShieldCheck,
  User,
  BookOpen,
  CreditCard,
  Target,
  Download,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

const ACTION_LABEL: Record<string, string> = {
  USER_ROLE_CHANGED: 'Papel alterado',
  USER_DEACTIVATED: 'Usuário desativado',
  USER_REACTIVATED: 'Usuário reativado',
  USER_DELETED: 'Usuário excluído',
  SUBSCRIPTION_STATUS_CHANGED: 'Status de assinatura alterado',
  SUBSCRIPTION_PLAN_CHANGED: 'Plano alterado',
  SUBSCRIPTION_CANCELED: 'Assinatura cancelada',
  COURSE_CREATED: 'Curso criado',
  COURSE_UPDATED: 'Curso atualizado',
  COURSE_DELETED: 'Curso excluído',
  COURSE_PUBLISHED: 'Curso publicado',
  COURSE_UNPUBLISHED: 'Curso despublicado',
  STUDENT_GOAL_UPDATED: 'Meta do aluno definida',
  STUDENT_GOAL_CLEARED: 'Meta do aluno removida',
  PROFESSOR_APPROVED: 'Professor aprovado',
  PROFESSOR_REJECTED: 'Professor rejeitado',
  DATA_EXPORT_REQUESTED: 'Exportação solicitada',
  DATA_EXPORT_COMPLETED: 'Exportação concluída',
  DATA_DELETION_REQUESTED: 'Exclusão solicitada',
  DATA_DELETION_COMPLETED: 'Exclusão concluída',
  DATA_DELETION_DENIED: 'Solicitação negada',
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  USER_ROLE_CHANGED: <User className="h-4 w-4 text-blue-400" />,
  USER_DEACTIVATED: <User className="h-4 w-4 text-red-400" />,
  USER_REACTIVATED: <User className="h-4 w-4 text-green-400" />,
  USER_DELETED: <User className="h-4 w-4 text-red-500" />,
  SUBSCRIPTION_STATUS_CHANGED: <CreditCard className="h-4 w-4 text-amber-400" />,
  SUBSCRIPTION_PLAN_CHANGED: <CreditCard className="h-4 w-4 text-purple-400" />,
  SUBSCRIPTION_CANCELED: <CreditCard className="h-4 w-4 text-red-400" />,
  COURSE_CREATED: <BookOpen className="h-4 w-4 text-green-400" />,
  COURSE_UPDATED: <BookOpen className="h-4 w-4 text-blue-400" />,
  COURSE_DELETED: <BookOpen className="h-4 w-4 text-red-400" />,
  COURSE_PUBLISHED: <BookOpen className="h-4 w-4 text-green-400" />,
  COURSE_UNPUBLISHED: <BookOpen className="h-4 w-4 text-amber-400" />,
  STUDENT_GOAL_UPDATED: <Target className="h-4 w-4 text-amber-400" />,
  STUDENT_GOAL_CLEARED: <Target className="h-4 w-4 text-zinc-400" />,
  PROFESSOR_APPROVED: <ShieldCheck className="h-4 w-4 text-green-400" />,
  PROFESSOR_REJECTED: <ShieldCheck className="h-4 w-4 text-red-400" />,
  DATA_EXPORT_REQUESTED: <Download className="h-4 w-4 text-green-400" />,
  DATA_EXPORT_COMPLETED: <Download className="h-4 w-4 text-green-500" />,
  DATA_DELETION_REQUESTED: <Trash2 className="h-4 w-4 text-red-400" />,
  DATA_DELETION_COMPLETED: <Trash2 className="h-4 w-4 text-red-500" />,
  DATA_DELETION_DENIED: <Trash2 className="h-4 w-4 text-zinc-400" />,
}

const ROLE_BADGE: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  ADMIN: 'destructive',
  PROFESSOR: 'default',
  STUDENT: 'secondary',
}

export default async function AdminAuditPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      actor: { select: { name: true, email: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <ShieldCheck className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Log de Auditoria</h1>
        </div>
        <p className="text-zinc-400">
          Rastreamento de ações críticas realizadas na plataforma (últimas 100).
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {logs.length} registro{logs.length !== 1 ? 's' : ''} encontrado
            {logs.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500">
              Nenhuma ação auditada ainda.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {logs.map((log) => {
                const before =
                  log.before && typeof log.before === 'object'
                    ? (log.before as Record<string, unknown>)
                    : null
                const after =
                  log.after && typeof log.after === 'object'
                    ? (log.after as Record<string, unknown>)
                    : null

                return (
                  <div
                    key={log.id}
                    className="px-5 py-4 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {ACTION_ICON[log.action] ?? (
                            <ShieldCheck className="h-4 w-4 text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">
                              {ACTION_LABEL[log.action] ?? log.action}
                            </span>
                            <Badge
                              variant={
                                ROLE_BADGE[log.actorRole] ?? 'secondary'
                              }
                              className="text-xs"
                            >
                              {log.actorRole}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Por{' '}
                            <span className="text-zinc-300">
                              {log.actor.name ?? log.actor.email}
                            </span>
                            {log.targetType && (
                              <>
                                {' '}
                                →{' '}
                                <span className="text-zinc-300">
                                  {log.targetType}
                                </span>
                                {log.targetId && (
                                  <span className="text-zinc-500 font-mono text-[10px] ml-1">
                                    {log.targetId.slice(0, 12)}…
                                  </span>
                                )}
                              </>
                            )}
                          </p>

                          {/* Before / After */}
                          {(before || after) && (
                            <div className="mt-2 flex gap-3 text-xs flex-wrap">
                              {before && (
                                <span className="text-zinc-400 bg-zinc-800 rounded px-2 py-0.5">
                                  antes:{' '}
                                  <span className="text-zinc-300 font-mono">
                                    {JSON.stringify(before)}
                                  </span>
                                </span>
                              )}
                              {after && (
                                <span className="text-zinc-400 bg-zinc-800 rounded px-2 py-0.5">
                                  depois:{' '}
                                  <span className="text-zinc-300 font-mono">
                                    {JSON.stringify(after)}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* IP */}
                          {log.ipAddress && (
                            <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                              IP: {log.ipAddress}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
