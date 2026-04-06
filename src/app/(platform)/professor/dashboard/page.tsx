import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import {
  Users,
  BookOpen,
  Video,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDate, getInitials } from '@/lib/utils'

const getProfessorData = unstable_cache(
  async (userId: string) => {
    try {
      const [courses, enrollmentCount, feedbacks, upcomingLives] =
        await Promise.all([
          prisma.course.findMany({
            where: { professorId: userId },
            include: {
              _count: { select: { enrollments: true, modules: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 4,
          }),
          prisma.enrollment.count({
            where: { course: { professorId: userId } },
          }),
          prisma.teacherFeedback.findMany({
            where: { teacherId: userId },
            include: { student: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          prisma.liveSession.findMany({
            where: {
              professorId: userId,
              status: 'SCHEDULED',
              scheduledAt: { gte: new Date() },
            },
            orderBy: { scheduledAt: 'asc' },
            take: 3,
          }),
        ])

      return { courses, enrollmentCount, feedbacks, upcomingLives }
    } catch {
      return {
        courses: [],
        enrollmentCount: 0,
        feedbacks: [],
        upcomingLives: [],
      }
    }
  },
  ['professor-dashboard-data'],
  { revalidate: 30 },
)

export default async function ProfessorDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { courses, enrollmentCount, feedbacks, upcomingLives } =
    await getProfessorData(session.user.id)

  const stats = [
    {
      title: 'Total de alunos',
      value: enrollmentCount,
      icon: Users,
      color: 'text-blue-400',
    },
    {
      title: 'Cursos ativos',
      value: courses.length,
      icon: BookOpen,
      color: 'text-green-400',
    },
    {
      title: 'Lives agendadas',
      value: upcomingLives.length,
      icon: Video,
      color: 'text-purple-400',
    },
    {
      title: 'Feedbacks enviados',
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
          Olá, {session.user.name?.split(' ')[0] ?? 'Professor'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seus alunos, cursos e lives.
        </p>
      </div>

      {/* Stats */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meus cursos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" />
              Meus cursos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum curso criado ainda.
              </p>
            ) : (
              courses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-accent/40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c._count.modules} módulos · {c._count.enrollments} alunos
                    </p>
                  </div>
                  <Badge
                    variant={c.isPublished ? 'success' : 'secondary'}
                    className="shrink-0 text-xs"
                  >
                    {c.isPublished ? 'Publicado' : 'Rascunho'}
                  </Badge>
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
                Nenhuma live agendada.
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
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(live.scheduledAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Feedbacks recentes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              Feedbacks enviados recentemente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum feedback enviado ainda.
              </p>
            ) : (
              feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-accent/40"
                >
                  <Avatar size="sm" className="shrink-0 mt-0.5">
                    <AvatarFallback>
                      {getInitials(fb.student.name ?? fb.student.email ?? 'A')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">
                        {fb.student.name ?? fb.student.email}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        {formatDate(fb.createdAt)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {fb.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
