import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasActiveSubscription } from '@/lib/subscriptions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toggleLessonCompleteAction } from '@/app/actions/course-actions'
import { ArrowRight, BookOpen, CheckCircle2, Circle, Video } from 'lucide-react'
import { VideoProgressPlayer } from '@/components/course/video-progress-player'
import { LessonNotes } from '@/components/course/lesson-notes'
import { LessonComments } from '@/components/course/lesson-comments'

interface Props {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ lesson?: string }>
}

export default async function StudentCourseLearnPage({
  params,
  searchParams,
}: Props) {
  const { courseId } = await params
  const { lesson: selectedLessonId } = await searchParams
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/professor/dashboard')
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId,
      },
    },
    include: {
      course: {
        include: {
          modules: {
            where: { isPublished: true },
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                where: { isPublished: true },
                orderBy: { order: 'asc' },
                include: {
                  progress: {
                    where: { userId: session.user.id },
                    select: { completed: true, watchTime: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!enrollment) notFound()

  if (enrollment.course.isPremium && session.user.role === 'STUDENT') {
    const activeSubscription = await hasActiveSubscription(session.user.id)
    if (!activeSubscription) {
      redirect('/student/courses/catalog?locked=premium')
    }
  }

  const publishedLessons = enrollment.course.modules.flatMap((m) => m.lessons)
  const selectedLesson =
    publishedLessons.find((l) => l.id === selectedLessonId) ??
    publishedLessons[0] ??
    null
  const selectedLessonIndex = selectedLesson
    ? publishedLessons.findIndex((l) => l.id === selectedLesson.id)
    : -1
  const nextLesson =
    selectedLessonIndex >= 0
      ? (publishedLessons[selectedLessonIndex + 1] ?? null)
      : null

  const lessonComments = selectedLesson
    ? await prisma.lessonComment.findMany({
        where: { lessonId: selectedLesson.id },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })
    : []

  return (
    <div className="p-6 max-w-[1240px] mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          {enrollment.course.title}
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe as aulas e marque seu progresso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seu progresso no curso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Concluído</span>
            <span className="font-semibold">{enrollment.progress}%</span>
          </div>
          <Progress value={enrollment.progress} size="sm" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)] gap-6 items-start">
        <div className="space-y-4">
          {selectedLesson ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Aula em reprodução: {selectedLesson.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLesson.videoUrl ? (
                  <VideoProgressPlayer
                    lessonId={selectedLesson.id}
                    videoUrl={selectedLesson.videoUrl}
                    initialWatchTime={
                      selectedLesson.progress[0]?.watchTime ?? 0
                    }
                    initialCompleted={
                      selectedLesson.progress[0]?.completed ?? false
                    }
                    videoDuration={selectedLesson.videoDuration}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Esta aula ainda não possui vídeo.
                  </p>
                )}

                {!!selectedLesson.description && (
                  <div className="rounded-lg border border-border bg-accent/20 p-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedLesson.description}
                    </p>
                  </div>
                )}

                {!!selectedLesson.content && (
                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold mb-2">
                      Conteúdo da aula
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {selectedLesson.content}
                    </p>
                  </div>
                )}

                <LessonNotes lessonId={selectedLesson.id} />

                <LessonComments
                  lessonId={selectedLesson.id}
                  initialComments={lessonComments}
                  canComment={true}
                />

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-accent/10 p-3">
                  <p className="text-sm text-muted-foreground">
                    {nextLesson
                      ? `Próxima aula: ${nextLesson.title}`
                      : 'Você chegou na última aula deste curso.'}
                  </p>
                  {nextLesson && (
                    <Link
                      href={`?lesson=${nextLesson.id}`}
                      className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0"
                    >
                      Próxima aula
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma aula publicada ainda.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6">
          {enrollment.course.modules.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Conteúdo ainda não disponível.
              </CardContent>
            </Card>
          )}

          {enrollment.course.modules.map((module) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">
                      Módulo {module.order}: {module.title}
                    </span>
                  </span>
                  <Badge variant="secondary">
                    {module.lessons.length} aulas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {module.lessons.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma aula neste módulo.
                  </p>
                )}

                {module.lessons.map((lesson) => {
                  const isCompleted = lesson.progress[0]?.completed ?? false

                  return (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          Aula {lesson.order}: {lesson.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Video className="w-3.5 h-3.5" />
                            {lesson.videoDuration
                              ? `${Math.ceil(lesson.videoDuration / 60)} min`
                              : 'Sem duração'}
                          </span>
                          {lesson.isFree && <span>Grátis</span>}
                        </p>
                      </div>

                      <Link
                        href={`?lesson=${lesson.id}`}
                        className="h-8 px-2.5 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:bg-accent transition-colors"
                      >
                        Assistir
                      </Link>

                      <form action={toggleLessonCompleteAction}>
                        <input
                          type="hidden"
                          name="lessonId"
                          value={lesson.id}
                        />
                        <button
                          type="submit"
                          className="h-8 px-2.5 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:bg-accent transition-colors"
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              Concluída
                            </>
                          ) : (
                            <>
                              <Circle className="w-4 h-4" />
                              Marcar
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
