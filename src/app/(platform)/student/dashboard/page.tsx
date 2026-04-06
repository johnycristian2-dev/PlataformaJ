import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import {
  BookOpen,
  Dumbbell,
  Video,
  MessageSquare,
  TrendingUp,
  Clock,
  PlayCircle,
  Bell,
  Sparkles,
  Target,
  Flame,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getCurrentStreak(activityDates: Date[]) {
  if (activityDates.length === 0) return 0

  const uniqueDays = Array.from(
    new Set(activityDates.map((date) => getDateKey(new Date(date)))),
  ).sort((a, b) => (a < b ? 1 : -1))

  let streak = 0
  const cursor = new Date(uniqueDays[0])

  for (const dayKey of uniqueDays) {
    if (dayKey !== getDateKey(cursor)) {
      break
    }

    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function getMonthlyTimeline(activityDates: Date[]) {
  const uniqueDays = new Set(
    activityDates.map((date) => getDateKey(new Date(date))),
  )

  return Array.from({ length: 4 }, (_, index) => {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - (27 - index * 7))

    let count = 0
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + offset)
      if (uniqueDays.has(getDateKey(day))) {
        count += 1
      }
    }

    return {
      label: `S${index + 1}`,
      count,
    }
  })
}

function getEligibleBadgeDefinitions(params: {
  currentStreak: number
  monthlyActiveDays: number
  monthlyGoalTarget: number
  completedCoursesCount: number
  completedLessonsCount: number
}) {
  return [
    params.currentStreak >= 3
      ? {
          badgeKey: 'streak-3',
          label: 'Ritmo Inicial',
          description: 'Você manteve 3 dias consecutivos de atividade.',
        }
      : null,
    params.currentStreak >= 7
      ? {
          badgeKey: 'streak-7',
          label: 'Semana Blindada',
          description: 'Você completou 7 dias seguidos de atividade.',
        }
      : null,
    params.monthlyActiveDays >= params.monthlyGoalTarget
      ? {
          badgeKey: 'monthly-goal-hit',
          label: 'Meta do Mês',
          description: 'Você atingiu sua meta mensal personalizada.',
        }
      : null,
    params.completedCoursesCount >= 1
      ? {
          badgeKey: 'first-course-finished',
          label: 'Primeira Conquista',
          description: 'Você concluiu seu primeiro curso.',
        }
      : null,
    params.completedLessonsCount >= 10
      ? {
          badgeKey: 'lessons-10',
          label: '10 Aulas Concluídas',
          description: 'Você acumulou 10 aulas concluídas.',
        }
      : null,
  ].filter(
    (
      badge,
    ): badge is { badgeKey: string; label: string; description: string } =>
      Boolean(badge),
  )
}

function getBadgeTier(badgeKey: string) {
  if (badgeKey === 'streak-7' || badgeKey === 'monthly-goal-hit') {
    return {
      tier: 'Ouro',
      glowClass: 'from-amber-300/40 via-yellow-300/10 to-transparent',
      chipClass: 'border-amber-300/50 bg-amber-100/60 text-amber-950',
    }
  }

  if (badgeKey === 'lessons-10') {
    return {
      tier: 'Prata',
      glowClass: 'from-slate-300/40 via-slate-200/10 to-transparent',
      chipClass: 'border-slate-300/60 bg-slate-100/70 text-slate-950',
    }
  }

  return {
    tier: 'Bronze',
    glowClass: 'from-orange-300/35 via-orange-200/10 to-transparent',
    chipClass: 'border-orange-300/50 bg-orange-100/70 text-orange-950',
  }
}

async function ensureAchievementBadges(params: {
  userId: string
  currentStreak: number
  monthlyActiveDays: number
  monthlyGoalTarget: number
  completedCoursesCount: number
  completedLessonsCount: number
}) {
  const badges = getEligibleBadgeDefinitions(params)

  if (badges.length === 0) return

  await Promise.all(
    badges.map((badge) =>
      prisma.achievementBadge.upsert({
        where: {
          userId_badgeKey: {
            userId: params.userId,
            badgeKey: badge.badgeKey,
          },
        },
        create: {
          userId: params.userId,
          badgeKey: badge.badgeKey,
          label: badge.label,
          description: badge.description,
        },
        update: {},
      }),
    ),
  )
}

