import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getDashboardRoute } from '@/lib/utils'
import {
  Play,
  Star,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Trophy,
  Users,
  Video,
  Dumbbell,
  ChevronRight,
  Flame,
  TrendingUp,
  Clock,
  LogIn,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Plataforma Premium de Ensino Online | Muay Thai & Fitness',
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS ESTÁTICOS
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '2.400+', label: 'Alunos Ativos', icon: Users },
  { value: '98%', label: 'Satisfação', icon: Star },
  { value: '120+', label: 'Horas de Conteúdo', icon: Video },
  { value: '48', label: 'Cursos Publicados', icon: Trophy },
] as const

const FEATURES = [
  {
    icon: Flame,
    title: 'Cursos em Vídeo Premium',
    description:
      'Aulas HD gravadas por mestres reais, organizadas em módulos progressivos com progresso individual.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Zap,
    title: 'Treinos Personalizados',
    description:
      'Cada aluno recebe um plano de treino individualizado com monitoramento direto do professor.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Video,
    title: 'Lives Semanais Exclusivas',
    description:
      'Sessões ao vivo exclusivas para Premium: Q&A, análise técnica e conteúdo extra com o mestre.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Shield,
    title: 'Feedback Individual',
    description:
      'Envie seus vídeos e receba análise técnica personalizada diretamente do professor.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Acompanhamento de Progresso',
    description:
      'Dashboard completo com histórico de aulas, evolução física e relatórios de desempenho.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    icon: Trophy,
    title: 'Certificados de Conclusão',
    description:
      'Certificados digitais validados ao concluir cada curso. Comprove sua evolução.',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
] as const

const NICHES = [
  {
    id: 'muaythai',
    label: 'Muay Thai',
    description:
      'Da guarda ao combate. Técnica, força e mentalidade de campeão.',
    color: 'from-red-900/60 to-red-950/80',
    border: 'border-red-800/40',
    accent: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400',
    icon: '🥊',
    courses: 12,
    students: 850,
  },
  {
    id: 'fitness',
    label: 'Academia & Fitness',
    description:
      'Hipertrofia, emagrecimento e performance. Ciência aplicada ao treino real.',
    color: 'from-zinc-900/60 to-zinc-950/80',
    border: 'border-zinc-700/40',
    accent: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-400',
    icon: '💪',
    courses: 18,
    students: 1200,
  },
] as const

const PLANS = [
  {
    name: 'Básico',
    price: '97',
    description: 'Para quem está começando',
    isPremium: false,
    cta: 'Começar Agora',
    features: [
      'Acesso a cursos fundamentais',
      'Aulas em vídeo HD',
      'Material complementar',
      'Acesso à comunidade',
      'Suporte por e-mail',
    ],
    unavailable: [
      'Lives exclusivas',
      'Treino personalizado',
      'Feedback individual',
    ],
  },
  {
    name: 'Premium',
    price: '197',
    description: 'A experiência completa',
    isPremium: true,
    cta: 'Quero o Premium',
    features: [
      'Tudo do plano Básico',
      'Acesso a TODOS os cursos',
      'Lives semanais exclusivas',
      'Treino personalizado',
      'Feedback individual do professor',
      'Avaliação física mensal',
      'Suporte prioritário via WhatsApp',
      'Certificados de conclusão',
    ],
    unavailable: [],
  },
] as const

const TESTIMONIALS = [
  {
    name: 'Carlos Mendes',
    role: 'Aluno Premium — Muay Thai',
    text: 'Em 6 meses de plataforma, evolui mais do que em 2 anos indo à academia por conta própria. O Mestre Silva é excepcional e o feedback individual fez toda a diferença.',
    stars: 5,
    avatar: 'CM',
  },
  {
    name: 'Ana Rodrigues',
    role: 'Aluna Premium — Fitness',
    text: 'Os treinos personalizados do Coach Thiago transformaram meu corpo e minha mentalidade. A plataforma é linda, intuitiva e o conteúdo é de outro nível.',
    stars: 5,
    avatar: 'AR',
  },
  {
    name: 'Pedro Alves',
    role: 'Aluno Básico — Muay Thai',
    text: 'Já testei várias plataformas. Essa é a única que parece um produto profissional de verdade. Os cursos são organizados, os vídeos são excelentes.',
    stars: 5,
    avatar: 'PA',
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE — LANDING
// ─────────────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const session = await auth()
  const dashboardHref = session?.user?.role
    ? getDashboardRoute(session.user.role)
    : '/login'

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── GRID DE FUNDO ─────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-grid opacity-40 pointer-events-none"
        aria-hidden
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* NAVBAR                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <nav className="glass-dark border-b border-white/5">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-glow-red group-hover:shadow-glow-red-lg transition-shadow">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-xl tracking-tight">
                Plataforma<span className="text-primary">J</span>
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="#features"
                className="hover:text-foreground transition-colors"
              >
                Funcionalidades
              </Link>
              <Link
                href="#niches"
                className="hover:text-foreground transition-colors"
              >
                Nichos
              </Link>
              <Link
                href="#plans"
                className="hover:text-foreground transition-colors"
              >
                Planos
              </Link>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2">
              {session?.user ? (
                <Button size="sm" asChild className="btn-glow-red h-9 px-3">
                  <Link href={dashboardHref} prefetch>
                    <LayoutDashboard className="w-4 h-4" />
                    Ir para meu perfil
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-9 px-3"
                  >
                    <Link href="/login">
                      <LogIn className="w-4 h-4" />
                      Entrar
                    </Link>
                  </Button>
                  <Button size="sm" asChild className="btn-glow-red h-9 px-3">
                    <Link href="/register">
                      Começar Grátis
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Glow de fundo */}
        <div
          className="absolute inset-0 hero-glow-muaythai pointer-events-none"
          aria-hidden
        />

        {/* Elementos decorativos */}
        <div
          className="absolute top-1/4 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute bottom-1/4 left-10 w-96 h-96 rounded-full bg-primary/3 blur-3xl pointer-events-none"
          aria-hidden
        />

        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge topo */}
            <div className="flex justify-center mb-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 glass border border-primary/20 rounded-full px-4 py-1.5 text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                A plataforma de ensino Número 1 do Brasil
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-6 animate-fade-in animation-delay-100">
              DOMINE <span className="text-gradient-red">SUA</span>
              <br />
              <span className="text-gradient-red">ARTE.</span> SEJA{' '}
              <span className="text-white/90">ELITE.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in animation-delay-200">
              Cursos em vídeo, treinos personalizados, lives exclusivas e
              acompanhamento individual. A plataforma construída para quem leva
              o treino a sério.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in animation-delay-300">
              <Button size="xl" asChild className="btn-glow-red min-w-52">
                <Link href="/register">
                  <Flame className="w-5 h-5" />
                  Começar Agora
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                asChild
                className="min-w-52 group"
              >
                <Link href="#features" className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Ver Como Funciona
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto animate-fade-in animation-delay-500">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="glass border border-white/5 rounded-xl p-4 text-center"
                >
                  <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-heading font-black text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce opacity-40">
          <div className="w-0.5 h-8 bg-gradient-to-b from-transparent to-muted-foreground rounded-full" />
          <p className="text-xs text-muted-foreground">Scroll</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FEATURES                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <Badge variant="primary-subtle" className="mb-4">
              Funcionalidades
            </Badge>
            <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-tight mb-4">
              Tudo que você precisa{' '}
              <span className="text-gradient-red">em um só lugar</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Uma plataforma completa construída para criadores de conteúdo
              premium e alunos que querem performance máxima.
            </p>
          </div>

          {/* Grid de features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card
                key={feature.title}
                className="border-border/60 hover:border-primary/30 transition-all duration-300 group"
                hoverable
              >
                <CardContent className="p-6">
                  <div
                    className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="font-heading font-semibold text-lg mb-2 uppercase tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* NICHOS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section id="niches" className="relative py-24">
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-card/30 to-transparent pointer-events-none"
          aria-hidden
        />

        <div className="container mx-auto px-4 relative">
          {/* Header */}
          <div className="text-center mb-16">
            <Badge variant="primary-subtle" className="mb-4">
              Nichos
            </Badge>
            <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-tight mb-4">
              Cada nicho com sua{' '}
              <span className="text-gradient-red">identidade</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Cada professor tem sua plataforma com visual único, cores e
              identidade própria — mantendo toda a estrutura profissional.
            </p>
          </div>

          {/* Cards de nicho */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {NICHES.map((niche) => (
              <Link
                key={niche.id}
                href={`/student/courses/catalog?niche=${niche.id}`}
                className={`
                  group relative block overflow-hidden rounded-2xl border ${niche.border}
                  bg-gradient-to-br ${niche.color}
                  p-8 cursor-pointer
                  hover:scale-[1.02] transition-all duration-300
                `}
              >
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{niche.icon}</span>
                    <div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${niche.badge}`}
                      >
                        {niche.label}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-heading font-black text-2xl uppercase tracking-tight mb-2 text-white">
                    {niche.label}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    {niche.description}
                  </p>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        <span className={`font-bold ${niche.accent}`}>
                          {niche.courses}
                        </span>{' '}
                        cursos
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        <span className={`font-bold ${niche.accent}`}>
                          {niche.students}+
                        </span>{' '}
                        alunos
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* CTA abaixo dos nichos */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground text-sm mb-4">
              É professor? Crie sua plataforma personalizada.
            </p>
            <Button variant="outline-primary" asChild>
              <Link href="/register?role=professor">
                Quero ser Professor
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DEPOIMENTOS                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="primary-subtle" className="mb-4">
              Depoimentos
            </Badge>
            <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-tight mb-4">
              O que nossos{' '}
              <span className="text-gradient-red">alunos dizem</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <Card
                key={t.name}
                className="border-border/60 hover:border-primary/20 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <StarRating count={t.stars} />
                  <p className="mt-4 mb-6 text-sm text-muted-foreground leading-relaxed">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm font-heading">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PLANOS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section id="plans" className="relative py-24">
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-card/20 to-transparent pointer-events-none"
          aria-hidden
        />

        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <Badge variant="primary-subtle" className="mb-4">
              Planos
            </Badge>
            <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-tight mb-4">
              Escolha seu <span className="text-gradient-red">nível</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Sem taxas ocultas. Cancele quando quiser. Acesso imediato ao
              conteúdo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`
                  relative rounded-2xl border p-8
                  ${
                    plan.isPremium
                      ? 'border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 shadow-glow-red'
                      : 'border-border bg-card'
                  }
                `}
              >
                {plan.isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-premium px-4 py-1 text-xs">
                      ⭐ MAIS POPULAR
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-heading font-black text-2xl uppercase tracking-tight mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8">
                  <div className="flex items-end gap-1">
                    <span className="text-muted-foreground text-lg">R$</span>
                    <span className="font-heading font-black text-5xl leading-none">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1">
                      /mês
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.unavailable.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm opacity-35"
                    >
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="line-through">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.isPremium ? 'gradient' : 'outline'}
                  size="lg"
                  asChild
                >
                  <Link href={`/register?plan=${plan.name.toLowerCase()}`}>
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-sm text-muted-foreground">
            Pagamento seguro via Stripe ou Mercado Pago · Cancele a qualquer
            momento
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CTA FINAL                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-32">
        <div
          className="absolute inset-0 hero-glow-muaythai opacity-60 pointer-events-none"
          aria-hidden
        />

        <div className="container mx-auto px-4 text-center relative">
          <div className="max-w-3xl mx-auto">
            <Badge variant="premium" className="mb-6 mx-auto">
              <Flame className="w-3.5 h-3.5" />
              Comece hoje. Sem desculpas.
            </Badge>
            <h2 className="font-heading font-black text-5xl md:text-7xl uppercase tracking-tight leading-[0.9] mb-6">
              PRONTO PARA <span className="text-gradient-red">EVOLUIR?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Junte-se a mais de 2.400 alunos que escolheram a plataforma
              premium para chegar ao próximo nível.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" asChild className="btn-glow-red min-w-60">
                <Link href="/register">
                  <Flame className="w-5 h-5" />
                  Criar Minha Conta
                </Link>
              </Button>
              <Button size="xl" variant="ghost" asChild>
                <Link href="/login">
                  Já tenho conta
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            {/* Garantias */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Pagamento 100% seguro
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Acesso imediato
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                Cancele quando quiser
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-border/40">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <span className="font-heading font-bold text-xl">
                  Plataforma<span className="text-primary">J</span>
                </span>
              </Link>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                A plataforma SaaS premium para criadores de conteúdo
                educacional. Muay Thai, Fitness, Nutrição e muito mais.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider mb-4">
                Plataforma
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/login"
                    className="hover:text-foreground transition-colors"
                  >
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    className="hover:text-foreground transition-colors"
                  >
                    Criar Conta
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#plans"
                    className="hover:text-foreground transition-colors"
                  >
                    Planos
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider mb-4">
                Legal
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/termos"
                    className="hover:text-foreground transition-colors"
                  >
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacidade"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacidade
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Plataforma J. Todos os direitos
              reservados.
            </p>
            <p>Feito com ❤️ para quem treina de verdade.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
