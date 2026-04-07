import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { BookOpen, Users, Crown, ArrowRight } from 'lucide-react'
import type { CourseLevel } from '@prisma/client'

interface PageProps {
  searchParams: Promise<{
    q?: string
    level?: string
    niche?: string
    professor?: string
    sort?: string
  }>
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Iniciante',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
  ALL_LEVELS: 'Todos os níveis',
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
  ['public-catalog-professors'],
  { revalidate: 300 },
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
  ['public-catalog-niches'],
  { revalidate: 300 },
)

const getCatalogCourses = unstable_cache(
  (
    q: string,
    level: string,
    niche: string,
    professor: string,
    sort: string,
  ) => {
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

    if (niche) {
      andConditions.push({
        category: { contains: niche, mode: 'insensitive' as const },
      })
    }

    if (professor) {
      andConditions.push({ professorId: professor })
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
  ['public-catalog-courses'],
  { revalidate: 60 },
)

export default async function PublicCatalogPage({ searchParams }: PageProps) {
  const {
    q = '',
    level = '',
    niche = '',
    professor = '',
    sort = '',
  } = await searchParams

  const [courses, professors, niches] = await Promise.all([
    getCatalogCourses(q, level, niche, professor, sort),
    getCatalogProfessors(),
    getCatalogNiches(),
  ])

  return (
    <div className="p-6 max-w-[1240px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            Catálogo de cursos
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore o conteúdo antes de criar sua conta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="h-9 px-3 rounded-md border border-border text-sm inline-flex items-center hover:bg-accent transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            Criar conta
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-9 w-full rounded-md bg-accent/30 animate-pulse" />
        }
      >
        <CatalogFilters professors={professors} niches={niches} />
      </Suspense>

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

        {courses.map((course) => (
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

              <div className="pt-1 mt-auto">
                <Link
                  href={`/register?course=${course.id}`}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center hover:opacity-90 transition-opacity"
                >
                  Criar conta para acessar
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
