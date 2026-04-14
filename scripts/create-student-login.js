const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const email = 'aluno.teste@plataformaj.com'
  const passwordPlain = 'Aluno@123456'
  const passwordHash = await bcrypt.hash(passwordPlain, 12)
  const now = new Date()

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      role: 'STUDENT',
      isActive: true,
      emailVerified: now,
      name: 'Aluno Teste',
    },
    create: {
      email,
      password: passwordHash,
      role: 'STUDENT',
      isActive: true,
      emailVerified: now,
      name: 'Aluno Teste',
    },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      isActive: true,
    },
  })

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })

  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      fitnessLevel: 'iniciante',
    },
  })

  console.log('LOGIN_ALUNO_CRIADO')
  console.log(`email=${email}`)
  console.log(`senha=${passwordPlain}`)
  console.log(`role=${user.role}`)
  console.log(`ativo=${user.isActive}`)
  console.log(`emailVerificado=${user.emailVerified?.toISOString()}`)
}

main()
  .catch((error) => {
    console.error('ERRO_AO_CRIAR_LOGIN_ALUNO')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
