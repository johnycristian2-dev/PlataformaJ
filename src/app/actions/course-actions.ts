'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { getSubscriptionAccessSnapshot } from '@/lib/subscriptions'
import {
  CreateCourseSchema,
  CreateLessonSchema,
  CreateModuleSchema,
} from '@/lib/validations'
import { slugify } from '@/lib/utils'

async function generateUniqueCertificateCode() {
  while (true) {
    const code = `CERT-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`

    const exists = await prisma.certificate.findUnique({
      where: { certificateCode: code },
      select: { id: true },
    })

    if (!exists) return code
  }
}

async function ensureProfessorOrAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  if (!['PROFESSOR', 'ADMIN'].includes(session.user.role)) {
    throw new Error('Sem permissão')
  }

  return session.user
}

async function ensureStudentOrAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    throw new Error('Sem permissão')
  }

  return session.user
}

async function generateUniqueCourseSlug(base: string) {
  const original = slugify(base)
  let slug = original
  let counter = 1

  while (true) {
    const exists = await prisma.course.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!exists) return slug
    slug = `${original}-${counter}`
    counter += 1
  }
}

async function updateCourseAggregates(courseId: string) {
  const modules = await prisma.module.findMany({
    where: { courseId },
    include: {
      _count: { select: { lessons: true } },
      lessons: { select: { videoDuration: true } },
    },
  })

  const totalModules = modules.length
  const totalLessons = modules.reduce((acc, mod) => acc + mod._count.lessons, 0)
  const totalSeconds = modules.reduce(
    (acc, mod) =>
      acc +
      mod.lessons.reduce(
        (lessonAcc, lesson) => lessonAcc + (lesson.videoDuration ?? 0),
        0,
      ),
    0,
  )

  await prisma.course.update({
    where: { id: courseId },
    data: {
      totalModules,
      totalLessons,
      totalHours: totalSeconds / 3600,
    },
  })
}

async function updateEnrollmentProgressForCourse(
  courseId: string,
  userId: string,
) {
  const courseLessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  })

  const totalLessons = courseLessons.length
  const completedLessons =
    totalLessons === 0
      ? 0
      : await prisma.lessonProgress.count({
          where: {
            userId,
            completed: true,
            lessonId: { in: courseLessons.map((l) => l.id) },
          },
        })

  const progress =
    totalLessons === 0
      ? 0
      : Number(((completedLessons / totalLessons) * 100).toFixed(1))

  const enrollment = await prisma.enrollment.update({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    data: {
      status: progress === 100 ? 'COMPLETED' : 'ACTIVE',
      progress,
      ...(progress === 100
        ? { completedAt: new Date() }
        : { completedAt: null }),
    },
    select: {
      id: true,
      userId: true,
      courseId: true,
    },
  })

  if (progress === 100) {
    const existingCertificate = await prisma.certificate.findUnique({
      where: { enrollmentId: enrollment.id },
      select: { id: true },
    })

    if (!existingCertificate) {
      const certificateCode = await generateUniqueCertificateCode()

      await prisma.certificate.create({
        data: {
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          certificateCode,
        },
      })
    }
  } else {
    await prisma.certificate.deleteMany({
      where: { enrollmentId: enrollment.id },
    })
  }

  revalidatePath('/student/certificates')
}

function normalizeVideoUrl(raw: FormDataEntryValue | null) {
  const value = String(raw || '').trim()
  if (!value) return undefined

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  return `https://${value}`
}

async function saveCourseThumbnailFromForm(formData: FormData) {
  const file = formData.get('thumbnailFile')
  if (!(file instanceof File) || file.size === 0) return null

  if (!file.type.startsWith('image/')) {
    throw new Error('O banner deve ser uma imagem válida')
  }

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('O banner deve ter no máximo 5MB')
  }

  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }

  const extension = extensionMap[file.type] ?? 'jpg'
  const folder = join(process.cwd(), 'public', 'uploads', 'courses')
  await mkdir(folder, { recursive: true })

  const filename = `${Date.now()}-${randomUUID()}.${extension}`
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(join(folder, filename), bytes)

  return `/uploads/courses/${filename}`
}

