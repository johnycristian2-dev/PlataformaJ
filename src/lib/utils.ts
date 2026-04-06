import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─────────────────────────────────────────────────────────────────────────────
// CLASSNAMES
// ─────────────────────────────────────────────────────────────────────────────

/** Combina classes Tailwind com merge inteligente */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATAÇÃO DE DATAS
// ─────────────────────────────────────────────────────────────────────────────

export function formatDate(
  date: Date | string,
  pattern = 'dd/MM/yyyy',
): string {
  return format(new Date(date), pattern, { locale: ptBR })
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function isDatePast(date: Date | string): boolean {
  return isBefore(new Date(date), new Date())
}

export function isDateFuture(date: Date | string): boolean {
  return isAfter(new Date(date), new Date())
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATAÇÃO DE MOEDA
// ─────────────────────────────────────────────────────────────────────────────

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATAÇÃO DE DURAÇÃO DE VÍDEO
// ─────────────────────────────────────────────────────────────────────────────

/** Converte segundos para formato HH:MM:SS ou MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Converte segundos para formato legível (ex: "2h 30min" ou "45min") */
export function formatDurationHuman(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)

  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

// ─────────────────────────────────────────────────────────────────────────────
// STRINGS
// ─────────────────────────────────────────────────────────────────────────────

/** Cria um slug a partir de uma string */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

/** Trunca texto com reticências */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

/** Retorna as iniciais do nome (ex: "Ricardo Silva" → "RS") */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

/** Capitaliza a primeira letra de cada palavra */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSO E CÁLCULOS
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula percentual com precisão */
export function calcPercent(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

/** Retorna label de progresso para exibição */
export function progressLabel(percent: number): string {
  if (percent === 0) return 'Não iniciado'
  if (percent < 25) return 'Iniciado'
  if (percent < 50) return 'Em andamento'
  if (percent < 75) return 'Mais da metade'
  if (percent < 100) return 'Quase lá!'
  return 'Concluído'
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES E PERMISSÕES
// ─────────────────────────────────────────────────────────────────────────────

export function getDashboardRoute(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard'
    case 'PROFESSOR':
      return '/professor/dashboard'
    case 'STUDENT':
      return '/student/dashboard'
    default:
      return '/'
  }
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrador'
    case 'PROFESSOR':
      return 'Professor'
    case 'STUDENT':
      return 'Aluno'
    default:
      return role
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚMEROS
// ─────────────────────────────────────────────────────────────────────────────

/** Formata número para exibição compacta (ex: 1500 → "1.5k") */
export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRAYS E OBJETOS
// ─────────────────────────────────────────────────────────────────────────────

/** Remove propriedades undefined/null de um objeto */
export function cleanObject<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>
}

/** Agrupa array por chave */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const group = String(item[key])
      if (!acc[group]) acc[group] = []
      acc[group].push(item)
      return acc
    },
    {} as Record<string, T[]>,
  )
}
