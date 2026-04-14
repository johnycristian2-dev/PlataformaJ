import type { ProfessorProfile } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface ProfessorItemProps {
  prof: ProfessorProfile & {
    user: {
      name: string | null
      email: string
      createdAt: Date
      isActive: boolean
    }
  }
  onApprove: (
    formData: FormData,
  ) => Promise<{ success: boolean; error?: string }>
}

export default async function ProfessorItem({
  prof,
  onApprove,
}: ProfessorItemProps) {
  async function handleApproval(formData: FormData) {
    'use server'
    const result = await onApprove(formData)
    if (!result.success) {
      throw new Error(result.error || 'Falha ao processar aprovação')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-accent/20 p-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <p className="text-sm font-semibold">
            {prof.user.name ?? prof.user.email}
          </p>
          <p className="text-xs text-muted-foreground">{prof.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={prof.isApproved ? 'success' : 'warning'}>
            {prof.isApproved ? 'Aprovado' : 'Pendente'}
          </Badge>
          <Badge variant={prof.user.isActive ? 'secondary' : 'destructive'}>
            {prof.user.isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Criado em {formatDate(prof.user.createdAt)}
      </p>

      {prof.applicationSubmittedAt && (
        <p className="text-xs text-muted-foreground mt-1">
          Candidatura enviada em {formatDate(prof.applicationSubmittedAt)}
        </p>
      )}

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Status:</span>{' '}
          {prof.applicationStatus ?? (prof.isApproved ? 'APPROVED' : 'PENDING')}
        </p>
        <p>
          <span className="font-medium text-foreground">Foco:</span>{' '}
          {prof.focusArea ?? 'Não informado'}
        </p>
        <p>
          <span className="font-medium text-foreground">Escolaridade:</span>{' '}
          {prof.educationLevel ?? 'Não informado'}
        </p>
        <p>
          <span className="font-medium text-foreground">Contato:</span>{' '}
          {prof.contactPhone ?? prof.phone ?? prof.user.email}
        </p>
      </div>

      {prof.rejectionReason && (
        <p className="text-xs text-destructive mt-2">
          Último motivo de rejeição: {prof.rejectionReason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!prof.isApproved && (
          <form action={handleApproval}>
            <input type="hidden" name="professorProfileId" value={prof.id} />
            <input type="hidden" name="approved" value="true" />
            <Button type="submit" size="sm">
              Aprovar professor
            </Button>
          </form>
        )}

        {!prof.isApproved && (
          <form
            action={handleApproval}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="professorProfileId" value={prof.id} />
            <input type="hidden" name="approved" value="false" />
            <input
              type="text"
              name="reason"
              required
              minLength={10}
              placeholder="Motivo da rejeição (mínimo 10 caracteres)"
              className="h-8 w-[280px] rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button type="submit" size="sm" variant="destructive">
              Rejeitar candidatura
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
