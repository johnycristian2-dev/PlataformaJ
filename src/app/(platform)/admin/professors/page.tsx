import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function AdminProfessorsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const professors = await prisma.professorProfile.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
          createdAt: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  })

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
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
