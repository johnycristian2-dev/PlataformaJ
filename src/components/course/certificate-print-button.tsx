'use client'

export function CertificatePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 px-3 rounded-md border border-border text-sm hover:bg-accent transition-colors"
    >
      Imprimir certificado
    </button>
  )
}
