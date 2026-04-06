/**
 * Tipos TypeScript centralizados para toda a aplicação.
 * Reaproveita e expande os tipos do Prisma.
 */

import type {
  User,
  Profile,
  ProfessorProfile,
  StudentProfile,
  Plan,
  Subscription,
  Course,
  Module,
  Lesson,
  LessonProgress,
  Enrollment,
  TrainingPlan,
  TrainingExercise,
  TeacherFeedback,
  Assessment,
  AssessmentAnswer,
  LiveSession,
  LiveReplay,
  ThemeSettings,
  Role,
  SubscriptionStatus,
  CourseLevel,
  LiveStatus,
  NotificationType,
  FeedbackType,
} from '@prisma/client'

// Re-exporta enums do Prisma para uso direto
export type {
  Role,
  SubscriptionStatus,
  CourseLevel,
  LiveStatus,
  NotificationType,
  FeedbackType,
}

// ─────────────────────────────────────────────────────────────────────────────
// USUÁRIO
// ─────────────────────────────────────────────────────────────────────────────

/** Usuário completo com perfil e assinatura ativa */
export type UserWithProfile = User & {
  profile: Profile | null
  professorProfile: ProfessorProfile | null
  studentProfile: StudentProfile | null
}

/** Dados públicos de um usuário (sem senha) */
export type PublicUser = Omit<User, 'password'> & {
  profile: Profile | null
  professorProfile:
    | (ProfessorProfile & { themeSettings?: ThemeSettings | null })
    | null
}

/** Resumo de usuário para listas */
export type UserSummary = Pick<
  User,
  'id' | 'name' | 'email' | 'image' | 'role' | 'createdAt'
>

// ─────────────────────────────────────────────────────────────────────────────
// ASSINATURA
// ─────────────────────────────────────────────────────────────────────────────

export type SubscriptionWithPlan = Subscription & {
  plan: Plan
}

export type UserSubscriptionStatus = {
  isActive: boolean
  isPremium: boolean
  plan: Plan | null
  expiresAt: Date | null
}

// ─────────────────────────────────────────────────────────────────────────────
// CURSO
// ─────────────────────────────────────────────────────────────────────────────

export type CourseWithProfessor = Course & {
  professor: Pick<User, 'id' | 'name' | 'image'>
  _count?: { enrollments: number; modules: number }
}

export type CourseWithModules = Course & {
  professor: Pick<User, 'id' | 'name' | 'image'>
  modules: (Module & { lessons: Lesson[]; _count?: { lessons: number } })[]
  _count?: { enrollments: number }
}

export type CourseWithProgress = CourseWithProfessor & {
  enrollment: Enrollment | null
  progress: number
}

export type ModuleWithLessons = Module & {
  lessons: LessonWithProgress[]
}

export type LessonWithProgress = Lesson & {
  progress: LessonProgress | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TREINO
// ─────────────────────────────────────────────────────────────────────────────

export type TrainingWithDetails = TrainingPlan & {
  student: Pick<User, 'id' | 'name' | 'image' | 'email'>
  coach: Pick<User, 'id' | 'name' | 'image'>
  exercises: TrainingExercise[]
  feedbacks: TeacherFeedback[]
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

export type FeedbackWithUsers = TeacherFeedback & {
  teacher: Pick<User, 'id' | 'name' | 'image'>
  student: Pick<User, 'id' | 'name' | 'image'>
}

// ─────────────────────────────────────────────────────────────────────────────
// AVALIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export type AssessmentWithAnswers = Assessment & {
  student: Pick<User, 'id' | 'name' | 'image' | 'email'>
  answers: AssessmentAnswer[]
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE
// ─────────────────────────────────────────────────────────────────────────────

export type LiveWithProfessor = LiveSession & {
  professor: Pick<User, 'id' | 'name' | 'image'>
  replays: LiveReplay[]
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DO ALUNO — dados agregados
// ─────────────────────────────────────────────────────────────────────────────

export type StudentDashboardData = {
  user: PublicUser
  subscription: SubscriptionWithPlan | null
  enrolledCourses: CourseWithProgress[]
  activeTrainings: TrainingWithDetails[]
  recentFeedbacks: FeedbackWithUsers[]
  upcomingLives: LiveWithProfessor[]
  unreadNotifications: number
  stats: {
    totalCourses: number
    completedCourses: number
    totalLessons: number
    completedLessons: number
    overallProgress: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DO PROFESSOR — dados agregados
// ─────────────────────────────────────────────────────────────────────────────

export type ProfessorDashboardData = {
  user: PublicUser
  themeSettings: ThemeSettings | null
  stats: {
    totalStudents: number
    activeSubscriptions: number
    totalCourses: number
    totalLessons: number
    totalLives: number
    pendingFeedbacks: number
    revenue: number
  }
  recentStudents: UserSummary[]
  upcomingLives: LiveWithProfessor[]
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DO ADMIN — dados agregados
// ─────────────────────────────────────────────────────────────────────────────

export type AdminDashboardData = {
  stats: {
    totalUsers: number
    totalProfessors: number
    totalStudents: number
    totalCourses: number
    activeSubscriptions: number
    pendingProfessors: number
    monthlyRevenue: number
    totalRevenue: number
  }
  recentUsers: UserSummary[]
  recentSubscriptions: SubscriptionWithPlan[]
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMA / IDENTIDADE VISUAL
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeConfig = {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  niche: string
  logoUrl: string | null
  bannerUrl: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API / SERVER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never }

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type PaginationParams = {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─────────────────────────────────────────────────────────────────────────────
// UI GENÉRICOS
// ─────────────────────────────────────────────────────────────────────────────

export type NavItem = {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: number | string
  children?: NavItem[]
}

export type StatsCard = {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}
