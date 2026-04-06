import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hasActiveSubscription } from '@/lib/subscriptions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, Calendar, PlayCircle, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function StudentLivesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const activeSubscription = await hasActiveSubscription(session.user.id)

  const [upcomingLives, completedLives] = await Promise.all([
    prisma.liveSession.findMany({
      where: {
        status: 'SCHEDULED',
        ...(activeSubscription ? {} : { isPremium: false }),
      },
      include: {
        professor: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 8,
    }),
    prisma.liveSession.findMany({
      where: {
        isCompleted: true,
        ...(activeSubscription ? {} : { isPremium: false }),
      },
      include: {
        professor: { select: { name: true } },
        replays: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 8,
    }),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Lives
        </h1>
        <p className="text-muted-foreground mt-1">
          Próximas transmissões e gravações disponíveis.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold uppercase tracking-tight">
          Próximas lives
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingLives.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma live agendada.
              </CardContent>
            </Card>
          )}

          {upcomingLives.map((live) => (
            <Card key={live.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Video className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{live.title}</span>
                  </span>
                  <Badge variant={live.isPremium ? 'premium' : 'secondary'}>
                    {live.isPremium ? 'Premium' : 'Aberta'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {live.description || 'Sem descrição'}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(live.scheduledAt)}
                  </span>
                  <span>{live.professor.name}</span>
                  {live.platform && (
                    <Badge variant="outline">{live.platform}</Badge>
                  )}
                </div>

                {live.link && (
                  <a
                    href={live.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Entrar na transmissão
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold uppercase tracking-tight">
          Replays
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {completedLives.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma gravação disponível.
              </CardContent>
            </Card>
          )}

          {completedLives.map((live) => {
            const replay = live.replays[0]
            return (
              <Card key={live.id}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{live.title}</span>
                    </span>
                    <Badge variant={live.isPremium ? 'premium' : 'secondary'}>
                      {live.isPremium ? 'Premium' : 'Livre'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Professor: {live.professor.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Realizada em {formatDate(live.scheduledAt)}
                  </p>

                  {replay ? (
                    <a
                      href={replay.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Assistir replay
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Replay ainda não publicado.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
