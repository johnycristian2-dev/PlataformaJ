import { Skeleton } from '@/components/ui/skeleton'

export default function ProfessorSettingsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
    </div>
  )
}
