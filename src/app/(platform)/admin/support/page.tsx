import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  sendSupportMessageAction,
  updateSupportConversationStatusAction,
} from '@/app/actions/support-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  WAITING_USER: 'Aguardando usuário',
  RESOLVED: 'Resolvido',
}

const STATUS_VARIANT: Record<string, 'warning' | 'secondary' | 'success'> = {
  OPEN: 'warning',
  WAITING_USER: 'secondary',
  RESOLVED: 'success',
}

const CATEGORY_LABEL: Record<string, string> = {
  BILLING: 'Cobrança',
  ACCESS: 'Acesso',
  COURSE: 'Curso',
  TECHNICAL: 'Técnico',
  OTHER: 'Outro',
}

interface AdminSupportPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminSupportPage({
  searchParams,
}: AdminSupportPageProps) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const params = await searchParams
  const statusFilter = String(params.status || 'ALL').trim()

  async function sendMessage(formData: FormData) {
    'use server'

    await sendSupportMessageAction(formData)
  }

  async function updateStatus(formData: FormData) {
    'use server'

    await updateSupportConversationStatusAction(formData)
  }

  const conversations = await prisma.supportConversation.findMany({
    where:
      statusFilter === 'ALL'
        ? undefined
        : { status: statusFilter as 'OPEN' | 'WAITING_USER' | 'RESOLVED' },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
      messages: {
        include: {
          sender: {
            select: { name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 40,
      },
    },
    orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
    take: 80,
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Suporte
        </h1>
        <p className="text-muted-foreground mt-1">
          Central de atendimento para responder chamados de alunos e
          professores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex items-center gap-2" method="get">
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ALL">Todos</option>
              <option value="OPEN">Aberto</option>
              <option value="WAITING_USER">Aguardando usuário</option>
              <option value="RESOLVED">Resolvido</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Aplicar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chamados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum chamado encontrado para esse filtro.
            </p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="rounded-xl border border-border bg-accent/20 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {conversation.subject}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conversation.user.name ?? conversation.user.email} ·{' '}
                      {conversation.user.role}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Categoria:{' '}
                      {CATEGORY_LABEL[conversation.category] ??
                        conversation.category}
                    </p>
                  </div>

                  <Badge
                    variant={STATUS_VARIANT[conversation.status] ?? 'secondary'}
                  >
                    {STATUS_LABEL[conversation.status] ?? conversation.status}
                  </Badge>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-background/50 p-3 max-h-80 overflow-y-auto">
                  {conversation.messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sem mensagens.
                    </p>
                  ) : (
                    conversation.messages.map((message) => (
                      <div key={message.id} className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {message.sender.name ?? message.sender.email} ·{' '}
                          {formatDateTime(message.createdAt)}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form action={sendMessage} className="space-y-2">
                  <input
                    type="hidden"
                    name="conversationId"
                    value={conversation.id}
                  />
                  <textarea
                    name="content"
                    required
                    rows={3}
                    placeholder="Responder chamado"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    Enviar resposta
                  </Button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateStatus}>
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversation.id}
                    />
                    <input type="hidden" name="status" value="RESOLVED" />
                    <Button type="submit" size="sm" variant="secondary">
                      Marcar como resolvido
                    </Button>
                  </form>

                  <form action={updateStatus}>
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversation.id}
                    />
                    <input type="hidden" name="status" value="OPEN" />
                    <Button type="submit" size="sm" variant="outline">
                      Reabrir
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
