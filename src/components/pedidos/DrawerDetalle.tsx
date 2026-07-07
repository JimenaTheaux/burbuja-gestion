import { useState, useEffect, useRef } from 'react'
import { Clock, Edit2, XCircle, ChevronRight, Check } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BadgeEstado }   from '@/components/common/BadgeEstado'
import { BtnWhatsapp }  from '@/components/common/BtnWhatsapp'
import { Skeleton }     from '@/components/ui/skeleton'
import {
  usePedidoDetalle, useCambiarEstado, useAnularPedido, useEditarCobro, useCerrarPedido,
  totalPedido, type PedidoDetalle,
} from '@/services/pedidos'
import { ESTADO_CONFIG, ESTADOS_FACTURABLES, formatNumero, formatUnidad, type EstadoPedido } from '@/types'
import { useAuthStore }      from '@/store/authStore'
import { useCompartirFactura } from '@/hooks/useCompartirFactura'

// ─── Transiciones secuenciales ────────────────────────────────────────────────

const TRANSICIONES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  borrador:        ['confirmado'],
  confirmado:      ['en_produccion'],
  en_produccion:   ['listo_reparto'],
  listo_reparto:   ['cerrado'],
  en_reparto:      ['cerrado', 'entrega_fallida'],
  entrega_fallida: ['listo_reparto'],
}

// en_reparto ya no forma parte del flujo normal (listo_reparto → cerrado directo);
// queda solo como override manual del Admin para casos que sí necesiten ese paso intermedio.
const TRANSICIONES_ADMIN: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  borrador:        ['confirmado', 'en_produccion', 'listo_reparto', 'cerrado', 'en_reparto'],
  confirmado:      ['en_produccion', 'listo_reparto', 'cerrado', 'en_reparto'],
  en_produccion:   ['listo_reparto', 'cerrado', 'en_reparto'],
  listo_reparto:   ['cerrado', 'en_reparto'],
  en_reparto:      ['cerrado', 'entrega_fallida'],
  entrega_fallida: ['listo_reparto', 'cerrado', 'en_reparto'],
}

// Etiqueta de la acción primaria, indexada por el estado ACTUAL del pedido
const ACCION_LABEL: Partial<Record<EstadoPedido, string>> = {
  borrador:        'Confirmar pedido',
  confirmado:      'Enviar a producción',
  en_produccion:   'Marcar listo para reparto',
  listo_reparto:   'Registrar entrega',
  en_reparto:      'Registrar entrega',
  entrega_fallida: 'Reagendar entrega',
}

// ─── Modales ─────────────────────────────────────────────────────────────────

