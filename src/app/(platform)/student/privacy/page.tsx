import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  Shield,
  Download,
  Trash2,
  Bell,
  Mail,
  Megaphone,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import {
  createDataRequestAction as _createDataRequestAction,
  updateCommunicationPreferencesAction as _updateCommPrefs,
} from '@/app/actions/privacy-actions'

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

// void wrappers for form action type compatibility
async function saveCommPrefs(formData: FormData): Promise<void> {
  'use server'
  await _updateCommPrefs(formData)
}
async function submitDataRequest(formData: FormData): Promise<void> {
  'use server'
  await _createDataRequestAction(formData)
}

export default async function StudentPrivacyPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  const [dataRequests, commPrefs] = await Promise.all([
    prisma.dataRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.communicationPreferences.findUnique({ where: { userId } }),
  ])

  const hasPendingExport = dataRequests.some(
    (r) => r.type === 'EXPORT' && ['PENDING', 'PROCESSING'].includes(r.status),
  )
  const hasPendingDelete = dataRequests.some(
    (r) => r.type === 'DELETE' && ['PENDING', 'PROCESSING'].includes(r.status),
  )

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Privacidade e Dados
          </h1>
        </div>
        <p className="text-zinc-400">
          Gerencie seus dados pessoais e preferências de comunicação conforme a
          LGPD.
        </p>
      </div>

      {/* Preferências de comunicação */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Bell className="h-4 w-4 text-amber-400" />
            Preferências de comunicação
          </CardTitle>
          <p className="text-sm text-zinc-400">
            Controle quais mensagens e alertas você deseja receber.
          </p>
        </CardHeader>
        <CardContent>
          <form action={saveCommPrefs} className="space-y-4">
            {[
              {
                name: 'receiveEmail',
                label: 'E-mails transacionais',
                description: 'Confirmações, recibos e alertas de conta',
                icon: <Mail className="h-4 w-4 text-blue-400" />,
                defaultChecked: commPrefs?.receiveEmail ?? true,
              },
              {
                name: 'receiveMarketing',
                label: 'E-mails de marketing',
                description: 'Novidades, promoções e conteúdos exclusivos',
                icon: <Megaphone className="h-4 w-4 text-purple-400" />,
                defaultChecked: commPrefs?.receiveMarketing ?? true,
              },
              {
                name: 'receiveProductAlerts',
                label: 'Alertas de produto',
                description: 'Novos cursos, lives e atualizações da plataforma',
                icon: <AlertCircle className="h-4 w-4 text-green-400" />,
                defaultChecked: commPrefs?.receiveProductAlerts ?? true,
              },
              {
                name: 'receiveReminders',
                label: 'Lembretes',
                description: 'Metas mensais, continuidade de cursos e treinos',
                icon: <Bell className="h-4 w-4 text-amber-400" />,
                defaultChecked: commPrefs?.receiveReminders ?? true,
              },
            ].map((item) => (
              <label
                key={item.name}
                className="flex items-start gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  name={item.name}
                  defaultChecked={item.defaultChecked}
                  className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-red-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-sm font-medium text-white">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </label>
            ))}

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Salvar preferências
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="bg-zinc-800" />

      {/* LGPD — Solicitação de dados */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Seus dados</h2>
          <p className="text-sm text-zinc-400">
            De acordo com a LGPD, você pode solicitar exportação ou exclusão dos
            seus dados.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Exportar */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Download className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Exportar meus dados
                  </p>
                  <p className="text-xs text-zinc-400">
                    Receba um arquivo com todos os seus dados
                  </p>
                </div>
              </div>

              {hasPendingExport ? (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 rounded-md px-3 py-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  Solicitação pendente em análise
                </div>
              ) : (
                <form action={submitDataRequest}>
                  <input type="hidden" name="type" value="EXPORT" />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Solicitar exportação
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Excluir */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Solicitar exclusão
                  </p>
                  <p className="text-xs text-zinc-400">
                    Solicite a remoção de todos os seus dados
                  </p>
                </div>
              </div>

              {hasPendingDelete ? (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 rounded-md px-3 py-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  Solicitação pendente em análise
                </div>
              ) : (
                <form action={submitDataRequest} className="space-y-2">
                  <input type="hidden" name="type" value="DELETE" />
                  <textarea
                    name="reason"
                    placeholder="Motivo (opcional)"
                    rows={2}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-red-500"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-red-800 text-red-400 hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Solicitar exclusão
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de solicitações */}
      {dataRequests.length > 0 && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">
              Histórico de solicitações
            </h2>
            <div className="space-y-2">
              {dataRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    {req.type === 'EXPORT' ? (
                      <Download className="h-4 w-4 text-green-400" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm text-white">
                        {req.type === 'EXPORT'
                          ? 'Exportação de dados'
                          : 'Exclusão de dados'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(req.createdAt)}
                        {req.adminNote && ` — ${req.adminNote}`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={STATUS_VARIANT[req.status] ?? 'secondary'}
                    className="flex items-center gap-1"
                  >
                    {STATUS_ICON[req.status]}
                    {STATUS_LABEL[req.status] ?? req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Informativo LGPD */}
      <Card className="bg-zinc-900/50 border-zinc-800/50">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Seus direitos pela LGPD
              </p>
              <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
                <li>Acesso: solicite uma cópia dos seus dados a qualquer momento</li>
                <li>Correção: atualize seus dados via perfil</li>
                <li>Exclusão: solicite a remoção dos seus dados pessoais</li>
                <li>Portabilidade: receba seus dados em formato estruturado</li>
                <li>
                  Dúvidas:{' '}
                  <a
                    href="mailto:privacidade@plataformaj.com"
                    className="text-blue-400 hover:underline"
                  >
                    privacidade@plataformaj.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
