'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Flame } from 'lucide-react'
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
import { loginAction } from '@/modules/auth/actions'
import { SignInSchema, type SignInInput } from '@/lib/validations'

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? undefined
  const verified = searchParams.get('verified') === '1'
  const [showPw, setShowPw] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
  })

  async function onSubmit(data: SignInInput) {
    const result = await loginAction({ ...data, callbackUrl })
    if (result && !result.success) {
      setError('root', {
        message:
          result.error === 'CredentialsSignin'
            ? 'Email ou senha inválidos. Se ainda não confirmou seu email, verifique sua caixa de entrada.'
            : result.error,
      })
    }
    // Em caso de sucesso loginAction lança NEXT_REDIRECT — navegação automática
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Entrar na plataforma</CardTitle>
        <CardDescription>Acesse sua conta e continue treinando</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {verified && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              Email verificado com sucesso! Faça login para continuar.
            </div>
          )}
          {errors.root && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}

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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                tabIndex={-1}
              >
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
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
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            loading={isSubmitting}
          >
            Entrar
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Não tem conta?{' '}
          <Link
            href="/register"
            className="text-primary hover:underline font-medium"
          >
            Criar conta grátis
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
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

        <Suspense
          fallback={
            <div className="h-72 animate-pulse rounded-xl bg-card border border-border" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
