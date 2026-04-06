/**
 * CONSTANTS — Plataforma J
 * Constantes globais usadas em todo o projeto.
 */

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────

export const APP_NAME = 'Plataforma J'
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const APP_VERSION = '1.0.0'
export const APP_EMAIL = 'contato@plataformaj.com'

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS PROTEGIDAS
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTES = {
  // Públicas
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PW: '/forgot-password',
  RESET_PW: '/reset-password',
  PLANS: '/planos',
  ABOUT: '/sobre',
  CONTACT: '/contato',

  // Aluno
  STUDENT: {
    DASHBOARD: '/student/dashboard',
    ONBOARDING: '/student/onboarding',
    ACHIEVEMENTS: '/student/achievements',
    COURSES: '/student/courses',
    CERTIFICATES: '/student/certificates',
    SUBSCRIPTION: '/student/subscription',
    TRAININGS: '/student/trainings',
    FEEDBACK: '/student/feedback',
    SUPPORT: '/student/support',
    LIVES: '/student/lives',
    PROFILE: '/student/profile',
    ASSESSMENT: '/student/assessment',
    PRIVACY: '/student/privacy',
  },

  // Professor
  PROFESSOR: {
    DASHBOARD: '/professor/dashboard',
    COURSES: '/professor/courses',
    STUDENTS: '/professor/students',
    TRAININGS: '/professor/trainings',
    FEEDBACK: '/professor/feedback',
    SUPPORT: '/professor/support',
    LIVES: '/professor/lives',
    PROFILE: '/professor/profile',
    SETTINGS: '/professor/settings',
  },

  // Admin
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    PROFESSORS: '/admin/professors',
    STUDENTS: '/admin/students',
    COURSES: '/admin/courses',
    PLANS: '/admin/plans',
    SUBSCRIPTIONS: '/admin/subscriptions',
    SECURITY: '/admin/security',
    SUPPORT: '/admin/support',
    SETTINGS: '/admin/settings',
    LIVES: '/admin/lives',
    AUDIT: '/admin/audit',
    DATA_REQUESTS: '/admin/data-requests',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN: 'ADMIN',
  PROFESSOR: 'PROFESSOR',
  STUDENT: 'STUDENT',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// PLANOS
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_SLUGS = {
  BASICO: 'basico',
  PREMIUM: 'premium',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TEMAS / NICHOS
// ─────────────────────────────────────────────────────────────────────────────

export const NICHES = {
  DEFAULT: 'default',
  MUAYTHAI: 'muaythai',
  FITNESS: 'fitness',
  NUTRITION: 'nutrition',
  YOGA: 'yoga',
  SWIMMING: 'swimming',
} as const

export type NicheKey = (typeof NICHES)[keyof typeof NICHES]

/** Configuração de tema padrão por nicho */
export const NICHE_THEMES: Record<
  NicheKey,
  {
    label: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    backgroundColor: string
    surfaceColor: string
    cssClass: string
  }
> = {
  default: {
    label: 'Padrão',
    primaryColor: '#dc2626',
    secondaryColor: '#7f1d1d',
    accentColor: '#f97316',
    backgroundColor: '#0a0a0a',
    surfaceColor: '#111111',
    cssClass: '',
  },
  muaythai: {
    label: 'Muay Thai',
    primaryColor: '#dc2626',
    secondaryColor: '#7f1d1d',
    accentColor: '#f97316',
    backgroundColor: '#080606',
    surfaceColor: '#110a0a',
    cssClass: 'theme-muaythai',
  },
  fitness: {
    label: 'Fitness / Academia',
    primaryColor: '#ffffff',
    secondaryColor: '#9ca3af',
    accentColor: '#3b82f6',
    backgroundColor: '#000000',
    surfaceColor: '#0d0d0d',
    cssClass: 'theme-fitness',
  },
  nutrition: {
    label: 'Nutrição',
    primaryColor: '#16a34a',
    secondaryColor: '#14532d',
    accentColor: '#84cc16',
    backgroundColor: '#020a04',
    surfaceColor: '#0a1a0f',
    cssClass: 'theme-nutrition',
  },
  yoga: {
    label: 'Yoga / Bem-estar',
    primaryColor: '#a855f7',
    secondaryColor: '#581c87',
    accentColor: '#e879f9',
    backgroundColor: '#030009',
    surfaceColor: '#0e0718',
    cssClass: 'theme-yoga',
  },
  swimming: {
    label: 'Natação / Aquático',
    primaryColor: '#0ea5e9',
    secondaryColor: '#0c4a6e',
    accentColor: '#38bdf8',
    backgroundColor: '#020810',
    surfaceColor: '#061525',
    cssClass: 'theme-swimming',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12,
  MAX_LIMIT: 100,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

export const UPLOAD = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5 MB
  MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500 MB
  ACCEPTED_IMAGES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ACCEPTED_VIDEOS: ['video/mp4', 'video/webm', 'video/ogg'],
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CURSOS
// ─────────────────────────────────────────────────────────────────────────────

export const COURSE_LEVELS = [
  { value: 'BEGINNER', label: 'Iniciante' },
  { value: 'INTERMEDIATE', label: 'Intermediário' },
  { value: 'ADVANCED', label: 'Avançado' },
  { value: 'ALL_LEVELS', label: 'Todos os Níveis' },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// IDIOMA
// ─────────────────────────────────────────────────────────────────────────────

export const DATE_FORMAT = 'dd/MM/yyyy'
export const DATETIME_FORMAT = "dd/MM/yyyy 'às' HH:mm"
export const CURRENCY = 'BRL'
export const LOCALE = 'pt-BR'
