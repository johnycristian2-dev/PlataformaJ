'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

interface PlatformShellProps {
  user: {
    name: string | null
    email: string | null
    image: string | null
    role: string
  }
  children: React.ReactNode
}

export function PlatformShell({ user, children }: PlatformShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — desktop fixo */}
      <div className="hidden lg:flex h-full flex-shrink-0">
        <Sidebar user={user} />
      </div>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header — mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-lg tracking-tight">
            Plataforma<span className="text-primary">J</span>
          </span>
          <Avatar size="sm">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback>
              {getInitials(user.name ?? user.email ?? 'U')}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
