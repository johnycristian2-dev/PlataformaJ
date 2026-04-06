import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSubscriptionAccessSnapshot } from '@/lib/subscriptions'
import { ROUTES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { enrollInCourseAction } from '@/app/actions/course-actions'
import { openPremiumCheckoutAction } from '@/app/actions/subscription-actions'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { BookOpen, Users, Crown } from 'lucide-react'
import type { CourseLevel } from '@prisma/client'

interface PageProps {
  searchParams: Promise<{
    q?: string
    level?: string
    niche?: string
    professor?: string
    sort?: string
    goal?: string
    track?: string
  }>
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Iniciante',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
  ALL_LEVELS: 'Todos os níveis',
}

function normalizeNiche(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function getNicheQueryVariants(rawNiche: string) {
  const normalized = normalizeNiche(rawNiche)
  if (!normalized) return [] as string[]

  const variants = new Set<string>([rawNiche.trim(), normalized])

  if (normalized === 'muaythai') {
    variants.add('Muay Thai')
    variants.add('muay thai')
    variants.add('muay-thai')
  }

  if (normalized === 'fitness') {
    variants.add('Fitness')
    variants.add('Academia & Fitness')
    variants.add('Academia e Fitness')
  }

  return Array.from(variants).filter(Boolean)
}

function getRecommendationKeywords(goal: string, track: string) {
  const keywords = new Set<string>()

  switch (goal) {
    case 'Emagrecimento':
      keywords.add('emagrecimento')
      keywords.add('fitness')
      keywords.add('cardio')
      break
    case 'Hipertrofia':
      keywords.add('hipertrofia')
      keywords.add('forca')
      keywords.add('fitness')
      break
    case 'Condicionamento':
      keywords.add('condicionamento')
      keywords.add('resistencia')
      break
    case 'Performance técnica':
      keywords.add('tecnica')
      keywords.add('performance')
      keywords.add('muay thai')
      break
    case 'Saúde e consistência':
      keywords.add('saude')
      keywords.add('bem-estar')
      keywords.add('iniciante')
      break
  }

  switch (track) {
    case 'Cursos':
      keywords.add('curso')
      break
    case 'Treinos':
      keywords.add('treino')
      keywords.add('fitness')
      break
    case 'Lives':
      keywords.add('live')
      keywords.add('mentoria')
      break
    case 'Misto':
      keywords.add('jornada')
      break
  }

  return Array.from(keywords)
}

const getCatalogProfessors = unstable_cache(
  () =>
    prisma.user.findMany({
      where: {
        role: 'PROFESSOR',
        coursesCreated: { some: { isPublished: true } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ['catalog-professors'],
  { revalidate: 300 },
)

const getCatalogCourses = unstable_cache(
  (
    q: string,
    level: string,
    niche: string,
    professor: string,
    sort: string,
    goal: string,
    track: string,
  ) => {
    const nicheVariants = getNicheQueryVariants(niche)
    const recommendationKeywords = getRecommendationKeywords(goal, track)
    const andConditions: object[] = []

    if (q) {
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { category: { contains: q, mode: 'insensitive' as const } },
        ],
      })
    }

    if (level) {
      andConditions.push({ level: level as CourseLevel })
    }

    if (nicheVariants.length > 0) {
      andConditions.push({
        OR: nicheVariants.map((value) => ({
          category: { contains: value, mode: 'insensitive' as const },
        })),
      })
    }

    if (professor) {
      andConditions.push({ professorId: professor })
    }

    if (recommendationKeywords.length > 0) {
      andConditions.push({
        OR: [
          ...recommendationKeywords.map((value) => ({
            title: { contains: value, mode: 'insensitive' as const },
          })),
          ...recommendationKeywords.map((value) => ({
            description: { contains: value, mode: 'insensitive' as const },
          })),
          ...recommendationKeywords.map((value) => ({
            category: { contains: value, mode: 'insensitive' as const },
          })),
          { tags: { hasSome: recommendationKeywords } },
        ],
      })
    }

    const where = {
      isPublished: true,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    }
    const orderBy =
      sort === 'popular'
        ? { enrollments: { _count: 'desc' as const } }
        : sort === 'az'
          ? { title: 'asc' as const }
          : { createdAt: 'desc' as const }
    return prisma.course.findMany({
      where,
      include: {
        professor: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy,
    })
  },
  ['catalog-courses'],
  { revalidate: 60 },
)

const getCatalogEnrollments = unstable_cache(
  async (userId: string) =>
    prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true, progress: true },
    }),
  ['catalog-enrollments'],
  { revalidate: 60 },
)

const getCatalogNiches = unstable_cache(
  async () => {
    const rows = await prisma.course.findMany({
      where: {
        isPublished: true,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })

    return rows
      .map((r) => r.category)
      .filter((value): value is string => !!value)
  },
  ['catalog-niches'],
  { revalidate: 300 },
)

export default async function StudentCatalogPage({ searchParams }: PageProps) {
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/professor/dashboard')
  }

  const {
    q = '',
    level = '',
    niche = '',
    professor = '',
    sort = '',
    goal = '',
    track = '',
  } = await searchParams

  const [courses, enrollments, professors, niches, subscriptionSnapshot] =
    await Promise.all([
      getCatalogCourses(q, level, niche, professor, sort, goal, track),
      getCatalogEnrollments(session.user.id),
      getCatalogProfessors(),
      getCatalogNiches(),
      getSubscriptionAccessSnapshot(session.user.id),
    ])

  const hasFullAccess = subscriptionSnapshot?.accessLevel === 'FULL'
  const hasPartialAccess = subscriptionSnapshot?.accessLevel === 'PARTIAL'

  const enrollmentMap = new Map(
    enrollments.map((e) => [e.courseId, e.progress]),
  )

  return (
    <div className="p-6 max-w-[1240px] mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Catálogo de cursos
        </h1>
        <p className="text-muted-foreground mt-1">
          Descubra novos conteúdos e faça sua matrícula.
        </p>
      </div>

      {(goal || track) && (
        <Card className="border-primary/20 bg-primary/10">
          <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                Recomendado pela sua jornada
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {goal && `Objetivo: ${goal}`}
                {goal && track ? ' • ' : ''}
                {track && `Trilha: ${track}`}
              </p>
            </div>
            <Link
              href={ROUTES.STUDENT.ONBOARDING}
              className="text-sm text-primary hover:underline"
            >
              Ajustar onboarding
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Suspense
        fallback={
          <div className="h-9 w-full rounded-md bg-accent/30 animate-pulse" />
        }
      >
        <CatalogFilters professors={professors} niches={niches} />
      </Suspense>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {courses.length === 0
          ? 'Nenhum curso encontrado.'
          : `${courses.length} curso${courses.length !== 1 ? 's' : ''} encontrado${courses.length !== 1 ? 's' : ''}`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {courses.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum curso encontrado com estes filtros.
            </CardContent>
          </Card>
        )}

        {courses.map((course: (typeof courses)[number]) => {
          const enrollmentProgress = enrollmentMap.get(course.id)
          const isEnrolled = enrollmentProgress !== undefined
          const needsSubscriptionForNewEnrollment =
            course.isPremium && !hasFullAccess
          const needsSubscriptionForEnrolledCourse =
            course.isPremium && !hasFullAccess && !hasPartialAccess

          return (
            <Card key={course.id} className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{course.title}</span>
                  </span>
                  {course.isPremium && (
                    <Badge variant="premium" className="shrink-0">
                      <Crown className="w-3.5 h-3.5 mr-1" /> Premium
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex flex-col flex-1">
                {course.thumbnail && (
                  <div className="relative overflow-hidden rounded-lg border border-border aspect-[16/9]">
                    <Image
                      src={course.thumbnail}
                      alt={`Banner do curso ${course.title}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                  </div>
                )}

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {course.description || 'Sem descrição'}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {course.level && (
                    <Badge variant="secondary">
                      {LEVEL_LABELS[course.level] ?? course.level}
                    </Badge>
                  )}
                  <span>{course.totalModules} módulos</span>
                  <span>{course.totalLessons} aulas</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {course._count.enrollments}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Professor: {course.professor.name || 'Professor'}
                </p>

                {/* Progress bar for enrolled courses */}
                {isEnrolled && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Seu progresso</span>
                      <span className="font-medium text-foreground">
                        {enrollmentProgress}%
                      </span>
                    </div>
                    <Progress value={enrollmentProgress} size="sm" />
                  </div>
                )}

                <div className="pt-1 mt-auto">
                  {isEnrolled && needsSubscriptionForEnrolledCourse ? (
                    <form action={openPremiumCheckoutAction}>
                      <input type="hidden" name="planSlug" value="premium" />
                      <input
                        type="hidden"
                        name="successPath"
                        value="/student/courses/catalog"
                      />
                      <input
                        type="hidden"
                        name="cancelPath"
                        value="/student/courses/catalog"
                      />
                      <button
                        type="submit"
                        className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                      >
                        Assinar para continuar
                      </button>
                    </form>
                  ) : isEnrolled ? (
                    <Link
                      href={`/student/courses/${course.id}`}
                      className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center hover:opacity-90 transition-opacity"
                    >
                      {(enrollmentProgress ?? 0) > 0
                        ? 'Continuar curso'
                        : 'Ir para o curso'}
                    </Link>
                  ) : needsSubscriptionForNewEnrollment ? (
                    <form action={openPremiumCheckoutAction}>
                      <input type="hidden" name="planSlug" value="premium" />
                      <input
                        type="hidden"
                        name="successPath"
                        value="/student/courses/catalog"
                      />
                      <input
                        type="hidden"
                        name="cancelPath"
                        value="/student/courses/catalog"
                      />
                      <button
                        type="submit"
                        className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                      >
                        Assinar para acessar
                      </button>
                    </form>
                  ) : (
                    <form action={enrollInCourseAction}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <button
                        type="submit"
                        className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                      >
                        Matricular agora
                      </button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
