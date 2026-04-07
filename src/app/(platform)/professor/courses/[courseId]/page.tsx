import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
} from '@/modules/course/actions'
import { BookOpen, PlusCircle, Video } from 'lucide-react'

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function ProfessorCourseDetailsPage({ params }: Props) {
  const { courseId } = await params
  const session = await auth()

  if (!session?.user) redirect('/login')
  if (!['PROFESSOR', 'ADMIN'].includes(session.user.role)) {
    redirect('/student/dashboard')
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  if (!course) notFound()
  if (session.user.role !== 'ADMIN' && course.professorId !== session.user.id) {
    redirect('/professor/courses')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          {course.title}
        </h1>
        <p className="text-muted-foreground mt-1">
          Organize módulos e aulas do curso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="w-4 h-4 text-primary" />
            Adicionar módulo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createModuleAction}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <input type="hidden" name="courseId" value={course.id} />
            <input
              name="title"
              placeholder="Título do módulo"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
              minLength={3}
            />
            <input
              name="dripDays"
              type="number"
              min={0}
              placeholder="Liberar após X dias (opcional)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <textarea
              name="description"
              rows={2}
              placeholder="Descrição do módulo"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Criar módulo
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {course.modules.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum módulo criado ainda.
            </CardContent>
          </Card>
        )}

        {course.modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">
                    Módulo {module.order}: {module.title}
                  </span>
                </span>
                <Badge variant="secondary">{module.lessons.length} aulas</Badge>
              </CardTitle>
              <div>
                <form action={deleteModuleAction}>
                  <input type="hidden" name="moduleId" value={module.id} />
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-md border border-destructive/40 text-destructive text-xs hover:bg-destructive/10 transition-colors"
                  >
                    Excluir módulo
                  </button>
                </form>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                action={createLessonAction}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg bg-accent/30"
              >
                <input type="hidden" name="moduleId" value={module.id} />
                <input
                  name="title"
                  placeholder="Título da aula"
                  className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
                  required
                  minLength={3}
                />
                <input
                  name="videoUrl"
                  placeholder="URL do vídeo (opcional)"
                  className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
                />
                <input
                  name="videoDuration"
                  type="number"
                  min={0}
                  placeholder="Duração (segundos)"
                  className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="isFree" className="rounded" />
                  Aula gratuita
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Descrição da aula"
                  className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
                />
                <textarea
                  name="content"
                  rows={3}
                  placeholder="Conteúdo extra da aula (markdown)"
                  className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
                />
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Adicionar aula
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {module.lessons.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma aula neste módulo.
                  </p>
                )}

                {module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Aula {lesson.order}: {lesson.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lesson.videoDuration
                          ? `${lesson.videoDuration}s`
                          : 'Sem duração'}
                        {lesson.isFree ? ' · Grátis' : ''}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Video className="w-3.5 h-3.5" />
                      {lesson.isPublished ? 'Publicada' : 'Rascunho'}
                    </span>
                    <form action={deleteLessonAction}>
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <button
                        type="submit"
                        className="h-8 px-2.5 rounded-md border border-destructive/40 text-destructive text-xs hover:bg-destructive/10 transition-colors"
                      >
                        Excluir
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
