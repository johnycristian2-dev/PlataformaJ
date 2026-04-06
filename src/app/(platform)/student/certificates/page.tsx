import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function StudentCertificatesPage() {
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!['STUDENT', 'ADMIN'].includes(session.user.role)) {
    redirect('/professor/dashboard')
  }

  const certificates = await prisma.certificate.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          professor: { select: { name: true } },
        },
      },
    },
    orderBy: { issuedAt: 'desc' },
  })

  return (
    <div className="p-6 max-w-[1240px] mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
          Certificados
        </h1>
        <p className="text-muted-foreground mt-1">
          Seus certificados emitidos após conclusão dos cursos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {certificates.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Você ainda não possui certificados emitidos.
            </CardContent>
          </Card>
        )}

        {certificates.map((certificate) => (
          <Card key={certificate.id} className="h-full">
            <CardHeader>
              <CardTitle className="text-base leading-tight">
                {certificate.course.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Professor: {certificate.course.professor.name ?? 'Professor'}
              </p>

              <div className="flex items-center gap-2">
                <Badge variant="success">Emitido</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(certificate.issuedAt)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Código: {certificate.certificateCode}
              </p>

              <Link
                href={`/student/certificates/${certificate.id}`}
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center hover:opacity-90 transition-opacity"
              >
                Visualizar certificado
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
