import { z } from 'zod'

function emptyToUndefined(value: unknown) {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined
  }

  return value
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export const SignInSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email({ message: 'Email inválido' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
})

export const SignUpSchema = z
  .object({
    role: z.enum(['STUDENT', 'PROFESSOR']).optional().default('STUDENT'),
    name: z
      .string({ required_error: 'Nome é obrigatório' })
      .min(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
      .max(60, { message: 'Nome muito longo' })
      .trim(),
    email: z
      .string({ required_error: 'Email é obrigatório' })
      .email({ message: 'Email inválido' })
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: 'Senha é obrigatória' })
      .min(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
      .regex(/[A-Z]/, {
        message: 'Senha deve ter ao menos uma letra maiúscula',
      })
      .regex(/[0-9]/, { message: 'Senha deve ter ao menos um número' }),
    confirmPassword: z.string({
      required_error: 'Confirmação de senha é obrigatória',
    }),
    birthDate: z.preprocess(emptyToUndefined, z.string().optional()),
    phone: z.preprocess(
      emptyToUndefined,
      z.string().max(20, { message: 'Telefone inválido' }).optional(),
    ),
    contactEmail: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .email({ message: 'E-mail de contato inválido' })
        .toLowerCase()
        .trim()
        .optional(),
    ),
    contactPhone: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .max(20, { message: 'Telefone para contato inválido' })
        .optional(),
    ),
    cpf: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value
        const digits = value.replace(/\D/g, '')
        return digits === '' ? undefined : digits
      },
      z
        .string()
        .regex(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos numéricos' })
        .optional(),
    ),
    educationLevel: z.preprocess(
      emptyToUndefined,
      z.string().max(80).optional(),
    ),
    focusArea: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    objective: z
      .string()
      .max(1200, { message: 'Objetivo muito longo' })
      .optional(),
    specialties: z.preprocess(
      (value) => {
        if (!Array.isArray(value)) return value
        const filtered = value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => typeof item === 'string' && item.length > 0)
        return filtered.length > 0 ? filtered : undefined
      },
      z.array(z.string().trim()).max(12).optional(),
    ),
    experience: z
      .string()
      .max(1600, { message: 'Descrição de experiência muito longa' })
      .optional(),
    yearsTeaching: z.preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') {
          return undefined
        }

        if (typeof value === 'number' && Number.isNaN(value)) {
          return undefined
        }

        return value
      },
      z.coerce.number().int().min(0).max(60).optional(),
    ),
    city: z.preprocess(emptyToUndefined, z.string().max(80).optional()),
    state: z.preprocess(emptyToUndefined, z.string().max(80).optional()),
    availability: z.preprocess(
      emptyToUndefined,
      z.string().max(120).optional(),
    ),
    instagram: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    linkedin: z.preprocess(emptyToUndefined, z.string().max(180).optional()),
    portfolioUrl: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .url({ message: 'Portfólio deve ser uma URL válida' })
        .optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'As senhas não coincidem',
        path: ['confirmPassword'],
      })
    }

    if (data.role !== 'PROFESSOR') return

    if (!data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de nascimento é obrigatória para candidatura',
        path: ['birthDate'],
      })
    }

    if (!data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Telefone é obrigatório para candidatura',
        path: ['phone'],
      })
    }

    if (!data.contactEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'E-mail para contato é obrigatório para candidatura',
        path: ['contactEmail'],
      })
    }

    if (!data.contactPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Telefone para contato é obrigatório para candidatura',
        path: ['contactPhone'],
      })
    }

    if (!data.cpf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPF é obrigatório para candidatura',
        path: ['cpf'],
      })
    }

    if (!data.educationLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Escolaridade é obrigatória para candidatura',
        path: ['educationLevel'],
      })
    }

    if (!data.focusArea) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Foco de atuação é obrigatório para candidatura',
        path: ['focusArea'],
      })
    }

    if (!data.objective || data.objective.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Descreva seu objetivo com pelo menos 20 caracteres',
        path: ['objective'],
      })
    }

    if (!data.specialties || data.specialties.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe ao menos uma especialidade',
        path: ['specialties'],
      })
    }

    if (!data.experience || data.experience.trim().length < 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Descreva sua experiência com pelo menos 30 caracteres',
        path: ['experience'],
      })
    }
  })

