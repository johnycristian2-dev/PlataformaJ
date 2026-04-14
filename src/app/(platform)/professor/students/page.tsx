import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  runSegmentBatchAction,
  updateStudentMonthlyGoalByProfessorAction,
} from '@/modules/professor/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  UserCircle,
  Mail,
  Activity,
  BookOpen,
  Trophy,
  AlertTriangle,
  Users,
  Sparkles,
} from 'lucide-react'

const PAGE_SIZE = 10

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getProfessorStudentsPage = unstable_cache(
  async (professorId: string, page: number, segment: string) => {
    const baseWhere = {
      role: 'STUDENT' as const,
      enrollments: {
        some: {
          course: { professorId },
        },
      },
    }

    const [allStudents, total] = await Promise.all([
      prisma.user.findMany({
        where: baseWhere,
        include: {
          studentProfile: true,
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              currentPeriodEnd: true,
              dunningStage: true,
            },
          },
          enrollments: {
            where: { course: { professorId } },
            select: { enrolledAt: true, progress: true },
          },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: baseWhere }),
    ])

    const allStudentIds = allStudents.map((student) => ({
      id: student.id,
      name: student.name,
    }))

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const now = new Date()
    const daysInMonthSoFar = Math.max(1, now.getDate())

    const [monthlyActivityEntries, studentProfiles] =
      allStudentIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.lessonProgress.findMany({
              where: {
                userId: { in: allStudentIds.map((student) => student.id) },
                OR: [
                  {
                    watchedAt: {
                      gte: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
                    },
                  },
                  {
                    completedAt: {
                      gte: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
                    },
                  },
                  {
                    updatedAt: {
                      gte: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
                    },
                  },
                ],
              },
              select: {
                userId: true,
                watchedAt: true,
                completedAt: true,
                updatedAt: true,
              },
            }),
            prisma.studentProfile.findMany({
              where: {
                userId: { in: allStudentIds.map((student) => student.id) },
              },
              select: {
                userId: true,
                monthlyGoalTarget: true,
              },
            }),
          ])

    const activeDaysByUser = new Map<string, Set<string>>()

    for (const entry of monthlyActivityEntries) {
      const referenceDate =
        entry.completedAt ?? entry.watchedAt ?? entry.updatedAt ?? null

      if (!referenceDate) continue

      const day = getDateKey(new Date(referenceDate))
      const currentSet = activeDaysByUser.get(entry.userId) ?? new Set<string>()
      currentSet.add(day)
      activeDaysByUser.set(entry.userId, currentSet)
    }

    const monthlyGoalByUser = new Map(
      studentProfiles.map((profile) => [
        profile.userId,
        profile.monthlyGoalTarget ?? 12,
      ]),
    )

    const consistencyRanking = allStudentIds
      .map((student) => {
        const activeDays = activeDaysByUser.get(student.id)?.size ?? 0
        const monthlyGoal = monthlyGoalByUser.get(student.id) ?? 12
        const consistencyScore = Math.min(
          100,
          Math.round((activeDays / daysInMonthSoFar) * 100),
        )
        const goalProgress = Math.min(
          100,
          Math.round((activeDays / monthlyGoal) * 100),
        )

        return {
          userId: student.id,
          name: student.name ?? 'Aluno',
          activeDays,
          consistencyScore,
          monthlyGoal,
          goalProgress,
        }
      })
      .sort((a, b) => {
        if (b.consistencyScore !== a.consistencyScore) {
          return b.consistencyScore - a.consistencyScore
        }

        return b.activeDays - a.activeDays
      })
      .slice(0, 10)

    const last14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const last28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)

    const recentDaysByUser = new Map<string, Set<string>>()
    const previousDaysByUser = new Map<string, Set<string>>()

    for (const entry of monthlyActivityEntries) {
      const ref = entry.completedAt ?? entry.watchedAt ?? entry.updatedAt
      if (!ref) continue
      const dayKey = getDateKey(new Date(ref))
      if (ref >= last14) {
        const set = recentDaysByUser.get(entry.userId) ?? new Set<string>()
        set.add(dayKey)
        recentDaysByUser.set(entry.userId, set)
      } else if (ref >= last28) {
        const set = previousDaysByUser.get(entry.userId) ?? new Set<string>()
        set.add(dayKey)
        previousDaysByUser.set(entry.userId, set)
      }
    }

    const segmentMap = {
      AT_RISK: [] as string[],
      BEGINNER: [] as string[],
      ADVANCED: [] as string[],
      PREMIUM: [] as string[],
      LOW_FREQUENCY: [] as string[],
      HIGH_CONSISTENCY: [] as string[],
    }

    const riskInsights: Array<{
      userId: string
      name: string
      reasons: string[]
    }> = []

    for (const student of allStudents) {
      const recentDays = recentDaysByUser.get(student.id)?.size ?? 0
      const previousDays = previousDaysByUser.get(student.id)?.size ?? 0
      const latestSubscription = student.subscriptions[0]
      const fitnessLevel =
        student.studentProfile?.fitnessLevel?.toLowerCase() ?? ''

      const stoppedAccess = recentDays === 0
      const droppedFrequency = previousDays >= 2 && recentDays <= 1
      const nearCancel = Boolean(
        latestSubscription &&
        (['PAST_DUE', 'RECOVERY', 'SUSPENDED'].includes(
          latestSubscription.status,
        ) ||
          latestSubscription.dunningStage >= 3),
      )
      const delayedTrack = student.enrollments.some(
        (enrollment) =>
          now.getTime() - enrollment.enrolledAt.getTime() >
            21 * 24 * 60 * 60 * 1000 && enrollment.progress < 20,
      )

      const reasons: string[] = []
      if (stoppedAccess) reasons.push('parou de entrar')
      if (droppedFrequency) reasons.push('caiu frequência')
      if (nearCancel) reasons.push('perto de cancelar')
      if (delayedTrack) reasons.push('atrasado em trilha')

      if (reasons.length > 0) {
        segmentMap.AT_RISK.push(student.id)
        riskInsights.push({
          userId: student.id,
          name: student.name ?? 'Aluno',
          reasons,
        })
      }

      if (['iniciante', 'beginner'].some((v) => fitnessLevel.includes(v))) {
        segmentMap.BEGINNER.push(student.id)
      }

      if (
        ['avancado', 'avançado', 'advanced'].some((v) =>
          fitnessLevel.includes(v),
        )
      ) {
        segmentMap.ADVANCED.push(student.id)
      }

      if (
        latestSubscription &&
        ['ACTIVE', 'RECOVERY'].includes(latestSubscription.status) &&
        latestSubscription.currentPeriodEnd > now
      ) {
        segmentMap.PREMIUM.push(student.id)
      }

      if (recentDays <= 2) {
        segmentMap.LOW_FREQUENCY.push(student.id)
      }

      if (recentDays + previousDays >= 12) {
        segmentMap.HIGH_CONSISTENCY.push(student.id)
      }
    }

    const selectedSegment =
      segment && segment in segmentMap
        ? (segment as keyof typeof segmentMap)
        : null

    const filteredStudents = selectedSegment
      ? allStudents.filter((student) =>
          segmentMap[selectedSegment].includes(student.id),
        )
      : allStudents

    const skip = (page - 1) * PAGE_SIZE
    const students = filteredStudents.slice(skip, skip + PAGE_SIZE)

    return {
      students,
      total,
      filteredTotal: filteredStudents.length,
      consistencyRanking,
      segmentCounts: {
        AT_RISK: segmentMap.AT_RISK.length,
        BEGINNER: segmentMap.BEGINNER.length,
        ADVANCED: segmentMap.ADVANCED.length,
        PREMIUM: segmentMap.PREMIUM.length,
        LOW_FREQUENCY: segmentMap.LOW_FREQUENCY.length,
        HIGH_CONSISTENCY: segmentMap.HIGH_CONSISTENCY.length,
      },
      riskInsights: riskInsights.slice(0, 8),
    }
  },
  ['professor-students-page'],
  { revalidate: 30 },
)

