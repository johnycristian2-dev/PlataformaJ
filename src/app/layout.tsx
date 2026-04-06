import type { Metadata, Viewport } from 'next'
import { Inter, Oswald } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from 'sonner'
import { APP_NAME } from '@/lib/constants'

// ─────────────────────────────────────────────────────────────────────────────
// FONTES
// ─────────────────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

// ─────────────────────────────────────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    template: `%s — ${APP_NAME}`,
    default: `${APP_NAME} | Plataforma Premium de Ensino`,
  },
  description:
    'A plataforma definitiva para criadores de conteúdo educacional premium. Cursos, treinos personalizados, lives exclusivas e muito mais.',
  keywords: [
    'cursos online',
    'plataforma educacional',
    'muay thai',
    'fitness',
    'academia',
    'treino personalizado',
    'lives',
    'streaming de aulas',
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: APP_NAME,
    title: `${APP_NAME} | Plataforma Premium de Ensino`,
    description:
      'Cursos, treinos e lives exclusivos da melhor plataforma de ensino premium.',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} | Plataforma Premium de Ensino`,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT RAIZ
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`
          ${inter.variable}
          ${oswald.variable}
          font-sans antialiased bg-background text-foreground
          min-h-screen selection:bg-primary/20 selection:text-foreground
        `}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Conteúdo da rota */}
          {children}

          {/* Toast global (sonner) */}
          <Toaster
            theme="dark"
            richColors
            closeButton
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.875rem',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
