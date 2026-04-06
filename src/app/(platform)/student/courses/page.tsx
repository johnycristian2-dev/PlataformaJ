import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSubscriptionAccessSnapshot } from '@/lib/subscriptions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, PlayCircle, ChevronRight } from 'lucide-react'

const getStudentEnrollments = unstable_cache(
  async (userId: string) =>
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        certificate: { select: { id: true } },
        course: {
          include: {
            professor: { select: { name: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    }),
  ['student-enrollments'],
  { revalidate: 30, tags: ['enrollments'] },
)

export default async function StudentCoursesPage() {
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/professor/dashboard')
  }

  const [enrollments, subscriptionSnapshot] = await Promise.all([
    getStudentEnrollments(session.user.id),
    getSubscriptionAccessSnapshot(session.user.id),
  ])

  const hasFullAccess = subscriptionSnapshot?.accessLevel === 'FULL'
  const hasPartialAccess = subscriptionSnapshot?.accessLevel === 'PARTIAL'

  return (
    <div className="p-6 max-w-[1240px] mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Meus cursos
        </h1>
        <p className="text-muted-foreground mt-1">
          Continue de onde você parou.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {enrollments.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Você ainda não está matriculado em nenhum curso.
            </CardContent>
          </Card>
        )}

        {enrollments.map((enrollment) => (
          <Card key={enrollment.id} className="h-full">
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{enrollment.course.title}</span>
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {enrollment.progress}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex h-full flex-col">
              <p className="text-xs text-muted-foreground">
                Professor: {enrollment.course.professor.name || 'Professor'}
              </p>

              <Progress value={enrollment.progress} size="sm" />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{enrollment.course.totalModules} módulos</span>
                <span>{enrollment.course.totalLessons} aulas</span>
                <span>{enrollment.course.totalHours.toFixed(1)}h</span>
              </div>

              <div className="pt-1 mt-auto">
                {enrollment.progress === 100 && enrollment.certificate ? (
                  <Link
                    href={`/student/certificates/${enrollment.certificate.id}`}
                    className="h-9 px-3 rounded-md border border-border text-sm inline-flex items-center gap-1 hover:bg-accent transition-colors"
                  >
                    Ver certificado
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : enrollment.course.isPremium &&
                  !hasFullAccess &&
                  !hasPartialAccess ? (
                  <Link
                    href="/student/subscription"
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                  >
                    Assinar para continuar
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/student/courses/${enrollment.courseId}`}
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Continuar curso
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
