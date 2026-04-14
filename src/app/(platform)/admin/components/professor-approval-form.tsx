'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ProfessorApprovalFormProps {
  professorProfileId: string
  approved: boolean
  onSubmit: (formData: FormData) => Promise<void>
  onSuccess?: () => void
}

export function ProfessorApprovalForm({
  professorProfileId,
  approved,
  onSubmit,
  onSuccess,
}: ProfessorApprovalFormProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await onSubmit(formData)

        const action = approved ? 'Aprovação' : 'Rejeição'
        toast.success(`${action} do professor realizada com sucesso!`)

        // Aguarda um pouco para o servidor revalidar
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Refresca a página
        router.refresh()

        onSuccess?.()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erro ao processar'
        toast.error(message)
      }
    })
  }

  if (approved) {
    return (
      <form action={handleSubmit}>
        <input
          type="hidden"
          name="professorProfileId"
          value={professorProfileId}
        />
        <input type="hidden" name="approved" value="true" />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Processando...' : 'Aprovar professor'}
        </Button>
      </form>
    )
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="hidden"
        name="professorProfileId"
        value={professorProfileId}
      />
      <input type="hidden" name="approved" value="false" />
      <input
        type="text"
        name="reason"
        required
        minLength={10}
        placeholder="Motivo da rejeição (mínimo 10 caracteres)"
        className="h-8 w-[280px] rounded-md border border-input bg-background px-2 text-xs"
        disabled={isPending}
      />
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={isPending}
      >
        {isPending ? 'Processando...' : 'Rejeitar candidatura'}
      </Button>
    </form>
  )
}
