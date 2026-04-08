'use client'

/**
 * Página /verify-email — dois modos:
 *
 * 1. ?email=xxx  (vindo do registro)
 *    → Mostra mensagem "verifique sua caixa de entrada" + botão reenviar
 *
 * 2. ?token=xxx  (usuário clicou no link do email)
 *    → Chama verifyEmailAction automaticamente ao montar a página
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Flame, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  verifyEmailAction,
  resendVerificationEmailAction,
} from '@/modules/auth/actions'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [status, setStatus] = useState<
    'idle' | 'verifying' | 'success' | 'error'
  >('idle')
  const [message, setMessage] = useState('')
  const [resendStatus, setResendStatus] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle')

  // Modo token: processa automaticamente
  useEffect(() => {
    if (!token) return
    setStatus('verifying')
    verifyEmailAction(token).then((result) => {
      if (result?.success === false) {
        setStatus('error')
        setMessage(result.error ?? 'Link inválido ou expirado.')
        return
      }
      setStatus('success')
      router.replace('/login?verified=1')
    })
  }, [token, router])

  async function handleResend() {
    if (!email || resendStatus !== 'idle') return
    setResendStatus('sending')
    const result = await resendVerificationEmailAction(email)
    if (result?.success === false) {
      setResendStatus('error')
      setMessage(result.error ?? 'Não foi possível reenviar o link agora.')
      return
    }
    setResendStatus('sent')
  }

  // ── Modo: processando token ────────────────────────────────────────────────
  if (token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verificando email</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'verifying' || status === 'idle' ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">
                Validando seu link...
              </p>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm text-destructive">{message}</p>
              <Button variant="outline" asChild>
                <Link href="/register">Criar nova conta</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Email verificado! Redirecionando...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Modo: aviso pós-cadastro ────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Mail className="w-7 h-7 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">Confirme seu email</CardTitle>
        <CardDescription>
          Enviamos um link de confirmação para{' '}
          {email ? (
            <span className="font-medium text-foreground">{email}</span>
          ) : (
            'seu endereço de email'
          )}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          <p>1. Abra sua caixa de entrada</p>
          <p>2. Clique no link &quot;Confirmar meu email&quot;</p>
          <p className="mt-1 text-xs">
            Não encontrou? Verifique a pasta de spam.
          </p>
        </div>

        {email && (
          <Button
            variant="outline"
            className="w-full"
            disabled={resendStatus !== 'idle'}
            onClick={handleResend}
          >
            {resendStatus === 'sending' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {resendStatus === 'sent'
              ? 'Link reenviado!'
              : 'Reenviar link de confirmação'}
          </Button>
        )}

        {resendStatus === 'error' && (
          <p className="text-center text-xs text-destructive">{message}</p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Já confirmou?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading font-bold text-xl">
          Plataforma<span className="text-primary">J</span>
        </span>
      </Link>
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
