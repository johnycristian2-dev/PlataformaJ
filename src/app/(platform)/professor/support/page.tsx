import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  createSupportConversationAction,
  sendSupportMessageAction,
  updateSupportConversationStatusAction,
} from '@/modules/support/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  WAITING_USER: 'Aguardando você',
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

export default async function ProfessorSupportPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  if (!['PROFESSOR', 'ADMIN'].includes(session.user.role)) {
    redirect('/student/dashboard')
  }

  async function createConversation(formData: FormData) {
    'use server'

    await createSupportConversationAction(formData)
  }

  async function sendMessage(formData: FormData) {
    'use server'

    await sendSupportMessageAction(formData)
  }

  async function updateStatus(formData: FormData) {
    'use server'

    await updateSupportConversationStatusAction(formData)
  }

  const conversations = await prisma.supportConversation.findMany({
    where: { userId: session.user.id },
    include: {
      messages: {
        include: {
          sender: {
            select: { name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 30,
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Suporte
        </h1>
        <p className="text-muted-foreground mt-1">
          Abra chamados e acompanhe as respostas da equipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo chamado</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createConversation} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
              <input
                name="subject"
                required
                minLength={5}
                maxLength={140}
                placeholder="Assunto do chamado"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <select
                name="category"
                defaultValue="OTHER"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="BILLING">Cobrança</option>
                <option value="ACCESS">Acesso</option>
                <option value="COURSE">Curso</option>
                <option value="TECHNICAL">Técnico</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>

            <textarea
              name="content"
              required
              minLength={8}
              rows={4}
              placeholder="Descreva seu problema com detalhes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />

            <Button type="submit" size="sm">
              Abrir chamado
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Você ainda não possui chamados de suporte.
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

                <div className="space-y-2 rounded-md border border-border bg-background/50 p-3 max-h-72 overflow-y-auto">
                  {conversation.messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sem mensagens.
                    </p>
                  ) : (
                    conversation.messages.map((message) => (
                      <div key={message.id} className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {message.sender.role === 'ADMIN'
                            ? `Suporte · ${message.sender.name ?? message.sender.email}`
                            : 'Você'}{' '}
                          · {formatDateTime(message.createdAt)}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form action={sendMessage} className="flex flex-col gap-2">
                  <input
                    type="hidden"
                    name="conversationId"
                    value={conversation.id}
                  />
                  <textarea
                    name="content"
                    required
                    rows={3}
                    placeholder="Escreva sua mensagem"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" variant="secondary">
                      Enviar resposta
                    </Button>
                  </div>
                </form>

                {conversation.status === 'RESOLVED' && (
                  <form action={updateStatus}>
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversation.id}
                    />
                    <input type="hidden" name="status" value="OPEN" />
                    <Button type="submit" size="sm">
                      Reabrir chamado
                    </Button>
                  </form>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
