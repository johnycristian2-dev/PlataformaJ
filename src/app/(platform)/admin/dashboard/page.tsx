import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  setProfessorApprovalByAdminAction,
  updateCourseStatusByAdminAction,
} from '@/modules/admin/actions'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import {
  Users,
  BookOpen,
  GraduationCap,
  CreditCard,
  TrendingUp,
  UserCheck,
  AlertCircle,
  ShieldAlert,
  DollarSign,
  TrendingDown,
  ArrowUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatDate, getInitials, formatCurrency } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'

const getAdminData = unstable_cache(
  async () => {
    try {
      const now = new Date()
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const [
        totalUsers,
        totalStudents,
        totalProfessors,
        totalCourses,
        activeSubscriptions,
        recentUsers,
        pendingProfessors,
        recentProfessorDecisions,
        pendingCourseReviews,
        plans,
        activeSubscriptionsWithPlan,
        recentSubscriptionChanges,
        criticalAlertCount,
        highAlertCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'STUDENT' } }),
        prisma.user.count({ where: { role: 'PROFESSOR' } }),
        prisma.course.count({ where: { isPublished: true } }),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.professorProfile.findMany({
          where: {
            isApproved: false,
            applicationStatus: 'PENDING',
            applicationSubmittedAt: { not: null },
          },
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { applicationSubmittedAt: 'desc' },
          take: 5,
        }),
        prisma.professorApprovalDecision.findMany({
          include: {
            admin: { select: { name: true, email: true } },
            professorProfile: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.course.findMany({
          where: { isPublished: false },
          include: {
            professor: { select: { name: true, email: true } },
            _count: { select: { modules: true, enrollments: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.plan.findMany({
          include: { _count: { select: { subscriptions: true } } },
        }),
        prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                interval: true,
                price: true,
              },
            },
          },
        }),
        prisma.subscriptionStatusChange.findMany({
          where: { createdAt: { gte: since30d } },
          include: {
            subscription: {
              select: {
                plan: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        prisma.authAttemptStat.count({
          where: {
            OR: [
              { failedCount: { gte: 20 } },
              { lastFailureAt: { gte: since24h }, failedCount: { gte: 12 } },
            ],
          },
        }),
        prisma.authAttemptStat.count({
          where: {
            failedCount: { gt: 0 },
            OR: [
              { failedCount: { gte: 10 } },
              { lastFailureAt: { gte: since24h }, failedCount: { gte: 6 } },
            ],
            NOT: {
              OR: [
                { failedCount: { gte: 20 } },
                { lastFailureAt: { gte: since24h }, failedCount: { gte: 12 } },
              ],
            },
          },
        }),
      ])

      const monthlyRevenueEstimate = activeSubscriptionsWithPlan.reduce(
        (total, subscription) => {
          const amount = Number(subscription.plan.price)
          if (!Number.isFinite(amount) || amount <= 0) {
            return total
          }

          if (subscription.plan.interval === 'MONTHLY') {
            return total + amount
          }

          if (subscription.plan.interval === 'QUARTERLY') {
            return total + amount / 3
          }

          return total + amount / 12
        },
        0,
      )

      const churnedIn30d = recentSubscriptionChanges.filter(
        (change) =>
          change.fromStatus === 'ACTIVE' &&
          (change.toStatus === 'CANCELED' || change.toStatus === 'EXPIRED'),
      ).length

      const activationsIn30d = recentSubscriptionChanges.filter(
        (change) =>
          change.toStatus === 'ACTIVE' && change.fromStatus !== 'ACTIVE',
      )

      const churnRate =
        churnedIn30d === 0
          ? 0
          : (churnedIn30d / (activeSubscriptions + churnedIn30d)) * 100

      const upgradesByPlanMap = new Map<string, number>()
      for (const activation of activationsIn30d) {
        const planName = activation.subscription.plan.name
        upgradesByPlanMap.set(
          planName,
          (upgradesByPlanMap.get(planName) ?? 0) + 1,
        )
      }

      const upgradesByPlan = [...upgradesByPlanMap.entries()]
        .map(([planName, count]) => ({ planName, count }))
        .sort((a, b) => b.count - a.count)

      return {
        totalUsers,
        totalStudents,
        totalProfessors,
        totalCourses,
        activeSubscriptions,
        recentUsers,
        pendingProfessors,
        recentProfessorDecisions,
        pendingCourseReviews,
        plans,
        monthlyRevenueEstimate,
        churnedIn30d,
        churnRate,
        upgradesByPlan,
        criticalAlertCount,
        highAlertCount,
      }
    } catch {
      return {
        totalUsers: 0,
        totalStudents: 0,
        totalProfessors: 0,
        totalCourses: 0,
        activeSubscriptions: 0,
        recentUsers: [],
        pendingProfessors: [],
        recentProfessorDecisions: [],
        pendingCourseReviews: [],
        plans: [],
        monthlyRevenueEstimate: 0,
        churnedIn30d: 0,
        churnRate: 0,
        upgradesByPlan: [],
        criticalAlertCount: 0,
        highAlertCount: 0,
      }
    }
  },
  ['admin-dashboard-data'],
  { revalidate: 30 },
)

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  PROFESSOR: 'Professor',
  STUDENT: 'Aluno',
}

const ROLE_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'info' | 'success'
> = {
  ADMIN: 'default',
  PROFESSOR: 'info',
  STUDENT: 'success',
}

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  async function setProfessorApproval(formData: FormData) {
    'use server'

    await setProfessorApprovalByAdminAction(formData)
  }

  async function submitCourseReview(formData: FormData) {
    'use server'

    await updateCourseStatusByAdminAction(formData)
  }

  const {
    totalUsers,
    totalStudents,
    totalProfessors,
    totalCourses,
    activeSubscriptions,
    recentUsers,
    pendingProfessors,
    recentProfessorDecisions,
    pendingCourseReviews,
    plans,
    monthlyRevenueEstimate,
    churnedIn30d,
    churnRate,
    upgradesByPlan,
    criticalAlertCount,
    highAlertCount,
  } = await getAdminData()

  const stats = [
    {
      title: 'Total de usuários',
      value: totalUsers,
      icon: Users,
      color: 'text-blue-400',
    },
    {
      title: 'Alunos',
      value: totalStudents,
      icon: UserCheck,
      color: 'text-green-400',
    },
    {
      title: 'Professores',
      value: totalProfessors,
      icon: GraduationCap,
      color: 'text-purple-400',
    },
    {
      title: 'Cursos publicados',
      value: totalCourses,
      icon: BookOpen,
      color: 'text-orange-400',
    },
    {
      title: 'Assinaturas ativas',
      value: activeSubscriptions,
      icon: CreditCard,
      color: 'text-primary',
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral da plataforma.</p>
      </div>

      {/* Security Alert Banner */}
      {(criticalAlertCount > 0 || highAlertCount > 0) && (
        <Link href={ROUTES.ADMIN.SECURITY}>
          <div
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 transition-opacity hover:opacity-90 ${
              criticalAlertCount > 0
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-orange-500/40 bg-orange-500/10 text-orange-400'
            }`}
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {criticalAlertCount > 0
                  ? `${criticalAlertCount} alerta${criticalAlertCount > 1 ? 's' : ''} crítico${criticalAlertCount > 1 ? 's' : ''} de segurança`
                  : `${highAlertCount} alerta${highAlertCount > 1 ? 's' : ''} de segurança de alto risco`}
              </p>
              <p className="text-xs opacity-75">
                {criticalAlertCount > 0 && highAlertCount > 0
                  ? `+ ${highAlertCount} de alto risco — `
                  : ''}
                Clique para revisar na central de segurança.
              </p>
            </div>
            {criticalAlertCount > 0 && (
              <Badge variant="destructive" className="shrink-0">
                Crítico
              </Badge>
            )}
            {criticalAlertCount === 0 && highAlertCount > 0 && (
              <Badge variant="warning" className="shrink-0">
                Alto
              </Badge>
            )}
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{stat.title}</p>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4 text-green-500" />
            Receita e retenção (últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-accent/20 p-4">
            <p className="text-xs text-muted-foreground">MRR estimado</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {formatCurrency(monthlyRevenueEstimate)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Conversão mensal de planos mensais/trimestrais/anuais ativos.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-accent/20 p-4">
            <p className="text-xs text-muted-foreground">Churn (30d)</p>
            <p className="text-2xl font-bold mt-1 inline-flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-orange-500" />
              {churnRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {churnedIn30d} cancelamentos/expirações vindos de assinaturas
              ativas.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-accent/20 p-4">
            <p className="text-xs text-muted-foreground">
              Ativações por plano (30d)
            </p>
            <div className="mt-2 space-y-1">
              {upgradesByPlan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem ativações no período.
                </p>
              ) : (
                upgradesByPlan.slice(0, 3).map((upgrade) => (
                  <p
                    key={upgrade.planName}
                    className="text-sm inline-flex items-center gap-1"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-green-500" />
                    {upgrade.planName}: {upgrade.count}
                  </p>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              Usuários recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum usuário encontrado.
              </p>
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <Avatar size="sm" className="shrink-0">
                    <AvatarFallback>
                      {getInitials(u.name ?? u.email ?? 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {u.name ?? u.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={ROLE_VARIANTS[u.role] ?? 'secondary'}
                    className="shrink-0 text-xs"
                  >
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              Professores pendentes
              {pendingProfessors.length > 0 && (
                <Badge variant="warning" className="ml-auto text-xs">
                  {pendingProfessors.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingProfessors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum professor aguardando aprovação.
              </p>
            ) : (
              pendingProfessors.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" className="shrink-0">
                      <AvatarFallback>
                        {getInitials(p.user.name ?? p.user.email ?? 'P')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.user.name ?? p.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.user.email}
                      </p>
                    </div>
                    <Badge variant="warning" className="shrink-0 text-xs">
                      Pendente
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Escolaridade:
                      </span>{' '}
                      {p.educationLevel ?? 'Não informado'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Foco:</span>{' '}
                      {p.focusArea ?? 'Não informado'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">CPF:</span>{' '}
                      {p.cpf ?? 'Não informado'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Contato:
                      </span>{' '}
                      {p.contactPhone ?? p.phone ?? p.user.email}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Cidade/UF:
                      </span>{' '}
                      {p.city || p.state
                        ? `${p.city ?? '-'} / ${p.state ?? '-'}`
                        : 'Não informado'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Exp. docência:
                      </span>{' '}
                      {typeof p.yearsTeaching === 'number'
                        ? `${p.yearsTeaching} anos`
                        : 'Não informado'}
                    </p>
                  </div>

                  {p.specialtiesDetailed.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Especialidades:
                      </span>{' '}
                      {p.specialtiesDetailed.join(', ')}
                    </p>
                  )}

                  {p.teachingObjective && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Objetivo:
                      </span>{' '}
                      {p.teachingObjective}
                    </p>
                  )}

                  {p.teachingExperience && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Experiência:
                      </span>{' '}
                      {p.teachingExperience}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Enviado em:{' '}
                    {p.applicationSubmittedAt
                      ? formatDate(p.applicationSubmittedAt)
                      : 'Não informado'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setProfessorApproval}>
                      <input
                        type="hidden"
                        name="professorProfileId"
                        value={p.id}
                      />
                      <input type="hidden" name="approved" value="true" />
                      <Button type="submit" size="sm">
                        Aprovar agora
                      </Button>
                    </form>

                    <form
                      action={setProfessorApproval}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <input
                        type="hidden"
                        name="professorProfileId"
                        value={p.id}
                      />
                      <input type="hidden" name="approved" value="false" />
                      <input
                        type="text"
                        name="reason"
                        required
                        minLength={10}
                        placeholder="Motivo da rejeição (mínimo 10 caracteres)"
                        className="h-8 w-[280px] rounded-md border border-input bg-background px-2 text-xs"
                      />
                      <Button type="submit" size="sm" variant="destructive">
                        Rejeitar
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Fila de revisão de cursos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingCourseReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum curso pendente de revisão.
              </p>
            ) : (
              pendingCourseReviews.map((course) => (
                <form
                  key={course.id}
                  action={submitCourseReview}
                  className="rounded-xl border border-border bg-accent/20 p-4"
                >
                  <input type="hidden" name="courseId" value={course.id} />

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">
                      {course.title}
                    </p>
                    <Badge variant="secondary">Rascunho</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    Professor: {course.professor.name ?? course.professor.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {course._count.modules} módulos •{' '}
                    {course._count.enrollments} matrículas
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      name="publishState"
                      defaultValue="published"
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="published">Publicar</option>
                      <option value="draft">Manter rascunho</option>
                    </select>

                    <select
                      name="premiumState"
                      defaultValue={course.isPremium ? 'premium' : 'free'}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="free">Gratuito</option>
                      <option value="premium">Premium</option>
                    </select>

                    <Button type="submit" size="sm" variant="secondary">
                      Aplicar revisão
                    </Button>
                  </div>
                </form>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Histórico de decisões de professores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProfessorDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma decisão registrada ainda.
              </p>
            ) : (
              recentProfessorDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-xl border border-border bg-accent/20 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {decision.professorProfile.user.name ??
                        decision.professorProfile.user.email}
                    </p>
                    <Badge
                      variant={decision.approved ? 'success' : 'destructive'}
                    >
                      {decision.approved ? 'Aprovado' : 'Rejeitado'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por: {decision.admin.name ?? decision.admin.email} •{' '}
                    {formatDate(decision.createdAt)}
                  </p>
                  {decision.reason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Motivo: {decision.reason}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4 text-primary" />
              Planos disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl border border-border bg-accent/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{plan.name}</p>
                    <Badge variant="secondary">
                      {plan._count.subscriptions} assinantes
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(Number(plan.price))}
                    <span className="text-sm font-normal text-muted-foreground">
                      /
                      {plan.interval === 'MONTHLY'
                        ? 'mês'
                        : plan.interval === 'QUARTERLY'
                          ? 'trimestre'
                          : 'ano'}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
