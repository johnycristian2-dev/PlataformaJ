import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { completeStudentOnboardingAction } from '@/app/actions/student-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

function getRecommendedCatalogHref(params: {
  primaryGoal?: string | null
  preferredTrack?: string | null
}) {
  const searchParams = new URLSearchParams()

  if (params.primaryGoal) {
    searchParams.set('goal', params.primaryGoal)
  }

  if (params.preferredTrack) {
    searchParams.set('track', params.preferredTrack)
  }

  searchParams.set('sort', 'popular')

  return `${ROUTES.STUDENT.COURSES}/catalog?${searchParams.toString()}`
}

export default async function StudentOnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { studentProfile: true },
  })

  if (!user) redirect('/login')

  const recommendedCatalogHref = getRecommendedCatalogHref({
    primaryGoal: user.studentProfile?.primaryGoal,
    preferredTrack: user.studentProfile?.preferredTrack,
  })

  async function submitOnboarding(formData: FormData) {
    'use server'

    await completeStudentOnboardingAction(formData)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold">
            Jornada inicial
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Configure sua trilha ideal
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Em menos de 2 minutos, ajustamos a plataforma para te mostrar o
            próximo passo certo, o foco ideal e metas coerentes com sua rotina.
          </p>
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader>
            <CardTitle className="text-xl">Onboarding guiado</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={submitOnboarding}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Objetivo principal
                </label>
                <select
                  name="primaryGoal"
                  defaultValue={user.studentProfile?.primaryGoal ?? ''}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm w-full"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="Emagrecimento">Emagrecimento</option>
                  <option value="Hipertrofia">Hipertrofia</option>
                  <option value="Condicionamento">Condicionamento</option>
                  <option value="Performance técnica">
                    Performance técnica
                  </option>
                  <option value="Saúde e consistência">
                    Saúde e consistência
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nível atual</label>
                <select
                  name="fitnessLevel"
                  defaultValue={user.studentProfile?.fitnessLevel ?? ''}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm w-full"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="iniciante">Iniciante</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Trilha preferida</label>
                <select
                  name="preferredTrack"
                  defaultValue={user.studentProfile?.preferredTrack ?? ''}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm w-full"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="Cursos">Cursos</option>
                  <option value="Treinos">Treinos</option>
                  <option value="Lives">Lives</option>
                  <option value="Misto">Misto</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Compromisso semanal
                </label>
                <select
                  name="weeklyCommitment"
                  defaultValue={String(
                    user.studentProfile?.weeklyCommitment ?? '',
                  )}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm w-full"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="2">2 sessões por semana</option>
                  <option value="3">3 sessões por semana</option>
                  <option value="4">4 sessões por semana</option>
                  <option value="5">5 sessões por semana</option>
                  <option value="6">6 sessões por semana</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Meta mensal</label>
                <select
                  name="monthlyGoalTarget"
                  defaultValue={String(
                    user.studentProfile?.monthlyGoalTarget ?? '',
                  )}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm w-full"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="8">8 dias ativos</option>
                  <option value="12">12 dias ativos</option>
                  <option value="16">16 dias ativos</option>
                  <option value="20">20 dias ativos</option>
                  <option value="24">24 dias ativos</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Meta detalhada</label>
                <textarea
                  name="goals"
                  rows={4}
                  defaultValue={user.studentProfile?.goals ?? ''}
                  placeholder="Ex.: perder 5kg, melhorar mobilidade, voltar a treinar 4x por semana"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit">Salvar e montar minha jornada</Button>
                {user.studentProfile?.onboardingCompleted && (
                  <Link
                    href={recommendedCatalogHref}
                    className="h-10 px-4 rounded-lg border border-border text-sm inline-flex items-center hover:bg-accent transition-colors"
                  >
                    Ver catálogo recomendado
                  </Link>
                )}
                <Link
                  href={ROUTES.STUDENT.DASHBOARD}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar ao dashboard
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
