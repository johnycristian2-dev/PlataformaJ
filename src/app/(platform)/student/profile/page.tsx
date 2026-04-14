import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateStudentProfileAction } from '@/modules/student/actions'
import { ROUTES } from '@/lib/constants'

type StudentProfilePageProps = {
  searchParams: Promise<{ application?: string }>
}

export default async function StudentProfilePage({
  searchParams,
}: StudentProfilePageProps) {
  const { application } = await searchParams
  const hasProfessorApplicationPending = application === 'professor-pending'

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      studentProfile: true,
    },
  })

  if (!user) redirect('/login')

  async function submitStudentProfile(formData: FormData) {
    'use server'

    await updateStudentProfileAction(formData)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Meu perfil
        </h1>
        <p className="text-muted-foreground mt-1">
          Atualize seus dados pessoais e informações de treino.
        </p>
        {hasProfessorApplicationPending && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Recebemos sua candidatura para professor.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Seu cadastro foi enviado para análise da equipe admin. Você será
              avisado assim que houver atualização.
            </p>
          </div>
        )}
        {!user.studentProfile?.onboardingCompleted && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
            <p className="text-sm font-semibold">
              Seu onboarding ainda não foi concluído.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Complete sua jornada guiada para receber recomendações e metas
              mais alinhadas com seu objetivo.
            </p>
            <Link
              href={ROUTES.STUDENT.ONBOARDING}
              className="inline-flex mt-3 h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Completar onboarding
            </Link>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={submitStudentProfile}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <input
              name="name"
              defaultValue={user.name ?? ''}
              placeholder="Nome"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
              required
              minLength={2}
            />
            <input
              name="phone"
              defaultValue={user.profile?.phone ?? ''}
              placeholder="Telefone"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="city"
              defaultValue={user.profile?.city ?? ''}
              placeholder="Cidade"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="state"
              defaultValue={user.profile?.state ?? ''}
              placeholder="Estado"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <textarea
              name="bio"
              defaultValue={user.profile?.bio ?? ''}
              rows={3}
              placeholder="Bio"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />

            <h3 className="md:col-span-2 font-semibold mt-3">
              Dados de treino
            </h3>

            <input
              name="height"
              type="number"
              step="0.1"
              min={0}
              defaultValue={user.studentProfile?.height ?? ''}
              placeholder="Altura (cm)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="weight"
              type="number"
              step="0.1"
              min={0}
              defaultValue={user.studentProfile?.weight ?? ''}
              placeholder="Peso (kg)"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="fitnessLevel"
              defaultValue={user.studentProfile?.fitnessLevel ?? ''}
              placeholder="Nível físico (iniciante/intermediário/avançado)"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="primaryGoal"
              defaultValue={user.studentProfile?.primaryGoal ?? ''}
              placeholder="Objetivo principal"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="preferredTrack"
              defaultValue={user.studentProfile?.preferredTrack ?? ''}
              placeholder="Trilha preferida (cursos/treinos/lives/misto)"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="weeklyCommitment"
              type="number"
              min={1}
              max={7}
              defaultValue={user.studentProfile?.weeklyCommitment ?? ''}
              placeholder="Compromisso semanal (sessões)"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <input
              name="monthlyGoalTarget"
              type="number"
              min={4}
              max={31}
              defaultValue={user.studentProfile?.monthlyGoalTarget ?? ''}
              placeholder="Meta mensal (dias ativos no mês)"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />
            <textarea
              name="goals"
              defaultValue={user.studentProfile?.goals ?? ''}
              rows={3}
              placeholder="Objetivos"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
            <textarea
              name="medicalNotes"
              defaultValue={user.studentProfile?.medicalNotes ?? ''}
              rows={3}
              placeholder="Observações médicas"
              className="md:col-span-2 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />

            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Salvar perfil
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
