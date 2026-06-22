import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, ChevronRight, Truck } from 'lucide-react'
import { ButtonGroup }    from '@/components/common/ButtonGroup'
import { FloatInput }     from '@/components/common/FloatInput'
import { BadgeEstado }    from '@/components/common/BadgeEstado'
import { SelectorFecha }  from '@/components/common/SelectorFecha'
import { Skeleton }       from '@/components/ui/skeleton'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import { useOffline }     from '@/hooks/useOffline'
import {
  usePedidos, usePedidoDetalle, useCambiarEstado, useCerrarPedido, totalPedido,
  type PedidoListItem,
} from '@/services/pedidos'
import { ESTADO_CONFIG }  from '@/types'
import type { AddActionInput } from '@/hooks/useOffline'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const _d  = new Date()
const HOY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

const DIAS_CORTO  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

function labelFechaCorta(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}

function labelFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  return `${DIAS_CORTO[d.getDay()].toLowerCase()} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
}

// ─── Expanded items — lazy load via usePedidoDetalle ─────────────────────────

function ExpandedItems({ pedidoId }: { pedidoId: string }) {
  const { data, isLoading } = usePedidoDetalle(pedidoId)

  if (isLoading) {
    return (
      <div style={{ padding: '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1, 2].map(i => <Skeleton key={i} style={{ height: 13, borderRadius: 4 }} />)}
      </div>
    )
  }

  const items = data?.pedido_items ?? []
  if (!items.length) return null

  return (
    <div style={{ padding: '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => {
        const prod = item.productos as typeof item.productos | null
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#4A5568' }}>
              {prod?.nombre ?? '—'}
              {prod?.fragancia ? ` (${prod.fragancia})` : ''}
              {prod?.presentacion ? ` · ${prod.presentacion}L` : ''}
              {' · '}{item.cantidad}
            </span>
            {item.bidon_nuevo && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: '#FFF3E0', color: '#E65100',
                padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap',
              }}>
                BIDÓN NUEVO
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SeccionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, color: '#4A5568',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: '12px 0 6px',
      borderBottom: '0.5px solid #D1D5DB',
      marginBottom: 8,
    }}>
      {label} · {count}
    </div>
  )
}

// ─── Card repartidor ──────────────────────────────────────────────────────────

function CardRepartidor({ pedido, isExpanded, onToggle, soloLectura, esHoy, isOnline, addAction, onSaved }: {
  pedido:      PedidoListItem
  isExpanded:  boolean
  onToggle:    () => void
  soloLectura: boolean
  esHoy:       boolean
  isOnline:    boolean
  addAction:   (a: AddActionInput) => Promise<void>
  onSaved:     (msg: string) => void
}) {
  const cambiar = useCambiarEstado()
  const cerrar  = useCerrarPedido()

  const [formEntrega, setFormEntrega] = useState(false)
  const [formFalla,   setFormFalla]   = useState(false)
  const [confEmerg,   setConfEmerg]   = useState(false)

  const [forma,      setForma]      = useState<'efectivo' | 'transferencia' | 'pendiente'>('efectivo')
  const [monto,      setMonto]      = useState(String(Math.round(Number(totalPedido(pedido)))))
  const [notas,      setNotas]      = useState('')
  const [fechaCobro, setFechaCobro] = useState(() => new Date().toISOString().split('T')[0])
  const [motivo,     setMotivo]     = useState('')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const confirmEntregaBtnRef = useRef<HTMLButtonElement>(null)
  const confirmFallaBtnRef   = useRef<HTMLButtonElement>(null)
  const confirmEmergBtnRef   = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (formEntrega) confirmEntregaBtnRef.current?.focus() }, [formEntrega])
  useEffect(() => { if (formFalla)   confirmFallaBtnRef.current?.focus()   }, [formFalla])
  useEffect(() => { if (confEmerg)   confirmEmergBtnRef.current?.focus()   }, [confEmerg])

  const cfg    = ESTADO_CONFIG[pedido.estado]
  const total  = Number(totalPedido(pedido))
  const numStr = `P-${String(pedido.numero).padStart(5, '0')}`

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 3000)
  }

  // Don't collapse while a form is open
  const handleCardToggle = () => {
    if (formEntrega || formFalla || confEmerg) return
    onToggle()
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

  // en_reparto → cerrado
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
          type: 'cerrarPedido', pedidoId: pedido.id,
          formaCobro: forma, montoCobrado: monto || undefined,
          estadoPago, notasEntrega: notas.trim() || undefined,
          fechaCobro: forma !== 'pendiente' ? fechaCobro : undefined,
        })
        onSaved('Cierre guardado offline — se enviará al reconectar')
        setFormEntrega(false)
        return
      }
      await cerrar.mutateAsync({
        id: pedido.id, estadoActual: pedido.estado,
        forma_cobro: forma, monto_cobrado: monto || undefined,
        estado_pago: estadoPago,
        notas_entrega: notas.trim() || undefined,
        fecha_cobro: forma !== 'pendiente' ? fechaCobro : undefined,
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

  const showActions = !soloLectura && esHoy

  return (
    <div
      style={{
        background:   '#fff',
        borderRadius: 12,
        border:       '0.5px solid #D1D5DB',
        borderLeft:   `3px solid ${cfg.color}`,
        marginBottom: 8,
        boxShadow:    isExpanded ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
        overflow:     'hidden',
      }}
    >
      {/* Tappable header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${numStr}, ${pedido.clientes?.nombre ?? ''}, $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
        onClick={handleCardToggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardToggle() }
        }}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B9ED6] focus-visible:ring-offset-2"
        style={{ padding: '14px 16px', cursor: 'pointer' }}
      >
        {/* Line 1: número · badge · spacer · total · chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0D5C8A', whiteSpace: 'nowrap' }}>
            {numStr}
          </span>
          <BadgeEstado estado={pedido.estado} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C', whiteSpace: 'nowrap' }}>
            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
          <ChevronRight
            size={16}
            color="#4A5568"
            style={{
              transform:  isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        </div>

        {/* Line 2: nombre cliente */}
        <div style={{ marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2B3C' }}>
            {pedido.clientes?.nombre}
          </span>
        </div>

        {/* Line 3: dirección */}
        <div>
          {pedido.direccion_entrega
            ? <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2B3C' }}>{pedido.direccion_entrega}</span>
            : <span style={{ fontSize: 12, fontStyle: 'italic', color: '#D1D5DB' }}>Sin dirección registrada</span>
          }
        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div>
          <div style={{ borderTop: '0.5px solid #F4F6F8' }} />
          <ExpandedItems pedidoId={pedido.id} />

          {showActions && (
            <>
              <div style={{ borderTop: '0.5px solid #F4F6F8' }} />
              <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* listo_reparto → en_reparto */}
                {pedido.estado === 'listo_reparto' && (
                  <button
                    onClick={handleSalirIndividual}
                    disabled={loading}
                    aria-label={`Salir a repartir pedido ${numStr}`}
                    aria-disabled={loading}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      width: '100%', background: loading ? 'rgba(21,101,192,0.5)' : '#1565C0',
                      color: '#fff', border: 'none', borderRadius: 10,
                      height: 44, fontSize: 13, fontWeight: 500,
                      cursor: loading ? 'not-allowed' : 'pointer', outlineOffset: 2,
                    }}
                  >
                    {loading ? 'Procesando…' : '🚚 Salir a repartir'}
                  </button>
                )}

                {/* en_reparto: cierre o falla */}
                {pedido.estado === 'en_reparto' && !formFalla && (
                  formEntrega ? (
                    <div style={{ background: '#F4F6F8', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A2B3C' }}>Cerrar pedido</p>

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
                        <div style={{ background: '#FFFDE7', border: '1px solid #F9A825', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#F57C00' }}>
                          Sin conexión — se guardará offline al confirmar.
                        </div>
                      )}

                      {error && <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          ref={confirmEntregaBtnRef}
                          onClick={handleConfirmarCierre}
                          disabled={loading}
                          aria-disabled={loading}
                          aria-label={`Confirmar cierre del pedido ${numStr}`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{
                            background: loading ? 'rgba(20,90,50,0.5)' : '#145A32',
                            color: '#fff', border: 'none', borderRadius: 10,
                            height: 44, fontSize: 13, fontWeight: 500,
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
                            height: 44, fontSize: 13, cursor: 'pointer', outlineOffset: 2,
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setFormEntrega(true)}
                        aria-label={`Cerrar pedido ${numStr}`}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{
                          flex: 1, background: '#145A32', color: '#fff', border: 'none',
                          borderRadius: 10, height: 44, fontSize: 13, fontWeight: 500,
                          cursor: 'pointer', outlineOffset: 2,
                        }}
                      >
                        ✓ Cerrar pedido
                      </button>
                      <button
                        onClick={() => setFormFalla(true)}
                        aria-label={`Marcar entrega fallida del pedido ${numStr}`}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{
                          flex: 1, background: '#FDECEA', color: '#D32F2F',
                          border: '1.5px solid #D32F2F', borderRadius: 10,
                          height: 44, fontSize: 13, fontWeight: 500,
                          cursor: 'pointer', outlineOffset: 2,
                        }}
                      >
                        Entrega fallida
                      </button>
                    </div>
                  )
                )}

                {/* Form entrega fallida */}
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
                      <div style={{ background: '#FFFDE7', border: '1px solid #F9A825', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#F57C00' }}>
                        Sin conexión — se guardará offline al confirmar.
                      </div>
                    )}

                    {error && <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        ref={confirmFallaBtnRef}
                        onClick={handleConfirmarFalla}
                        disabled={loading || !motivo.trim()}
                        aria-disabled={loading || !motivo.trim()}
                        aria-label={`Confirmar entrega fallida del pedido ${numStr}`}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{
                          flex: 1,
                          background: !motivo.trim() ? 'rgba(211,47,47,0.4)' : '#D32F2F',
                          color: '#fff', border: 'none', borderRadius: 10,
                          height: 44, fontSize: 13, fontWeight: 500,
                          cursor: !motivo.trim() ? 'not-allowed' : 'pointer', outlineOffset: 2,
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
                          height: 44, fontSize: 13, cursor: 'pointer', outlineOffset: 2,
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Avance de emergencia (en_produccion) */}
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
                          aria-label={`Confirmar avance de emergencia del pedido ${numStr}`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{
                            flex: 1, background: loading ? 'rgba(245,124,0,0.5)' : '#F57C00',
                            color: '#fff', border: 'none',
                            borderRadius: 8, height: 44, fontSize: 13, fontWeight: 500,
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
                            border: '1.5px solid #D1D5DB', borderRadius: 8,
                            height: 44, fontSize: 13, cursor: 'pointer', outlineOffset: 2,
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfEmerg(true)}
                      aria-label={`Ya retiré el pedido ${numStr} — avance de emergencia`}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{
                        width: '100%', background: '#FFF3E0', color: '#F57C00',
                        border: '1.5px solid #F57C00', borderRadius: 10,
                        height: 44, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        outlineOffset: 2,
                      }}
                    >
                      <AlertTriangle size={14} /> Ya retiré este pedido
                    </button>
                  )
                )}

                {/* Error global (estados sin form inline) */}
                {error && pedido.estado !== 'en_reparto' && (
                  <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RepartidorPage() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(HOY)
  const [expandedId,        setExpandedId]        = useState<string | null>(null)
  const esHoy = fechaSeleccionada === HOY

  const { toasts, show, dismiss } = useToast()
  const { isOnline, addAction }   = useOffline()
  const cambiar                   = useCambiarEstado()

  const { data: pedidosFiltrados = [], isLoading, refetch } = usePedidos({
    fechaProduccion: fechaSeleccionada,
    estados: esHoy
      ? ['en_produccion', 'listo_reparto', 'en_reparto', 'cerrado', 'entrega_fallida']
      : ['cerrado', 'entrega_fallida'],
  })

  const enProd    = esHoy ? pedidosFiltrados.filter(p => p.estado === 'en_produccion')  : []
  const listos    = esHoy ? pedidosFiltrados.filter(p => p.estado === 'listo_reparto')  : []
  const enReparto = esHoy ? pedidosFiltrados.filter(p => p.estado === 'en_reparto')     : []
  const cerrados  = esHoy
    ? pedidosFiltrados.filter(p => p.estado === 'cerrado' || p.estado === 'entrega_fallida')
    : pedidosFiltrados

  const handleToggle = (id: string) => setExpandedId(prev => prev === id ? null : id)

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
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 10,
      }}>
        <h1 className="section-title">Mis entregas</h1>
        <SelectorFecha fecha={fechaSeleccionada} onChange={setFechaSeleccionada} />
      </div>

      {/* Banner historial */}
      {!esHoy && (
        <div style={{
          background: '#E8F4FF', borderBottom: '0.5px solid #1B9ED6',
          padding: '6px 16px', fontSize: 11, color: '#0D5C8A',
          marginBottom: 16, marginLeft: -16, marginRight: -16,
        }}>
          Historial · {labelFechaLarga(fechaSeleccionada)} · Solo lectura
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: 90, borderRadius: 12 }} />)}
        </div>

      ) : !pedidosFiltrados.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Truck size={40} strokeWidth={1.2} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: '#4A5568', margin: '0 0 8px' }}>
            {esHoy
              ? 'No tenés entregas asignadas hoy'
              : `No hay entregas para el ${labelFechaLarga(fechaSeleccionada)}`
            }
          </p>
          {!esHoy && (
            <button
              onClick={() => setFechaSeleccionada(HOY)}
              style={{ background: 'none', border: 'none', color: '#0D5C8A', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Ver hoy →
            </button>
          )}
        </div>

      ) : esHoy ? (
        // Vista de hoy: secciones por estado
        <div>
          {enProd.length > 0 && (
            <section role="region" aria-label="Pedidos en producción">
              <SeccionHeader label="En producción" count={enProd.length} />
              {enProd.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  soloLectura={false} esHoy={true}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}

          {listos.length > 0 && (
            <section role="region" aria-label="Pedidos listos para reparto">
              <SeccionHeader label="Listo para reparto" count={listos.length} />
              <button
                onClick={handleSalirARepartir}
                disabled={cambiar.isPending}
                aria-label={`Salir a repartir ${listos.length} pedido${listos.length !== 1 ? 's' : ''} listos`}
                aria-disabled={cambiar.isPending}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  width: '100%', background: cambiar.isPending ? 'rgba(21,101,192,0.5)' : '#1565C0',
                  color: '#fff', border: 'none', borderRadius: 10,
                  height: 44, fontSize: 13, fontWeight: 500,
                  cursor: cambiar.isPending ? 'not-allowed' : 'pointer',
                  marginBottom: 12, outlineOffset: 2,
                }}
              >
                Salir a repartir ({listos.length})
              </button>
              {listos.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  soloLectura={false} esHoy={true}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}

          {enReparto.length > 0 && (
            <section role="region" aria-label="Pedidos en reparto">
              <SeccionHeader label="En reparto" count={enReparto.length} />
              {enReparto.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  soloLectura={false} esHoy={true}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}

          {cerrados.length > 0 && (
            <section role="region" aria-label="Pedidos cerrados hoy">
              <SeccionHeader label="Cerrado hoy" count={cerrados.length} />
              {cerrados.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  soloLectura={true} esHoy={true}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}
        </div>

      ) : (
        // Vista historial: lista plana, solo lectura
        <div>
          {pedidosFiltrados.map(p => (
            <CardRepartidor key={p.id} pedido={p}
              isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
              soloLectura={true} esHoy={false}
              isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
            />
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
