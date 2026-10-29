import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatNumero } from '@/types'
import type { AccionFallida } from '@/hooks/useOffline'

// Acciones offline que el servidor rechazó (pedido anulado, no encontrado, rol…).
// Quedan guardadas hasta que alguien las descarte: así no se pierde un cobro
// sin que nadie se entere.

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

function descripcion(f: AccionFallida): string {
  const pedido = f.numero != null ? formatNumero(f.numero) : `pedido ${f.pedidoId.slice(0, 8)}`
  if (f.type === 'cerrarPedido') {
    const total = (f.pagos ?? []).reduce((s, p) => s + p.monto, 0)
    return `1 cierre no se pudo sincronizar: ${pedido}${total > 0 ? ` (${pesos(total)})` : ''} — ${f.motivo}`
  }
  return `1 cambio de estado no se pudo sincronizar: ${pedido} — ${f.motivo}`
}

export function AvisoFallidas({ fallidas, onDescartar }: {
  fallidas:    AccionFallida[]
  onDescartar: (id: string) => void
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null)
  if (fallidas.length === 0) return null

  const btn: React.CSSProperties = {
    border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11,
    fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter Variable, sans-serif', flexShrink: 0,
  }

  return (
    <div role="alert" style={{ background: '#FDECEA', borderBottom: '0.5px solid #D32F2F', padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {fallidas.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#B71C1C' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0 }} aria-hidden />
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{descripcion(f)}</span>
          {confirmando === f.id ? (
            <>
              <button type="button" onClick={() => { onDescartar(f.id); setConfirmando(null) }}
                style={{ ...btn, background: '#D32F2F', color: '#fff' }}>
                Descartar
              </button>
              <button type="button" onClick={() => setConfirmando(null)}
                style={{ ...btn, background: 'transparent', color: '#B71C1C', border: '1px solid #D32F2F' }}>
                No
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(f.id)}
              aria-label={`Descartar: ${descripcion(f)}`}
              style={{ ...btn, background: 'transparent', color: '#B71C1C', border: '1px solid #D32F2F' }}>
              Descartar
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
