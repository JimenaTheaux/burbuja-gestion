import { useState } from 'react'
import { Clock, Edit2, XCircle, ChevronRight, Printer } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BadgeEstado } from '@/components/common/BadgeEstado'
import { Skeleton }    from '@/components/ui/skeleton'
import {
  usePedidoDetalle, useCambiarEstado, useAnularPedido, useEditarCobro,
  totalPedido, type PedidoDetalle,
} from '@/services/pedidos'
import { ESTADO_CONFIG, type EstadoPedido } from '@/types'
import { useAuthStore } from '@/store/authStore'

// ─── Transiciones secuenciales (roles no-admin) ───────────────────────────────

const TRANSICIONES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  borrador:        ['confirmado'],
  confirmado:      ['en_produccion'],
  en_produccion:   ['listo_reparto'],
  listo_reparto:   ['en_reparto'],
  en_reparto:      ['entregado', 'entrega_fallida'],
  entregado:       ['cerrado'],
  entrega_fallida: ['listo_reparto'],
}

const TRANSICIONES_ADMIN: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  borrador:        ['confirmado', 'en_produccion', 'listo_reparto', 'en_reparto', 'entregado', 'cerrado'],
  confirmado:      ['en_produccion', 'listo_reparto', 'en_reparto', 'entregado', 'cerrado'],
  en_produccion:   ['listo_reparto', 'en_reparto', 'entregado', 'cerrado'],
  listo_reparto:   ['en_reparto', 'entregado', 'cerrado'],
  en_reparto:      ['entregado', 'entrega_fallida', 'cerrado'],
  entregado:       ['cerrado'],
  entrega_fallida: ['listo_reparto', 'en_reparto', 'entregado', 'cerrado'],
}

// ─── Modales ─────────────────────────────────────────────────────────────────

