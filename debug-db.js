const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    // Check ADMIN users
    console.log('=== ADMIN USERS ===')
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    console.log(`Found ${admins.length} admin users:`)
    admins.forEach((u) =>
      console.log(
        `  - ${u.email} (${u.name}) - ${u.isActive ? 'Active' : 'Inactive'}`,
      ),
    )

    // Check PROFESSOR users
    console.log('\n=== PROFESSOR USERS ===')
    const professors = await prisma.user.findMany({
      where: { role: 'PROFESSOR' },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    console.log(`Found ${professors.length} professor users`)

    // Check ProfessorProfile records
    console.log('\n=== PROFESSOR PROFILES ===')
    const profiles = await prisma.professorProfile.findMany({
      select: {
        id: true,
        userId: true,
        fullName: true,
        applicationStatus: true,
        isApproved: true,
        user: { select: { email: true, name: true } },
      },
      take: 10,
    })
    console.log(`Found ${profiles.length} professor profiles:`)
    profiles.forEach((p) => {
      console.log(
        `  - ${p.user?.email} | Status: ${p.applicationStatus} | Approved: ${p.isApproved}`,
      )
    })
  } catch (error) {
    console.error('Database error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
