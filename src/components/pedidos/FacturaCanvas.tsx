import { Fragment } from 'react'
import type { PedidoDetalle } from '@/services/pedidos'
import { totalPedido } from '@/types'

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtMonto(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

export function FacturaCanvas({ pedido }: { pedido: PedidoDetalle }) {
  const total      = Number(totalPedido(pedido))
  const numero     = `P-${String(pedido.numero).padStart(5, '0')}`
  const isCerrado  = pedido.estado === 'cerrado'

  return (
    <div
      data-factura-root
      style={{
        width: 600,
        background: '#ffffff',
        fontFamily: 'Inter, Arial, sans-serif',
        padding: 28,
        boxSizing: 'border-box',
        color: '#1A2B3C',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#1B9ED6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: -0.5 }}>LM</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0D5C8A', letterSpacing: -0.3 }}>
              LIMPIMAX
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#4A5568' }}>Productos Químicos</p>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: '#E5E7EB', marginBottom: 20 }} />

      {/* Datos del pedido */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '8px 24px',
          fontSize: 13,
        }}>
          <div>
            <span style={{ color: '#4A5568', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              N° Pedido
            </span>
            <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 15, color: '#0D5C8A' }}>{numero}</p>
          </div>
          <div>
            <span style={{ color: '#4A5568', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Fecha de producción
            </span>
            <p style={{ margin: '2px 0 0', fontWeight: 500 }}>{fmtFecha(pedido.fecha_produccion)}</p>
          </div>
          <div>
            <span style={{ color: '#4A5568', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cliente
            </span>
            <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{pedido.clientes?.nombre ?? '—'}</p>
          </div>
          {pedido.direccion_entrega && (
            <div>
              <span style={{ color: '#4A5568', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Dirección
              </span>
              <p style={{ margin: '2px 0 0' }}>{pedido.direccion_entrega}</p>
            </div>
          )}
          <div>
            <span style={{ color: '#4A5568', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tipo
            </span>
            <p style={{ margin: '2px 0 0', textTransform: 'capitalize' }}>{pedido.tipo_precio}</p>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: '#E5E7EB', marginBottom: 16 }} />

      {/* Tabla de ítems */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid #D1D5DB' }}>
            <th style={{
              textAlign: 'left', padding: '4px 6px', fontWeight: 600,
              color: '#4A5568', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em', width: '45%',
            }}>Producto</th>
            <th style={{
              textAlign: 'center', padding: '4px 6px', fontWeight: 600,
              color: '#4A5568', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>Cant.</th>
            <th style={{
              textAlign: 'right', padding: '4px 6px', fontWeight: 600,
              color: '#4A5568', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>P. Unit.</th>
            <th style={{
              textAlign: 'right', padding: '4px 6px', fontWeight: 600,
              color: '#4A5568', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(pedido.pedido_items ?? []).map((item) => (
            <Fragment key={item.id}>
              <tr>
                <td style={{ padding: '5px 6px', verticalAlign: 'top', borderBottom: item.bidon_nuevo ? 'none' : '0.5px solid #F0F0F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#1A2B3C' }}>
                    {item.productos?.nombre ?? '—'}
                    {item.productos?.presentacion ? ` — ${item.productos.presentacion}L` : ''}
                  </div>
                </td>
                <td style={{ textAlign: 'center', padding: '5px 6px', verticalAlign: 'top', borderBottom: item.bidon_nuevo ? 'none' : '0.5px solid #F0F0F0' }}>
                  {item.cantidad}
                </td>
                <td style={{ textAlign: 'right', padding: '5px 6px', verticalAlign: 'top', borderBottom: item.bidon_nuevo ? 'none' : '0.5px solid #F0F0F0' }}>
                  {fmtMonto(item.precio_unitario)}
                </td>
                <td style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 500, verticalAlign: 'top', borderBottom: item.bidon_nuevo ? 'none' : '0.5px solid #F0F0F0', color: '#0D5C8A' }}>
                  {fmtMonto(item.cantidad * item.precio_unitario)}
                </td>
              </tr>
              {item.bidon_nuevo && (
                <tr>
                  <td colSpan={4} style={{ padding: '0 6px 6px 14px', borderBottom: '0.5px solid #F0F0F0' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600,
                      background: '#FFF3E0', color: '#E65100',
                      padding: '1px 6px', borderRadius: 99,
                      display: 'inline-block',
                    }}>
                      Bidón nuevo
                    </span>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ minWidth: 240 }}>
          {pedido.costo_envio > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#4A5568', borderBottom: '1px solid #F0F0F0' }}>
              <span>Costo de envío</span>
              <span>{fmtMonto(pedido.costo_envio)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 16, fontWeight: 600, color: '#0D5C8A' }}>
            <span>Total</span>
            <span>{fmtMonto(total)}</span>
          </div>
          {pedido.total_manual && (
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#F57C00', textAlign: 'right' }}>
              Total modificado manualmente
            </p>
          )}
        </div>
      </div>

      {/* Footer de cobro (solo si está cerrado) */}
      {isCerrado && (
        <>
          <div style={{ height: 1, background: '#E5E7EB', margin: '20px 0 16px' }} />
          <div style={{ background: '#F4F6F8', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4A5568' }}>
              Información de cobro
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pedido.forma_cobro && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4A5568' }}>Forma de cobro</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{pedido.forma_cobro}</span>
                </div>
              )}
              {pedido.monto_cobrado != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4A5568' }}>Monto cobrado</span>
                  <span style={{ fontWeight: 600 }}>{fmtMonto(pedido.monto_cobrado)}</span>
                </div>
              )}
              {pedido.estado_pago && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4A5568' }}>Estado de pago</span>
                  <span style={{
                    fontWeight: 700,
                    color: pedido.estado_pago === 'cobrado' ? '#2E9E5C' : '#F57C00',
                    textTransform: 'capitalize',
                  }}>
                    {pedido.estado_pago === 'cobrado' ? 'Cobrado' : 'Pendiente'}
                  </span>
                </div>
              )}
              {pedido.fecha_cobro && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4A5568' }}>Cerrado el</span>
                  <span style={{ fontWeight: 600 }}>{fmtFecha(pedido.fecha_cobro)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
