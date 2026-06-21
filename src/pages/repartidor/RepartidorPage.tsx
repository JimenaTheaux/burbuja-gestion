import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, Truck, RefreshCw } from 'lucide-react'
import { ButtonGroup }    from '@/components/common/ButtonGroup'
import { FloatInput }     from '@/components/common/FloatInput'
import { BadgeEstado }    from '@/components/common/BadgeEstado'
import { Skeleton }       from '@/components/ui/skeleton'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import { useOffline }     from '@/hooks/useOffline'
import {
  usePedidos, useCambiarEstado, useCerrarPedido, totalPedido,
  type PedidoListItem,
} from '@/services/pedidos'
import { ESTADO_CONFIG }  from '@/types'
import type { AddActionInput } from '@/hooks/useOffline'

// ─── Card del repartidor con forms inline ────────────────────────────────────

function CardRepartidor({ pedido, isOnline, addAction, onSaved }: {
  pedido:    PedidoListItem
  isOnline:  boolean
  addAction: (a: AddActionInput) => Promise<void>
  onSaved:   (msg: string) => void
}) {
  const cambiar = useCambiarEstado()
  const cerrar  = useCerrarPedido()

  const [formEntrega, setFormEntrega] = useState(false)
  const [formFalla,   setFormFalla]   = useState(false)
  const [confEmerg,   setConfEmerg]   = useState(false)

  // Form entrega / cierre
  const [forma,      setForma]      = useState<'efectivo' | 'transferencia' | 'pendiente'>('efectivo')
  const [monto,      setMonto]      = useState(String(Math.round(Number(totalPedido(pedido)))))
  const [notas,      setNotas]      = useState('')
  const [fechaCobro, setFechaCobro] = useState(() => new Date().toISOString().split('T')[0])

  // Form falla
  const [motivo, setMotivo] = useState('')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const confirmEntregaBtnRef = useRef<HTMLButtonElement>(null)
  const confirmFallaBtnRef   = useRef<HTMLButtonElement>(null)
  const confirmEmergBtnRef   = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (formEntrega) confirmEntregaBtnRef.current?.focus() }, [formEntrega])
  useEffect(() => { if (formFalla)   confirmFallaBtnRef.current?.focus()   }, [formFalla])
  useEffect(() => { if (confEmerg)   confirmEmergBtnRef.current?.focus()   }, [confEmerg])

  const cfg   = ESTADO_CONFIG[pedido.estado]
  const total = Number(totalPedido(pedido))

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 3000)
  }

  // listo_reparto → en_reparto (individual)
  const handleSalirIndividual = async () => {
    if (!isOnline) {
      await addAction({ type: 'cambiarEstado', pedidoId: pedido.id, estadoNuevo: 'en_reparto' })
      onSaved('Pedido encolado offline')
      return
    }
    setLoading(true)
    try {
      await cambiar.mutateAsync({ id: pedido.id, estadoActual: 'listo_reparto', estado: 'en_reparto' })
      onSaved('Pedido en reparto')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  // en_reparto → cerrado (con cobro)
  const handleConfirmarCierre = async () => {
    if (forma !== 'pendiente' && !monto.trim()) {
      showError('El monto cobrado es obligatorio')
      return
    }
    const estadoPago: 'cobrado' | 'pendiente' = forma === 'pendiente' ? 'pendiente' : 'cobrado'
    setLoading(true)
    try {
      if (!isOnline) {
        await addAction({
          type:         'cerrarPedido',
          pedidoId:     pedido.id,
          formaCobro:   forma,
          montoCobrado: monto || undefined,
          estadoPago,
          notasEntrega: notas.trim() || undefined,
          fechaCobro:   forma !== 'pendiente' ? fechaCobro : undefined,
        })
        onSaved('Cierre guardado offline — se enviará al reconectar')
        setFormEntrega(false)
        return
      }
      await cerrar.mutateAsync({
        id:            pedido.id,
        estadoActual:  pedido.estado,
        forma_cobro:   forma,
        monto_cobrado: monto || undefined,
        estado_pago:   estadoPago,
        notas_entrega: notas.trim() || undefined,
        fecha_cobro:   forma !== 'pendiente' ? fechaCobro : undefined,
      })
      onSaved('Pedido cerrado correctamente')
      setFormEntrega(false)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al cerrar pedido')
    } finally {
      setLoading(false)
    }
  }

  // en_reparto → entrega_fallida
  const handleConfirmarFalla = async () => {
    if (!motivo.trim()) return
    setLoading(true)
    try {
      if (!isOnline) {
        await addAction({ type: 'cambiarEstado', pedidoId: pedido.id, estadoNuevo: 'entrega_fallida', notas: motivo.trim() })
        onSaved('Falla guardada offline — se enviará al reconectar')
        setFormFalla(false)
        return
      }
      await cambiar.mutateAsync({ id: pedido.id, estadoActual: pedido.estado, estado: 'entrega_fallida', notas: motivo.trim() })
      onSaved('Entrega fallida registrada')
      setFormFalla(false)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error al registrar falla')
    } finally {
      setLoading(false)
    }
  }

  // en_produccion → en_reparto (emergencia)
  const handleEmergencia = async () => {
    setLoading(true)
    try {
      if (!isOnline) {
        await addAction({ type: 'cambiarEstado', pedidoId: pedido.id, estadoNuevo: 'en_reparto', notas: 'Avance de emergencia — repartidor' })
        onSaved('Avance guardado offline')
        setConfEmerg(false)
        return
      }
      await cambiar.mutateAsync({ id: pedido.id, estadoActual: 'en_produccion', estado: 'en_reparto', notas: 'Avance de emergencia — repartidor' })
      onSaved('Avance de emergencia registrado')
      setConfEmerg(false)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background:   '#fff',
      borderRadius: 20,
      boxShadow:    '0 2px 8px rgba(0,0,0,0.06)',
      borderLeft:   `4px solid ${cfg.color}`,
      overflow:     'hidden',
    }}>
      {/* Cabecera */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1A2B3C' }}>
                P-{String(pedido.numero).padStart(5, '0')}
              </span>
              <BadgeEstado estado={pedido.estado} />
            </div>
            <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15, color: '#1A2B3C' }}>
              {pedido.clientes?.nombre}
            </p>
            {pedido.direccion_entrega && (
              <p style={{ margin: 0, fontSize: 13, color: '#4A5568' }}>{pedido.direccion_entrega}</p>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 22, color: '#0D5C8A', letterSpacing: -1 }}>
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {pedido.notas_produccion && (
          <p style={{ fontSize: 12, color: '#4A5568', background: '#F4F6F8', borderRadius: 8, padding: '6px 10px', marginTop: 8 }}>
            {pedido.notas_produccion}
          </p>
        )}
      </div>

      {/* Zona de acciones */}
      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* ── listo_reparto → en_reparto ───────────────────────────────── */}
        {pedido.estado === 'listo_reparto' && (
          <button
            onClick={handleSalirIndividual}
            disabled={loading}
            aria-label={`Salir a repartir pedido P-${String(pedido.numero).padStart(5, '0')}`}
            aria-disabled={loading}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: loading ? 'rgba(21,101,192,0.5)' : '#1565C0',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '13px', minHeight: 48, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', outlineOffset: 2,
            }}
          >
            {loading ? 'Procesando…' : '🚚 Salir a repartir'}
          </button>
        )}

        {/* ── en_reparto: form cierre o form falla ─────────────────────── */}
        {pedido.estado === 'en_reparto' && !formFalla && (
          formEntrega ? (
            // Form inline cerrar pedido
            <div style={{ background: '#F4F6F8', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A2B3C' }}>Cerrar pedido</p>

              {/* Total a cobrar */}
              <div style={{
                background: '#D4EDDA', borderRadius: 10, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: '#145A32', fontWeight: 600 }}>Total a cobrar</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#145A32', letterSpacing: -0.5 }}>
                  ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <ButtonGroup
                label="Forma de cobro"
                value={forma}
                onChange={v => setForma(v as typeof forma)}
                options={[
                  { value: 'efectivo',      label: 'Efectivo',  color: '#2E9E5C' },
                  { value: 'transferencia', label: 'Transf.',   color: '#1B9ED6' },
                  { value: 'pendiente',     label: 'Pendiente', color: '#F9A825' },
                ]}
              />

              {forma !== 'pendiente' && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#4A5568', display: 'block', marginBottom: 6 }}>
                    Fecha de cobro
                  </span>
                  <input
                    type="date"
                    value={fechaCobro}
                    onChange={e => setFechaCobro(e.target.value)}
                    style={{
                      width: '100%', height: 44, padding: '0 10px',
                      border: '1px solid rgba(105,105,105,0.4)',
                      borderRadius: 10, fontSize: 14, fontFamily: 'Inter, sans-serif',
                      outline: 'none', boxSizing: 'border-box' as const,
                    }}
                    onFocus={e => (e.target.style.borderColor = '#1B9ED6')}
                    onBlur={e  => (e.target.style.borderColor = 'rgba(105,105,105,0.4)')}
                  />
                </div>
              )}

              <FloatInput
                label={forma === 'pendiente' ? 'Monto cobrado (opcional)' : 'Monto cobrado *'}
                value={monto}
                onChange={e => setMonto(e.target.value)}
                inputMode="decimal"
              />

              <FloatInput
                label="Observaciones (opcional)"
                value={notas}
                onChange={e => setNotas(e.target.value)}
              />

              {!isOnline && (
                <div style={{
                  background: '#FFFDE7', border: '1px solid #F9A825', borderRadius: 8,
                  padding: '7px 10px', fontSize: 12, color: '#F57C00',
                }}>
                  Sin conexión — se guardará offline al confirmar.
                </div>
              )}

              {error && (
                <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  ref={confirmEntregaBtnRef}
                  onClick={handleConfirmarCierre}
                  disabled={loading}
                  aria-disabled={loading}
                  aria-label={`Confirmar cierre del pedido P-${String(pedido.numero).padStart(5, '0')}`}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    background: loading ? 'rgba(20,90,50,0.5)' : '#145A32',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '13px', minHeight: 48, fontSize: 15, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', outlineOffset: 2,
                  }}
                >
                  {loading ? 'Guardando…' : isOnline ? '✓ Confirmar y cerrar pedido' : '✓ Guardar offline'}
                </button>
                <button
                  onClick={() => setFormEntrega(false)}
                  disabled={loading}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    background: 'transparent', color: '#4A5568',
                    border: '1.5px solid #D1D5DB', borderRadius: 10,
                    padding: '11px', fontSize: 14, cursor: 'pointer', minHeight: 44, outlineOffset: 2,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            // Botones principales
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setFormEntrega(true)}
                aria-label={`Cerrar pedido P-${String(pedido.numero).padStart(5, '0')}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  flex: 1, background: '#145A32', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '13px', minHeight: 48, fontSize: 14,
                  fontWeight: 700, cursor: 'pointer', outlineOffset: 2,
                }}
              >
                ✓ Cerrar pedido
              </button>
              <button
                onClick={() => setFormFalla(true)}
                aria-label={`Marcar entrega fallida del pedido P-${String(pedido.numero).padStart(5, '0')}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  flex: 1, background: '#FDECEA', color: '#D32F2F',
                  border: '1.5px solid #D32F2F', borderRadius: 10,
                  padding: '13px', minHeight: 48, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', outlineOffset: 2,
                }}
              >
                Entrega fallida
              </button>
            </div>
          )
        )}

        {/* ── Form entrega fallida ─────────────────────────────────────── */}
        {pedido.estado === 'en_reparto' && formFalla && (
          <div style={{ background: '#FDECEA', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#D32F2F' }}>Entrega fallida</p>

            <div>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4A5568', display: 'block', marginBottom: 6 }}>
                Motivo *
              </span>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Describí por qué no se pudo entregar…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #D32F2F', borderRadius: 10, resize: 'vertical',
                  fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 0,
                  background: '#fff', boxSizing: 'border-box',
                }}
              />
            </div>

            {!isOnline && (
              <div style={{
                background: '#FFFDE7', border: '1px solid #F9A825', borderRadius: 8,
                padding: '7px 10px', fontSize: 12, color: '#F57C00',
              }}>
                Sin conexión — se guardará offline al confirmar.
              </div>
            )}

            {error && (
              <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                ref={confirmFallaBtnRef}
                onClick={handleConfirmarFalla}
                disabled={loading || !motivo.trim()}
                aria-disabled={loading || !motivo.trim()}
                aria-label={`Confirmar entrega fallida del pedido P-${String(pedido.numero).padStart(5, '0')}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  flex: 1,
                  background: !motivo.trim() ? 'rgba(211,47,47,0.4)' : '#D32F2F',
                  color: '#fff', border: 'none', borderRadius: 10,
                  padding: '12px', fontSize: 14, fontWeight: 700,
                  cursor: !motivo.trim() ? 'not-allowed' : 'pointer', minHeight: 48,
                  outlineOffset: 2,
                }}
              >
                {loading ? 'Guardando…' : isOnline ? 'Confirmar falla' : 'Guardar offline'}
              </button>
              <button
                onClick={() => setFormFalla(false)}
                disabled={loading}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  flex: 1, background: 'transparent', color: '#4A5568',
                  border: '1.5px solid #D1D5DB', borderRadius: 10,
                  padding: '12px', fontSize: 14, cursor: 'pointer', minHeight: 48,
                  outlineOffset: 2,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Avance de emergencia (en_produccion) ─────────────────────── */}
        {pedido.estado === 'en_produccion' && (
          confEmerg ? (
            <div style={{ background: '#FFF3E0', borderRadius: 12, padding: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#F57C00', fontWeight: 600 }}>
                ¿Confirmás que retiraste físicamente este pedido sin que producción lo marcara?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  ref={confirmEmergBtnRef}
                  onClick={handleEmergencia}
                  disabled={loading}
                  aria-disabled={loading}
                  aria-label={`Confirmar avance de emergencia del pedido P-${String(pedido.numero).padStart(5, '0')}`}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    flex: 1, background: loading ? 'rgba(245,124,0,0.5)' : '#F57C00',
                    color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', outlineOffset: 2,
                  }}
                >
                  {loading ? 'Procesando…' : 'Sí, retiré'}
                </button>
                <button
                  onClick={() => setConfEmerg(false)}
                  disabled={loading}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    flex: 1, background: 'transparent', color: '#4A5568',
                    border: '1.5px solid #D1D5DB', borderRadius: 8, padding: '10px',
                    fontSize: 13, cursor: 'pointer', outlineOffset: 2,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfEmerg(true)}
              aria-label={`Ya retiré el pedido P-${String(pedido.numero).padStart(5, '0')} — avance de emergencia`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: '#FFF3E0', color: '#F57C00',
                border: '1.5px solid #F57C00', borderRadius: 10,
                padding: '11px', minHeight: 44, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                outlineOffset: 2,
              }}
            >
              <AlertTriangle size={14} /> Ya retiré este pedido
            </button>
          )
        )}

        {/* Error global de la card */}
        {error && pedido.estado !== 'en_reparto' && (
          <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RepartidorPage() {
  const HOY = new Date().toISOString().split('T')[0]
  const { toasts, show, dismiss } = useToast()
  const { isOnline, addAction }   = useOffline()
  const cambiar                   = useCambiarEstado()

  const { data: pedidosFiltrados = [], isLoading, refetch } = usePedidos({
    fechaProduccion: HOY,
    estados: ['en_produccion', 'listo_reparto', 'en_reparto'],
  })

  const listos    = pedidosFiltrados.filter(p => p.estado === 'listo_reparto')
  const enReparto = pedidosFiltrados.filter(p => p.estado === 'en_reparto')
  const enProd    = pedidosFiltrados.filter(p => p.estado === 'en_produccion')

  const handleSalirARepartir = async () => {
    if (!isOnline) {
      for (const p of listos) {
        await addAction({ type: 'cambiarEstado', pedidoId: p.id, estadoNuevo: 'en_reparto' })
      }
      show(`${listos.length} pedido${listos.length !== 1 ? 's' : ''} encolados offline`, 'info')
      return
    }
    try {
      await Promise.all(listos.map(p =>
        cambiar.mutateAsync({ id: p.id, estadoActual: 'listo_reparto', estado: 'en_reparto' })
      ))
      show(`${listos.length} pedido${listos.length !== 1 ? 's' : ''} en camino`, 'success')
      refetch()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const handleSaved = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else { show(msg, 'success'); refetch() }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title">Pedidos del día</h1>
        <button onClick={() => refetch()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#4A5568', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
        }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Botón global salir a repartir */}
      {listos.length > 0 && (
        <button
          onClick={handleSalirARepartir}
          disabled={cambiar.isPending}
          aria-label={`Salir a repartir ${listos.length} pedido${listos.length !== 1 ? 's' : ''} listos`}
          aria-disabled={cambiar.isPending}
          style={{
            width: '100%', background: cambiar.isPending ? 'rgba(21,101,192,0.5)' : '#1565C0',
            color: '#fff', border: 'none',
            borderRadius: 14, padding: '16px', minHeight: 56, fontSize: 16, fontWeight: 800,
            cursor: cambiar.isPending ? 'not-allowed' : 'pointer', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(21,101,192,0.3)',
          }}
        >
          <Truck size={20} />
          Salir a repartir ({listos.length} pedido{listos.length !== 1 ? 's' : ''})
        </button>
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <Skeleton key={i} style={{ height: 120, borderRadius: 20 }} />)}
        </div>
      ) : !pedidosFiltrados.length ? (
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Truck size={48} strokeWidth={1.2} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <p style={{ fontWeight: 600, fontSize: 15, color: '#1A2B3C', margin: '0 0 4px' }}>Sin pedidos para hoy</p>
          <p style={{ fontSize: 13, color: '#4A5568', margin: 0 }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {enReparto.map(p => (
            <CardRepartidor key={p.id} pedido={p} isOnline={isOnline} addAction={addAction} onSaved={handleSaved} />
          ))}
          {listos.map(p => (
            <CardRepartidor key={p.id} pedido={p} isOnline={isOnline} addAction={addAction} onSaved={handleSaved} />
          ))}
          {enProd.map(p => (
            <CardRepartidor key={p.id} pedido={p} isOnline={isOnline} addAction={addAction} onSaved={handleSaved} />
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