interface ProfessorStudentsPageProps {
  searchParams: Promise<{ page?: string; segment?: string }>
}

export default async function ProfessorStudentsPage({
  searchParams,
}: ProfessorStudentsPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'PROFESSOR') redirect('/student/dashboard')

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)
  const segment = String(params.segment || '').trim()
  const {
    students,
    total,
    filteredTotal,
    consistencyRanking,
    segmentCounts,
    riskInsights,
  } = await getProfessorStudentsPage(session.user.id, page, segment)
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))

  async function updateMonthlyGoal(formData: FormData) {
    'use server'

    await updateStudentMonthlyGoalByProfessorAction(formData)
  }

  async function runBatch(formData: FormData) {
    'use server'

    await runSegmentBatchAction(formData)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Alunos
        </h1>
        <p className="text-muted-foreground mt-1">
          Alunos matriculados nos seus cursos.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Total: {total} alunos · exibindo {filteredTotal}
          {segment ? ` (segmento ${segment})` : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Segmentação de alunos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ['AT_RISK', 'Em risco', segmentCounts.AT_RISK],
              ['BEGINNER', 'Iniciantes', segmentCounts.BEGINNER],
              ['ADVANCED', 'Avançados', segmentCounts.ADVANCED],
              ['PREMIUM', 'Premium', segmentCounts.PREMIUM],
              [
                'LOW_FREQUENCY',
                'Baixa frequência',
                segmentCounts.LOW_FREQUENCY,
              ],
              [
                'HIGH_CONSISTENCY',
                'Alta consistência',
                segmentCounts.HIGH_CONSISTENCY,
              ],
            ].map(([key, label, count]) => (
              <Link
                key={key}
                href={`?segment=${key}`}
                className="rounded-lg border border-border bg-background p-3 hover:bg-accent transition-colors"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold mt-1">{count as number}</p>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="?"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpar filtro
            </Link>
            {segment ? (
              <Badge variant="secondary">Filtro ativo: {segment}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Ações em lote por segmento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={runBatch}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <select
              name="segment"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={segment || 'AT_RISK'}
            >
              <option value="AT_RISK">Em risco</option>
              <option value="BEGINNER">Iniciantes</option>
              <option value="ADVANCED">Avançados</option>
              <option value="PREMIUM">Premium</option>
              <option value="LOW_FREQUENCY">Baixa frequência</option>
              <option value="HIGH_CONSISTENCY">Alta consistência</option>
            </select>
            <select
              name="action"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue="SEND_REMINDER"
            >
              <option value="SEND_REMINDER">Enviar lembrete</option>
              <option value="APPLY_MONTHLY_GOAL">Aplicar meta mensal</option>
              <option value="RECOMMEND_LESSON">Recomendar aula</option>
              <option value="COLLECTIVE_FEEDBACK">
                Disparar feedback coletivo
              </option>
            </select>

            <input
              name="monthlyGoalTarget"
              type="number"
              min={4}
              max={31}
              placeholder="Meta mensal (quando aplicável)"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              name="monthlyGoalReason"
              placeholder="Motivo da meta"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              name="lessonTitle"
              placeholder="Título da aula recomendada"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              name="lessonLink"
              placeholder="Link da aula (opcional)"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              name="feedbackTitle"
              placeholder="Título do feedback coletivo"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
            />
            <textarea
              name="feedbackContent"
              rows={3}
              placeholder="Conteúdo do feedback coletivo"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            />
            <div className="md:col-span-2">
              <Button type="submit" size="sm">
                Executar ação em lote
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Visão de alunos em risco
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {riskInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aluno em risco identificado neste momento.
            </p>
          ) : (
            riskInsights.map((item) => (
              <div
                key={item.userId}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.reasons.join(' • ')}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:col-span-2 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="w-4 h-4 text-primary" />
              Ranking de consistência no mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {consistencyRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda sem dados de consistência neste mês.
              </p>
            ) : (
              consistencyRanking.map((item, index) => (
                <div
                  key={item.userId}
                  className="rounded-lg border border-border bg-background/80 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        #{index + 1} {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.activeDays} dias ativos neste mês
                      </p>
                    </div>
                    <Badge variant="secondary">
                      Consistência {item.consistencyScore}%
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-accent/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(6, item.consistencyScore)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Meta mensal: {item.activeDays}/{item.monthlyGoal} (
                    {item.goalProgress}%)
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {students.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum aluno vinculado aos seus cursos.
            </CardContent>
          </Card>
        )}

        {students.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle className="w-4 h-4 text-primary" />
                {s.name ?? 'Aluno'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {s.email}
              </p>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {s._count.enrollments} matrículas
              </p>
              {s.studentProfile?.fitnessLevel && (
                <Badge
                  variant="secondary"
                  className="inline-flex items-center gap-1"
                >
                  <Activity className="w-3 h-3" />
                  {s.studentProfile.fitnessLevel}
                </Badge>
              )}

              <div className="pt-2 border-t border-border mt-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Meta mensal atual:{' '}
                  <span className="font-medium text-foreground">
                    {s.studentProfile?.monthlyGoalTarget ?? 'não definida'}
                  </span>
                </p>
                <form action={updateMonthlyGoal} className="space-y-2">
                  <input type="hidden" name="studentId" value={s.id} />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="monthlyGoalTarget"
                      min={4}
                      max={31}
                      defaultValue={s.studentProfile?.monthlyGoalTarget ?? 12}
                      className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Salvar meta
                    </Button>
                  </div>
                  <textarea
                    name="monthlyGoalReason"
                    rows={2}
                    maxLength={280}
                    defaultValue={s.studentProfile?.monthlyGoalReason ?? ''}
                    placeholder="Observação/motivo da meta (ex.: foco em regularidade antes de subir intensidade)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Página {page} de {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`?page=${Math.max(1, page - 1)}${segment ? `&segment=${segment}` : ''}`}
            className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
          >
            Anterior
          </Link>
          <Link
            href={`?page=${Math.min(totalPages, page + 1)}${segment ? `&segment=${segment}` : ''}`}
            className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
          >
            Próxima
          </Link>
        </div>
      </div>
    </div>
  )
}
