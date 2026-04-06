import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createProfessorFeedbackAction } from '@/app/actions/professor-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, UserCircle, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 12

const getProfessorFeedbackPage = unstable_cache(
  async (teacherId: string, page: number) => {
    const skip = (page - 1) * PAGE_SIZE

    const [feedbacks, total] = await Promise.all([
      prisma.teacherFeedback.findMany({
        where: { teacherId },
        include: {
          student: { select: { name: true, email: true } },
          training: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.teacherFeedback.count({ where: { teacherId } }),
    ])

    return { feedbacks, total }
  },
  ['professor-feedback-page'],
  { revalidate: 30 },
)

interface ProfessorFeedbackPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ProfessorFeedbackPage({
  searchParams,
}: ProfessorFeedbackPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)

  const [students, trainings, feedbacks] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'STUDENT',
        enrollments: { some: { course: { professorId: session.user.id } } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.trainingPlan.findMany({
      where: { coachId: session.user.id },
      select: { id: true, name: true, studentId: true },
      orderBy: { createdAt: 'desc' },
    }),
    getProfessorFeedbackPage(session.user.id, page),
  ])
  const totalPages = Math.max(1, Math.ceil(feedbacks.total / PAGE_SIZE))

  async function submitProfessorFeedback(formData: FormData) {
    'use server'

    await createProfessorFeedbackAction(formData)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Feedback
        </h1>
        <p className="text-muted-foreground mt-1">
          Envie feedbacks para seus alunos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar novo feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={submitProfessorFeedback}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <select
              name="studentId"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione o aluno
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.email}
                </option>
              ))}
            </select>

            <select
              name="type"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              defaultValue="GENERAL"
            >
              <option value="GENERAL">Geral</option>
              <option value="COURSE">Curso</option>
              <option value="TRAINING">Treino</option>
              <option value="ASSESSMENT">Avaliação</option>
            </select>

            <input
              name="title"
              placeholder="Título"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
            />

            <select
              name="trainingId"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
              defaultValue=""
            >
              <option value="">(Opcional) Vincular a um treino</option>
              {trainings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <textarea
              name="content"
              rows={4}
              placeholder="Conteúdo do feedback"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
              required
            />

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
              <input type="checkbox" name="isImportant" className="rounded" />
              Marcar como importante
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Enviar feedback
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {feedbacks.feedbacks.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum feedback enviado ainda.
            </CardContent>
          </Card>
        )}

        {feedbacks.feedbacks.map((fb) => (
          <Card key={fb.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="truncate">{fb.title}</span>
                </span>
                <div className="flex items-center gap-2">
                  {fb.isImportant && (
                    <Badge variant="warning">Importante</Badge>
                  )}
                  <Badge variant={fb.isRead ? 'secondary' : 'info'}>
                    {fb.isRead ? 'Lido' : 'Não lido'}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{fb.content}</p>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1">
                  <UserCircle className="w-3.5 h-3.5" />
                  {fb.student.name ?? fb.student.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(fb.createdAt)}
                </span>
                <Badge variant="outline">{fb.type}</Badge>
                {fb.training?.name ? (
                  <Badge variant="secondary">Treino: {fb.training.name}</Badge>
                ) : null}
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