export const ForgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email({ message: 'Email inválido' })
    .toLowerCase()
    .trim(),
})

export const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
      .regex(/[A-Z]/, {
        message: 'Senha deve ter ao menos uma letra maiúscula',
      })
      .regex(/[0-9]/, { message: 'Senha deve ter ao menos um número' }),
    confirmPassword: z.string(),
    token: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

// ─────────────────────────────────────────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(60).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  phone: z.string().max(20).optional(),
  birthDate: z.coerce.date().optional(),
  city: z.string().max(60).optional(),
  state: z.string().max(60).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// CURSO
// ─────────────────────────────────────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  title: z
    .string({ required_error: 'Título é obrigatório' })
    .min(5, { message: 'Título deve ter no mínimo 5 caracteres' })
    .max(120, { message: 'Título muito longo' })
    .trim(),
  description: z.string().max(2000).trim().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']),
  category: z.string().max(60).optional(),
  tags: z.array(z.string()).max(10).optional(),
  isPremium: z.boolean().default(false),
  dripEnabled: z.boolean().default(false),
})

export const UpdateCourseSchema = CreateCourseSchema.partial()

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO
// ─────────────────────────────────────────────────────────────────────────────

export const CreateModuleSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  description: z.string().max(500).trim().optional(),
  order: z.number().int().min(1),
  dripDays: z.number().int().min(0).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// AULA
// ─────────────────────────────────────────────────────────────────────────────

export const CreateLessonSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  description: z.string().max(1000).trim().optional(),
  videoUrl: z.string().url({ message: 'URL do vídeo inválida' }).optional(),
  videoDuration: z.number().int().min(0).optional(),
  order: z.number().int().min(1),
  isFree: z.boolean().default(false),
  content: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// TREINO
// ─────────────────────────────────────────────────────────────────────────────

export const CreateTrainingSchema = z.object({
  studentId: z.string().cuid({ message: 'ID de aluno inválido' }),
  name: z.string().min(3).max(120).trim(),
  objective: z.string().max(500).trim().optional(),
  notes: z.string().max(1000).trim().optional(),
  frequency: z.string().max(120).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

export const CreateFeedbackSchema = z.object({
  studentId: z.string().cuid(),
  title: z.string().min(5).max(120).trim(),
  content: z.string().min(10).max(3000).trim(),
  type: z
    .enum(['GENERAL', 'COURSE', 'TRAINING', 'ASSESSMENT'])
    .default('GENERAL'),
  trainingId: z.string().cuid().optional(),
  isImportant: z.boolean().default(false),
})

// ─────────────────────────────────────────────────────────────────────────────
// LIVE
// ─────────────────────────────────────────────────────────────────────────────

export const CreateLiveSchema = z.object({
  title: z.string().min(5).max(120).trim(),
  description: z.string().max(1000).trim().optional(),
  scheduledAt: z.coerce.date(),
  duration: z.number().int().min(15).max(480).optional(),
  link: z.string().url({ message: 'URL inválida' }).optional(),
  platform: z.string().max(60).optional(),
  isPremium: z.boolean().default(false),
})

// ─────────────────────────────────────────────────────────────────────────────
// AVALIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export const CreateAssessmentSchema = z.object({
  studentId: z.string().cuid(),
  title: z.string().min(3).max(120).trim(),
  type: z
    .enum(['GENERAL', 'PHYSICAL', 'NUTRITIONAL', 'PSYCHOLOGICAL'])
    .default('GENERAL'),
  notes: z.string().max(1000).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// TEMA
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateThemeSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional(),
  surfaceColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional(),
  textColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .optional(),
  fontFamily: z.string().max(120).optional(),
  headingFont: z.string().max(120).optional(),
  niche: z.string().max(30).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INFERIDOS
// ─────────────────────────────────────────────────────────────────────────────

export type SignInInput = z.infer<typeof SignInSchema>
export type SignUpInput = z.infer<typeof SignUpSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>
export type CreateModuleInput = z.infer<typeof CreateModuleSchema>
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>
export type CreateTrainingInput = z.infer<typeof CreateTrainingSchema>
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>
export type CreateLiveInput = z.infer<typeof CreateLiveSchema>
export type UpdateThemeInput = z.infer<typeof UpdateThemeSchema>
