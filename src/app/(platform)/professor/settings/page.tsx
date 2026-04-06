import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentThemeSettings } from '@/app/actions/theme-actions'
import { updateProfessorSettingsAction } from '@/app/actions/professor-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ProfessorSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const theme = await getCurrentThemeSettings()

  async function submitProfessorSettings(formData: FormData) {
    'use server'

    await updateProfessorSettingsAction(formData)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1">
          Personalize identidade visual e tema da sua plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tema visual</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={submitProfessorSettings}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <label className="text-sm">
              Cor primária
              <input
                type="color"
                name="primaryColor"
                defaultValue={theme?.primaryColor ?? '#dc2626'}
                className="mt-1 h-10 w-full rounded-md border border-border bg-input p-1"
              />
            </label>

            <label className="text-sm">
              Cor secundária
              <input
                type="color"
                name="secondaryColor"
                defaultValue={theme?.secondaryColor ?? '#7f1d1d'}
                className="mt-1 h-10 w-full rounded-md border border-border bg-input p-1"
              />
            </label>

            <label className="text-sm">
              Cor de acento
              <input
                type="color"
                name="accentColor"
                defaultValue={theme?.accentColor ?? '#ef4444'}
                className="mt-1 h-10 w-full rounded-md border border-border bg-input p-1"
              />
            </label>

            <label className="text-sm">
              Cor de fundo
              <input
                type="color"
                name="backgroundColor"
                defaultValue={theme?.backgroundColor ?? '#0a0a0a'}
                className="mt-1 h-10 w-full rounded-md border border-border bg-input p-1"
              />
            </label>

            <label className="text-sm">
              Cor de superfície
              <input
                type="color"
                name="surfaceColor"
                defaultValue={theme?.surfaceColor ?? '#111111'}
                className="mt-1 h-10 w-full rounded-md border border-border bg-input p-1"
              />
            </label>

            <label className="text-sm">
              Cor do texto
              <input
                type="color"
                name="textColor"
                defaultValue={theme?.textColor ?? '#ffffff'}
                className="mt-1 h-10 w-full rounded-md border border-border bg-input p-1"
              />
            </label>

            <input
              name="fontFamily"
              defaultValue={theme?.fontFamily ?? 'Inter'}
              placeholder="Fonte base"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />

            <input
              name="headingFont"
              defaultValue={theme?.headingFont ?? 'Oswald'}
              placeholder="Fonte de títulos"
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />

            <input
              name="niche"
              defaultValue={theme?.niche ?? 'default'}
              placeholder="Nicho (default, muaythai, fitness...)"
              className="md:col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm"
            />

            <div className="md:col-span-2">
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Salvar configurações
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
