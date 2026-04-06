'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface CatalogFiltersProps {
  professors: { id: string; name: string | null }[]
  niches: string[]
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Iniciante',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
  ALL_LEVELS: 'Todos os níveis',
}

export function CatalogFilters({ professors, niches }: CatalogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => update('q', value), 350)
    },
    [update],
  )

  const hasFilters =
    !!searchParams.get('q') ||
    !!searchParams.get('level') ||
    !!searchParams.get('niche') ||
    !!searchParams.get('professor') ||
    !!searchParams.get('sort')

  const clearAll = () => {
    router.push(pathname, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar cursos..."
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Nível */}
      <select
        defaultValue={searchParams.get('level') ?? ''}
        onChange={(e) => update('level', e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Todos os níveis</option>
        {Object.entries(LEVEL_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Nicho */}
      {niches.length > 0 && (
        <select
          defaultValue={searchParams.get('niche') ?? ''}
          onChange={(e) => update('niche', e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os nichos</option>
          {niches.map((niche) => (
            <option key={niche} value={niche}>
              {niche}
            </option>
          ))}
        </select>
      )}

      {/* Professor */}
      {professors.length > 0 && (
        <select
          defaultValue={searchParams.get('professor') ?? ''}
          onChange={(e) => update('professor', e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os professores</option>
          {professors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? 'Professor'}
            </option>
          ))}
        </select>
      )}

      {/* Ordenação */}
      <select
        defaultValue={searchParams.get('sort') ?? ''}
        onChange={(e) => update('sort', e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Mais recentes</option>
        <option value="popular">Mais populares</option>
        <option value="az">A — Z</option>
      </select>

      {/* Limpar filtros */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="h-9 px-3 rounded-md border border-border text-sm text-muted-foreground inline-flex items-center gap-1.5 hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Limpar
        </button>
      )}
    </div>
  )
}
