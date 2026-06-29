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
        padding: '32px 36px',
        boxSizing: 'border-box',
        color: '#1C1C1E',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, width: '100%' }}>
          <img
            src="/Logo_sin_fondo_negro.png"
            alt="Burbuja"
            style={{ maxWidth: 160, height: 'auto', flexShrink: 0 }}
          />
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#8E8E93' }}>Limpieza Superpoderosa</p>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 2, background: '#3DD6B5', marginBottom: 20, width: '100%' }} />

      {/* Datos del pedido */}
      <div style={{ marginBottom: 20, width: '100%', boxSizing: 'border-box' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16,
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 13,
        }}>
          <div>
            <span style={{ color: '#8E8E93', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              N° Pedido
            </span>
            <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 15, color: '#3DD6B5' }}>{numero}</p>
          </div>
          <div>
            <span style={{ color: '#8E8E93', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Fecha de producción
            </span>
            <p style={{ margin: '2px 0 0', fontWeight: 500 }}>{fmtFecha(pedido.fecha_produccion)}</p>
          </div>
          <div>
            <span style={{ color: '#8E8E93', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cliente
            </span>
            <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{pedido.clientes?.nombre ?? '—'}</p>
          </div>
          {pedido.direccion_entrega && (
            <div>
              <span style={{ color: '#8E8E93', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Dirección
              </span>
              <p style={{ margin: '2px 0 0' }}>{pedido.direccion_entrega}</p>
            </div>
          )}
          <div>
            <span style={{ color: '#8E8E93', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tipo
            </span>
            <p style={{ margin: '2px 0 0', textTransform: 'capitalize' }}>{pedido.tipo_precio}</p>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: '#E5E7EB', marginBottom: 16, width: '100%' }} />

      {/* Tabla de ítems — anchos en px explícitos para html2canvas */}
      <table style={{ width: 528, borderCollapse: 'collapse', fontSize: 11, marginBottom: 0, tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '0.5px solid #E5E5EA' }}>
            <th style={{
              textAlign: 'left', padding: '4px 6px', fontWeight: 600,
              color: '#8E8E93', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em', width: 264,
            }}>Producto</th>
            <th style={{
              textAlign: 'center', padding: '4px 6px', fontWeight: 600,
              color: '#8E8E93', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em', width: 79,
            }}>Cant.</th>
            <th style={{
              textAlign: 'right', padding: '4px 6px', fontWeight: 600,
              color: '#8E8E93', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em', width: 90,
            }}>P. Unit.</th>
            <th style={{
              textAlign: 'right', padding: '4px 6px', fontWeight: 600,
              color: '#8E8E93', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.06em', width: 95,
            }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(pedido.pedido_items ?? []).map((item) => (
            <Fragment key={item.id}>
              {/* Fila del producto */}
              <tr>
                <td style={{ padding: '8px 6px 2px 6px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1C1C1E', lineHeight: 1.3 }}>
                    {item.productos?.nombre ?? '—'}
                    {item.productos?.presentacion ? ` — ${item.productos.presentacion}L` : ''}
                  </div>
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px 2px', fontSize: 12, verticalAlign: 'top' }}>
                  {item.cantidad}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 6px 2px', fontSize: 12, verticalAlign: 'top' }}>
                  {fmtMonto(item.precio_unitario)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 6px 2px', fontSize: 12, fontWeight: 500, color: '#3DD6B5', verticalAlign: 'top' }}>
                  {fmtMonto(item.cantidad * item.precio_unitario)}
                </td>
              </tr>
              {/* Fila del badge — solo si bidon_nuevo */}
              {item.bidon_nuevo && (
                <tr>
                  <td colSpan={4} style={{ padding: '0 6px 10px 6px' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 9,
                      fontWeight: 600,
                      color: '#E65100',
                      background: '#FFF3E0',
                      padding: '2px 8px',
                      borderRadius: 99,
                      marginTop: 2,
                    }}>
                      Bidón nuevo
                    </span>
                  </td>
                </tr>
              )}
              {/* Separador entre ítems */}
              <tr>
                <td colSpan={4} style={{ padding: 0 }}>
                  <div style={{ height: 1, background: '#F5F7F9' }} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ marginTop: 16, borderTop: '0.5px solid #E5E5EA', paddingTop: 12, width: '100%', boxSizing: 'border-box' }}>
        {pedido.costo_envio > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12, color: '#8E8E93',
            marginBottom: 8, padding: '0 6px',
          }}>
            <span>Costo de envío</span>
            <span>{fmtMonto(pedido.costo_envio)}</span>
          </div>
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 6px 0',
          borderTop: pedido.costo_envio > 0 ? '0.5px solid #F5F7F9' : 'none',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E' }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#3DD6B5' }}>{fmtMonto(total)}</span>
        </div>
        {pedido.total_manual && (
          <p style={{ margin: '2px 6px 0', fontSize: 10, color: '#F57C00', textAlign: 'right' }}>
            Total modificado manualmente
          </p>
        )}
      </div>

      {/* Footer de cobro (solo si está cerrado) */}
      {isCerrado && (
        <>
          <div style={{ height: 1, background: '#E5E7EB', margin: '20px 0 16px', width: '100%' }} />
          <div style={{ background: '#F5F7F9', borderRadius: 10, padding: '12px 16px', fontSize: 12, width: '100%', boxSizing: 'border-box' }}>
            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8E8E93' }}>
              Información de cobro
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pedido.forma_cobro && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8E8E93' }}>Forma de cobro</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{pedido.forma_cobro}</span>
                </div>
              )}
              {pedido.monto_cobrado != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8E8E93' }}>Monto cobrado</span>
                  <span style={{ fontWeight: 600 }}>{fmtMonto(pedido.monto_cobrado)}</span>
                </div>
              )}
              {pedido.estado_pago && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8E8E93' }}>Estado de pago</span>
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
                  <span style={{ color: '#8E8E93' }}>Cerrado el</span>
                  <span style={{ fontWeight: 600 }}>{fmtFecha(pedido.fecha_cobro)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ height: 1, background: '#3DD6B5', margin: '20px 0 12px', width: '100%' }} />
      <p style={{ margin: 0, fontSize: 10, color: '#8E8E93', textAlign: 'center' }}>
        Burbuja Limpieza Superpoderosa
      </p>
    </div>
  )
}
