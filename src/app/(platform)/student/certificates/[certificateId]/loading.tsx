import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function CertificateDetailsLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Skeleton className="h-9 w-64" />
      <Card>
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-8 w-72 mx-auto" />
          <Skeleton className="h-5 w-80 mx-auto" />
          <Skeleton className="h-5 w-96 mx-auto" />
          <Skeleton className="h-6 w-56 mx-auto" />
        </CardContent>
      </Card>
    </div>
  )
}
