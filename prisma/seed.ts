/**
 * SEED — Plataforma J
 * Popula o banco com dados realistas para demonstração e desenvolvimento.
 *
 * Execução: npm run db:seed
 */

import {
  PrismaClient,
  Role,
  PlanInterval,
  SubscriptionStatus,
  CourseLevel,
  EnrollmentStatus,
  LiveStatus,
  NotificationType,
  FeedbackType,
  AssessmentType,
  AssessmentStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n')

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. HASH DE SENHAS
  // ─────────────────────────────────────────────────────────────────────────────
  const SALT_ROUNDS = 12
  const hashAdmin = await bcrypt.hash('Admin@123456', SALT_ROUNDS)
  const hashProf = await bcrypt.hash('Prof@123456', SALT_ROUNDS)
  const hashStudent = await bcrypt.hash('Student@123456', SALT_ROUNDS)

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ADMIN
  // ─────────────────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'johnycristian2@gmail.com' },
    update: {},
    create: {
      email: 'johnycristian2@gmail.com',
      name: 'Administrador Sistema',
      password: hashAdmin,
      role: Role.ADMIN,
      isActive: true,
    },
  })

  await prisma.profile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      phone: '+55 11 90000-0000',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
    },
  })

  console.log('✅  Admin criado:', admin.email)

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PROFESSORES
  // ─────────────────────────────────────────────────────────────────────────────

  // Professor 1 — Muay Thai
  const profMuay = await prisma.user.upsert({
    where: { email: 'mestre.silva@muaythai.com' },
    update: {},
    create: {
      email: 'mestre.silva@muaythai.com',
      name: 'Mestre Ricardo Silva',
      password: hashProf,
      role: Role.PROFESSOR,
      image: 'https://api.dicebear.com/7.x/personas/svg?seed=mestresilva',
      isActive: true,
    },
  })

  await prisma.profile.upsert({
    where: { userId: profMuay.id },
    update: {},
    create: {
      userId: profMuay.id,
      bio: 'Mestre de Muay Thai com mais de 15 anos de experiência. Campeão nacional pela CBMuayThai. Especialista em transformar guerreiros desde a base até competição.',
      phone: '+55 11 91111-1111',
      city: 'São Paulo',
      state: 'SP',
    },
  })

  await prisma.professorProfile.upsert({
    where: { userId: profMuay.id },
    update: {},
    create: {
      userId: profMuay.id,
      title: 'Mestre',
      specialty: 'Muay Thai Tradicional e Competitivo',
      yearsExperience: 15,
      certifications: [
        'CBMuayThai Grau A',
        'IFMA Certified Coach',
        'Árbitro Nacional',
      ],
      platformName: 'Mestre Silva — Muay Thai Elite',
      platformSlug: 'mestre-silva',
      niche: 'muaythai',
      isApproved: true,
      socialLinks: {
        instagram: 'https://instagram.com/mestresilva',
        youtube: 'https://youtube.com/@mestresilva',
      },
    },
  })

  await prisma.themeSettings.upsert({
    where: { userId: profMuay.id },
    update: {},
    create: {
      userId: profMuay.id,
      primaryColor: '#dc2626',
      secondaryColor: '#7f1d1d',
      accentColor: '#f97316',
      backgroundColor: '#0a0a0a',
      surfaceColor: '#111111',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      headingFont: 'Oswald',
      niche: 'muaythai',
    },
  })

  console.log('✅  Professor Muay Thai criado:', profMuay.email)

  // Professor 2 — Fitness
  const profFitness = await prisma.user.upsert({
    where: { email: 'coach.thiago@academiaelite.com' },
    update: {},
    create: {
      email: 'coach.thiago@academiaelite.com',
      name: 'Coach Thiago Martins',
      password: hashProf,
      role: Role.PROFESSOR,
      image: 'https://api.dicebear.com/7.x/personas/svg?seed=coachthiago',
      isActive: true,
    },
  })

  await prisma.profile.upsert({
    where: { userId: profFitness.id },
    update: {},
    create: {
      userId: profFitness.id,
      bio: 'Personal Trainer CREF certificado. Especialista em hipertrofia, emagrecimento e preparação física. Mais de 500 alunos transformados.',
      phone: '+55 21 92222-2222',
      city: 'Rio de Janeiro',
      state: 'RJ',
    },
  })

  await prisma.professorProfile.upsert({
    where: { userId: profFitness.id },
    update: {},
    create: {
      userId: profFitness.id,
      title: 'Coach',
      specialty: 'Treinamento Funcional e Hipertrofia',
      yearsExperience: 10,
      certifications: [
        'CREF 040000-G/SP',
        'NSCA-CSCS',
        'Precision Nutrition Level 2',
      ],
      platformName: 'Academia Elite Online',
      platformSlug: 'academia-elite',
      niche: 'fitness',
      isApproved: true,
      socialLinks: {
        instagram: 'https://instagram.com/coachthiago',
        youtube: 'https://youtube.com/@coachthiago',
      },
    },
  })

  await prisma.themeSettings.upsert({
    where: { userId: profFitness.id },
    update: {},
    create: {
      userId: profFitness.id,
      primaryColor: '#ffffff',
      secondaryColor: '#9ca3af',
      accentColor: '#3b82f6',
      backgroundColor: '#000000',
      surfaceColor: '#0d0d0d',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      headingFont: 'Inter',
      niche: 'fitness',
    },
  })

  console.log('✅  Professor Fitness criado:', profFitness.email)

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ALUNOS
  // ─────────────────────────────────────────────────────────────────────────────
  const studentsData = [
    {
      email: 'joao.silva@aluno.com',
      name: 'João Silva',
      height: 178,
      weight: 82,
      level: 'intermediario',
    },
    {
      email: 'maria.costa@aluno.com',
      name: 'Maria Costa',
      height: 165,
      weight: 62,
      level: 'iniciante',
    },
    {
      email: 'carlos.lima@aluno.com',
      name: 'Carlos Lima',
      height: 182,
      weight: 90,
      level: 'avancado',
    },
    {
      email: 'ana.santos@aluno.com',
      name: 'Ana Santos',
      height: 162,
      weight: 58,
      level: 'iniciante',
    },
    {
      email: 'pedro.rocha@aluno.com',
      name: 'Pedro Rocha',
      height: 175,
      weight: 75,
      level: 'intermediario',
    },
  ]

  const students: Awaited<ReturnType<typeof prisma.user.upsert>>[] = []

  for (const s of studentsData) {
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        name: s.name,
        password: hashStudent,
        role: Role.STUDENT,
        image: `https://api.dicebear.com/7.x/personas/svg?seed=${s.email}`,
        isActive: true,
      },
    })

    await prisma.profile.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id,
        city: 'São Paulo',
        state: 'SP',
      },
    })

    await prisma.studentProfile.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id,
        height: s.height,
        weight: s.weight,
        fitnessLevel: s.level,
        goals: 'Melhorar condicionamento físico e performance técnica.',
      },
    })

    students.push(student)
  }

  console.log(`✅  ${students.length} alunos criados`)

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PLANOS
  // ─────────────────────────────────────────────────────────────────────────────
  const planBasico = await prisma.plan.upsert({
    where: { slug: 'basico' },
    update: {
      stripePriceId: 'price_1THGY6Ax1g0VM9lfQ0nF1XK4',
    },
    create: {
      name: 'Básico',
      slug: 'basico',
      description: 'Acesso aos cursos fundamentais e conteúdo selecionado.',
      price: 97.0,
      interval: PlanInterval.MONTHLY,
      stripePriceId: 'price_1THGY6Ax1g0VM9lfQ0nF1XK4',
      isPremium: false,
      sortOrder: 1,
      features: [
        'Acesso a cursos fundamentais',
        'Aulas em vídeo HD',
        'Material complementar',
        'Acesso à comunidade',
        'Suporte por e-mail',
      ],
    },
  })

  const planPremium = await prisma.plan.upsert({
    where: { slug: 'premium' },
    update: {
      stripePriceId: 'price_1THGYRAx1g0VM9lftpIKF1L3',
    },
    create: {
      name: 'Premium',
      slug: 'premium',
      description:
        'Experiência completa: todos os cursos, lives exclusivas e acompanhamento personalizado.',
      price: 197.0,
      interval: PlanInterval.MONTHLY,
      stripePriceId: 'price_1THGYRAx1g0VM9lftpIKF1L3',
      isPremium: true,
      sortOrder: 2,
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
    },
  })

  console.log('✅  Planos criados:', planBasico.name, '&', planPremium.name)

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. ASSINATURAS
  // ─────────────────────────────────────────────────────────────────────────────
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // João e Carlos — Premium | Maria, Ana, Pedro — Básico
  const subData = [
    { userId: students[0].id, planId: planPremium.id },
    { userId: students[1].id, planId: planBasico.id },
    { userId: students[2].id, planId: planPremium.id },
    { userId: students[3].id, planId: planBasico.id },
    { userId: students[4].id, planId: planPremium.id },
  ]

  for (const sub of subData) {
    await prisma.subscription.upsert({
      where: { id: `sub_${sub.userId}` },
      update: {},
      create: {
        id: `sub_${sub.userId}`,
        userId: sub.userId,
        planId: sub.planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: in30,
      },
    })
  }

  console.log('✅  5 assinaturas criadas')

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. CURSOS — MUAY THAI
  // ─────────────────────────────────────────────────────────────────────────────

  const courseMuayFundamentos = await prisma.course.upsert({
    where: { slug: 'fundamentos-muay-thai' },
    update: {},
    create: {
      professorId: profMuay.id,
      title: 'Fundamentos do Muay Thai',
      slug: 'fundamentos-muay-thai',
      description:
        'Do zero ao sólido: aprenda as bases técnicas do Muay Thai com um dos maiores mestres do Brasil. Postura, guarda, socos, chutes, joelhos e cotoveladas com detalhamento técnico de alto nível.',
      level: CourseLevel.BEGINNER,
      category: 'Artes Marciais',
      tags: ['muay thai', 'soco', 'chute', 'iniciante', 'base'],
      isPublished: true,
      isPremium: false,
      dripEnabled: false,
      totalModules: 3,
      totalLessons: 12,
      totalHours: 8.5,
    },
  })

  const courseMuayAvancado = await prisma.course.upsert({
    where: { slug: 'muay-thai-avancado-combate' },
    update: {},
    create: {
      professorId: profMuay.id,
      title: 'Muay Thai Avançado — Combate e Performance',
      slug: 'muay-thai-avancado-combate',
      description:
        'Para guerreiros que já dominam a base. Combinações avançadas, estratégias de combate, defesa e contra-ataque, preparação física específica para luta e mentalidade campeã.',
      level: CourseLevel.ADVANCED,
      category: 'Artes Marciais',
      tags: ['muay thai', 'combate', 'avançado', 'luta', 'campeonato'],
      isPublished: true,
      isPremium: true,
      dripEnabled: true,
      totalModules: 4,
      totalLessons: 18,
      totalHours: 14.0,
    },
  })

  console.log('✅  Cursos Muay Thai criados')

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. MÓDULOS E AULAS — Fundamentos Muay Thai
  // ─────────────────────────────────────────────────────────────────────────────

  const muayMod1 = await prisma.module.upsert({
    where: { id: 'mod_muay_fund_1' },
    update: {},
    create: {
      id: 'mod_muay_fund_1',
      courseId: courseMuayFundamentos.id,
      title: 'Módulo 1 — Postura, Guarda e Deslocamento',
      description:
        'A fundação de tudo: antes de atacar, você precisa saber se posicionar, se defender e se movimentar como um lutador.',
      order: 1,
      isPublished: true,
    },
  })

  const muayMod2 = await prisma.module.upsert({
    where: { id: 'mod_muay_fund_2' },
    update: {},
    create: {
      id: 'mod_muay_fund_2',
      courseId: courseMuayFundamentos.id,
      title: 'Módulo 2 — Socos e Chutes Fundamentais',
      description:
        'As armas básicas: jab, direto, gancho, uppercut, chutar com shin e tep kick. Mecânica correta de cada golpe.',
      order: 2,
      isPublished: true,
    },
  })

  const muayMod3 = await prisma.module.upsert({
    where: { id: 'mod_muay_fund_3' },
    update: {},
    create: {
      id: 'mod_muay_fund_3',
      courseId: courseMuayFundamentos.id,
      title: 'Módulo 3 — Joelhos, Cotoveladas e Clínch',
      description:
        'As armas exclusivas do muay thai: joelhos devastadores, cotoveladas cortantes e o poderoso corpo-a-corpo.',
      order: 3,
      isPublished: true,
    },
  })

  // Aulas Módulo 1
  const muayLessonsM1 = [
    {
      id: 'les_m1_1',
      title: 'A Guarda Clássica do Muay Thai',
      duration: 1200,
      order: 1,
    },
    {
      id: 'les_m1_2',
      title: 'Footwork: Passos e Pivôs Essenciais',
      duration: 1500,
      order: 2,
    },
    {
      id: 'les_m1_3',
      title: 'Defesas Básicas: Bloqueio e Parry',
      duration: 1800,
      order: 3,
    },
    {
      id: 'les_m1_4',
      title: 'Combinando Guarda + Movimento',
      duration: 1400,
      order: 4,
      isFree: true,
    },
  ]

  for (const l of muayLessonsM1) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        moduleId: muayMod1.id,
        title: l.title,
        description: `Aula ${l.order} do Módulo 1 — ${l.title}. Conteúdo técnico de alta qualidade com demonstração passo a passo.`,
        videoUrl: `https://vimeo.com/example/${l.id}`,
        videoDuration: l.duration,
        order: l.order,
        isPublished: true,
        isFree: (l as any).isFree ?? false,
      },
    })
  }

  // Aulas Módulo 2
  const muayLessonsM2 = [
    {
      id: 'les_m2_1',
      title: 'Jab — Velocidade e Cadência',
      duration: 1350,
      order: 1,
    },
    {
      id: 'les_m2_2',
      title: 'Direto — Potência e Rotação',
      duration: 1500,
      order: 2,
    },
    { id: 'les_m2_3', title: 'Gancho e Uppercut', duration: 1700, order: 3 },
    {
      id: 'les_m2_4',
      title: 'Chute Lateral (Teep/Tep Kick)',
      duration: 1600,
      order: 4,
    },
    {
      id: 'les_m2_5',
      title: 'Roundhouse Kick — A Arma Letal',
      duration: 1900,
      order: 5,
    },
  ]

  for (const l of muayLessonsM2) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        moduleId: muayMod2.id,
        title: l.title,
        description: `${l.title} — técnica detalhada, biomecânica e aplicação em sparring.`,
        videoUrl: `https://vimeo.com/example/${l.id}`,
        videoDuration: l.duration,
        order: l.order,
        isPublished: true,
        isFree: false,
      },
    })
  }

  // Aulas Módulo 3
  const muayLessonsM3 = [
    {
      id: 'les_m3_1',
      title: 'Joelho Frontal e Diagonal',
      duration: 1400,
      order: 1,
    },
    {
      id: 'les_m3_2',
      title: 'Cotovelada — Os 7 Tipos Básicos',
      duration: 1600,
      order: 2,
    },
    {
      id: 'les_m3_3',
      title: 'Clinch: Entrada e Domínio',
      duration: 2100,
      order: 3,
    },
  ]

  for (const l of muayLessonsM3) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        moduleId: muayMod3.id,
        title: l.title,
        description: `${l.title} — domínio técnico das armas exclusivas do Muay Thai.`,
        videoUrl: `https://vimeo.com/example/${l.id}`,
        videoDuration: l.duration,
        order: l.order,
        isPublished: true,
        isFree: false,
      },
    })
  }

  console.log('✅  Módulos e aulas Muay Thai criados')

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. CURSOS — FITNESS
  // ─────────────────────────────────────────────────────────────────────────────

  const courseFitnessFuncional = await prisma.course.upsert({
    where: { slug: 'treino-funcional-total' },
    update: {},
    create: {
      professorId: profFitness.id,
      title: 'Treino Funcional Total — Do Zero ao Avançado',
      slug: 'treino-funcional-total',
      description:
        'Programa completo de treinamento funcional para todos os níveis. Força, mobilidade, resistência e composição corporal. Treine em qualquer lugar com o máximo resultado.',
      level: CourseLevel.ALL_LEVELS,
      category: 'Fitness & Saúde',
      tags: [
        'funcional',
        'treino',
        'perda de peso',
        'hipertrofia',
        'mobilidade',
      ],
      isPublished: true,
      isPremium: false,
      dripEnabled: false,
      totalModules: 3,
      totalLessons: 15,
      totalHours: 10.0,
    },
  })

  const courseFitnessHipertrofia = await prisma.course.upsert({
    where: { slug: 'hipertrofia-resultados-reais' },
    update: {},
    create: {
      professorId: profFitness.id,
      title: 'Hipertrofia — Resultados Reais em 90 Dias',
      slug: 'hipertrofia-resultados-reais',
      description:
        'Protocolo científico de hipertrofia muscular. Periodização, técnicas avançadas, nutrição estratégica e recuperação otimizada. Para quem quer resultado de verdade.',
      level: CourseLevel.INTERMEDIATE,
      category: 'Fitness & Saúde',
      tags: [
        'hipertrofia',
        'musculação',
        'massa muscular',
        'protocolo',
        'periodização',
      ],
      isPublished: true,
      isPremium: true,
      dripEnabled: true,
      totalModules: 4,
      totalLessons: 20,
      totalHours: 16.0,
    },
  })

  console.log('✅  Cursos Fitness criados')

  // Módulos — Treino Funcional Total
  const fitMod1 = await prisma.module.upsert({
    where: { id: 'mod_fit_func_1' },
    update: {},
    create: {
      id: 'mod_fit_func_1',
      courseId: courseFitnessFuncional.id,
      title: 'Módulo 1 — Fundamentos do Movimento',
      description:
        'Padrões de movimento essenciais: agachamento, empurrar, puxar, dobrar, rodar e locomoção.',
      order: 1,
      isPublished: true,
    },
  })

  const fitMod2 = await prisma.module.upsert({
    where: { id: 'mod_fit_func_2' },
    update: {},
    create: {
      id: 'mod_fit_func_2',
      courseId: courseFitnessFuncional.id,
      title: 'Módulo 2 — Força e Condicionamento',
      description:
        'Treinos de força funcional com peso corporal e carga progressiva.',
      order: 2,
      isPublished: true,
    },
  })

  const fitMod3 = await prisma.module.upsert({
    where: { id: 'mod_fit_func_3' },
    update: {},
    create: {
      id: 'mod_fit_func_3',
      courseId: courseFitnessFuncional.id,
      title: 'Módulo 3 — Mobilidade e Recuperação',
      description:
        'O elo que falta na maioria dos treinos. Recuperação ativa, mobilidade articular e prevenção de lesões.',
      order: 3,
      isPublished: true,
    },
  })

  const fitLessonsData = [
    {
      id: 'les_fit_1',
      mod: fitMod1.id,
      title: 'Os 7 Padrões de Movimento Humano',
      dur: 1200,
      ord: 1,
      free: true,
    },
    {
      id: 'les_fit_2',
      mod: fitMod1.id,
      title: 'Avaliação Postural Inicial',
      dur: 900,
      ord: 2,
      free: false,
    },
    {
      id: 'les_fit_3',
      mod: fitMod1.id,
      title: 'Agachamento Perfeito — Detalhes',
      dur: 1500,
      ord: 3,
      free: false,
    },
    {
      id: 'les_fit_4',
      mod: fitMod1.id,
      title: 'Freqüência, Volume e Intensidade',
      dur: 1100,
      ord: 4,
      free: false,
    },
    {
      id: 'les_fit_5',
      mod: fitMod2.id,
      title: 'Treino A — Upper Body',
      dur: 2400,
      ord: 1,
      free: false,
    },
    {
      id: 'les_fit_6',
      mod: fitMod2.id,
      title: 'Treino B — Lower Body',
      dur: 2400,
      ord: 2,
      free: false,
    },
    {
      id: 'les_fit_7',
      mod: fitMod2.id,
      title: 'Treino C — Push/Pull/Legs',
      dur: 2700,
      ord: 3,
      free: false,
    },
    {
      id: 'les_fit_8',
      mod: fitMod2.id,
      title: 'HIIT — High Intensity Protocol',
      dur: 1800,
      ord: 4,
      free: false,
    },
    {
      id: 'les_fit_9',
      mod: fitMod3.id,
      title: 'Rotina de Mobilidade — 20min Daily',
      dur: 1200,
      ord: 1,
      free: false,
    },
    {
      id: 'les_fit_10',
      mod: fitMod3.id,
      title: 'Alongamento Pós-Treino Completo',
      dur: 900,
      ord: 2,
      free: false,
    },
  ]

  for (const l of fitLessonsData) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        moduleId: l.mod,
        title: l.title,
        description: `${l.title} — conteúdo completo com explicação técnica e dicas práticas do Coach Thiago.`,
        videoUrl: `https://vimeo.com/example/${l.id}`,
        videoDuration: l.dur,
        order: l.ord,
        isPublished: true,
        isFree: l.free,
      },
    })
  }

  console.log('✅  Módulos e aulas Fitness criados')

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. MATRÍCULAS
  // ─────────────────────────────────────────────────────────────────────────────
  const enrollmentsData = [
    {
      userId: students[0].id,
      courseId: courseMuayFundamentos.id,
      progress: 58,
    },
    { userId: students[0].id, courseId: courseMuayAvancado.id, progress: 22 },
    {
      userId: students[1].id,
      courseId: courseMuayFundamentos.id,
      progress: 18,
    },
    {
      userId: students[1].id,
      courseId: courseFitnessFuncional.id,
      progress: 35,
    },
    {
      userId: students[2].id,
      courseId: courseMuayFundamentos.id,
      progress: 100,
      status: EnrollmentStatus.COMPLETED,
    },
    { userId: students[2].id, courseId: courseMuayAvancado.id, progress: 75 },
    {
      userId: students[2].id,
      courseId: courseFitnessHipertrofia.id,
      progress: 40,
    },
    {
      userId: students[3].id,
      courseId: courseFitnessFuncional.id,
      progress: 10,
    },
    {
      userId: students[4].id,
      courseId: courseMuayFundamentos.id,
      progress: 45,
    },
    {
      userId: students[4].id,
      courseId: courseFitnessFuncional.id,
      progress: 60,
    },
  ]

  for (const e of enrollmentsData) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: e.userId, courseId: e.courseId } },
      update: { progress: e.progress },
      create: {
        userId: e.userId,
        courseId: e.courseId,
        status: (e as any).status ?? EnrollmentStatus.ACTIVE,
        progress: e.progress,
        completedAt:
          (e as any).status === EnrollmentStatus.COMPLETED ? new Date() : null,
      },
    })
  }

  console.log('✅  Matrículas criadas')

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. PROGRESSO DE AULAS (João — parcialmente concluído no Fundamentos)
  // ─────────────────────────────────────────────────────────────────────────────
  const joao = students[0]
  const completedLessonIds = [
    'les_m1_1',
    'les_m1_2',
    'les_m1_3',
    'les_m1_4',
    'les_m2_1',
    'les_m2_2',
    'les_m2_3',
  ]

  for (const lesId of completedLessonIds) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: joao.id, lessonId: lesId } },
      update: {},
      create: {
        userId: joao.id,
        lessonId: lesId,
        completed: true,
        watchTime: 1400,
        watchedAt: new Date(
          Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000,
        ),
        completedAt: new Date(
          Date.now() - Math.random() * 8 * 24 * 60 * 60 * 1000,
        ),
      },
    })
  }

  console.log('✅  Progresso de aulas criado para João')

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. TREINOS PERSONALIZADOS
  // ─────────────────────────────────────────────────────────────────────────────
  const trainingJoao = await prisma.trainingPlan.upsert({
    where: { id: 'training_joao_1' },
    update: {},
    create: {
      id: 'training_joao_1',
      studentId: students[0].id,
      coachId: profMuay.id,
      name: 'Protocolo Muay Thai — Força e Técnica',
      objective:
        'Desenvolver base física sólida com foco em potência nos golpes e resistência para sparring de 3 rounds.',
      notes:
        'João tem boa mobilidade natural. Focar em timing do jab + teep. Monitorar joelho direito.',
      frequency: '4x por semana (Seg, Ter, Qui, Sex)',
      startDate: new Date('2025-01-01'),
      isActive: true,
    },
  })

  const exercisesJoao = [
    {
      name: 'Shadowboxing com foco técnico',
      sets: 5,
      reps: '3min',
      rest: 60,
      load: 'Peso corporal',
      order: 1,
    },
    {
      name: 'Combos no saco pesado',
      sets: 8,
      reps: '2min',
      rest: 45,
      load: 'Saco 30kg',
      order: 2,
    },
    {
      name: 'Agachamento com salto',
      sets: 4,
      reps: '12',
      rest: 90,
      load: 'Peso corporal',
      order: 3,
    },
    {
      name: 'Prancha lateral com torção',
      sets: 3,
      reps: '45s',
      rest: 60,
      load: 'Peso corporal',
      order: 4,
    },
    {
      name: 'Corrida HIIT na esteira',
      sets: 1,
      reps: '20min',
      rest: null,
      load: 'Vel. 10-14km/h',
      order: 5,
    },
    {
      name: 'Kick pad com parceiro',
      sets: 6,
      reps: '1min',
      rest: 60,
      load: 'Mitts',
      order: 6,
    },
  ]

  for (const ex of exercisesJoao) {
    await prisma.trainingExercise.upsert({
      where: { id: `ex_joao_${ex.order}` },
      update: {},
      create: {
        id: `ex_joao_${ex.order}`,
        trainingId: trainingJoao.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        restTime: ex.rest ?? undefined,
        load: ex.load,
        order: ex.order,
      },
    })
  }

  const trainingCarlos = await prisma.trainingPlan.upsert({
    where: { id: 'training_carlos_1' },
    update: {},
    create: {
      id: 'training_carlos_1',
      studentId: students[2].id,
      coachId: profFitness.id,
      name: 'Mesociclo Hipertrofia — Fase 1',
      objective:
        'Hipertrofia muscular com foco em membros inferiores e posterior de coxa.',
      notes:
        'Carlos responde bem a alto volume. Aumentar carga nos compostos a cada 2 semanas.',
      frequency: '5x por semana',
      startDate: new Date('2025-01-15'),
      isActive: true,
    },
  })

  const exercisesCarlos = [
    {
      name: 'Agachamento livre',
      sets: 5,
      reps: '5',
      rest: 180,
      load: '85% 1RM',
      order: 1,
    },
    {
      name: 'Leg Press 45°',
      sets: 4,
      reps: '10-12',
      rest: 120,
      load: '200kg',
      order: 2,
    },
    {
      name: 'Stiff leg deadlift',
      sets: 4,
      reps: '8-10',
      rest: 120,
      load: '70% 1RM',
      order: 3,
    },
    {
      name: 'Leg curl na máquina',
      sets: 3,
      reps: '12-15',
      rest: 90,
      load: '35kg',
      order: 4,
    },
    {
      name: 'Panturrilha em pé',
      sets: 5,
      reps: '15-20',
      rest: 60,
      load: 'Peso + colete',
      order: 5,
    },
  ]

  for (const ex of exercisesCarlos) {
    await prisma.trainingExercise.upsert({
      where: { id: `ex_carlos_${ex.order}` },
      update: {},
      create: {
        id: `ex_carlos_${ex.order}`,
        trainingId: trainingCarlos.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        restTime: ex.rest,
        load: ex.load,
        order: ex.order,
      },
    })
  }

  console.log('✅  Treinos personalizados criados')

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. FEEDBACKS DO PROFESSOR
  // ─────────────────────────────────────────────────────────────────────────────
  await prisma.teacherFeedback.upsert({
    where: { id: 'fb_1' },
    update: {},
    create: {
      id: 'fb_1',
      teacherId: profMuay.id,
      studentId: students[0].id,
      trainingId: trainingJoao.id,
      title: 'Excelente evolução no jab! Corrija o cotovelo no gancho.',
      content:
        'João, estou muito satisfeito com sua evolução no jab. Velocidade e cadência estão ótimas. Ponto de atenção: no gancho, você está deixando o cotovelo alto — isso expõe você a um contra-ataque. Reveja a aula do gancho e me mande um vídeo na semana que vem. Continue o bom trabalho!',
      type: FeedbackType.TRAINING,
      isImportant: true,
      isRead: false,
    },
  })

  await prisma.teacherFeedback.upsert({
    where: { id: 'fb_2' },
    update: {},
    create: {
      id: 'fb_2',
      teacherId: profMuay.id,
      studentId: students[0].id,
      title: 'Progresso no curso — semana 3',
      content:
        'Você completou 58% do curso de Fundamentos. Ritmo consistente! Sugiro focar nos capítulos de defesa antes de avançar para os chutes. Base sólida primeiro.',
      type: FeedbackType.COURSE,
      isImportant: false,
      isRead: true,
    },
  })

  await prisma.teacherFeedback.upsert({
    where: { id: 'fb_3' },
    update: {},
    create: {
      id: 'fb_3',
      teacherId: profFitness.id,
      studentId: students[2].id,
      trainingId: trainingCarlos.id,
      title: 'Aumentar carga no agachamento — próxima semana',
      content:
        'Carlos, você está dominando a técnica do agachamento. A forma está impecável. Próxima semana vamos adicionar 5kg. Continue reportando RIR (repetições em reserva) para eu calibrar o volume.',
      type: FeedbackType.TRAINING,
      isImportant: true,
      isRead: false,
    },
  })

  console.log('✅  Feedbacks criados')

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. AVALIAÇÕES
  // ─────────────────────────────────────────────────────────────────────────────
  const assessJoao = await prisma.assessment.upsert({
    where: { id: 'assess_joao_1' },
    update: {},
    create: {
      id: 'assess_joao_1',
      studentId: students[0].id,
      title: 'Avaliação Inicial — Muay Thai',
      type: AssessmentType.PHYSICAL,
      status: AssessmentStatus.REVIEWED,
      professorNotes:
        'Boa base atlética. Foco no desenvolvimento da guarda e no ritmo dos chutes. Potencial alto.',
      submittedAt: new Date('2025-01-10'),
      reviewedAt: new Date('2025-01-12'),
    },
  })

  const answersJoao = [
    {
      q: 'Qual é sua experiência prévia com artes marciais?',
      a: 'Pratiquei jiu-jitsu por 2 anos. Sempre quis aprender Muay Thai.',
      ord: 1,
    },
    {
      q: 'Quais são seus objetivos na modalidade?',
      a: 'Competir amadoramente em 1 ano. Ganhar disciplina e preparo físico.',
      ord: 2,
    },
    {
      q: 'Você tem alguma lesão ou limitação física?',
      a: 'Joelho direito com episódio de tendinite em 2023. Resolvida.',
      ord: 3,
    },
    {
      q: 'Quantos dias por semana você pode treinar?',
      a: '4 a 5 dias.',
      ord: 4,
    },
    {
      q: 'Como você avalia seu condicionamento físico atual (1-10)?',
      a: '7/10. Pratico corrida 3x por semana.',
      ord: 5,
    },
  ]

  for (const ans of answersJoao) {
    await prisma.assessmentAnswer.upsert({
      where: { id: `ans_joao_${ans.ord}` },
      update: {},
      create: {
        id: `ans_joao_${ans.ord}`,
        assessmentId: assessJoao.id,
        question: ans.q,
        answer: ans.a,
        order: ans.ord,
      },
    })
  }

  console.log('✅  Avaliações criadas')

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. LIVES
  // ─────────────────────────────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const nextWeek2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  tomorrow.setHours(20, 0, 0, 0)
  nextWeek.setHours(20, 0, 0, 0)
  nextWeek2.setHours(19, 0, 0, 0)
  lastWeek.setHours(20, 0, 0, 0)

  const live1 = await prisma.liveSession.upsert({
    where: { id: 'live_muay_1' },
    update: {},
    create: {
      id: 'live_muay_1',
      professorId: profMuay.id,
      title: 'LIVE — Q&A: Dúvidas sobre Guarda e Defesa',
      description:
        'Sessão ao vivo para tirar todas as dúvidas do Módulo 1. Traga seus vídeos para análise técnica.',
      scheduledAt: tomorrow,
      duration: 90,
      link: 'https://meet.google.com/example-live-1',
      platform: 'Google Meet',
      isPremium: false,
      status: LiveStatus.SCHEDULED,
    },
  })

  const live2 = await prisma.liveSession.upsert({
    where: { id: 'live_muay_2' },
    update: {},
    create: {
      id: 'live_muay_2',
      professorId: profMuay.id,
      title: 'LIVE PREMIUM — Análise de Combate: Estratégia e Timing',
      description:
        'Para assinantes Premium: análise detalhada de combates profissionais, estratégias avançadas e segredos do Mestre Silva.',
      scheduledAt: nextWeek,
      duration: 120,
      link: 'https://meet.google.com/example-live-2',
      platform: 'Google Meet',
      isPremium: true,
      status: LiveStatus.SCHEDULED,
    },
  })

  const live3 = await prisma.liveSession.upsert({
    where: { id: 'live_fit_1' },
    update: {},
    create: {
      id: 'live_fit_1',
      professorId: profFitness.id,
      title: 'LIVE — Protocolos de Hipertrofia + Tira-Dúvidas',
      description:
        'Revisão dos princípios fundamentais de hipertrofia. Traga suas planilhas para análise.',
      scheduledAt: nextWeek2,
      duration: 90,
      link: 'https://zoom.us/example-live-3',
      platform: 'Zoom',
      isPremium: false,
      status: LiveStatus.SCHEDULED,
    },
  })

  // Live passada com replay
  const livePast = await prisma.liveSession.upsert({
    where: { id: 'live_muay_past_1' },
    update: {},
    create: {
      id: 'live_muay_past_1',
      professorId: profMuay.id,
      title: 'LIVE — Introdução ao Treinamento de Bag',
      description: 'Como treinar no saco pesado de forma técnica e produtiva.',
      scheduledAt: lastWeek,
      duration: 75,
      platform: 'YouTube',
      isPremium: false,
      isCompleted: true,
      status: LiveStatus.COMPLETED,
    },
  })

  await prisma.liveReplay.upsert({
    where: { id: 'replay_1' },
    update: {},
    create: {
      id: 'replay_1',
      liveId: livePast.id,
      videoUrl: 'https://youtube.com/watch?v=example_replay',
      duration: 4500,
      isPremium: false,
      views: 147,
    },
  })

  console.log(
    '✅  Lives criadas:',
    live1.title,
    '|',
    live2.title,
    '|',
    live3.title,
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. NOTIFICAÇÕES
  // ─────────────────────────────────────────────────────────────────────────────
  const notificationsData = [
    {
      userId: students[0].id,
      title: 'Nova aula disponível!',
      message:
        "A aula 'Cotovelada — Os 7 Tipos Básicos' foi publicada no curso Fundamentos do Muay Thai.",
      type: NotificationType.NEW_CONTENT,
      link: '/student/courses/fundamentos-muay-thai',
    },
    {
      userId: students[0].id,
      title: 'Feedback do Mestre Silva',
      message:
        "Você recebeu um novo feedback: 'Excelente evolução no jab! Corrija o cotovelo no gancho.'",
      type: NotificationType.FEEDBACK,
      link: '/student/feedback',
      isRead: false,
    },
    {
      userId: students[0].id,
      title: 'Live amanhã às 20h!',
      message:
        "Não perca: 'Q&A: Dúvidas sobre Guarda e Defesa'. Acesso gratuito para todos os assinantes.",
      type: NotificationType.LIVE,
      link: '/student/lives',
    },
    {
      userId: students[2].id,
      title: 'Parabéns! Curso concluído 🏆',
      message:
        'Você concluiu 100% do curso Fundamentos do Muay Thai. Continue para o nível avançado!',
      type: NotificationType.SUCCESS,
      link: '/student/courses',
    },
  ]

  for (let i = 0; i < notificationsData.length; i++) {
    await prisma.notification.upsert({
      where: { id: `notif_${i + 1}` },
      update: {},
      create: {
        id: `notif_${i + 1}`,
        ...notificationsData[i],
        isRead: (notificationsData[i] as any).isRead ?? false,
      },
    })
  }

  console.log('✅  Notificações criadas')

  // ─────────────────────────────────────────────────────────────────────────────
  // RESUMO
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✨  SEED CONCLUÍDO COM SUCESSO!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n📧 CREDENCIAIS DE ACESSO:')
  console.log('\n👑 Admin:')
  console.log('   Email:  johnycristian2@gmail.com')
  console.log('   Senha:  Admin@123456')
  console.log('\n🥊 Professor Muay Thai:')
  console.log('   Email:  mestre.silva@muaythai.com')
  console.log('   Senha:  Prof@123456')
  console.log('\n💪 Professor Fitness:')
  console.log('   Email:  coach.thiago@academiaelite.com')
  console.log('   Senha:  Prof@123456')
  console.log('\n🎓 Alunos (senha: Student@123456):')
  for (const s of studentsData) {
    console.log(`   ${s.email}`)
  }
  console.log('\n💳 Planos:')
  console.log('   Básico:   R$ 97/mês')
  console.log('   Premium:  R$ 197/mês')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌  Erro no seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
