import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createCourseAction,
  deleteCourseAction,
  toggleCoursePublishAction,
  updateCourseAction,
} from '@/app/actions/course-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, PlusCircle, ChevronRight } from 'lucide-react'

export default async function ProfessorCoursesPage() {
  const session = await auth()

  if (!session?.user) redirect('/login')
  if (!['PROFESSOR', 'ADMIN'].includes(session.user.role)) {
    redirect('/student/dashboard')
  }

  const courses = await prisma.course.findMany({
    where:
      session.user.role === 'ADMIN' ? {} : { professorId: session.user.id },
    include: {
      _count: { select: { modules: true, enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Cursos
        </h1>
        <p className="text-muted-foreground mt-1">
          Crie e gerencie seus cursos, módulos e aulas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="w-4 h-4 text-primary" />
            Criar novo curso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createCourseAction}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <input
              name="title"
              placeholder="Título do curso"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
              minLength={5}
            />
            <select
              name="level"
              defaultValue="BEGINNER"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            >
              <option value="BEGINNER">Iniciante</option>
              <option value="INTERMEDIATE">Intermediário</option>
              <option value="ADVANCED">Avançado</option>
              <option value="ALL_LEVELS">Todos os níveis</option>
            </select>
            <input
              name="category"
              placeholder="Nicho (ex: Muay Thai)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="thumbnailFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm"
            />
            <input
              name="tags"
              placeholder="Tags separadas por vírgula"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <textarea
              name="description"
              rows={3}
              placeholder="Descrição do curso"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="isPremium" className="rounded" />
              Curso premium
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="dripEnabled" className="rounded" />
              Liberação gradual (drip)
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Criar curso
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {courses.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum curso ainda.
            </CardContent>
          </Card>
        )}

        {courses.map((course) => (
          <Card key={course.id}>
            <CardContent className="p-5 space-y-4">
              <form
                action={updateCourseAction}
                className="grid grid-cols-1 gap-2 p-3 rounded-lg bg-accent/30"
              >
                <input type="hidden" name="courseId" value={course.id} />
                <input
                  name="title"
                  defaultValue={course.title}
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm"
                  required
                  minLength={5}
                />
                <input
                  name="category"
                  defaultValue={course.category ?? ''}
                  placeholder="Nicho"
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm"
                />
                <input
                  name="thumbnailFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="h-9 rounded-md border border-border bg-input px-3 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm"
                />
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    name="removeThumbnail"
                    className="rounded"
                  />
                  Remover banner atual
                </label>
                <textarea
                  name="description"
                  defaultValue={course.description ?? ''}
                  rows={2}
                  className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                />
                <div>
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-md border border-border text-xs hover:bg-accent transition-colors"
                  >
                    Salvar alterações
                  </button>
                </div>
              </form>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{course.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {course.category || 'Sem nicho'} · {course.level}
                  </p>
                </div>
                <Badge variant={course.isPublished ? 'success' : 'secondary'}>
                  {course.isPublished ? 'Publicado' : 'Rascunho'}
                </Badge>
              </div>

              {course.thumbnail && (
                <div className="relative overflow-hidden rounded-lg border border-border aspect-[16/6]">
                  <Image
                    src={course.thumbnail}
                    alt={`Banner do curso ${course.title}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 45vw"
                  />
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {course._count.modules} módulos
                </span>
                <span>{course.totalLessons} aulas</span>
                <span>{course._count.enrollments} alunos</span>
              </div>

              <div className="flex items-center gap-2">
                <form action={toggleCoursePublishAction}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors"
                  >
                    {course.isPublished ? 'Despublicar' : 'Publicar'}
                  </button>
                </form>

                <form action={deleteCourseAction}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-md border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 transition-colors"
                  >
                    Excluir
                  </button>
                </form>

                <Link
                  href={`/professor/courses/${course.id}`}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                >
                  Gerenciar
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