async function deleteLocalCourseThumbnail(thumbnailPath: string | null) {
  if (!thumbnailPath?.startsWith('/uploads/courses/')) return

  const absolute = join(
    process.cwd(),
    'public',
    thumbnailPath.replace(/^\//, ''),
  )
  await unlink(absolute).catch(() => {})
}

export async function createCourseAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()

  const parsed = CreateCourseSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    level: formData.get('level'),
    category: formData.get('category') || undefined,
    tags: String(formData.get('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    isPremium: formData.get('isPremium') === 'on',
    dripEnabled: formData.get('dripEnabled') === 'on',
  })

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Dados inválidos')
  }

  const slug = await generateUniqueCourseSlug(parsed.data.title)
  const uploadedThumbnail = await saveCourseThumbnailFromForm(formData)

  const newCourse = await prisma.course.create({
    data: {
      professorId: user.id,
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
      level: parsed.data.level,
      category: parsed.data.category,
      thumbnail: uploadedThumbnail,
      tags: parsed.data.tags ?? [],
      isPremium: parsed.data.isPremium,
      dripEnabled: parsed.data.dripEnabled,
    },
  })

  await createAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: 'COURSE_CREATED',
    targetType: 'Course',
    targetId: newCourse.id,
    after: { title: newCourse.title, slug: newCourse.slug },
  })

  revalidatePath('/professor/courses')
  revalidatePath('/professor/dashboard')
}

export async function updateCourseAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()
  const courseId = String(formData.get('courseId') || '')

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, professorId: true, thumbnail: true },
  })

  if (!course) throw new Error('Curso não encontrado')
  if (user.role !== 'ADMIN' && course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const category = String(formData.get('category') || '').trim()
  const removeThumbnail = formData.get('removeThumbnail') === 'on'
  const uploadedThumbnail = await saveCourseThumbnailFromForm(formData)

  let thumbnailToSave = course.thumbnail
  if (removeThumbnail) {
    await deleteLocalCourseThumbnail(course.thumbnail)
    thumbnailToSave = null
  }
  if (uploadedThumbnail) {
    await deleteLocalCourseThumbnail(course.thumbnail)
    thumbnailToSave = uploadedThumbnail
  }

  if (title.length < 5) {
    throw new Error('Título deve ter no mínimo 5 caracteres')
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      title,
      description: description || null,
      category: category || null,
      thumbnail: thumbnailToSave,
    },
  })

  await createAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: 'COURSE_UPDATED',
    targetType: 'Course',
    targetId: courseId,
    after: { title, category: category || null },
  })

  revalidatePath('/professor/courses')
  revalidatePath(`/professor/courses/${courseId}`)
  revalidatePath('/student/courses')
}

export async function deleteCourseAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()
  const courseId = String(formData.get('courseId') || '')

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, professorId: true },
  })

  if (!course) throw new Error('Curso não encontrado')
  if (user.role !== 'ADMIN' && course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  await prisma.course.delete({ where: { id: courseId } })

  revalidatePath('/professor/courses')
  revalidatePath('/professor/dashboard')
  revalidatePath('/student/courses')
}

export async function toggleCoursePublishAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()
  const courseId = String(formData.get('courseId') || '')

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, professorId: true, isPublished: true },
  })

  if (!course) throw new Error('Curso não encontrado')
  if (user.role !== 'ADMIN' && course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  await prisma.course.update({
    where: { id: course.id },
    data: { isPublished: !course.isPublished },
  })

  revalidatePath('/professor/courses')
  revalidatePath(`/professor/courses/${course.id}`)
  revalidatePath('/student/courses')
}