function ConfirmModal({ mensaje, onConfirm, onCancel }: {
  mensaje: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <p style={{ fontSize: 15, color: '#1C1C1E', margin: '0 0 20px', lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} style={{ flex: 1, background: '#3DD6B5', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Confirmar</button>
          <button onClick={onCancel}  style={{ flex: 1, background: 'transparent', color: '#8E8E93', border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalAnular({ onConfirm, onCancel }: { onConfirm: (motivo: string) => void; onCancel: () => void }) {
  const [motivo, setMotivo] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%' }}>
        <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Anular pedido</p>
        <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 16px' }}>Esta acción no se puede deshacer. Ingresá el motivo.</p>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo de anulación…" rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 14, resize: 'vertical', fontFamily: 'Inter Variable, sans-serif' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => motivo.trim() && onConfirm(motivo.trim())} disabled={!motivo.trim()}
            style={{ flex: 1, background: !motivo.trim() ? 'rgba(211,47,47,0.4)' : '#D32F2F', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: motivo.trim() ? 'pointer' : 'not-allowed', minHeight: 44 }}>
            Anular pedido
          </button>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', color: '#8E8E93', border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalMotivo({ titulo, onConfirm, onCancel }: {
  titulo: string; onConfirm: (motivo: string) => void; onCancel: () => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%' }}>
        <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>{titulo}</p>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo…" rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 14, resize: 'vertical', fontFamily: 'Inter Variable, sans-serif' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => motivo.trim() && onConfirm(motivo.trim())} disabled={!motivo.trim()}
            style={{ flex: 1, background: !motivo.trim() ? 'rgba(61,214,181,0.4)' : '#3DD6B5', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: motivo.trim() ? 'pointer' : 'not-allowed', minHeight: 44 }}>
            Confirmar
          </button>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', color: '#8E8E93', border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer detalle ───────────────────────────────────────────────────────────

interface Props {
  pedidoId: string | null
  open:     boolean
  onClose:  () => void
  onEditar: (pedido: PedidoDetalle) => void
  onSaved:  (msg: string) => void
}

const inputFechaStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 10px',
  border: '1px solid rgba(105,105,105,0.4)',
  borderRadius: 10, fontSize: 14, fontFamily: 'Inter Variable, sans-serif',
  outline: 'none', boxSizing: 'border-box',
}

const labelUpperStyle: React.CSSProperties = {
  fontSize: 11, color: '#8E8E93', fontWeight: 600,
  display: 'block', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

export function DrawerDetalle({ pedidoId, open, onClose, onEditar, onSaved }: Props) {
  const { data: pedido, isLoading } = usePedidoDetalle(pedidoId)
  const cambiarEstado = useCambiarEstado()
  const anular        = useAnularPedido()
  const editarCobro   = useEditarCobro()
  const cerrarPedido  = useCerrarPedido()

  const usuario = useAuthStore(s => s.usuario)
  const isAdmin = usuario?.rol === 'admin' || usuario?.rol === 'superadmin'

  const { compartir, loading: loadingWA } = useCompartirFactura()

  const [confirmando,      setConfirmando]      = useState<EstadoPedido | null>(null)
  const [anulando,         setAnulando]         = useState(false)
  const [fallaMotivo,      setFallaMotivo]      = useState(false)
  const [editandoCobro,    setEditandoCobro]    = useState(false)
  const [cobroForma,       setCobroForma]       = useState('')
  const [cobroMonto,       setCobroMonto]       = useState('')
  const [cobroFechaCobro,  setCobroFechaCobro]  = useState('')

  // Flujo "Cerrar venta" con form de cobro inline
  const [cerrando,         setCerrando]         = useState(false)
  const [cerrarForma,      setCerrarForma]      = useState<'efectivo' | 'transferencia' | 'pendiente'>('efectivo')
  const [cerrarMonto,      setCerrarMonto]      = useState('')
  const [cerrarFechaCobro, setCerrarFechaCobro] = useState(() => new Date().toISOString().split('T')[0])
  const [cerrarError,      setCerrarError]      = useState<string | null>(null)
  const cerrarBtnRef = useRef<HTMLButtonElement>(null)

  // Pre-llenar cobro al abrir el form de cierre
  useEffect(() => {
    if (cerrando && p) {
      setCerrarForma((p.forma_cobro ?? 'efectivo') as typeof cerrarForma)
      setCerrarMonto(
        p.monto_cobrado != null
          ? String(p.monto_cobrado)
          : String(Math.round(Number(totalPedido(p))))
      )
      setCerrarFechaCobro(new Date().toISOString().split('T')[0])
      setCerrarError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrando])

  useEffect(() => {
    if (cerrando) cerrarBtnRef.current?.focus()
  }, [cerrando])

  const handleEstado = async (nuevoEstado: EstadoPedido, notas?: string) => {
    if (!pedido) return
    try {
      await cambiarEstado.mutateAsync({ id: pedido.id, estadoActual: pedido.estado, estado: nuevoEstado, notas })
      onSaved(`Estado actualizado a: ${ESTADO_CONFIG[nuevoEstado].label}`)
      setConfirmando(null)
      setFallaMotivo(false)
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error') + '|error')
    }
  }

  const handleAnular = async (motivo: string) => {
    if (!pedido) return
    try {
      await anular.mutateAsync({ id: pedido.id, motivo, estadoActual: pedido.estado })
      onSaved('Pedido anulado')
      setAnulando(false)
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error') + '|error')
    }
  }

  const handleGuardarCobro = async () => {
    if (!pedido) return
    const estadoPago: 'cobrado' | 'pendiente' = cobroForma === 'pendiente' ? 'pendiente' : 'cobrado'
    try {
      await editarCobro.mutateAsync({
        id:            pedido.id,
        forma_cobro:   cobroForma,
        monto_cobrado: cobroMonto || undefined,
        fecha_cobro:   cobroFechaCobro || undefined,
        estado_pago:   estadoPago,
      })
      onSaved('Cobro actualizado')
      setEditandoCobro(false)
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error') + '|error')
    }
  }

  const handleCerrarVenta = async () => {
    if (!pedido) return
    if (cerrarForma !== 'pendiente' && !cerrarMonto.trim()) {
      setCerrarError('El monto cobrado es obligatorio')
      return
    }
    setCerrarError(null)
    const estadoPago: 'cobrado' | 'pendiente' = cerrarForma === 'pendiente' ? 'pendiente' : 'cobrado'
    try {
      await cerrarPedido.mutateAsync({
        id:            pedido.id,
        estadoActual:  pedido.estado,
        forma_cobro:   cerrarForma,
        monto_cobrado: cerrarMonto.trim() || undefined,
        estado_pago:   estadoPago,
        fecha_cobro:   cerrarForma !== 'pendiente' ? cerrarFechaCobro : undefined,
      })
      onSaved('Pedido cerrado correctamente')
      setCerrando(false)
    } catch (e) {
      setCerrarError(e instanceof Error ? e.message : 'No se pudo cerrar el pedido')
    }
  }

  const p = pedido
  const transiciones: EstadoPedido[] = p
    ? (isAdmin ? TRANSICIONES_ADMIN[p.estado] : TRANSICIONES[p.estado]) ?? []
    : []

  const showCobro = p?.estado === 'cerrado'
  // Admin puede editar en cualquier estado activo; cerrado solo mientras el cobro siga pendiente
  const puedeEditar = !!p && isAdmin && p.estado !== 'anulado' && (p.estado !== 'cerrado' || p.estado_pago === 'pendiente')

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
        <SheetContent
          side="right"
          style={{ width: '100%', maxWidth: 500, overflowY: 'auto', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          onPointerDownOutside={e => { if (confirmando || anulando || cerrando) e.preventDefault() }}
          onInteractOutside={e => { if (confirmando || anulando || cerrando) e.preventDefault() }}
        >
          <SheetHeader>
            <SheetTitle>{p ? `P-${String(p.numero).padStart(5, '0')}` : 'Detalle de pedido'}</SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 60, borderRadius: 12 }} />)}
            </div>
          ) : !p ? (
            <p style={{ color: '#8E8E93', marginTop: 20 }}>No se encontró el pedido.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>

              {/* Estado + cliente */}
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <BadgeEstado estado={p.estado} />
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>
                    {new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>{p.clientes?.nombre ?? '—'}</p>
                {p.direccion_entrega && <p style={{ margin: 0, fontSize: 13, color: '#8E8E93' }}>{p.direccion_entrega}</p>}
                {p.fecha_produccion && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8E8E93' }}>
                    Producción: {new Date(p.fecha_produccion + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                )}
              </div>

              {/* Ítems */}
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93' }}>Productos</p>
                {p.pedido_items?.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F5F7F9' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                        {[item.productos?.nombre, item.productos?.fragancia].filter(Boolean).join(' ')}
                        {item.productos?.presentacion != null && item.productos?.unidad_medida && (
                          <span style={{ color: '#8E8E93', fontWeight: 400 }}>
                            {' · '}{formatUnidad(item.productos.presentacion, item.productos.unidad_medida)}
                          </span>
                        )}
                        {item.bidon_nuevo && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: '#FFF3E0', color: '#F57C00', padding: '2px 6px', borderRadius: 99 }}>BIDÓN NUEVO</span>
                        )}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#8E8E93' }}>
                        {item.cantidad} × ${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#3DD6B5' }}>
                      ${(item.cantidad * item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#3DD6B5', letterSpacing: -0.5 }}>
                    ${totalPedido(p).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {p.total_manual && (
                  <p style={{ fontSize: 11, color: '#F57C00', margin: '2px 0 0', textAlign: 'right' }}>Total editado manualmente</p>
                )}
              </div>

              {/* Notas */}
              {(p.notas_produccion || p.notas_internas) && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  {p.notas_produccion && (
                    <p style={{ margin: '0 0 6px', fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>Producción: </span>{p.notas_produccion}
                    </p>
                  )}
                  {p.notas_internas && (
                    <p style={{ margin: 0, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>Internas: </span>{p.notas_internas}
                    </p>
                  )}
                </div>
              )}

              {/* Cobro */}
              {showCobro && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93' }}>Cobro</p>
                    {!editandoCobro && (
                      <button type="button"
                        onClick={() => {
                          setCobroForma(p.forma_cobro ?? 'pendiente')
                          setCobroMonto(p.monto_cobrado != null ? String(p.monto_cobrado) : '')
                          setCobroFechaCobro(p.fecha_cobro ?? new Date().toISOString().split('T')[0])
                          setEditandoCobro(true)
                        }}
                        style={{ fontSize: 12, color: '#3DD6B5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        Editar
                      </button>
                    )}
                  </div>

                  {!editandoCobro ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#8E8E93' }}>Forma de cobro</span>
                        <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{p.forma_cobro ?? '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#8E8E93' }}>Monto cobrado</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {p.monto_cobrado != null
                            ? `$${p.monto_cobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#8E8E93' }}>Fecha de cobro</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {p.fecha_cobro
                            ? new Date(p.fecha_cobro + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={labelUpperStyle}>Forma de cobro</label>
                        <select value={cobroForma} onChange={e => setCobroForma(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 14, fontFamily: 'Inter Variable, sans-serif', outline: 'none' }}>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="pendiente">Pendiente</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelUpperStyle}>Monto cobrado</label>
                        <input type="number" value={cobroMonto} onChange={e => setCobroMonto(e.target.value)} placeholder="0.00"
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 14, fontFamily: 'Inter Variable, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      {cobroForma !== 'pendiente' && (
                        <div>
                          <label style={labelUpperStyle}>Fecha de cobro</label>
                          <input
                            type="date"
                            value={cobroFechaCobro}
                            onChange={e => setCobroFechaCobro(e.target.value)}
                            style={inputFechaStyle}
                            onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
                            onBlur={e  => (e.target.style.borderColor = 'rgba(105,105,105,0.4)')}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={handleGuardarCobro} disabled={editarCobro.isPending}
                          style={{ flex: 1, background: '#3DD6B5', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 40, opacity: editarCobro.isPending ? 0.6 : 1 }}>
                          {editarCobro.isPending ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" onClick={() => setEditandoCobro(false)}
                          style={{ flex: 1, background: 'transparent', color: '#8E8E93', border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 40 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historial */}
              {!!p.pedido_historial?.length && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} /> Historial
                  </p>
                  {p.pedido_historial.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {h.estado_anterior && <BadgeEstado estado={h.estado_anterior} />}
                      {h.estado_anterior && h.estado_anterior !== h.estado_nuevo && <ChevronRight size={12} color="#9A9A9A" />}
                      <BadgeEstado estado={h.estado_nuevo} />
                      {h.notas && h.estado_anterior === h.estado_nuevo && (
                        <span style={{ fontSize: 11, color: '#F57C00' }}>{h.notas}</span>
                      )}
                      <span style={{ fontSize: 11, color: '#8E8E93', marginLeft: 'auto' }}>
                        {h.perfiles?.nombre ?? '—'} · {new Date(h.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ESTADOS_FACTURABLES.includes(p.estado) && (
                  <BtnWhatsapp
                    variante="pill"
                    loading={loadingWA}
                    numeroLabel={formatNumero(p.numero)}
                    onClick={() => compartir(p, msg => onSaved(msg + '|error'))}
                  />
                )}

                {/* ── Form cerrar venta ── */}
                {cerrando ? (
                  <div style={{
                    background: '#F5F7F9', borderRadius: 14, padding: 16,
                    display: 'flex', flexDirection: 'column', gap: 12,
                    border: '1.5px solid #145A32',
                  }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#145A32' }}>
                      Confirmar cobro y cerrar venta
                    </p>

                    {/* Total de referencia */}
                    <div style={{
                      background: '#D4EDDA', borderRadius: 10, padding: '10px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 12, color: '#145A32', fontWeight: 600 }}>Total pedido</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: '#145A32', letterSpacing: -0.5 }}>
                        ${Number(totalPedido(p)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Forma de cobro */}
                    <div>
                      <label style={labelUpperStyle}>Forma de cobro</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['efectivo', 'transferencia', 'pendiente'] as const).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setCerrarForma(f)}
                            style={{
                              flex: 1, padding: '9px 6px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                              border: `1.5px solid ${cerrarForma === f ? '#145A32' : '#E5E5EA'}`,
                              background: cerrarForma === f ? '#D4EDDA' : '#fff',
                              color: cerrarForma === f ? '#145A32' : '#8E8E93',
                              cursor: 'pointer',
                            }}
                          >
                            {f === 'efectivo' ? 'Efectivo' : f === 'transferencia' ? 'Transf.' : 'Pendiente'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fecha de cobro */}
                    {cerrarForma !== 'pendiente' && (
                      <div>
                        <label style={labelUpperStyle}>Fecha de cobro</label>
                        <input
                          type="date"
                          value={cerrarFechaCobro}
                          onChange={e => setCerrarFechaCobro(e.target.value)}
                          style={inputFechaStyle}
                          onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
                          onBlur={e  => (e.target.style.borderColor = 'rgba(105,105,105,0.4)')}
                        />
                      </div>
                    )}

                    {/* Monto cobrado */}
                    <div>
                      <label style={labelUpperStyle}>
                        Monto cobrado {cerrarForma !== 'pendiente' ? '*' : '(opcional)'}
                      </label>
                      <input
                        type="number"
                        value={cerrarMonto}
                        onChange={e => setCerrarMonto(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                        style={{
                          width: '100%', padding: '10px 12px',
                          border: `1.5px solid ${cerrarError ? '#D32F2F' : '#E5E5EA'}`,
                          borderRadius: 10, fontSize: 14, fontFamily: 'Inter Variable, sans-serif',
                          outline: 0, boxSizing: 'border-box',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#145A32')}
                        onBlur={e  => (e.target.style.borderColor = cerrarError ? '#D32F2F' : '#E5E5EA')}
                      />
                    </div>

                    {cerrarError && (
                      <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">
                        {cerrarError}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        ref={cerrarBtnRef}
                        type="button"
                        onClick={handleCerrarVenta}
                        disabled={cerrarPedido.isPending}
                        aria-disabled={cerrarPedido.isPending}
                        aria-label={`Confirmar cierre de pedido P-${String(p.numero).padStart(5, '0')}`}
                        style={{
                          flex: 1,
                          background: cerrarPedido.isPending ? 'rgba(20,90,50,0.5)' : '#145A32',
                          color: '#fff', border: 'none', borderRadius: 10,
                          padding: '13px', minHeight: 48, fontSize: 15, fontWeight: 700,
                          cursor: cerrarPedido.isPending ? 'not-allowed' : 'pointer',
                          outlineOffset: 2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {cerrarPedido.isPending ? 'Cerrando…' : <><Check size={15} /> Confirmar cierre</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCerrando(false); setCerrarError(null) }}
                        disabled={cerrarPedido.isPending}
                        style={{
                          flex: 1, background: 'transparent', color: '#8E8E93',
                          border: '1.5px solid #E5E5EA', borderRadius: 10,
                          padding: '12px', fontSize: 14, cursor: 'pointer', minHeight: 48,
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Botón primario */}
                    {transiciones.length > 0 && (() => {
                      const primary   = transiciones[0]
                      const cfg       = ESTADO_CONFIG[primary]
                      const label     = ACCION_LABEL[p.estado] ?? `Pasar a ${cfg.label}`
                      const isPending = cambiarEstado.isPending

                      return (
                        <button
                          key={primary}
                          type="button"
                          onClick={() => primary === 'cerrado' ? setCerrando(true) : setConfirmando(primary)}
                          disabled={isPending}
                          aria-disabled={isPending}
                          aria-label={`${label} — pedido P-${String(p.numero).padStart(5, '0')}`}
                          style={{
                            background: isPending ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
                            color: '#fff', border: 'none', borderRadius: 10,
                            padding: '14px', minHeight: 48, fontSize: 15, fontWeight: 700,
                            cursor: isPending ? 'not-allowed' : 'pointer', outlineOffset: 2,
                          }}
                        >
                          {isPending ? 'Procesando…' : label}
                        </button>
                      )
                    })()}

                    {/* Transiciones secundarias (override admin) */}
                    {transiciones.slice(1).map((next: EstadoPedido) => {
                      const isFalla = next === 'entrega_fallida'
                      return (
                        <button
                          key={next}
                          type="button"
                          onClick={() => {
                            if (next === 'cerrado') setCerrando(true)
                            else if (isFalla) setFallaMotivo(true)
                            else setConfirmando(next)
                          }}
                          disabled={cambiarEstado.isPending}
                          aria-label={`${isFalla ? 'Marcar entrega fallida' : `Pasar a ${ESTADO_CONFIG[next].label}`} — pedido P-${String(p.numero).padStart(5, '0')}`}
                          style={{
                            background: isFalla ? '#FDECEA' : ESTADO_CONFIG[next].bg,
                            color:      isFalla ? '#D32F2F' : ESTADO_CONFIG[next].color,
                            border: `1.5px solid ${isFalla ? '#D32F2F' : ESTADO_CONFIG[next].color}`,
                            borderRadius: 10, padding: '11px', minHeight: 44, fontSize: 13,
                            fontWeight: 600, cursor: 'pointer', outlineOffset: 2,
                          }}
                        >
                          {isFalla ? 'Entrega fallida' : `Pasar a: ${ESTADO_CONFIG[next].label}`}
                        </button>
                      )
                    })}
                  </>
                )}

                {puedeEditar && (
                  <button type="button" onClick={() => pedido && onEditar(pedido)}
                    aria-label={`Editar pedido P-${String(p.numero).padStart(5, '0')}`}
                    style={{ background: 'transparent', color: '#3DD6B5', border: '1.5px solid #3DD6B5', borderRadius: 10, padding: '12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, outlineOffset: 2 }}>
                    <Edit2 size={14} /> Editar pedido
                  </button>
                )}

                {p.estado !== 'cerrado' && p.estado !== 'anulado' && (
                  <button type="button" onClick={() => setAnulando(true)}
                    aria-label={`${p.estado === 'borrador' ? 'Eliminar borrador' : 'Anular pedido'} P-${String(p.numero).padStart(5, '0')}`}
                    style={{ background: '#FDECEA', color: '#D32F2F', border: '1.5px solid #D32F2F', borderRadius: 10, padding: '12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, outlineOffset: 2 }}>
                    <XCircle size={14} /> {p.estado === 'borrador' ? 'Eliminar borrador' : 'Anular pedido'}
                  </button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {confirmando && (
        <ConfirmModal
          mensaje={`¿Confirmás que querés pasar el pedido a "${ESTADO_CONFIG[confirmando].label}"?`}
          onConfirm={() => handleEstado(confirmando)}
          onCancel={() => setConfirmando(null)}
        />
      )}
      {anulando && (
        <ModalAnular onConfirm={handleAnular} onCancel={() => setAnulando(false)} />
      )}
      {fallaMotivo && (
        <ModalMotivo
          titulo="Marcar entrega fallida — ingresá el motivo"
          onConfirm={motivo => handleEstado('entrega_fallida', motivo)}
          onCancel={() => setFallaMotivo(false)}
        />
      )}
    </>
  )
}
