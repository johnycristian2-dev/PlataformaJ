import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Award, Crown, Gem, ShieldCheck } from 'lucide-react'
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
    if (dayKey !== getDateKey(cursor)) break

    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
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

function getBadgePresentation(badgeKey: string) {
  if (badgeKey === 'streak-7' || badgeKey === 'monthly-goal-hit') {
    return {
      tier: 'OURO',
      icon: Crown,
      cardClass:
        'border-amber-300/60 bg-gradient-to-br from-amber-100/80 via-background to-amber-50/70',
      tierClass: 'text-amber-800 bg-amber-100 border-amber-300/70',
    }
  }

  if (badgeKey === 'lessons-10') {
    return {
      tier: 'PRATA',
      icon: Gem,
      cardClass:
        'border-slate-300/70 bg-gradient-to-br from-slate-100/70 via-background to-slate-50/70',
      tierClass: 'text-slate-800 bg-slate-100 border-slate-300/70',
    }
  }

  return {
    tier: 'BRONZE',
    icon: ShieldCheck,
    cardClass:
      'border-orange-300/70 bg-gradient-to-br from-orange-100/70 via-background to-orange-50/70',
    tierClass: 'text-orange-800 bg-orange-100 border-orange-300/70',
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

export default async function StudentAchievementsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [
    studentProfile,
    monthlyActivityEntries,
    completedLessonsCount,
    completedCoursesCount,
  ] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.lessonProgress.findMany({
      where: {
        userId: session.user.id,
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
      select: { watchedAt: true, completedAt: true, updatedAt: true },
    }),
    prisma.lessonProgress.count({
      where: { userId: session.user.id, completed: true },
    }),
    prisma.enrollment.count({
      where: { userId: session.user.id, progress: 100 },
    }),
  ])

  const monthlyGoalTarget =
    studentProfile?.monthlyGoalTarget ??
    Math.max(8, (studentProfile?.weeklyCommitment ?? 3) * 4)

  const monthlyActivityDates = monthlyActivityEntries
    .map(
      (entry) =>
        entry.completedAt ?? entry.watchedAt ?? entry.updatedAt ?? null,
    )
    .filter((value): value is Date => Boolean(value))

  const monthlyActiveDays = new Set(
    monthlyActivityDates.map((date) => getDateKey(new Date(date))),
  ).size

  const currentStreak = getCurrentStreak(monthlyActivityDates)
  const monthlyGoalProgress = Math.min(
    100,
    Math.round((monthlyActiveDays / monthlyGoalTarget) * 100),
  )

  await ensureAchievementBadges({
    userId: session.user.id,
    currentStreak,
    monthlyActiveDays,
    monthlyGoalTarget,
    completedCoursesCount,
    completedLessonsCount,
  })

  const badges = await prisma.achievementBadge.findMany({
    where: { userId: session.user.id },
    orderBy: { earnedAt: 'desc' },
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-semibold">
            Hall de Conquistas
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight mt-1">
            Seus selos premium
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Acompanhe suas conquistas por consistência, evolução e cumprimento
            de meta.
          </p>
        </div>
        <Link
          href={ROUTES.STUDENT.DASHBOARD}
          className="h-10 px-4 rounded-md border border-border text-sm inline-flex items-center hover:bg-accent transition-colors"
        >
          Voltar ao dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Streak atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{currentStreak} dias</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sequência ativa sem quebrar ritmo.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Meta mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">
              {monthlyActiveDays}/{monthlyGoalTarget}
            </p>
            <Progress value={monthlyGoalProgress} size="sm" className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Selos desbloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{badges.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Continue ativo para liberar novos níveis.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Coleção de Selos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum selo ainda. Complete aulas e mantenha consistência para
              desbloquear os primeiros níveis.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {badges.map((badge) => {
                const presentation = getBadgePresentation(badge.badgeKey)
                const Icon = presentation.icon

                return (
                  <div
                    key={badge.id}
                    className={`rounded-xl border p-4 ${presentation.cardClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-background/70 border border-border flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-bold">{badge.label}</p>
                      </div>
                      <Badge className={presentation.tierClass}>
                        {presentation.tier}
                      </Badge>
                    </div>
                    {badge.description && (
                      <p className="text-xs text-muted-foreground mt-3">
                        {badge.description}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-3">
                      Conquistado em{' '}
                      {badge.earnedAt.toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
