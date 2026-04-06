import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { updateUserRoleByAdminAction } from '@/app/actions/admin-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDate, getInitials } from '@/lib/utils'

const ROLE_LABELS = {
  ADMIN: 'Admin',
  PROFESSOR: 'Professor',
  STUDENT: 'Aluno',
} as const

const ROLE_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'info' | 'success'
> = {
  ADMIN: 'default',
  PROFESSOR: 'info',
  STUDENT: 'success',
}

const PAGE_SIZE = 12

const getAdminUsersPage = unstable_cache(
  async (page: number) => {
    const skip = (page - 1) * PAGE_SIZE

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count(),
    ])

    return { users, total }
  },
  ['admin-users-page'],
  { revalidate: 30, tags: ['users'] },
)

interface AdminUsersPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const params = await searchParams
  const page = Math.max(1, Number(params.page || 1) || 1)
  const { users, total } = await getAdminUsersPage(page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function submitRoleUpdate(formData: FormData) {
    'use server'

    await updateUserRoleByAdminAction(formData)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Gestão de Perfis
        </h1>
        <p className="text-muted-foreground mt-1">
          Somente o admin pode escolher quem é aluno ou professor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários da plataforma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum usuário encontrado.
            </p>
          ) : (
            users.map((user) => (
              <form
                key={user.id}
                action={submitRoleUpdate}
                className="rounded-xl border border-border bg-accent/20 p-4"
              >
                <input type="hidden" name="userId" value={user.id} />

                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar size="sm" className="shrink-0">
                      <AvatarFallback>
                        {getInitials(user.name ?? user.email ?? 'U')}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {user.name ?? user.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={ROLE_VARIANTS[user.role] ?? 'secondary'}>
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ??
                        user.role}
                    </Badge>
                    <Badge variant={user.isActive ? 'success' : 'destructive'}>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 lg:min-w-[250px]">
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full"
                    >
                      <option value="STUDENT">Aluno</option>
                      <option value="PROFESSOR">Professor</option>
                      <option value="ADMIN">Admin</option>
                    </select>

                    <Button type="submit" variant="secondary">
                      Salvar
                    </Button>
                  </div>
                </div>
              </form>
            ))
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`?page=${Math.max(1, page - 1)}`}
                className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
              >
                Anterior
              </Link>
              <Link
                href={`?page=${Math.min(totalPages, page + 1)}`}
                className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center hover:bg-accent transition-colors"
              >
                Próxima
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