function getRecommendedCatalogHref(params: {
  primaryGoal?: string | null
  preferredTrack?: string | null
}) {
  const searchParams = new URLSearchParams()

  if (params.primaryGoal) {
    searchParams.set('goal', params.primaryGoal)
  }

  if (params.preferredTrack) {
    searchParams.set('track', params.preferredTrack)
  }

  searchParams.set('sort', 'popular')

  return `${ROUTES.STUDENT.COURSES}/catalog?${searchParams.toString()}`
}

function getGoalDrivenNextStepTitle(goal?: string | null) {
  switch (goal) {
    case 'Emagrecimento':
      return 'Próximo passo para acelerar seu emagrecimento'
    case 'Hipertrofia':
      return 'Próximo passo para evoluir sua hipertrofia'
    case 'Condicionamento':
      return 'Próximo passo para subir seu condicionamento'
    case 'Performance técnica':
      return 'Próximo passo para refinar sua técnica'
    case 'Saúde e consistência':
      return 'Próximo passo para manter sua consistência'
    default:
      return 'Seu próximo passo'
  }
}

const getStudentData = unstable_cache(
  async (userId: string) => {
    try {
      const [
        enrollments,
        trainings,
        upcomingLives,
        feedbacks,
        latestTeacherRecommendation,
        lastLessonProgress,
        activeTrainingCount,
        liveInNext24h,
        studentProfile,
        completedLessonsCount,
        weeklyActivityCount,
        completedCoursesCount,
        weeklyActivityEntries,
        monthlyActivityEntries,
        achievementBadges,
      ] = await Promise.all([
        prisma.enrollment.findMany({
          where: { userId },
          include: {
            course: {
              include: {
                professor: { select: { name: true } },
                _count: { select: { modules: true } },
              },
            },
          },
          orderBy: { enrolledAt: 'desc' },
          take: 4,
        }),
        prisma.trainingPlan.findMany({
          where: { studentId: userId },
          include: { _count: { select: { exercises: true } } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        prisma.liveSession.findMany({
          where: {
            status: 'SCHEDULED',
            scheduledAt: { gte: new Date() },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 3,
        }),
        prisma.teacherFeedback.findMany({
          where: { studentId: userId },
          include: { teacher: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        prisma.teacherFeedback.findFirst({
          where: { studentId: userId },
          include: { teacher: { select: { name: true, email: true } } },
          orderBy: [{ isImportant: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.lessonProgress.findFirst({
          where: { userId },
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: {
                      select: { id: true, title: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ watchedAt: 'desc' }, { updatedAt: 'desc' }],
        }),
        prisma.trainingPlan.count({
          where: {
            studentId: userId,
            isActive: true,
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
        }),
        prisma.liveSession.findFirst({
          where: {
            status: 'SCHEDULED',
            scheduledAt: {
              gte: new Date(),
              lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { scheduledAt: 'asc' },
          select: { id: true, title: true, scheduledAt: true },
        }),
        prisma.studentProfile.findUnique({
          where: { userId },
        }),
        prisma.lessonProgress.count({
          where: { userId, completed: true },
        }),
        prisma.lessonProgress.count({
          where: {
            userId,
            OR: [
              {
                watchedAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
              {
                completedAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
        }),
        prisma.enrollment.count({
          where: { userId, progress: 100 },
        }),
        prisma.lessonProgress.findMany({
          where: {
            userId,
            OR: [
              {
                watchedAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
              {
                completedAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
          select: {
            watchedAt: true,
            completedAt: true,
            updatedAt: true,
          },
        }),
        prisma.lessonProgress.findMany({
          where: {
            userId,
            OR: [
              {
                watchedAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
              {
                completedAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
          select: {
            watchedAt: true,
            completedAt: true,
            updatedAt: true,
          },
        }),
        prisma.achievementBadge.findMany({
          where: { userId },
          orderBy: { earnedAt: 'desc' },
          take: 6,
        }),
      ])

      return {
        enrollments,
        trainings,
        upcomingLives,
        feedbacks,
        lastLessonProgress,
        activeTrainingCount,
        liveInNext24h,
        studentProfile,
        completedLessonsCount,
        weeklyActivityCount,
        completedCoursesCount,
        weeklyActivityEntries,
        monthlyActivityEntries,
        achievementBadges,
        latestTeacherRecommendation,
      }
    } catch {
      return {
        enrollments: [],
        trainings: [],
        upcomingLives: [],
        feedbacks: [],
        lastLessonProgress: null,
        activeTrainingCount: 0,
        liveInNext24h: null,
        studentProfile: null,
        completedLessonsCount: 0,
        weeklyActivityCount: 0,
        completedCoursesCount: 0,
        weeklyActivityEntries: [],
        monthlyActivityEntries: [],
        achievementBadges: [],
        latestTeacherRecommendation: null,
      }
    }
  },
  ['student-dashboard-data'],
  { revalidate: 30 },
)

async function ensureEngagementReminders(params: {
  userId: string
  liveInNext24h: { id: string; title: string; scheduledAt: Date } | null
  activeTrainingCount: number
}) {
  const today = new Date()
  const dayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  if (params.liveInNext24h) {
    const liveTitle = `Lembrete de live (${dayKey})`
    const existingLiveReminder = await prisma.notification.findFirst({
      where: {
        userId: params.userId,
        title: liveTitle,
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    })

    if (!existingLiveReminder) {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: 'LIVE',
          title: liveTitle,
          message: `A live "${params.liveInNext24h.title}" acontece em breve. Reserve um horário para participar.`,
          link: '/student/lives',
        },
      })
    }
  }

  if (params.activeTrainingCount > 0) {
    const trainingTitle = `Lembrete de treino (${dayKey})`
    const existingTrainingReminder = await prisma.notification.findFirst({
      where: {
        userId: params.userId,
        title: trainingTitle,
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    })

    if (!existingTrainingReminder) {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: 'WARNING',
          title: trainingTitle,
          message: `Você tem ${params.activeTrainingCount} treino(s) ativo(s). Não deixe para depois.`,
          link: '/student/trainings',
        },
      })
    }
  }
}

export default async function StudentDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const {
    enrollments,
    trainings,
    upcomingLives,
    feedbacks,
    lastLessonProgress,
    activeTrainingCount,
    liveInNext24h,
    studentProfile,
    completedLessonsCount,
    weeklyActivityCount,
    completedCoursesCount,
    weeklyActivityEntries,
    monthlyActivityEntries,
    achievementBadges,
    latestTeacherRecommendation,
  } = await getStudentData(session.user.id)

  await ensureEngagementReminders({
    userId: session.user.id,
    liveInNext24h,
    activeTrainingCount,
  })

  const continueLearningLink = lastLessonProgress
    ? `/student/courses/${lastLessonProgress.lesson.module.course.id}?lesson=${lastLessonProgress.lesson.id}`
    : enrollments[0]
      ? `/student/courses/${enrollments[0].courseId}`
      : '/student/courses/catalog'

  const onboardingCompleted = Boolean(studentProfile?.onboardingCompleted)
  const recommendedCatalogHref = getRecommendedCatalogHref({
    primaryGoal: studentProfile?.primaryGoal,
    preferredTrack: studentProfile?.preferredTrack,
  })
  const weeklyCommitment = studentProfile?.weeklyCommitment ?? 3
  const weeklyProgress = Math.min(
    100,
    Math.round((weeklyActivityCount / Math.max(weeklyCommitment, 1)) * 100),
  )
  const monthlyGoalTarget =
    studentProfile?.monthlyGoalTarget ?? Math.max(8, weeklyCommitment * 4)
  const averageCourseProgress = enrollments.length
    ? Math.round(
        enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) /
          enrollments.length,
      )
    : 0

  const monthlyActivityDates = monthlyActivityEntries
    .map(
      (entry) =>
        entry.completedAt ?? entry.watchedAt ?? entry.updatedAt ?? null,
    )
    .filter((value): value is Date => Boolean(value))
  const monthlyActiveDays = new Set(
    monthlyActivityDates.map((date) => getDateKey(new Date(date))),
  ).size
  const monthlyGoalProgress = Math.min(
    100,
    Math.round((monthlyActiveDays / monthlyGoalTarget) * 100),
  )
  const currentStreak = getCurrentStreak(monthlyActivityDates)
  const monthlyTimeline = getMonthlyTimeline(monthlyActivityDates)
  const monthlyTimelineMax = Math.max(
    1,
    ...monthlyTimeline.map((item) => item.count),
  )

  await ensureAchievementBadges({
    userId: session.user.id,
    currentStreak,
    monthlyActiveDays,
    monthlyGoalTarget,
    completedCoursesCount,
    completedLessonsCount,
  })

  const eligibleBadges = getEligibleBadgeDefinitions({
    currentStreak,
    monthlyActiveDays,
    monthlyGoalTarget,
    completedCoursesCount,
    completedLessonsCount,
  })
  const displayBadges = [
    ...achievementBadges,
    ...eligibleBadges
      .filter(
        (badge) =>
          !achievementBadges.some(
            (savedBadge) => savedBadge.badgeKey === badge.badgeKey,
          ),
      )
      .map((badge) => ({
        id: badge.badgeKey,
        badgeKey: badge.badgeKey,
        label: badge.label,
        description: badge.description,
      })),
  ]

  const weeklyTimeline = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const label = date.toLocaleDateString('pt-BR', { weekday: 'short' })

    const count = weeklyActivityEntries.filter((entry) => {
      const referenceDate =
        entry.completedAt ?? entry.watchedAt ?? entry.updatedAt ?? null

      if (!referenceDate) return false

      const activityDate = new Date(referenceDate)
      return (
        activityDate.getDate() === date.getDate() &&
        activityDate.getMonth() === date.getMonth() &&
        activityDate.getFullYear() === date.getFullYear()
      )
    }).length

    return {
      label: label.replace('.', ''),
      count,
    }
  })

  const weeklyTimelineMax = Math.max(
    1,
    ...weeklyTimeline.map((item) => item.count),
  )

  let nextStep: {
    title: string
    description: string
    href: string
    cta: string
  } = {
    title: 'Comece seu onboarding',
    description:
      'Configure objetivo, trilha e compromisso semanal para receber uma jornada personalizada.',
    href: ROUTES.STUDENT.ONBOARDING,
    cta: 'Completar onboarding',
  }

  if (onboardingCompleted && enrollments.length === 0) {
    nextStep = {
      title: 'Escolha sua primeira trilha',
      description:
        'Seu perfil já está pronto. Abra um catálogo já filtrado com cursos mais alinhados ao seu objetivo e à sua trilha preferida.',
      href: recommendedCatalogHref,
      cta: 'Ver catálogo recomendado',
    }
  } else if (
    onboardingCompleted &&
    studentProfile?.primaryGoal === 'Performance técnica' &&
    liveInNext24h
  ) {
    nextStep = {
      title: getGoalDrivenNextStepTitle(studentProfile?.primaryGoal),
      description: `${liveInNext24h.title} acontece em breve e combina com sua meta atual de evolução técnica.`,
      href: ROUTES.STUDENT.LIVES,
      cta: 'Entrar na rotina de lives',
    }
  } else if (
    onboardingCompleted &&
    studentProfile?.preferredTrack === 'Treinos' &&
    activeTrainingCount > 0
  ) {
    nextStep = {
      title: getGoalDrivenNextStepTitle(studentProfile?.primaryGoal),
      description: `Você tem ${activeTrainingCount} treino(s) ativos aguardando execução esta semana para sustentar seu objetivo.`,
      href: ROUTES.STUDENT.TRAININGS,
      cta: 'Abrir treinos',
    }
  } else if (onboardingCompleted && lastLessonProgress) {
    nextStep = {
      title: getGoalDrivenNextStepTitle(studentProfile?.primaryGoal),
      description: `Última atividade ${formatRelativeTime(lastLessonProgress.updatedAt)} em ${lastLessonProgress.lesson.module.course.title}. Voltar agora mantém sua jornada em movimento.`,
      href: continueLearningLink,
      cta: 'Continuar agora',
    }
  } else if (onboardingCompleted && liveInNext24h) {
    nextStep = {
      title: getGoalDrivenNextStepTitle(studentProfile?.primaryGoal),
      description: `${liveInNext24h.title} acontece em breve. Entre ao vivo para manter consistência.`,
      href: ROUTES.STUDENT.LIVES,
      cta: 'Ver lives',
    }
  }

  const professorRecommendation = latestTeacherRecommendation
    ? {
        title: latestTeacherRecommendation.title,
        content: latestTeacherRecommendation.content,
        teacherName:
          latestTeacherRecommendation.teacher.name ??
          latestTeacherRecommendation.teacher.email ??
          'Professor',
        isImportant: latestTeacherRecommendation.isImportant,
        createdAt: latestTeacherRecommendation.createdAt,
      }
    : {
        title: 'Sem recomendação recente do professor',
        content:
          studentProfile?.primaryGoal === 'Hipertrofia'
            ? 'Mantenha frequência alta nos treinos e avance para as aulas recomendadas no catálogo.'
            : studentProfile?.primaryGoal === 'Emagrecimento'
              ? 'Priorize consistência semanal e conclua aulas curtas para manter volume de atividade.'
              : 'Siga sua trilha principal e mantenha uma rotina estável para acelerar resultados.',
        teacherName: 'Sistema de jornada',
        isImportant: false,
        createdAt: new Date(),
      }

  const stats = [
    {
      title: 'Cursos matriculados',
      value: enrollments.length,
      icon: BookOpen,
      color: 'text-blue-400',
    },
    {
      title: 'Planos de treino',
      value: trainings.length,
      icon: Dumbbell,
      color: 'text-green-400',
    },
    {
      title: 'Lives agendadas',
      value: upcomingLives.length,
      icon: Video,
      color: 'text-purple-400',
    },
    {
      title: 'Feedbacks recebidos',
      value: feedbacks.length,
      icon: MessageSquare,
      color: 'text-orange-400',
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Saudação */}
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Olá, {session.user.name?.split(' ')[0] ?? 'Aluno'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Continue progredindo! Veja seu resumo de hoje.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!onboardingCompleted && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background">
          <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold">
                Ative sua jornada personalizada
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete o onboarding para destravar recomendações mais
                inteligentes, metas semanais e um dashboard alinhado ao seu
                objetivo.
              </p>
            </div>
            <Link
              href={ROUTES.STUDENT.ONBOARDING}
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              Começar onboarding
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="w-4 h-4 text-primary" />
              Continuar aprendendo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastLessonProgress ? (
              <>
                <p className="text-sm font-semibold">
                  {lastLessonProgress.lesson.module.course.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Última aula: {lastLessonProgress.lesson.title}
                </p>
                <Link
                  href={continueLearningLink}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                >
                  Voltar para a aula
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Você ainda não iniciou nenhuma aula.
                </p>
                <Link
                  href={recommendedCatalogHref}
                  className="h-9 px-3 rounded-md border border-border text-sm inline-flex items-center gap-1 hover:bg-accent transition-colors"
                >
                  Ver recomendações para sua trilha
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-primary" />
              Lembretes automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveInNext24h ? (
              <p className="text-sm text-muted-foreground">
                Live em até 24h:{' '}
                <span className="font-medium text-foreground">
                  {liveInNext24h.title}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem live próxima nas próximas 24h.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Treinos ativos pendentes:{' '}
              <span className="font-medium text-foreground">
                {activeTrainingCount}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Esses lembretes também são enviados automaticamente para sua
              central de notificações.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-4 h-4 text-primary" />
              Seu próximo passo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold leading-tight">
              {nextStep.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {nextStep.description}
            </p>
            <Link
              href={nextStep.href}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
            >
              {nextStep.cta}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary" />
              Recomendação do professor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  professorRecommendation.isImportant ? 'warning' : 'secondary'
                }
              >
                {professorRecommendation.isImportant
                  ? 'Prioridade alta'
                  : 'Orientação recente'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {professorRecommendation.teacherName} •{' '}
                {formatDate(professorRecommendation.createdAt)}
              </span>
            </div>
            <p className="text-sm font-semibold">
              {professorRecommendation.title}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-4">
              {professorRecommendation.content}
            </p>
            <Link
              href={ROUTES.STUDENT.FEEDBACK}
              className="text-sm text-primary hover:underline"
            >
              Ver feedbacks completos
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="w-4 h-4 text-primary" />
              Progresso da sua jornada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-accent/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Aulas concluídas
                </p>
                <p className="text-2xl font-bold mt-1">
                  {completedLessonsCount}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-accent/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Cursos finalizados
                </p>
                <p className="text-2xl font-bold mt-1">
                  {completedCoursesCount}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Meta semanal</span>
                <span className="font-semibold">
                  {weeklyActivityCount}/{weeklyCommitment} sessões
                </span>
              </div>
              <Progress value={weeklyProgress} size="sm" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Linha do tempo semanal
                </span>
                <span className="font-semibold">7 dias</span>
              </div>
              <div className="grid grid-cols-7 gap-2 items-end h-28">
                {weeklyTimeline.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="text-[10px] text-muted-foreground h-3">
                      {item.count > 0 ? item.count : ''}
                    </div>
                    <div className="h-20 w-full rounded-md bg-accent/40 flex items-end overflow-hidden">
                      <div
                        className="w-full rounded-md bg-primary/80"
                        style={{
                          height: `${Math.max(10, Math.round((item.count / weeklyTimelineMax) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-accent/20 p-3">
                <p className="text-xs text-muted-foreground">Meta mensal</p>
                <p className="text-2xl font-bold mt-1">
                  {monthlyActiveDays}/{monthlyGoalTarget}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Definida por{' '}
                  {studentProfile?.monthlyGoalSetBy === 'PROFESSOR'
                    ? 'professor'
                    : studentProfile?.monthlyGoalSetBy === 'ADMIN'
                      ? 'admin'
                      : 'você'}
                </p>
                {studentProfile?.monthlyGoalReason && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    Motivo: {studentProfile.monthlyGoalReason}
                  </p>
                )}
                <Progress
                  value={monthlyGoalProgress}
                  size="sm"
                  className="mt-3"
                />
              </div>
              <div className="rounded-lg border border-border bg-accent/20 p-3">
                <p className="text-xs text-muted-foreground">Streak atual</p>
                <p className="text-2xl font-bold mt-1">
                  {currentStreak} dia{currentStreak === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Sequência real baseada nos dias com atividade registrada.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Acompanhamento mensal
                </span>
                <span className="font-semibold">4 semanas</span>
              </div>
              <div className="grid grid-cols-4 gap-3 items-end h-28">
                {monthlyTimeline.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="text-[10px] text-muted-foreground h-3">
                      {item.count > 0 ? item.count : ''}
                    </div>
                    <div className="h-20 w-full rounded-md bg-accent/40 flex items-end overflow-hidden">
                      <div
                        className="w-full rounded-md bg-green-500/80"
                        style={{
                          height: `${Math.max(10, Math.round((item.count / monthlyTimelineMax) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Progresso médio nos cursos
                </span>
                <span className="font-semibold">{averageCourseProgress}%</span>
              </div>
              <Progress value={averageCourseProgress} size="sm" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Selos conquistados
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{displayBadges.length}</span>
                  <Link
                    href={ROUTES.STUDENT.ACHIEVEMENTS}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver todas
                  </Link>
                </div>
              </div>
              {displayBadges.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Continue ativo para desbloquear seus primeiros selos de
                  consistência.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displayBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`relative overflow-hidden rounded-xl border px-3 py-2 min-w-40 ${getBadgeTier(badge.badgeKey).chipClass}`}
                    >
                      <div
                        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${getBadgeTier(badge.badgeKey).glowClass}`}
                      />
                      <div className="relative">
                        <p className="text-[10px] uppercase tracking-wide font-bold opacity-80 inline-flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {getBadgeTier(badge.badgeKey).tier}
                        </p>
                        <p className="text-xs font-semibold mt-0.5">
                          {badge.label}
                        </p>
                      </div>
                      {badge.description && (
                        <p className="relative text-[10px] text-foreground/75 mt-0.5">
                          {badge.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {studentProfile?.primaryGoal && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">
                  Objetivo: {studentProfile.primaryGoal}
                </Badge>
                {studentProfile.preferredTrack && (
                  <Badge variant="secondary">
                    Foco: {studentProfile.preferredTrack}
                  </Badge>
                )}
                {studentProfile.fitnessLevel && (
                  <Badge variant="secondary">
                    Nível: {studentProfile.fitnessLevel}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meus cursos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" />
              Meus cursos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum curso ainda. Explore os cursos disponíveis!
              </p>
            ) : (
              enrollments.map((e) => (
                <div key={e.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {e.course.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.course.professor.name} · {e.course._count.modules}{' '}
                        módulos
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {e.progress}%
                    </Badge>
                  </div>
                  <Progress value={e.progress} size="sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Lives agendadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="w-4 h-4 text-primary" />
              Próximas lives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingLives.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem lives agendadas no momento.
              </p>
            ) : (
              upcomingLives.map((live) => (
                <div
                  key={live.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-accent/40"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{live.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(live.scheduledAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Treinos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="w-4 h-4 text-primary" />
              Meus treinos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trainings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum treino personalizado ainda.
              </p>
            ) : (
              trainings.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-accent/40"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t._count.exercises} exercícios
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Feedbacks recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              Feedbacks recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum feedback ainda.
              </p>
            ) : (
              feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="p-3 rounded-lg bg-accent/40 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {fb.teacher.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(fb.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm line-clamp-2">{fb.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
