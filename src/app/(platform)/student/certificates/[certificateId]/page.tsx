import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { CertificatePrintButton } from '@/components/course/certificate-print-button'

interface Props {
  params: Promise<{ certificateId: string }>
}

export default async function StudentCertificateDetailsPage({ params }: Props) {
  const { certificateId } = await params
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/professor/dashboard')
  }

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      user: { select: { name: true, email: true } },
      course: {
        select: {
          title: true,
          professor: { select: { name: true } },
        },
      },
    },
  })

  if (!certificate || certificate.userId !== session.user.id) {
    notFound()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/student/certificates"
          className="h-9 px-3 rounded-md border border-border text-sm inline-flex items-center hover:bg-accent transition-colors"
        >
          Voltar para certificados
        </Link>
        <CertificatePrintButton />
      </div>

      <Card className="border-2">
        <CardContent className="p-10 md:p-14 text-center space-y-6">
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
            Certificado de conclusão
          </p>

          <h1 className="font-heading text-3xl md:text-4xl font-black uppercase tracking-tight">
            {certificate.course.title}
          </h1>

          <p className="text-base md:text-lg text-muted-foreground">
            Certificamos que
          </p>

          <p className="text-2xl md:text-3xl font-semibold">
            {certificate.user.name ?? certificate.user.email}
          </p>

          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto">
            concluiu com sucesso o curso acima na Plataforma J, sob orientação
            de {certificate.course.professor.name ?? 'Professor'}.
          </p>

          <div className="pt-2 space-y-1 text-sm text-muted-foreground">
            <p>Emitido em: {formatDate(certificate.issuedAt)}</p>
            <p>Código de validação: {certificate.certificateCode}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
