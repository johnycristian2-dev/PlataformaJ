import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlatformShell } from '@/components/layout/platform-shell'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? 'STUDENT',
  }

  return <PlatformShell user={user}>{children}</PlatformShell>
}