export async function createModuleAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()

  const courseId = String(formData.get('courseId') || '')
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, professorId: true },
  })

  if (!course) throw new Error('Curso não encontrado')
  if (user.role !== 'ADMIN' && course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  const order = await prisma.module.count({ where: { courseId } })

  const parsed = CreateModuleSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    order: order + 1,
    dripDays: formData.get('dripDays')
      ? Number(formData.get('dripDays'))
      : undefined,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Dados inválidos')
  }

  await prisma.module.create({
    data: {
      courseId,
      title: parsed.data.title,
      description: parsed.data.description,
      order: parsed.data.order,
      dripDays: parsed.data.dripDays,
      isPublished: true,
    },
  })

  await updateCourseAggregates(courseId)

  revalidatePath(`/professor/courses/${courseId}`)
  revalidatePath('/professor/courses')
}

export async function createLessonAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()

  const moduleId = String(formData.get('moduleId') || '')
  const moduleRecord = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: {
        select: {
          id: true,
          professorId: true,
        },
      },
    },
  })

  if (!moduleRecord) throw new Error('Módulo não encontrado')
  if (user.role !== 'ADMIN' && moduleRecord.course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  const order = await prisma.lesson.count({ where: { moduleId } })
  const normalizedVideoUrl = normalizeVideoUrl(formData.get('videoUrl'))

  const parsed = CreateLessonSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    videoUrl: normalizedVideoUrl,
    videoDuration: formData.get('videoDuration')
      ? Number(formData.get('videoDuration'))
      : undefined,
    order: order + 1,
    isFree: formData.get('isFree') === 'on',
    content: formData.get('content') || undefined,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Dados inválidos')
  }

  await prisma.lesson.create({
    data: {
      moduleId,
      title: parsed.data.title,
      description: parsed.data.description,
      videoUrl: parsed.data.videoUrl,
      videoDuration: parsed.data.videoDuration,
      order: parsed.data.order,
      isFree: parsed.data.isFree,
      content: parsed.data.content,
      isPublished: true,
    },
  })

  await updateCourseAggregates(moduleRecord.course.id)

  revalidatePath(`/professor/courses/${moduleRecord.course.id}`)
  revalidatePath('/professor/courses')
}

export async function deleteModuleAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()
  const moduleId = String(formData.get('moduleId') || '')

  const moduleRecord = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { id: true, professorId: true } } },
  })

  if (!moduleRecord) throw new Error('Módulo não encontrado')
  if (user.role !== 'ADMIN' && moduleRecord.course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  await prisma.module.delete({ where: { id: moduleId } })
  await updateCourseAggregates(moduleRecord.course.id)

  revalidatePath('/professor/courses')
  revalidatePath(`/professor/courses/${moduleRecord.course.id}`)
  revalidatePath(`/student/courses/${moduleRecord.course.id}`)
}

export async function deleteLessonAction(formData: FormData) {
  const user = await ensureProfessorOrAdmin()
  const lessonId = String(formData.get('lessonId') || '')

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: { course: { select: { id: true, professorId: true } } },
      },
    },
  })

  if (!lesson) throw new Error('Aula não encontrada')
  if (user.role !== 'ADMIN' && lesson.module.course.professorId !== user.id) {
    throw new Error('Sem permissão')
  }

  await prisma.lesson.delete({ where: { id: lessonId } })
  await updateCourseAggregates(lesson.module.course.id)

  revalidatePath('/professor/courses')
  revalidatePath(`/professor/courses/${lesson.module.course.id}`)
  revalidatePath(`/student/courses/${lesson.module.course.id}`)
}

