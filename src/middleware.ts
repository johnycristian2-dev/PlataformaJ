import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type MiddlewareAuthRequest = NextRequest & {
  auth?: {
    user?: {
      role?: string
    }
  } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: rota de dashboard por role
// ─────────────────────────────────────────────────────────────────────────────
function dashboardForRole(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard'
    case 'PROFESSOR':
      return '/professor/dashboard'
    default:
      return '/student/dashboard'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default auth(function middleware(req: MiddlewareAuthRequest) {
  const { nextUrl } = req
  const session = req.auth
  const isLoggedIn = !!session?.user
  const role: string = session?.user?.role ?? ''
  const pathname = nextUrl.pathname
  const roleParam = nextUrl.searchParams.get('role')?.toLowerCase().trim()
  const wantsProfessorApplication =
    pathname.startsWith('/register') &&
    (roleParam === 'professor' || roleParam === 'teacher')

  // ── Rotas de autenticação ─────────────────────────────────────────────────
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')

  if (isAuthRoute) {
    // Aluno logado pode abrir o fluxo de candidatura em /register?role=professor
    if (isLoggedIn && wantsProfessorApplication && role === 'STUDENT') {
      return NextResponse.next()
    }

    // Usuário já autenticado → redireciona para o dashboard correto
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(dashboardForRole(role), nextUrl))
    }
    return NextResponse.next()
  }

  // ── Rotas protegidas — exige autenticação ─────────────────────────────────
  const isProtected =
    pathname.startsWith('/student') ||
    pathname.startsWith('/professor') ||
    pathname.startsWith('/admin')

  if (isProtected && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(`${pathname}${nextUrl.search}`)
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl),
    )
  }

  // ── Controle de role — Admin ──────────────────────────────────────────────
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(dashboardForRole(role), nextUrl))
  }

  // ── Controle de role — Professor ─────────────────────────────────────────
  if (
    pathname.startsWith('/professor') &&
    role !== 'PROFESSOR' &&
    role !== 'ADMIN'
  ) {
    return NextResponse.redirect(new URL(dashboardForRole(role), nextUrl))
  }

  // ── Controle de role — Aluno ──────────────────────────────────────────────
  if (
    pathname.startsWith('/student') &&
    role !== 'STUDENT' &&
    role !== 'ADMIN'
  ) {
    return NextResponse.redirect(new URL(dashboardForRole(role), nextUrl))
  }

  return NextResponse.next()
})

// ─────────────────────────────────────────────────────────────────────────────
// MATCHER — aplica o middleware apenas nas rotas relevantes
// Exclui arquivos estáticos, imagens, API routes do NextAuth
// ─────────────────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    /*
     * Aplica o middleware em todas as rotas EXCETO:
     * - _next/static  (arquivos estáticos)
     * - _next/image   (otimização de imagem)
     * - favicon.ico
     * - api/auth      (Next-Auth handler — não deve ser interceptado)
     * - public/       (assets públicos)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/auth|public).*)',
  ],
}
