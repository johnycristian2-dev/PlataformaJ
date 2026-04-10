'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Flame, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { registerAction } from '@/modules/auth/actions'
import { SignUpSchema, type SignUpInput } from '@/lib/validations'

const PW_RULES = [
  { label: 'Mínimo 8 caracteres', test: (v: string) => v.length >= 8 },
  { label: 'Letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Número', test: (v: string) => /[0-9]/.test(v) },
]

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('role')?.toLowerCase().trim()
  const isProfessorFlow = roleParam === 'professor' || roleParam === 'teacher'
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [specialtiesText, setSpecialtiesText] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    mode: 'onChange',
    defaultValues: {
      role: isProfessorFlow ? 'PROFESSOR' : 'STUDENT',
    },
  })

  const pwValue = watch('password', '')
  const professorRoleValue = useMemo(
    () => (isProfessorFlow ? 'PROFESSOR' : 'STUDENT'),
    [isProfessorFlow],
  )

  async function onSubmit(data: SignUpInput) {
    const specialties = specialtiesText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const payload: SignUpInput = {
      ...data,
      role: professorRoleValue,
      specialties,
      cpf: data.cpf?.replace(/\D/g, ''),
      birthDate: data.birthDate?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      contactEmail: data.contactEmail?.trim() || undefined,
      contactPhone: data.contactPhone?.trim() || undefined,
      educationLevel: data.educationLevel?.trim() || undefined,
      focusArea: data.focusArea?.trim() || undefined,
      objective: data.objective?.trim() || undefined,
      experience: data.experience?.trim() || undefined,
      city: data.city?.trim() || undefined,
      state: data.state?.trim() || undefined,
      availability: data.availability?.trim() || undefined,
      instagram: data.instagram?.trim() || undefined,
      linkedin: data.linkedin?.trim() || undefined,
      portfolioUrl: data.portfolioUrl?.trim() || undefined,
    }

    try {
      const result = await registerAction(payload)
      if (result && !result.success) {
        setError('root', { message: result.error })
      }
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'digest' in error &&
        typeof (error as { digest?: string }).digest === 'string' &&
        (error as { digest: string }).digest.includes('NEXT_REDIRECT')
      ) {
        throw error
      }
      setError('root', { message: 'Erro ao criar conta. Tente novamente.' })
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow-red group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight">
              Plataforma<span className="text-primary">J</span>
            </span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isProfessorFlow ? 'Candidatura de Professor' : 'Criar conta'}
            </CardTitle>
            <CardDescription>
              {isProfessorFlow
                ? 'Responda o questionário para análise de aprovação'
                : 'Comece sua jornada hoje mesmo'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <input
                type="hidden"
                value={professorRoleValue}
                {...register('role')}
              />

              {errors.root && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}

              {isProfessorFlow && (
                <div className="rounded-lg border-2 border-primary bg-primary/15 px-4 py-3 space-y-1.5">
                  <p className="font-bold text-foreground text-sm">
                    ✓ Formulário de Candidatura
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Preencha todos os campos abaixo. Sua candidatura será analisada pela equipe admin.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              {isProfessorFlow && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="birthDate">
                        Idade (data de nascimento)
                      </Label>
                      <Input
                        id="birthDate"
                        type="date"
                        error={errors.birthDate?.message}
                        {...register('birthDate')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        placeholder="Somente números"
                        error={errors.cpf?.message}
                        {...register('cpf')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Telefone principal</Label>
                      <Input
                        id="phone"
                        placeholder="(00) 00000-0000"
                        error={errors.phone?.message}
                        {...register('phone')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contactPhone">
                        Telefone para contato
                      </Label>
                      <Input
                        id="contactPhone"
                        placeholder="(00) 00000-0000"
                        error={errors.contactPhone?.message}
                        {...register('contactPhone')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contactEmail">E-mail para contato</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contato@dominio.com"
                      error={errors.contactEmail?.message}
                      {...register('contactEmail')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="educationLevel">Escolaridade</Label>
                      <select
                        id="educationLevel"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        {...register('educationLevel')}
                      >
                        <option value="">Selecione</option>
                        <option value="Ensino médio">Ensino médio</option>
                        <option value="Técnico">Técnico</option>
                        <option value="Graduação">Graduação</option>
                        <option value="Pós-graduação">Pós-graduação</option>
                        <option value="Mestrado">Mestrado</option>
                        <option value="Doutorado">Doutorado</option>
                        <option value="Outro">Outro</option>
                      </select>
                      {errors.educationLevel?.message && (
                        <p className="text-xs text-destructive">
                          {errors.educationLevel.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="focusArea">Foco de atuação</Label>
                      <Input
                        id="focusArea"
                        placeholder="Ex: Musculação, Muay Thai, Nutrição"
                        error={errors.focusArea?.message}
                        {...register('focusArea')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="specialtiesText">
                      Especialidades (separadas por vírgula)
                    </Label>
                    <Input
                      id="specialtiesText"
                      placeholder="Ex: Hipertrofia, Emagrecimento, Treino funcional"
                      value={specialtiesText}
                      onChange={(event) =>
                        setSpecialtiesText(event.target.value)
                      }
                    />
                    {errors.specialties?.message && (
                      <p className="text-xs text-destructive">
                        {errors.specialties.message as string}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="yearsTeaching">Anos de experiência</Label>
                      <Input
                        id="yearsTeaching"
                        type="number"
                        min={0}
                        max={60}
                        placeholder="Ex: 5"
                        error={errors.yearsTeaching?.message}
                        {...register('yearsTeaching', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="availability">Disponibilidade</Label>
                      <Input
                        id="availability"
                        placeholder="Ex: Noites e finais de semana"
                        error={errors.availability?.message}
                        {...register('availability')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        placeholder="Sua cidade"
                        error={errors.city?.message}
                        {...register('city')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        placeholder="Seu estado"
                        error={errors.state?.message}
                        {...register('state')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="objective">Objetivo na plataforma</Label>
                    <textarea
                      id="objective"
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Conte seu objetivo como professor dentro da plataforma"
                      {...register('objective')}
                    />
                    {errors.objective?.message && (
                      <p className="text-xs text-destructive">
                        {errors.objective.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="experience">
                      Experiência e diferenciais
                    </Label>
                    <textarea
                      id="experience"
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Descreva sua experiência prática, certificações e resultados"
                      {...register('experience')}
                    />
                    {errors.experience?.message && (
                      <p className="text-xs text-destructive">
                        {errors.experience.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="instagram">Instagram (opcional)</Label>
                      <Input
                        id="instagram"
                        placeholder="@seuperfil"
                        error={errors.instagram?.message}
                        {...register('instagram')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="linkedin">LinkedIn (opcional)</Label>
                      <Input
                        id="linkedin"
                        placeholder="linkedin.com/in/"
                        error={errors.linkedin?.message}
                        {...register('linkedin')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="portfolioUrl">Portfólio (opcional)</Label>
                      <Input
                        id="portfolioUrl"
                        placeholder="https://"
                        error={errors.portfolioUrl?.message}
                        {...register('portfolioUrl')}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  error={errors.password?.message}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                  {...register('password')}
                />
                {/* Indicador de força da senha */}
                {pwValue.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {PW_RULES.map((rule) => (
                      <li
                        key={rule.label}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {rule.test(pwValue) ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span
                          className={
                            rule.test(pwValue)
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          }
                        >
                          {rule.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type={showConfirmPw ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        showConfirmPw ? 'Ocultar senha' : 'Mostrar senha'
                      }
                    >
                      {showConfirmPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                  {...register('confirmPassword')}
                />
              </div>

              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                loading={isSubmitting}
              >
                {isProfessorFlow ? 'Enviar Candidatura' : 'Criar conta'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Já tem uma conta?{' '}
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
