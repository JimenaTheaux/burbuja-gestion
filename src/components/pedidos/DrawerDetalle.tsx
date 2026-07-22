import { useState } from 'react'
import { Clock, Edit2, XCircle, ChevronRight, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BadgeEstado }   from '@/components/common/BadgeEstado'
import { BtnWhatsapp }  from '@/components/common/BtnWhatsapp'
import { Skeleton }     from '@/components/ui/skeleton'
import { FormPagos }    from '@/components/pedidos/FormPagos'
import {
  usePedidoDetalle, useCambiarEstado, useAnularPedido, useCerrarPedido, useEliminarPedido,
  totalPedido, type PedidoDetalle,
} from '@/services/pedidos'
import { usePagosPedido, useRegistrarPago } from '@/services/pedidoPagos'
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

function ModalEliminar({ numero, onConfirm, onCancel, loading }: {
  numero: number; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: '#1C1C1E' }}>
          ¿Eliminar el pedido P-{String(numero).padStart(5, '0')}?
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8E8E93' }}>
          Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', color: '#8E8E93', border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading}
            style={{ flex: 1, background: loading ? 'rgba(211,47,47,0.4)' : '#D32F2F', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', minHeight: 44 }}>
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
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

export function DrawerDetalle({ pedidoId, open, onClose, onEditar, onSaved }: Props) {
  const { data: pedido, isLoading } = usePedidoDetalle(pedidoId)
  const { data: pagos = [] }        = usePagosPedido(pedidoId)
  const cambiarEstado = useCambiarEstado()
  const anular        = useAnularPedido()
  const registrarPago = useRegistrarPago()
  const cerrarPedido  = useCerrarPedido()
  const eliminarPedido = useEliminarPedido()

  const usuario = useAuthStore(s => s.usuario)
  const isAdmin = usuario?.rol === 'admin' || usuario?.rol === 'superadmin'

  const { compartir, loading: loadingWA } = useCompartirFactura()

  const [confirmando,      setConfirmando]      = useState<EstadoPedido | null>(null)
  const [anulando,         setAnulando]         = useState(false)
  const [fallaMotivo,      setFallaMotivo]      = useState(false)
  const [agregandoPago,    setAgregandoPago]    = useState(false)
  const [eliminando,       setEliminando]       = useState(false)

  // Flujo "Cerrar venta" con FormPagos inline
  const [cerrando, setCerrando] = useState(false)

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

  const handleEliminar = async () => {
    if (!pedido) return
    try {
      await eliminarPedido.mutateAsync({ id: pedido.id })
      onSaved('Pedido eliminado')
      setEliminando(false)
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al eliminar') + '|error')
    }
  }

  const handleCerrarVenta = async (pagosForm: { forma_pago: string; monto: number }[]) => {
    if (!pedido) return
    try {
      await cerrarPedido.mutateAsync({ id: pedido.id, pagos: pagosForm })
      onSaved('Pedido cerrado correctamente')
      setCerrando(false)
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'No se pudo cerrar el pedido') + '|error')
    }
  }

  const handleAgregarPago = async (pagosForm: { forma_pago: string; monto: number }[]) => {
    if (!pedido) return
    try {
      for (const pago of pagosForm) {
        await registrarPago.mutateAsync({
          pedido_id:  pedido.id,
          forma_pago: pago.forma_pago as 'efectivo' | 'transferencia',
          monto:      pago.monto,
        })
      }
      onSaved('Pago registrado')
      setAgregandoPago(false)
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'No se pudo registrar el pago') + '|error')
    }
  }

  const p = pedido
  const transiciones: EstadoPedido[] = p
    ? (isAdmin ? TRANSICIONES_ADMIN[p.estado] : TRANSICIONES[p.estado]) ?? []
    : []

  const showCobro   = p?.estado === 'cerrado'
  const totalPagado = pagos.reduce((s, pg) => s + pg.monto, 0)
  const restante     = p ? Math.max(0, Number(totalPedido(p)) - totalPagado) : 0
  // Admin puede editar en cualquier estado activo; cerrado solo mientras el cobro siga pendiente
  const puedeEditar = !!p && isAdmin && p.estado !== 'anulado' && (p.estado !== 'cerrado' || p.estado_pago === 'pendiente')

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
        <SheetContent
          side="right"
          style={{ width: '100%', maxWidth: 500, overflowY: 'auto', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          onPointerDownOutside={e => { if (confirmando || anulando || cerrando || eliminando) e.preventDefault() }}
          onInteractOutside={e => { if (confirmando || anulando || cerrando || eliminando) e.preventDefault() }}
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

              {/* Pagos */}
              {showCobro && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93' }}>
                    Pagos registrados
                  </p>

                  {pagos.length === 0 ? (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#8E8E93' }}>Sin pagos registrados</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {pagos.map(pago => (
                        <div key={pago.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#1C1C1E', textTransform: 'capitalize' }}>{pago.forma_pago}</span>
                          <span style={{ fontSize: 13, color: '#8E8E93' }}>
                            {new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      <div style={{ height: 1, background: '#E5E5EA', margin: '4px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Total cobrado</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#28B99A' }}>
                          ${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}

                  {p.estado_pago === 'pendiente' && (
                    agregandoPago ? (
                      <FormPagos
                        totalPedido={restante}
                        loading={registrarPago.isPending}
                        onConfirmar={handleAgregarPago}
                        onCancelar={() => setAgregandoPago(false)}
                      />
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#C47B00' }}>
                          Resta: ${restante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <button type="button" onClick={() => setAgregandoPago(true)}
                          style={{ fontSize: 12, color: '#3DD6B5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          Agregar pago
                        </button>
                      </div>
                    )
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
                    <FormPagos
                      totalPedido={Number(totalPedido(p))}
                      loading={cerrarPedido.isPending}
                      onConfirmar={handleCerrarVenta}
                      onCancelar={() => setCerrando(false)}
                    />
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

                {isAdmin && (
                  <button type="button" onClick={() => setEliminando(true)}
                    aria-label={`Eliminar pedido P-${String(p.numero).padStart(5, '0')}`}
                    style={{ background: 'transparent', color: '#D32F2F', border: 'none', borderRadius: 10, padding: '10px', minHeight: 40, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, outlineOffset: 2 }}>
                    <Trash2 size={14} /> Eliminar pedido
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
      {eliminando && p && (
        <ModalEliminar
          numero={p.numero}
          onConfirm={handleEliminar}
          onCancel={() => setEliminando(false)}
          loading={eliminarPedido.isPending}
        />
      )}
    </>
  )
}
