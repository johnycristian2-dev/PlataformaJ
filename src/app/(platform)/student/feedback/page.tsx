import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, UserCircle, Calendar, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const FEEDBACK_LABELS: Record<string, string> = {
  GENERAL: 'Geral',
  TECHNIQUE: 'Técnica',
  PERFORMANCE: 'Performance',
  NUTRITION: 'Nutrição',
  BEHAVIOR: 'Comportamento',
}

const PAGE_SIZE = 10

const getStudentFeedbackPage = unstable_cache(
  async (studentId: string, page: number) => {
    const skip = (page - 1) * PAGE_SIZE

    const [feedbacks, total] = await Promise.all([
      prisma.teacherFeedback.findMany({
        where: { studentId },
        include: {
          teacher: { select: { name: true, email: true } },
          training: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.teacherFeedback.count({ where: { studentId } }),
    ])

    return { feedbacks, total }
  },
  ['student-feedback-page'],
  { revalidate: 30 },
)

interface StudentFeedbackPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function StudentFeedbackPage({
  searchParams,
}: StudentFeedbackPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)

  const { feedbacks, total } = await getStudentFeedbackPage(
    session.user.id,
    page,
  )
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Meus feedbacks
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe os retornos e recomendações dos professores.
        </p>
      </div>

      <div className="space-y-4">
        {feedbacks.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum feedback recebido ainda.
            </CardContent>
          </Card>
        )}

        {feedbacks.map((fb) => (
          <Card key={fb.id}>
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-3 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{fb.title}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {fb.isImportant && (
                    <Badge
                      variant="warning"
                      className="inline-flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      Importante
                    </Badge>
                  )}
                  <Badge variant={fb.isRead ? 'secondary' : 'info'}>
                    {fb.isRead ? 'Lido' : 'Novo'}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{fb.content}</p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserCircle className="w-3.5 h-3.5" />
                  {fb.teacher.name ?? fb.teacher.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(fb.createdAt)}
                </span>
                <Badge variant="outline">
                  {FEEDBACK_LABELS[fb.type] ?? fb.type}
                </Badge>
                {fb.training?.name && (
                  <Badge variant="secondary">Treino: {fb.training.name}</Badge>
                )}
              </div>
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