function ConfirmModal({ mensaje, onConfirm, onCancel }: {
  mensaje: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <p style={{ fontSize: 15, color: '#1A2B3C', margin: '0 0 20px', lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} style={{ flex: 1, background: '#0D5C8A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Confirmar</button>
          <button onClick={onCancel}  style={{ flex: 1, background: 'transparent', color: '#4A5568', border: '1.5px solid #D1D5DB', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
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
        <p style={{ fontSize: 13, color: '#4A5568', margin: '0 0 16px' }}>Esta acción no se puede deshacer. Ingresá el motivo.</p>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo de anulación…" rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, resize: 'vertical', fontFamily: 'Inter, sans-serif' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => motivo.trim() && onConfirm(motivo.trim())} disabled={!motivo.trim()}
            style={{ flex: 1, background: !motivo.trim() ? 'rgba(211,47,47,0.4)' : '#D32F2F', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: motivo.trim() ? 'pointer' : 'not-allowed', minHeight: 44 }}>
            Anular pedido
          </button>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', color: '#4A5568', border: '1.5px solid #D1D5DB', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
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
  const cambiarEstado = useCambiarEstado()
  const anular        = useAnularPedido()
  const editarCobro   = useEditarCobro()

  const usuario = useAuthStore(s => s.usuario)
  const isAdmin = usuario?.rol === 'admin' || usuario?.rol === 'superadmin'

  const [confirmando,   setConfirmando]   = useState<EstadoPedido | null>(null)
  const [anulando,      setAnulando]      = useState(false)
  const [editandoCobro, setEditandoCobro] = useState(false)
  const [cobroForma,    setCobroForma]    = useState('')
  const [cobroMonto,    setCobroMonto]    = useState('')

  const handleEstado = async (nuevoEstado: EstadoPedido) => {
    if (!pedido) return
    try {
      await cambiarEstado.mutateAsync({ id: pedido.id, estadoActual: pedido.estado, estado: nuevoEstado })
      onSaved(`Estado actualizado a: ${ESTADO_CONFIG[nuevoEstado].label}`)
      setConfirmando(null)
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
    try {
      await editarCobro.mutateAsync({ id: pedido.id, forma_cobro: cobroForma, monto_cobrado: cobroMonto || undefined })
      onSaved('Cobro actualizado')
      setEditandoCobro(false)
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error') + '|error')
    }
  }

  const p = pedido
  const transiciones: EstadoPedido[] = p
    ? (isAdmin ? TRANSICIONES_ADMIN[p.estado] : TRANSICIONES[p.estado]) ?? []
    : []

  const showCobro = p?.estado === 'entregado' || p?.estado === 'cerrado'

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
        <SheetContent
          side="right"
          style={{ width: '100%', maxWidth: 500, overflowY: 'auto' }}
          onPointerDownOutside={e => { if (confirmando || anulando) e.preventDefault() }}
          onInteractOutside={e => { if (confirmando || anulando) e.preventDefault() }}
        >
          <SheetHeader>
            <SheetTitle>{p ? `P-${String(p.numero).padStart(5, '0')}` : 'Detalle de pedido'}</SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              {[1,2,3,4].map(i => <Skeleton key={i} style={{ height: 60, borderRadius: 12 }} />)}
            </div>
          ) : !p ? (
            <p style={{ color: '#4A5568', marginTop: 20 }}>No se encontró el pedido.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>

              {/* Estado + cliente */}
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <BadgeEstado estado={p.estado} />
                  <span style={{ fontSize: 12, color: '#4A5568' }}>
                    {new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>{p.clientes?.nombre ?? '—'}</p>
                {p.direccion_entrega && <p style={{ margin: 0, fontSize: 13, color: '#4A5568' }}>{p.direccion_entrega}</p>}
                {p.fecha_produccion && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#4A5568' }}>
                    Producción: {new Date(p.fecha_produccion + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                )}
              </div>

              {/* Ítems */}
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4A5568' }}>Productos</p>
                {p.pedido_items?.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F4F6F8' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                        {item.productos?.nombre}
                        {item.bidon_nuevo && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: '#FFF3E0', color: '#F57C00', padding: '2px 6px', borderRadius: 99 }}>BIDÓN NUEVO</span>
                        )}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#4A5568' }}>
                        {item.cantidad} × ${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#0D5C8A' }}>
                      ${(item.cantidad * item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#0D5C8A', letterSpacing: -0.5 }}>
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
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4A5568' }}>Cobro</p>
                    {!editandoCobro && (
                      <button type="button"
                        onClick={() => { setCobroForma(p.forma_cobro ?? 'pendiente'); setCobroMonto(p.monto_cobrado != null ? String(p.monto_cobrado) : ''); setEditandoCobro(true) }}
                        style={{ fontSize: 12, color: '#0D5C8A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        Editar
                      </button>
                    )}
                  </div>

                  {!editandoCobro ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#4A5568' }}>Forma de cobro</span>
                        <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{p.forma_cobro ?? '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#4A5568' }}>Monto cobrado</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {p.monto_cobrado != null
                            ? `$${p.monto_cobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#4A5568', fontWeight: 600, display: 'block', marginBottom: 4 }}>Forma de cobro</label>
                        <select value={cobroForma} onChange={e => setCobroForma(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none' }}>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="pendiente">Pendiente</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#4A5568', fontWeight: 600, display: 'block', marginBottom: 4 }}>Monto cobrado</label>
                        <input type="number" value={cobroMonto} onChange={e => setCobroMonto(e.target.value)} placeholder="0.00"
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={handleGuardarCobro} disabled={editarCobro.isPending}
                          style={{ flex: 1, background: '#0D5C8A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 40, opacity: editarCobro.isPending ? 0.6 : 1 }}>
                          {editarCobro.isPending ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" onClick={() => setEditandoCobro(false)}
                          style={{ flex: 1, background: 'transparent', color: '#4A5568', border: '1.5px solid #D1D5DB', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 40 }}>
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
                  <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4A5568', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      <span style={{ fontSize: 11, color: '#4A5568', marginLeft: 'auto' }}>
                        {h.perfiles?.nombre ?? '—'} · {new Date(h.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button type="button" onClick={() => window.open(`/print/${p.id}`, '_blank')}
                  style={{ background: '#F4F6F8', color: '#4A5568', border: '1.5px solid #D1D5DB', borderRadius: 10, padding: '12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Printer size={14} /> Generar documento
                </button>

                {transiciones.map((next: EstadoPedido) => (
                  <button key={next} type="button" onClick={() => setConfirmando(next)}
                    style={{ background: ESTADO_CONFIG[next].bg, color: ESTADO_CONFIG[next].color, border: `1.5px solid ${ESTADO_CONFIG[next].color}`, borderRadius: 10, padding: '12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Pasar a: {ESTADO_CONFIG[next].label}
                  </button>
                ))}

                {['borrador', 'confirmado', 'en_produccion'].includes(p.estado) && (
                  <button type="button" onClick={() => pedido && onEditar(pedido)}
                    style={{ background: 'transparent', color: '#0D5C8A', border: '1.5px solid #0D5C8A', borderRadius: 10, padding: '12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Edit2 size={14} /> Editar pedido
                  </button>
                )}

                {p.estado !== 'cerrado' && p.estado !== 'anulado' && (
                  <button type="button" onClick={() => setAnulando(true)}
                    style={{ background: '#FDECEA', color: '#D32F2F', border: '1.5px solid #D32F2F', borderRadius: 10, padding: '12px', minHeight: 44, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <XCircle size={14} /> Anular pedido
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
    </>
  )
}
