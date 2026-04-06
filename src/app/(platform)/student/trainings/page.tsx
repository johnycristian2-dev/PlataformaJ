import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dumbbell,
  Calendar,
  UserCircle,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 10

const getStudentTrainingsPage = unstable_cache(
  async (studentId: string, page: number) => {
    const skip = (page - 1) * PAGE_SIZE

    const [trainings, total] = await Promise.all([
      prisma.trainingPlan.findMany({
        where: { studentId },
        include: {
          coach: { select: { name: true, email: true } },
          _count: { select: { exercises: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.trainingPlan.count({ where: { studentId } }),
    ])

    return { trainings, total }
  },
  ['student-trainings-page'],
  { revalidate: 30 },
)

interface StudentTrainingsPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function StudentTrainingsPage({
  searchParams,
}: StudentTrainingsPageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)
  const { trainings, total } = await getStudentTrainingsPage(
    session.user.id,
    page,
  )
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Meus treinos
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe seus planos de treino personalizados.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {trainings.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Você ainda não possui planos de treino.
            </CardContent>
          </Card>
        )}

        {trainings.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <Dumbbell className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{t.name}</span>
                </span>
                <Badge variant={t.isActive ? 'success' : 'secondary'}>
                  {t.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {t.objective || 'Sem objetivo definido'}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p className="inline-flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {t._count.exercises} exercícios
                </p>
                <p className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Início: {formatDate(t.startDate)}
                </p>
                <p className="inline-flex items-center gap-1 col-span-2">
                  <UserCircle className="w-3.5 h-3.5" />
                  Coach: {t.coach.name ?? t.coach.email}
                </p>
              </div>

              {t.frequency && (
                <p className="text-xs text-muted-foreground">
                  Frequência: {t.frequency}
                </p>
              )}

              <div className="pt-1">
                <Link
                  href={`/student/trainings/${t.id}`}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                >
                  Abrir treino
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Página {page} de {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`?page=${Math.max(1, page - 1)}`}
            className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
          >
            Anterior
          </Link>
          <Link
            href={`?page=${Math.min(totalPages, page + 1)}`}
            className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
          >
            Próxima
          </Link>
        </div>
      </div>
    </div>
  )
}
