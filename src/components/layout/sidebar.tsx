'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Dumbbell,
  MessageSquare,
  Video,
  UserCircle,
  Users,
  GraduationCap,
  CreditCard,
  BadgeCheck,
  Award,
  Settings,
  Shield,
  ShieldCheck,
  FileText,
  Flame,
  LogOut,
  X,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { logoutAction } from '@/modules/auth/actions'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.STUDENT.DASHBOARD, icon: LayoutDashboard },
  { label: 'Catálogo', href: '/student/courses/catalog', icon: BookOpen },
  { label: 'Meus cursos', href: ROUTES.STUDENT.COURSES, icon: BookOpen },
  {
    label: 'Certificados',
    href: ROUTES.STUDENT.CERTIFICATES,
    icon: BadgeCheck,
  },
  { label: 'Assinatura', href: ROUTES.STUDENT.SUBSCRIPTION, icon: CreditCard },
  { label: 'Conquistas', href: ROUTES.STUDENT.ACHIEVEMENTS, icon: Award },
  { label: 'Treinos', href: ROUTES.STUDENT.TRAININGS, icon: Dumbbell },
  { label: 'Feedback', href: ROUTES.STUDENT.FEEDBACK, icon: MessageSquare },
  { label: 'Suporte', href: ROUTES.STUDENT.SUPPORT, icon: MessageSquare },
  { label: 'Lives', href: ROUTES.STUDENT.LIVES, icon: Video },
  { label: 'Meu perfil', href: ROUTES.STUDENT.PROFILE, icon: UserCircle },
  { label: 'Privacidade', href: ROUTES.STUDENT.PRIVACY, icon: Shield },
]

const PROFESSOR_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: ROUTES.PROFESSOR.DASHBOARD,
    icon: LayoutDashboard,
  },
  { label: 'Cursos', href: ROUTES.PROFESSOR.COURSES, icon: BookOpen },
  { label: 'Alunos', href: ROUTES.PROFESSOR.STUDENTS, icon: Users },
  { label: 'Treinos', href: ROUTES.PROFESSOR.TRAININGS, icon: Dumbbell },
  { label: 'Feedback', href: ROUTES.PROFESSOR.FEEDBACK, icon: MessageSquare },
  { label: 'Suporte', href: ROUTES.PROFESSOR.SUPPORT, icon: MessageSquare },
  { label: 'Lives', href: ROUTES.PROFESSOR.LIVES, icon: Video },
  {
    label: 'Configurações',
    href: ROUTES.PROFESSOR.SETTINGS,
    icon: Settings,
  },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard },
  { label: 'Usuários', href: ROUTES.ADMIN.USERS, icon: Users },
  {
    label: 'Professores',
    href: ROUTES.ADMIN.PROFESSORS,
    icon: GraduationCap,
  },
  { label: 'Alunos', href: ROUTES.ADMIN.STUDENTS, icon: UserCircle },
  { label: 'Cursos', href: ROUTES.ADMIN.COURSES, icon: BookOpen },
  { label: 'Planos', href: ROUTES.ADMIN.PLANS, icon: CreditCard },
  {
    label: 'Assinaturas',
    href: ROUTES.ADMIN.SUBSCRIPTIONS,
    icon: BadgeCheck,
  },
  {
    label: 'Segurança',
    href: ROUTES.ADMIN.SECURITY,
    icon: Shield,
  },
  { label: 'Suporte', href: ROUTES.ADMIN.SUPPORT, icon: MessageSquare },
  { label: 'Lives', href: ROUTES.ADMIN.LIVES, icon: Video },
  {
    label: 'Configurações',
    href: ROUTES.ADMIN.SETTINGS,
    icon: Settings,
  },
  { label: 'Auditoria', href: ROUTES.ADMIN.AUDIT, icon: ShieldCheck },
  { label: 'Dados LGPD', href: ROUTES.ADMIN.DATA_REQUESTS, icon: FileText },
]

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  user: {
    name: string | null
    email: string | null
    image: string | null
    role: string
  }
  onClose?: () => void
}

export function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname()

  const navItems =
    user.role === 'ADMIN'
      ? ADMIN_NAV
      : user.role === 'PROFESSOR'
        ? PROFESSOR_NAV
        : STUDENT_NAV

  return (
    <aside className="h-full w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          onClick={onClose}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">
            Plataforma<span className="text-primary">J</span>
          </span>
        </Link>
        {/* Close button (mobile only) */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-3">
        <nav className="px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/student/dashboard' &&
                item.href !== '/professor/dashboard' &&
                item.href !== '/admin/dashboard' &&
                pathname.startsWith(item.href + '/'))

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <Avatar size="sm">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback>
              {getInitials(user.name ?? user.email ?? 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.name ?? 'Usuário'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <ThemeToggle />
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
