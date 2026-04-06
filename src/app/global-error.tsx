'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ maxWidth: 560, textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              Erro critico
            </h1>
            <p style={{ opacity: 0.8, marginBottom: 16 }}>
              Algo deu errado ao renderizar a aplicacao.
            </p>
            {process.env.NODE_ENV === 'development' ? (
              <pre
                style={{
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 16,
                }}
              >
                {error?.message}
              </pre>
            ) : null}
            <button type="button" onClick={() => reset()}>
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
