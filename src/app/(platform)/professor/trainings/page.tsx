import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  addTrainingExerciseAction,
  createProfessorTrainingAction,
} from '@/modules/professor/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dumbbell, UserCircle, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 8

const getProfessorTrainingsPage = unstable_cache(
  async (coachId: string, page: number) => {
    const skip = (page - 1) * PAGE_SIZE

    const [trainings, total] = await Promise.all([
      prisma.trainingPlan.findMany({
        where: { coachId },
        include: {
          student: { select: { name: true, email: true } },
          exercises: { orderBy: { order: 'asc' }, take: 5 },
          _count: { select: { exercises: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.trainingPlan.count({ where: { coachId } }),
    ])

    return { trainings, total }
  },
  ['professor-trainings-page'],
  { revalidate: 30 },
)

interface ProfessorTrainingsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function ProfessorTrainingsPage({
  searchParams,
}: ProfessorTrainingsPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)

  const [students, trainings] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'STUDENT',
        enrollments: { some: { course: { professorId: session.user.id } } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    getProfessorTrainingsPage(session.user.id, page),
  ])
  const totalPages = Math.max(1, Math.ceil(trainings.total / PAGE_SIZE))

  async function submitTrainingCreate(formData: FormData) {
    'use server'

    await createProfessorTrainingAction(formData)
  }

  async function submitExerciseCreate(formData: FormData) {
    'use server'

    await addTrainingExerciseAction(formData)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Treinos
        </h1>
        <p className="text-muted-foreground mt-1">
          Crie planos de treino e adicione exercícios para os seus alunos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criar plano de treino</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={submitTrainingCreate}
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
            <input
              name="name"
              placeholder="Nome do treino"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
            />
            <input
              name="frequency"
              placeholder="Frequência (ex: seg, qua, sex)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="startDate"
              type="date"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
            />
            <input
              name="endDate"
              type="date"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <textarea
              name="objective"
              rows={2}
              placeholder="Objetivo"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <textarea
              name="notes"
              rows={2}
              placeholder="Observações"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="isRecurring" className="rounded" />
              Plano recorrente semanal
            </label>
            <input
              name="repeatWeeks"
              type="number"
              min={1}
              max={16}
              defaultValue={8}
              placeholder="Repetir por semanas"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <p className="md:col-span-2 text-xs text-muted-foreground">
              Se ativo, a plataforma cria automaticamente um plano por semana.
            </p>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Criar treino
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {trainings.trainings.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum treino criado ainda.
            </CardContent>
          </Card>
        )}

        {trainings.trainings.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Dumbbell className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{t.name}</span>
                </span>
                <Badge variant={t.isActive ? 'success' : 'secondary'}>
                  {t.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1">
                  <UserCircle className="w-3.5 h-3.5" />
                  {t.student.name ?? t.student.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(t.startDate)}
                </span>
                <span>{t._count.exercises} exercícios</span>
              </div>

              <form
                action={submitExerciseCreate}
                className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 rounded-lg bg-accent/30"
              >
                <input type="hidden" name="trainingId" value={t.id} />
                <input
                  name="name"
                  placeholder="Nome do exercício"
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm md:col-span-2"
                  required
                />
                <input
                  name="sets"
                  type="number"
                  min={1}
                  placeholder="Séries"
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm"
                />
                <input
                  name="reps"
                  placeholder="Reps"
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm"
                />
                <div className="md:col-span-4">
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-md border border-border text-xs hover:bg-accent transition-colors"
                  >
                    Adicionar exercício
                  </button>
                </div>
              </form>

              <div className="space-y-1.5">
                {t.exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem exercícios ainda.
                  </p>
                ) : (
                  t.exercises.map((ex) => (
                    <p key={ex.id} className="text-sm">
                      {ex.order}. {ex.name}
                      {ex.sets ? ` • ${ex.sets} séries` : ''}
                      {ex.reps ? ` • ${ex.reps}` : ''}
                    </p>
                  ))
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
