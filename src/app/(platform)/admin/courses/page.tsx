import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { updateCourseStatusByAdminAction } from '@/app/actions/admin-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

export default async function AdminCoursesPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/login')

  const courses = await prisma.course.findMany({
    include: {
      professor: { select: { name: true, email: true } },
      _count: { select: { enrollments: true, modules: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  async function submitCourseStatus(formData: FormData) {
    'use server'

    await updateCourseStatusByAdminAction(formData)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Cursos
        </h1>
        <p className="text-muted-foreground mt-1">
          Baseline de monitoramento dos cursos da plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de cursos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum curso encontrado.
            </p>
          ) : (
            courses.map((course) => (
              <form
                key={course.id}
                action={submitCourseStatus}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <input type="hidden" name="courseId" value={course.id} />
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <p className="text-sm font-semibold">{course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.professor.name ?? course.professor.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={course.isPublished ? 'success' : 'secondary'}
                    >
                      {course.isPublished ? 'Publicado' : 'Rascunho'}
                    </Badge>
                    {course.isPremium && (
                      <Badge variant="premium">Premium</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {course._count.modules} módulos • {course._count.enrollments}{' '}
                  matrículas • criado em {formatDate(course.createdAt)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    name="isPublished"
                    defaultValue={course.isPublished ? 'true' : 'false'}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="true">Publicado</option>
                    <option value="false">Rascunho</option>
                  </select>

                  <select
                    name="isPremium"
                    defaultValue={course.isPremium ? 'true' : 'false'}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="false">Gratuito</option>
                    <option value="true">Premium</option>
                  </select>

                  <Button type="submit" variant="secondary" size="sm">
                    Salvar curso
                  </Button>
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
