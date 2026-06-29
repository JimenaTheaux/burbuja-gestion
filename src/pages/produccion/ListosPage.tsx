import { CheckCircle, List } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePedidosListosHoy } from '@/services/produccion'

export default function ListosPage() {
  const { data: pedidos, isLoading } = usePedidosListosHoy()

  return (
    <div>
      <h1 className="section-title" style={{ marginBottom: 20 }}>Listos para reparto — Hoy</h1>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <Skeleton key={i} style={{ height: 70, borderRadius: 16 }} />)}
        </div>
      ) : !pedidos?.length ? (
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <List size={48} strokeWidth={1.2} color="#E5E5EA" style={{ marginBottom: 12 }} />
          <p style={{ fontWeight: 600, fontSize: 15, color: '#1C1C1E', margin: '0 0 4px' }}>Sin pedidos listos aún</p>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Los pedidos marcados como listos aparecen aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedidos.map(p => (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid #F9A825',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <CheckCircle size={20} color="#2E9E5C" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1C1C1E' }}>
                  P-{String(p.numero).padStart(5, '0')} — {p.clientes?.nombre}
                </div>
                {p.notas_produccion && (
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{p.notas_produccion}</div>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>
                {new Date(p.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 4 }}>
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} listo{pedidos.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
