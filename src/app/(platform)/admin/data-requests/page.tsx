import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  FileText,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { processDataRequestAction as _processDataRequestAction } from '@/app/actions/privacy-actions'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Em processamento',
  COMPLETED: 'Concluída',
  DENIED: 'Negada',
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  PROCESSING: 'outline',
  COMPLETED: 'default',
  DENIED: 'destructive',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  PROCESSING: <Loader2 className="h-3 w-3" />,
  COMPLETED: <CheckCircle2 className="h-3 w-3" />,
  DENIED: <XCircle className="h-3 w-3" />,
}

// void-typed wrapper so <form action={...}> type-checks correctly
async function processDataRequest(formData: FormData): Promise<void> {
  'use server'
  await _processDataRequestAction(formData)
}

export default async function AdminDataRequestsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const requests = await prisma.dataRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      processedBy: { select: { name: true } },
    },
  })

  const pendingCount = requests.filter((r) =>
    ['PENDING', 'PROCESSING'].includes(r.status),
  ).length

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <FileText className="h-5 w-5 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Solicitações LGPD
          </h1>
        </div>
        <p className="text-zinc-400">
          Gerencie pedidos de exportação e exclusão de dados dos usuários.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          <Clock className="h-4 w-4 shrink-0" />
          {pendingCount} solicitaç{pendingCount === 1 ? 'ão' : 'ões'} pendente
          {pendingCount !== 1 ? 's' : ''} aguardando análise.
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base text-white">
            {requests.length} solicitaç{requests.length !== 1 ? 'ões' : 'ão'} registrada
            {requests.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500">
              Nenhuma solicitação ainda.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {requests.map((req) => (
                <div key={req.id} className="px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {req.type === 'EXPORT' ? (
                        <Download className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <Trash2 className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {req.type === 'EXPORT'
                              ? 'Exportação de dados'
                              : 'Exclusão de dados'}
                          </span>
                          <Badge
                            variant={STATUS_VARIANT[req.status] ?? 'secondary'}
                            className="flex items-center gap-1 text-xs"
                          >
                            {STATUS_ICON[req.status]}
                            {STATUS_LABEL[req.status] ?? req.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {req.user.name ?? req.user.email} — solicitado em{' '}
                          {formatDate(req.createdAt)}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-zinc-500 mt-1 italic">
                            &ldquo;{req.reason}&rdquo;
                          </p>
                        )}
                        {req.adminNote && (
                          <p className="text-xs text-zinc-400 mt-1">
                            Nota admin: {req.adminNote}
                          </p>
                        )}
                        {req.processedBy && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Processado por {req.processedBy.name} em{' '}
                            {req.processedAt ? formatDate(req.processedAt) : '—'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action form (only for pending/processing) */}
                    {['PENDING', 'PROCESSING'].includes(req.status) && (
                      <div className="shrink-0 flex flex-col gap-2 min-w-[180px]">
                        <form action={processDataRequest} className="space-y-2">
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <textarea
                            name="adminNote"
                            placeholder="Nota interna (opcional)"
                            rows={2}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-red-500"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              name="decision"
                              value="COMPLETED"
                              className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded-md px-2 py-1.5 transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Aprovar
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="DENIED"
                              className="flex-1 bg-zinc-700 hover:bg-red-800 text-white text-xs rounded-md px-2 py-1.5 transition-colors flex items-center justify-center gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              Negar
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