export async function enrollInCourseAction(formData: FormData) {
  const user = await ensureStudentOrAdmin()
  const courseId = String(formData.get('courseId') || '')

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true, isPremium: true },
  })

  if (!course || !course.isPublished) {
    throw new Error('Curso indisponível para matrícula')
  }

  if (course.isPremium && user.role === 'STUDENT') {
    const subscriptionSnapshot = await getSubscriptionAccessSnapshot(user.id)
    if (!subscriptionSnapshot || subscriptionSnapshot.accessLevel !== 'FULL') {
      throw new Error(
        'Curso premium: é necessário assinatura ativa com acesso completo',
      )
    }
  }

  await prisma.enrollment.upsert({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId,
      },
    },
    create: {
      userId: user.id,
      courseId,
      status: 'ACTIVE',
      progress: 0,
    },
    update: {
      status: 'ACTIVE',
    },
  })

  revalidatePath('/student/courses')
  revalidatePath('/student/courses/catalog')
  revalidatePath('/student/dashboard')
}

export async function upsertLessonWatchTimeAction(input: {
  lessonId: string
  watchTime: number
  completed?: boolean
}) {
  const user = await ensureStudentOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    include: {
      module: { select: { courseId: true } },
    },
  })

  if (!lesson) throw new Error('Aula não encontrada')

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: lesson.module.courseId,
      },
    },
    select: { id: true },
  })

  if (!enrollment && user.role !== 'ADMIN') {
    throw new Error('Você não está matriculado neste curso')
  }

  const watchTime = Math.max(0, Math.floor(input.watchTime))
  const completed = !!input.completed

  await prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: {
        userId: user.id,
        lessonId: input.lessonId,
      },
    },
    create: {
      userId: user.id,
      lessonId: input.lessonId,
      watchTime,
      completed,
      watchedAt: new Date(),
      completedAt: completed ? new Date() : null,
    },
    update: {
      watchTime,
      completed,
      watchedAt: new Date(),
      completedAt: completed ? new Date() : null,
    },
  })

  if (enrollment) {
    await updateEnrollmentProgressForCourse(lesson.module.courseId, user.id)
  }

  revalidatePath(`/student/courses/${lesson.module.courseId}`)
  revalidatePath('/student/courses')
}

export async function toggleLessonCompleteAction(formData: FormData) {
  const user = await ensureStudentOrAdmin()

  const lessonId = String(formData.get('lessonId') || '')

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: {
          courseId: true,
        },
      },
    },
  })

  if (!lesson) throw new Error('Aula não encontrada')

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: lesson.module.courseId,
      },
    },
    select: { id: true },
  })

  if (!enrollment && user.role !== 'ADMIN') {
    throw new Error('Você não está matriculado neste curso')
  }

  const existing = await prisma.lessonProgress.findUnique({
    where: {
      userId_lessonId: {
        userId: user.id,
        lessonId,
      },
    },
    select: { completed: true },
  })

  const completed = !existing?.completed

  await prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: {
        userId: user.id,
        lessonId,
      },
    },
    create: {
      userId: user.id,
      lessonId,
      completed,
      completedAt: completed ? new Date() : null,
      watchedAt: new Date(),
    },
    update: {
      completed,
      completedAt: completed ? new Date() : null,
      watchedAt: new Date(),
    },
  })

  if (enrollment) {
    await updateEnrollmentProgressForCourse(lesson.module.courseId, user.id)
  }

  revalidatePath('/student/courses')
  revalidatePath(`/student/courses/${lesson.module.courseId}`)
  revalidatePath('/student/dashboard')
}

export async function createLessonCommentAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Não autenticado')

  const lessonId = String(formData.get('lessonId') || '').trim()
  const content = String(formData.get('content') || '').trim()

  if (!lessonId) throw new Error('Aula inválida')
  if (content.length < 1 || content.length > 1000) {
    throw new Error('Comentário deve ter entre 1 e 1000 caracteres')
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { courseId: true } } },
  })
  if (!lesson) throw new Error('Aula não encontrada')

  await prisma.lessonComment.create({
    data: {
      lessonId,
      userId: session.user.id,
      content,
    },
  })

  revalidatePath(`/student/courses/${lesson.module.courseId}`)
}
