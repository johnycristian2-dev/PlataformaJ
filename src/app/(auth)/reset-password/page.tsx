'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Flame } from 'lucide-react'
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
import { resetPasswordAction } from '@/modules/auth/actions'

const ResetFormSchema = z
  .object({
    password: z
      .string({ required_error: 'Senha é obrigatória' })
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve ter ao menos uma letra maiúscula')
      .regex(/[0-9]/, 'Senha deve ter ao menos um número'),
    confirmPassword: z.string({ required_error: 'Confirmação é obrigatória' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type ResetFormInput = z.infer<typeof ResetFormSchema>

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [status, setStatus] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetFormInput>({
    resolver: zodResolver(ResetFormSchema),
  })

  async function onSubmit(data: ResetFormInput) {
    if (!token) {
      setError('root', { message: 'Token ausente na URL' })
      return
    }

    const res = await resetPasswordAction({
      token,
      password: data.password,
      confirmPassword: data.confirmPassword,
    })

    setStatus(res)
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
            <CardTitle className="text-2xl">Redefinir senha</CardTitle>
            <CardDescription>
              Digite sua nova senha para concluir a recuperação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.root && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.root.message}
              </div>
            )}

            {status?.success && (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                <p className="text-foreground">{status.message}</p>
                <Link
                  href="/login"
                  className="mt-2 inline-block text-primary font-medium hover:underline"
                >
                  Ir para login
                </Link>
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
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

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type={showConfirmPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
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
                className="w-full"
                loading={isSubmitting}
              >
                Redefinir senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
