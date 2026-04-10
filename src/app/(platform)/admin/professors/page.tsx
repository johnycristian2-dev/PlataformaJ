import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { ProfessorProfile } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type ProfessorListItem = ProfessorProfile & {
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

  let professors: ProfessorListItem[] = []
  try {
    // Primeiro tenta sem include para debug
    const rawProfs = await prisma.professorProfile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
    })

    // Depois enricha com user data
    professors = await Promise.all(
      rawProfs.map(async (prof) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: prof.userId },
            select: {
              name: true,
              email: true,
              createdAt: true,
              isActive: true,
            },
          })
          return {
            ...prof,
            user: user || {
              name: null,
              email: 'N/A',
              createdAt: new Date(),
              isActive: false,
            },
          }
        } catch {
          return {
            ...prof,
            user: {
              name: null,
              email: 'N/A',
              createdAt: new Date(),
              isActive: false,
            },
          }
        }
      }),
    )
  } catch (error) {
    console.error('[AdminProfessorsPage] database error:', error)
    throw error
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
          {professors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum professor encontrado.
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

                {prof.applicationSubmittedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Candidatura enviada em{' '}
                    {formatDate(prof.applicationSubmittedAt)}
                  </p>
                )}

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Status:</span>{' '}
                    {prof.applicationStatus ??
                      (prof.isApproved ? 'APPROVED' : 'PENDING')}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Foco:</span>{' '}
                    {prof.focusArea ?? 'Não informado'}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Escolaridade:
                    </span>{' '}
                    {prof.educationLevel ?? 'Não informado'}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Contato:
                    </span>{' '}
                    {prof.contactPhone ?? prof.phone ?? prof.user.email}
                  </p>
                </div>

                {prof.rejectionReason && (
                  <p className="text-xs text-destructive mt-2">
                    Último motivo de rejeição: {prof.rejectionReason}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
