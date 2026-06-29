import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Package, RefreshCw } from 'lucide-react'
import { Skeleton }        from '@/components/ui/skeleton'
import { ToastContainer }  from '@/components/common/ToastContainer'
import { SelectorFecha }   from '@/components/common/SelectorFecha'
import { useToast }        from '@/hooks/useToast'
import { usePedidosProduccion, useResumenProduccion, type PedidoProduccion } from '@/services/produccion'
import { useCambiarEstado } from '@/services/pedidos'

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const _d  = new Date()
const HOY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

const DIAS_CORTO  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

function labelFecha(fecha: string | null): string {
  if (!fecha) return 'Sin fecha'
  const d    = new Date(fecha + 'T00:00:00')
  if (fecha === HOY) return 'Hoy'
  const diff = Math.round((d.getTime() - new Date(HOY + 'T00:00:00').getTime()) / 86400000)
  if (diff === 1)  return 'Mañana'
  if (diff === -1) return 'Ayer'
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function labelFechaCorta(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}

function labelFechaLarga(fecha: string): string {
  const d   = new Date(fecha + 'T00:00:00')
  const dow = DIAS_CORTO[d.getDay()].toLowerCase()
  return `${dow} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
}

// ─── Panel resumen colapsable ─────────────────────────────────────────────────

function PanelResumen({ fecha }: { fecha: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useResumenProduccion(fecha)
  const esHoy  = fecha === HOY
  const titulo = esHoy ? 'Resumen de hoy' : `Resumen · ${labelFechaCorta(fecha)}`

  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '14px 20px', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: '#3DD6B5', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Package size={16} /> {titulo}
          {data?.length ? (
            <span style={{ background: '#EBF5FF', color: '#7EB8E8', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
              {data.length} artículos
            </span>
          ) : null}
        </span>
        {open ? <ChevronUp size={16} color="#8E8E93" /> : <ChevronDown size={16} color="#8E8E93" />}
      </button>

      {open && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid #F5F7F9' }}>
          {isLoading ? (
            <Skeleton style={{ height: 60, borderRadius: 10, marginTop: 12 }} />
          ) : !data?.length ? (
            <p style={{ color: '#8E8E93', fontSize: 13, marginTop: 12 }}>Sin pedidos en producción.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E5EA' }}>
                  <th style={{ textAlign: 'left',  padding: '6px 4px', color: '#8E8E93', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Producto</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', color: '#8E8E93', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', color: '#F57C00', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Bidón nuevo</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F5F7F9' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 500 }}>
                      {r.nombre_producto}
                      {r.presentacion && <span style={{ color: '#8E8E93', fontWeight: 400 }}> — {r.presentacion}{r.unidad_medida === 'litros' ? 'L' : ''}</span>}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: '#3DD6B5' }}>
                      {r.total_cantidad}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: r.total_bidon_nuevo > 0 ? '#F57C00' : '#9A9A9A' }}>
                      {r.total_bidon_nuevo > 0 ? r.total_bidon_nuevo : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card de pedido para producción ──────────────────────────────────────────

function CardProduccion({ pedido, onMarcarListo }: {
  pedido:        PedidoProduccion
  onMarcarListo: () => Promise<void>
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [saliendo,    setSaliendo]    = useState(false)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmando) confirmBtnRef.current?.focus()
  }, [confirmando])

  const handleConfirmar = async () => {
    setLoading(true)
    setError(null)
    try {
      await onMarcarListo()
      setSaliendo(true)
      setConfirmando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar como listo')
      setTimeout(() => setError(null), 3000)
      setConfirmando(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      opacity:    saliendo ? 0 : 1,
      maxHeight:  saliendo ? 0 : 800,
      overflow:   'hidden',
      transition: 'opacity 0.3s ease, max-height 0.3s ease',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '14px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        borderLeft: '4px solid #F57C00',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1C1C1E' }}>
              P-{String(pedido.numero).padStart(5, '0')}
            </span>
            <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 14, color: '#1C1C1E' }}>
              {pedido.clientes?.nombre}
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#8E8E93' }}>
            {new Date(pedido.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Ítems */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {pedido.pedido_items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8, background: '#F5F7F9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, color: '#3DD6B5', flexShrink: 0,
              }}>
                {item.cantidad}
              </span>
              <span style={{ fontWeight: 500 }}>
                {item.nombre}{item.fragancia ? ` (${item.fragancia})` : ''}
                <span style={{ color: '#8E8E93', fontWeight: 400 }}> · {item.presentacion}L</span>
              </span>
              {item.bidon_nuevo && (
                <span style={{ fontSize: 9, fontWeight: 700, background: '#FFF3E0', color: '#F57C00', padding: '2px 6px', borderRadius: 99 }}>
                  BIDÓN NUEVO
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Notas producción */}
        {pedido.notas_produccion && (
          <p style={{ fontSize: 12, color: '#8E8E93', background: '#F5F7F9', borderRadius: 8, padding: '6px 10px', margin: '0 0 12px' }}>
            {pedido.notas_produccion}
          </p>
        )}

        {/* Botón / confirmación inline */}
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            disabled={loading}
            aria-label={`Marcar pedido P-${String(pedido.numero).padStart(5, '0')} como listo para reparto`}
            aria-disabled={loading}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 btn-press"
            style={{
              width: '100%', background: loading ? 'rgba(249,168,37,0.5)' : '#F9A825',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '13px', minHeight: 48, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              outlineOffset: 2,
            }}
          >
            {loading ? 'Procesando…' : 'Marcar listo para reparto'}
          </button>
        ) : (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#1C1C1E', fontWeight: 600 }}>
              ¿Confirmás que está listo?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                ref={confirmBtnRef}
                onClick={handleConfirmar}
                disabled={loading}
                aria-disabled={loading}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  flex: 1, background: loading ? 'rgba(249,168,37,0.5)' : '#F9A825',
                  color: '#fff', border: 'none',
                  borderRadius: 10, padding: '13px', minHeight: 48, fontSize: 15,
                  fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  outlineOffset: 2,
                }}
              >
                {loading ? 'Guardando…' : 'Sí, marcar listo'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                disabled={loading}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  flex: 1, background: 'transparent', color: '#8E8E93',
                  border: '1.5px solid #E5E5EA', borderRadius: 10,
                  padding: '13px', minHeight: 48, fontSize: 15, cursor: 'pointer',
                  outlineOffset: 2,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Error inline */}
        {error && (
          <p style={{ color: '#D32F2F', fontSize: 12, marginTop: 8, margin: '8px 0 0' }} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Kanban Desktop ───────────────────────────────────────────────────────────

function KanbanDesktop({ grupos, onMarcarListo }: {
  grupos:        Map<string, PedidoProduccion[]>
  onMarcarListo: (id: string) => Promise<void>
}) {
  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, minHeight: 400 }}>
      {Array.from(grupos.entries()).map(([fecha, pedidosFecha]) => {
        const esHoy = fecha === HOY
        return (
          <div key={fecha} style={{
            minWidth: 300, maxWidth: 340, flexShrink: 0,
            background: esHoy ? '#EBF5FF' : '#F5F7F9',
            borderRadius: 16, padding: 16,
            border: esHoy ? '2px solid #7EB8E8' : '2px solid transparent',
          }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: esHoy ? '#7EB8E8' : '#1C1C1E' }}>
                {labelFecha(fecha)}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8E8E93' }}>
                {pedidosFecha.length} pedido{pedidosFecha.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pedidosFecha.map(p => (
                <CardProduccion key={p.id} pedido={p} onMarcarListo={() => onMarcarListo(p.id)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Lista Mobile agrupada ────────────────────────────────────────────────────

function ListaMobile({ grupos, onMarcarListo }: {
  grupos:        Map<string, PedidoProduccion[]>
  onMarcarListo: (id: string) => Promise<void>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Array.from(grupos.entries()).map(([fecha, pedidosFecha]) => {
        const esHoy    = fecha === HOY
        const d        = fecha ? new Date(fecha + 'T00:00:00') : null
        const subtitulo = d ? d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'short' }) : ''

        return (
          <div key={fecha}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: esHoy ? '#7EB8E8' : '#E5E5EA' }} />
              <div style={{
                background: esHoy ? '#7EB8E8' : '#F5F7F9',
                color:      esHoy ? '#fff' : '#8E8E93',
                borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}>
                {labelFecha(fecha)} — {subtitulo} · {pedidosFecha.length} pedido{pedidosFecha.length !== 1 ? 's' : ''}
              </div>
              <div style={{ flex: 1, height: 1, background: esHoy ? '#7EB8E8' : '#E5E5EA' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pedidosFecha.map(p => (
                <CardProduccion key={p.id} pedido={p} onMarcarListo={() => onMarcarListo(p.id)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Vista principal — reusada por /produccion (rol producción) y /admin/produccion ─

export function ProduccionView() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(HOY)
  const { toasts, show, dismiss }                 = useToast()
  const cambiarEstado                             = useCambiarEstado()
  const esHoy                                     = fechaSeleccionada === HOY

  const { data: pedidosProd, isLoading, refetch, isFetching } = usePedidosProduccion(fechaSeleccionada)

  const grupos = useMemo(() => {
    const map = new Map<string, PedidoProduccion[]>()
    pedidosProd?.forEach(p => {
      const key = p.fecha_produccion ?? 'sin-fecha'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    })
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
  }, [pedidosProd])

  const handleMarcarListo = async (id: string) => {
    await cambiarEstado.mutateAsync({ id, estadoActual: 'en_produccion', estado: 'listo_reparto' })
    show('Pedido marcado como listo para reparto', 'success')
  }

  const totalPedidos = pedidosProd?.length ?? 0

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title">Producción</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SelectorFecha fecha={fechaSeleccionada} onChange={setFechaSeleccionada} />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              background: 'none', border: 'none', cursor: isFetching ? 'default' : 'pointer',
              color: isFetching ? '#9A9A9A' : '#8E8E93',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
            }}
          >
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} />
            {isFetching ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Banner: fecha distinta de hoy */}
      {!esHoy && (
        <div style={{
          background: '#FFF3E0', borderBottom: '0.5px solid #F57C00',
          padding: '6px 16px', fontSize: 11, color: '#E65100',
          marginBottom: 16, marginLeft: -16, marginRight: -16,
        }}>
          Viendo pedidos del {labelFechaLarga(fechaSeleccionada)}
        </div>
      )}

      {/* Resumen colapsable */}
      <PanelResumen fecha={fechaSeleccionada} />

      {/* Contenido */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => <Skeleton key={i} style={{ height: 180, borderRadius: 20 }} />)}
        </div>
      ) : !totalPedidos ? (
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Package size={48} strokeWidth={1.2} color="#E5E5EA" style={{ marginBottom: 12 }} />
          <p style={{ fontWeight: 600, fontSize: 15, color: '#1C1C1E', margin: '0 0 4px' }}>
            No hay pedidos en producción para el {labelFechaLarga(fechaSeleccionada)}
          </p>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 12px' }}>
            Los pedidos confirmados aparecen aquí automáticamente.
          </p>
          {!esHoy && (
            <button
              onClick={() => setFechaSeleccionada(HOY)}
              style={{
                background: 'none', border: 'none', color: '#3DD6B5',
                fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0,
              }}
            >
              Ver hoy →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <KanbanDesktop grupos={grupos} onMarcarListo={handleMarcarListo} />
          </div>
          <div className="block md:hidden">
            <ListaMobile grupos={grupos} onMarcarListo={handleMarcarListo} />
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
