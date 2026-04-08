'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Eye, EyeOff, Flame, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
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
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    mode: 'onChange',
  })

  const pwValue = watch('password', '')

  async function onSubmit(data: SignUpInput) {
    try {
      const result = await registerAction(data)
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
            <CardTitle className="text-2xl">Criar conta</CardTitle>
            <CardDescription>Comece sua jornada hoje mesmo</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              {errors.root && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {errors.root.message}
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
                Criar conta
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
