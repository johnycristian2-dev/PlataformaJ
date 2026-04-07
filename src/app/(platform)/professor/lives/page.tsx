import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createProfessorLiveAction } from '@/modules/professor/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, Calendar, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 12

const getProfessorLivesPage = unstable_cache(
  async (professorId: string, page: number) => {
    const skip = (page - 1) * PAGE_SIZE

    const [lives, total] = await Promise.all([
      prisma.liveSession.findMany({
        where: { professorId },
        include: { replays: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.liveSession.count({ where: { professorId } }),
    ])

    return { lives, total }
  },
  ['professor-lives-page'],
  { revalidate: 30 },
)

interface ProfessorLivesPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ProfessorLivesPage({
  searchParams,
}: ProfessorLivesPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)

  const { lives, total } = await getProfessorLivesPage(session.user.id, page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function submitLiveCreate(formData: FormData) {
    'use server'

    await createProfessorLiveAction(formData)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Lives
        </h1>
        <p className="text-muted-foreground mt-1">
          Agende lives e publique conteúdos para os alunos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendar live</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={submitLiveCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <input
              name="title"
              placeholder="Título da live"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
            />
            <input
              name="scheduledAt"
              type="datetime-local"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
            />
            <input
              name="duration"
              type="number"
              min={1}
              placeholder="Duração (min)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="platform"
              placeholder="Plataforma (Zoom, Meet, etc)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="link"
              placeholder="Link da transmissão"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="thumbnail"
              placeholder="Thumbnail URL"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <textarea
              name="description"
              rows={3}
              placeholder="Descrição"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="isRecurring" className="rounded" />
              Tornar recorrente (semanal)
            </label>
            <input
              name="repeatWeeks"
              type="number"
              min={1}
              max={16}
              defaultValue={8}
              placeholder="Repetir por quantas semanas"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
              <input type="checkbox" name="isPremium" className="rounded" />
              Live exclusiva para premium
            </label>
            <p className="md:col-span-2 text-xs text-muted-foreground">
              Exemplo: terça 19h por 8 semanas gera automaticamente 8 ocorrências.
            </p>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Agendar live
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {lives.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhuma live criada ainda.
            </CardContent>
          </Card>
        )}

        {lives.map((live) => (
          <Card key={live.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="truncate">{live.title}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{live.status}</Badge>
                  {live.isPremium ? (
                    <Badge variant="premium">Premium</Badge>
                  ) : null}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(live.scheduledAt)}
              </p>
              {live.link ? (
                <a
                  href={live.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir link da live
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
              {live.replays[0]?.videoUrl ? (
                <a
                  href={live.replays[0].videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir replay
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </CardContent>
          </Card>
        ))}

        <div className="pt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`?page=${Math.max(1, page - 1)}`}
              className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
            >
              Anterior
            </Link>
            <Link
              href={`?page=${Math.min(totalPages, page + 1)}`}
              className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
            >
              Próxima
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
