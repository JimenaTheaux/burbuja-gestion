import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, X, MapPin } from 'lucide-react'
import { usePedidoDetalle, totalPedido } from '@/services/pedidos'
import { ESTADO_CONFIG } from '@/types'

export default function PrintPedidoPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { data: pedido, isLoading } = usePedidoDetalle(id ?? null)

  // Auto-print al cargar
  useEffect(() => {
    if (!pedido || isLoading) return
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [pedido, isLoading])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#8E8E93' }}>Cargando pedido…</p>
      </div>
    )
  }

  if (!pedido) return <p>Pedido no encontrado.</p>

  const total = Number(totalPedido(pedido))
  const fecha = pedido.created_at
    ? new Date(pedido.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <>
      {/* Barra de acción — solo pantalla */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1C1C1E', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
          Vista previa — P-{String(pedido.numero).padStart(5, '0')}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} style={{
            background: '#3DD6B5', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Printer size={14} /> Imprimir / Guardar PDF
          </button>
          <button onClick={() => navigate(-1)} style={{
            background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
          }}>
            <X size={14} /> Cerrar
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="no-print" style={{ height: 56 }} />
      <div style={{
        maxWidth: 680, margin: '0 auto', padding: '32px 24px',
        fontFamily: 'Inter, sans-serif', background: 'white',
        minHeight: '100vh',
      }}>

        {/* Encabezado empresa */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#3DD6B5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 900,
              }}>LM</div>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#3DD6B5', letterSpacing: -0.5 }}>
                Burbuja
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#8E8E93' }}>Productos Químicos de Limpieza</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1C1C1E', letterSpacing: -1 }}>
              PEDIDO
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#3DD6B5' }}>
              P-{String(pedido.numero).padStart(5, '0')}
            </p>
          </div>
        </div>

        {/* Línea separadora */}
        <div style={{ height: 2, background: '#3DD6B5', marginBottom: 24 }} />

        {/* Info fecha + estado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93', marginBottom: 4 }}>Fecha</p>
            <p style={{ margin: 0, fontSize: 14 }}>{fecha}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93', marginBottom: 4 }}>Estado</p>
            <span style={{
              background: ESTADO_CONFIG[pedido.estado].bg,
              color:      ESTADO_CONFIG[pedido.estado].color,
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
            }}>
              {ESTADO_CONFIG[pedido.estado].label}
            </span>
          </div>
          {pedido.fecha_produccion && (
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93', marginBottom: 4 }}>Fecha producción</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                {new Date(pedido.fecha_produccion + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93', marginBottom: 4 }}>Tipo precio</p>
            <p style={{ margin: 0, fontSize: 14, textTransform: 'capitalize' }}>{pedido.tipo_precio}</p>
          </div>
        </div>

        {/* Datos del cliente */}
        <div style={{ background: '#F5F7F9', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93' }}>Cliente</p>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{pedido.clientes?.nombre ?? '—'}</p>
          {pedido.direccion_entrega && (
            <p style={{ margin: 0, fontSize: 13, color: '#8E8E93', display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} /> {pedido.direccion_entrega}
            </p>
          )}
        </div>

        {/* Tabla de productos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #3DD6B5' }}>
              <th style={{ padding: '8px 4px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#3DD6B5' }}>Producto</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#3DD6B5', width: 60 }}>Cant.</th>
              <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#3DD6B5', width: 100 }}>Precio</th>
              <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#3DD6B5', width: 100 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.pedido_items?.map((item, i) => {
              const subtotal = Number(item.cantidad) * Number(item.precio_unitario)
              return (
                <tr key={i} style={{ borderBottom: '1px solid #F5F7F9' }}>
                  <td style={{ padding: '10px 4px', fontSize: 13 }}>
                    {item.productos?.nombre}
                    {item.productos?.fragancia ? ` (${item.productos.fragancia})` : ''}
                    {item.productos?.presentacion ? ` — ${item.productos.presentacion}L` : ''}
                    {item.bidon_nuevo && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: '#FFF3E0', color: '#F57C00', padding: '1px 5px', borderRadius: 99 }}>
                        BIDÓN NUEVO
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: 13 }}>{item.cantidad}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: 13 }}>
                    ${Number(item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                    ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totales */}
        <div style={{ marginLeft: 'auto', maxWidth: 260 }}>
          {Number(pedido.costo_envio) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#8E8E93' }}>Subtotal productos</span>
              <span>${(total - Number(pedido.costo_envio)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {Number(pedido.costo_envio) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #E5E5EA' }}>
              <span style={{ color: '#8E8E93' }}>Envío</span>
              <span>${Number(pedido.costo_envio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 18, fontWeight: 900, color: '#3DD6B5' }}>
            <span>TOTAL</span>
            <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          {pedido.total_manual && (
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#F57C00', textAlign: 'right' }}>Total editado manualmente</p>
          )}
        </div>

        {/* Cobro */}
        {(pedido.forma_cobro || pedido.monto_cobrado) && (
          <div style={{ marginTop: 24, padding: '14px 16px', background: '#E8F8F0', borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#2E9E5C' }}>
              COBRO REGISTRADO
              {pedido.forma_cobro && ` — ${pedido.forma_cobro.toUpperCase()}`}
              {pedido.monto_cobrado && `: $${Number(pedido.monto_cobrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
            </p>
          </div>
        )}

        {/* Notas */}
        {pedido.notas_produccion && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#F5F7F9', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#8E8E93' }}>
              <strong>Notas:</strong> {pedido.notas_produccion}
            </p>
          </div>
        )}

        {/* Pie */}
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #E5E5EA', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#9A9A9A' }}>
            Burbuja Productos Químicos — Documento generado el {new Date().toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>
    </>
  )
}
