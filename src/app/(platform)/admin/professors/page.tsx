import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setProfessorApprovalByAdminAction } from '@/modules/admin/actions'
import { formatDate } from '@/lib/utils'

type ProfessorListItem = {
  id: string
  isApproved: boolean
  createdAt: Date
  user: {
    name: string | null
    email: string
    createdAt: Date
    isActive: boolean
  }
}

export default async function AdminProfessorsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  async function handleApproval(formData: FormData) {
    'use server'
    await setProfessorApprovalByAdminAction(formData)
  }

  let professors: ProfessorListItem[] = []
  let loadError = false
  try {
    professors = await prisma.professorProfile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        isApproved: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
            createdAt: true,
            isActive: true,
          },
        },
      },
    })
  } catch (error) {
    console.error('[AdminProfessorsPage] database error:', error)
    loadError = true
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Professores
        </h1>
        <p className="text-muted-foreground mt-1">
          Baseline de gestão de professores da plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de professores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError && (
            <p className="text-sm text-destructive">
              Nao foi possivel carregar os professores agora. Tente novamente em alguns instantes.
            </p>
          )}

          {professors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {loadError
                ? 'Sem dados para exibir no momento.'
                : 'Nenhum professor encontrado.'}
            </p>
          ) : (
            professors.map((prof) => (
              <div
                key={prof.id}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {prof.user.name ?? prof.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {prof.user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={prof.isApproved ? 'success' : 'warning'}>
                      {prof.isApproved ? 'Aprovado' : 'Pendente'}
                    </Badge>
                    <Badge
                      variant={prof.user.isActive ? 'secondary' : 'destructive'}
                    >
                      {prof.user.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Criado em {formatDate(prof.user.createdAt)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!prof.isApproved && (
                    <form action={handleApproval}>
                      <input
                        type="hidden"
                        name="professorProfileId"
                        value={prof.id}
                      />
                      <input type="hidden" name="approved" value="true" />
                      <Button type="submit" size="sm">
                        Aprovar professor
                      </Button>
                    </form>
                  )}

                  {!prof.isApproved && (
                    <form
                      action={handleApproval}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="hidden"
                        name="professorProfileId"
                        value={prof.id}
                      />
                      <input type="hidden" name="approved" value="false" />
                      <input
                        type="text"
                        name="reason"
                        required
                        minLength={10}
                        placeholder="Motivo da rejeição (mínimo 10 caracteres)"
                        className="h-8 w-[280px] rounded-md border border-input bg-background px-2 text-xs"
                      />
                      <Button type="submit" size="sm" variant="destructive">
                        Rejeitar candidatura
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
