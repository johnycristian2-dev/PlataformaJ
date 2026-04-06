import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dumbbell,
  Calendar,
  UserCircle,
  ChevronLeft,
  ClipboardList,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface StudentTrainingDetailPageProps {
  params: Promise<{ trainingId: string }>
}

export default async function StudentTrainingDetailPage({
  params,
}: StudentTrainingDetailPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/professor/dashboard')
  }

  const { trainingId } = await params

  const where =
    session.user.role === 'ADMIN'
      ? { id: trainingId }
      : { id: trainingId, studentId: session.user.id }

  const training = await prisma.trainingPlan.findFirst({
    where,
    include: {
      coach: { select: { name: true, email: true } },
      exercises: { orderBy: { order: 'asc' } },
    },
  })

  if (!training) {
    redirect('/student/trainings')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="space-y-3">
        <Link
          href="/student/trainings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para meus treinos
        </Link>

        <div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {training.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Detalhes completos do seu plano de treino.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo do treino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={training.isActive ? 'success' : 'secondary'}>
              {training.isActive ? 'Ativo' : 'Inativo'}
            </Badge>
            {training.frequency && (
              <Badge variant="outline">{training.frequency}</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Início: {formatDate(training.startDate)}
            </p>
            <p className="inline-flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Fim:{' '}
              {training.endDate ? formatDate(training.endDate) : 'Não definido'}
            </p>
            <p className="inline-flex items-center gap-1 md:col-span-2">
              <UserCircle className="w-4 h-4" />
              Coach: {training.coach.name ?? training.coach.email}
            </p>
          </div>

          {training.objective && (
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <p className="text-sm font-medium">Objetivo</p>
              <p className="text-sm text-muted-foreground mt-1">
                {training.objective}
              </p>
            </div>
          )}

          {training.notes && (
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <p className="text-sm font-medium">Observações</p>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                {training.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Exercícios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {training.exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum exercício cadastrado para este treino ainda.
            </p>
          ) : (
            training.exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="rounded-lg border border-border bg-accent/20 p-3"
              >
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">
                    {exercise.order}. {exercise.name}
                  </p>
                </div>

                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
                  <span>Séries: {exercise.sets ?? '-'}</span>
                  <span>Repetições: {exercise.reps ?? '-'}</span>
                  <span>
                    Descanso:{' '}
                    {exercise.restTime ? `${exercise.restTime}s` : '-'}
                  </span>
                </div>

                {exercise.notes && (
                  <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">
                    {exercise.notes}
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
