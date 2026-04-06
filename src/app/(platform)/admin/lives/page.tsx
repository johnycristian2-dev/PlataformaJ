import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function AdminLivesPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const lives = await prisma.liveSession.findMany({
    include: {
      professor: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: { select: { replays: true } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 100,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Lives
        </h1>
        <p className="text-muted-foreground mt-1">
          Baseline de monitoramento das lives da plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de lives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma live encontrada.
            </p>
          ) : (
            lives.map((live) => (
              <div
                key={live.id}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <p className="text-sm font-semibold">{live.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {live.professor.name ?? live.professor.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{live.status}</Badge>
                    {live.isPremium && <Badge variant="premium">Premium</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDate(live.scheduledAt)} • {live._count.replays} replays
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
