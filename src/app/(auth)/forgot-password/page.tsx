'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { forgotPasswordAction } from '@/modules/auth/actions'
import {
  ForgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/validations'

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    error?: string
    resetUrl?: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordInput) {
    const res = await forgotPasswordAction(data.email)
    setResult(res)

    if (!res.success && res.error) {
      setError('root', { message: res.error })
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
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
            <CardTitle className="text-2xl">Recuperar senha</CardTitle>
            <CardDescription>
              Informe seu e-mail para gerar o link de redefinição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.root && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.root.message}
              </div>
            )}

            {result?.success && (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                <p className="text-foreground">{result.message}</p>
                {result.resetUrl && (
                  <Link
                    href={result.resetUrl}
                    className="mt-2 inline-block text-primary font-medium hover:underline"
                  >
                    Abrir link de redefinição (ambiente local)
                  </Link>
                )}
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <Button
                type="submit"
                variant="gradient"
                className="w-full"
                loading={isSubmitting}
              >
                Gerar link
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Lembrou a senha?{' '}
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
