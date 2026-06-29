import { useState, useRef, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { FloatInput }       from '@/components/common/FloatInput'
import { BadgeEstado }      from '@/components/common/BadgeEstado'
import { Skeleton }         from '@/components/ui/skeleton'
import { ToastContainer }   from '@/components/common/ToastContainer'
import { useToast }         from '@/hooks/useToast'
import { useOffline }       from '@/hooks/useOffline'
import {
  usePedidos, usePedidoDetalle, useCambiarEstado, useCerrarPedido, totalPedido,
  type PedidoListItem,
} from '@/services/pedidos'
import { ESTADO_CONFIG } from '@/types'
import type { AddActionInput } from '@/hooks/useOffline'

// ─── Date helper ──────────────────────────────────────────────────────────────

const _d  = new Date()
const HOY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

// ─── Expanded items — lazy load ───────────────────────────────────────────────

function ExpandedItems({ pedidoId }: { pedidoId: string }) {
  const { data, isLoading } = usePedidoDetalle(pedidoId)

  if (isLoading) {
    return (
      <div style={{ padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1, 2].map(i => <Skeleton key={i} style={{ height: 13, borderRadius: 4 }} />)}
      </div>
    )
  }

  const items = data?.pedido_items ?? []
  if (!items.length) return null

  return (
    <div style={{ padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => {
        const prod = item.productos as typeof item.productos | null
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#8E8E93' }}>
              {prod?.nombre ?? '—'}
              {prod?.presentacion ? ` · ${prod.presentacion}L` : ''}
              {' · '}{item.cantidad}
            </span>
            {item.bidon_nuevo && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: '#EBF5FF', color: '#2B6CB0',
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

// ─── Forma de cobro — 3 opciones en fila ─────────────────────────────────────

type FormaCobro = 'efectivo' | 'transferencia' | 'pendiente'

function FormaCobroSelector({
  value, onChange,
}: { value: FormaCobro; onChange: (v: FormaCobro) => void }) {
  const opts: { value: FormaCobro; label: string }[] = [
    { value: 'efectivo',      label: 'Efectivo'     },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'pendiente',     label: 'Pendiente'    },
  ]
  return (
    <div role="radiogroup" aria-label="Forma de cobro" style={{ display: 'flex', gap: 6 }}>
      {opts.map(opt => {
        const sel = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer',
              border: `0.5px solid ${sel ? '#3DD6B5' : '#E5E5EA'}`,
              background: sel ? '#EBF5FF' : '#fff',
              color: sel ? '#3DD6B5' : '#8E8E93',
              fontWeight: sel ? 500 : 400,
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Card repartidor ──────────────────────────────────────────────────────────

function CardRepartidor({ pedido, isExpanded, onToggle, isOnline, addAction, onSaved }: {
  pedido:    PedidoListItem
  isExpanded: boolean
  onToggle:  () => void
  isOnline:  boolean
  addAction: (a: AddActionInput) => Promise<void>
  onSaved:   (msg: string) => void
}) {
  const cambiar = useCambiarEstado()
  const cerrar  = useCerrarPedido()

  const [formEntrega, setFormEntrega] = useState(false)
  const [formFalla,   setFormFalla]   = useState(false)
  const [confEmerg,   setConfEmerg]   = useState(false)

  const [forma,      setForma]      = useState<FormaCobro>('efectivo')
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

  const handleCardToggle = () => {
    if (formEntrega || formFalla || confEmerg) return
    onToggle()
  }

  // listo_reparto → en_reparto (individual)
  const handleSalirIndividual = async () => {
    if (!isOnline) {
      await addAction({ type: 'cambiarEstado', pedidoId: pedido.id, estadoActual: 'listo_reparto', estadoNuevo: 'en_reparto' })
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
          type: 'cerrarPedido', pedidoId: pedido.id, estadoActual: pedido.estado,
          formaCobro: forma, montoCobrado: monto || undefined,
          estadoPago, notasEntrega: notas.trim() || undefined,
          fechaCobro: forma !== 'pendiente' ? fechaCobro : undefined,
        })
        onSaved('Cierre guardado offline')
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
        await addAction({ type: 'cambiarEstado', pedidoId: pedido.id, estadoActual: pedido.estado, estadoNuevo: 'entrega_fallida', notas: motivo.trim() })
        onSaved('Falla guardada offline')
        setFormFalla(false)
        return
      }
      await cambiar.mutateAsync({ id: pedido.id, estadoActual: pedido.estado, estado: 'entrega_fallida', notas: motivo.trim() })
      onSaved('Entrega fallida registrada')
      setFormFalla(false)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  // en_produccion → en_reparto (emergencia)
  const handleEmergencia = async () => {
    setLoading(true)
    try {
      if (!isOnline) {
        await addAction({ type: 'cambiarEstado', pedidoId: pedido.id, estadoActual: 'en_produccion', estadoNuevo: 'en_reparto', notas: 'Avance de emergencia — repartidor' })
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
    <div
      style={{
        background:   '#fff',
        borderRadius: 10,
        border:       '0.5px solid #E5E5EA',
        borderLeft:   `3px solid ${cfg.color}`,
        marginBottom: 6,
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
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7EB8E8] focus-visible:ring-offset-2"
        style={{ padding: '12px 14px', cursor: 'pointer' }}
      >
        {/* Line 1: número · badge · spacer · total · chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#3DD6B5', whiteSpace: 'nowrap' }}>
            {numStr}
          </span>
          <BadgeEstado estado={pedido.estado} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', whiteSpace: 'nowrap' }}>
            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
          <ChevronRight
            size={14}
            color="#E5E5EA"
            style={{
              transform:  isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        </div>

        {/* Line 2: nombre cliente */}
        <div style={{ marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>
            {pedido.clientes?.nombre}
          </span>
        </div>

        {/* Line 3: dirección */}
        <div>
          {pedido.direccion_entrega
            ? <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1C1E' }}>{pedido.direccion_entrega}</span>
            : <span style={{ fontSize: 11, fontStyle: 'italic', color: '#E5E5EA' }}>Sin dirección</span>
          }
        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div>
          <div style={{ borderTop: '0.5px solid #F5F7F9' }} />
          <ExpandedItems pedidoId={pedido.id} />

          <div style={{ borderTop: '0.5px solid #F5F7F9' }} />
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
                  width: '100%', background: loading ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
                  color: '#fff', border: 'none', borderRadius: 10,
                  height: 44, fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Procesando…' : 'Salir a repartir'}
              </button>
            )}

            {/* en_reparto: cierre o falla */}
            {pedido.estado === 'en_reparto' && !formFalla && (
              formEntrega ? (
                // Mini form registrar entrega
                <div style={{ background: '#F5F7F9', borderRadius: 8, padding: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FormaCobroSelector value={forma} onChange={setForma} />

                  {forma !== 'pendiente' && (
                    <div>
                      <label style={{
                        display: 'block', fontSize: 10, fontWeight: 500,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        color: '#8E8E93', marginBottom: 5,
                      }}>
                        Fecha de cobro
                      </label>
                      <input
                        type="date"
                        value={fechaCobro}
                        onChange={e => setFechaCobro(e.target.value)}
                        style={{
                          width: '100%', height: 44, padding: '0 10px',
                          border: '0.5px solid #E5E5EA', borderRadius: 8,
                          fontSize: 13, fontFamily: 'Inter, sans-serif',
                          outline: 'none', boxSizing: 'border-box',
                          background: '#fff',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
                        onBlur={e  => (e.target.style.borderColor = '#E5E5EA')}
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

                  {error && <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>}

                  <button
                    ref={confirmEntregaBtnRef}
                    onClick={handleConfirmarCierre}
                    disabled={loading}
                    aria-disabled={loading}
                    aria-label={`Confirmar entrega del pedido ${numStr}`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      width: '100%', background: loading ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
                      color: '#fff', border: 'none', borderRadius: 10,
                      height: 44, fontSize: 13, fontWeight: 500,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Guardando…' : 'Confirmar entrega'}
                  </button>
                  <button
                    onClick={() => setFormEntrega(false)}
                    disabled={loading}
                    style={{
                      background: 'none', border: 'none', color: '#8E8E93',
                      fontSize: 12, cursor: 'pointer', textAlign: 'center', padding: '2px 0',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setFormEntrega(true)}
                    aria-label={`Registrar entrega del pedido ${numStr}`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      flex: 1, background: '#3DD6B5', color: '#fff', border: 'none',
                      borderRadius: 10, height: 44, fontSize: 13, fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Registrar entrega
                  </button>
                  <button
                    onClick={() => setFormFalla(true)}
                    aria-label={`Marcar entrega fallida del pedido ${numStr}`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      flex: 1, background: 'transparent', color: '#8E8E93',
                      border: '1px solid #E5E5EA', borderRadius: 10,
                      height: 44, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    Entrega fallida
                  </button>
                </div>
              )
            )}

            {/* Mini form entrega fallida */}
            {pedido.estado === 'en_reparto' && formFalla && (
              <div style={{ background: '#F5F7F9', borderRadius: 8, padding: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: '#8E8E93', marginBottom: 5,
                  }}>
                    Motivo *
                  </label>
                  <textarea
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    rows={2}
                    placeholder="Describí por qué no se pudo entregar…"
                    style={{
                      width: '100%', padding: '8px 10px',
                      border: '0.5px solid #E5E5EA', borderRadius: 8,
                      fontSize: 13, fontFamily: 'Inter, sans-serif',
                      resize: 'vertical', outline: 0, background: '#fff',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
                    onBlur={e  => (e.target.style.borderColor = '#E5E5EA')}
                  />
                </div>

                {error && <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>}

                <button
                  ref={confirmFallaBtnRef}
                  onClick={handleConfirmarFalla}
                  disabled={loading || !motivo.trim()}
                  aria-disabled={loading || !motivo.trim()}
                  aria-label={`Confirmar entrega fallida del pedido ${numStr}`}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    width: '100%',
                    background: '#FDECEA', color: '#D32F2F',
                    border: '0.5px solid #D32F2F', borderRadius: 10,
                    height: 44, fontSize: 13, fontWeight: 500,
                    cursor: !motivo.trim() ? 'not-allowed' : 'pointer',
                    opacity: !motivo.trim() ? 0.6 : 1,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {loading ? 'Guardando…' : 'Confirmar falla'}
                </button>
                <button
                  onClick={() => setFormFalla(false)}
                  disabled={loading}
                  style={{
                    background: 'none', border: 'none', color: '#8E8E93',
                    fontSize: 12, cursor: 'pointer', textAlign: 'center', padding: '2px 0',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* en_produccion → en_reparto (emergencia) */}
            {pedido.estado === 'en_produccion' && (
              confEmerg ? (
                <div style={{ background: '#FFF3E0', borderRadius: 8, padding: 12 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#F57C00', fontWeight: 500 }}>
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
                        borderRadius: 10, height: 44, fontSize: 13, fontWeight: 500,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? 'Procesando…' : 'Sí, retiré'}
                    </button>
                    <button
                      onClick={() => setConfEmerg(false)}
                      disabled={loading}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{
                        flex: 1, background: '#fff', color: '#8E8E93',
                        border: '0.5px solid #E5E5EA', borderRadius: 10,
                        height: 44, fontSize: 13, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfEmerg(true)}
                  aria-label={`Ya retiré el pedido ${numStr}`}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    width: '100%', background: '#fff', color: '#F57C00',
                    border: '0.5px solid #F57C00', borderRadius: 10,
                    height: 44, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Ya retiré este pedido
                </button>
              )
            )}

            {error && pedido.estado !== 'en_reparto' && (
              <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }} role="alert">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vista principal — reusada por /repartidor (rol repartidor) y /admin/repartidor

export function RepartidorView() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { toasts, show, dismiss } = useToast()
  const { isOnline, addAction }   = useOffline()
  const cambiar                   = useCambiarEstado()

  const { data: pedidos = [], isLoading } = usePedidos({
    fechaProduccion: HOY,
    estados: ['en_produccion', 'listo_reparto', 'en_reparto'],
  })

  // Ordenar: listos primero, luego en_reparto, luego en_produccion
  const listos    = pedidos.filter(p => p.estado === 'listo_reparto').sort((a, b) => a.numero - b.numero)
  const enReparto = pedidos.filter(p => p.estado === 'en_reparto').sort((a, b) => a.numero - b.numero)
  const enProd    = pedidos.filter(p => p.estado === 'en_produccion').sort((a, b) => a.numero - b.numero)

  const handleToggle = (id: string) => setExpandedId(prev => prev === id ? null : id)

  const handleSalirARepartir = async () => {
    if (!isOnline) {
      for (const p of listos) {
        await addAction({ type: 'cambiarEstado', pedidoId: p.id, estadoActual: 'listo_reparto', estadoNuevo: 'en_reparto' })
      }
      show(`${listos.length} pedido${listos.length !== 1 ? 's' : ''} encolados offline`, 'info')
      return
    }
    try {
      await Promise.all(listos.map(p =>
        cambiar.mutateAsync({ id: p.id, estadoActual: 'listo_reparto', estado: 'en_reparto' })
      ))
      show(`${listos.length} pedido${listos.length !== 1 ? 's' : ''} en camino`, 'success')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const handleSaved = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else show(msg, 'success')
  }

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: 82, borderRadius: 10 }} />)}
        </div>

      ) : !pedidos.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E5E5EA" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><circle cx="20" cy="16" r="1"/>
          </svg>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>Sin entregas asignadas</p>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>No tenés pedidos para repartir hoy</p>
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Sección: Listos para salir */}
          {listos.length > 0 && (
            <section role="region" aria-label="Listos para salir">
              <button
                onClick={handleSalirARepartir}
                disabled={cambiar.isPending}
                aria-label={`Salir a repartir ${listos.length} pedido${listos.length !== 1 ? 's' : ''} listos`}
                aria-disabled={cambiar.isPending}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 btn-press"
                style={{
                  width: '100%',
                  background: cambiar.isPending ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
                  color: '#fff', border: 'none', borderRadius: 10,
                  height: 48, fontSize: 14, fontWeight: 600,
                  cursor: cambiar.isPending ? 'not-allowed' : 'pointer',
                  marginBottom: 12,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Salir a repartir ({listos.length} pedido{listos.length !== 1 ? 's' : ''})
              </button>
              {listos.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}

          {/* En reparto */}
          {enReparto.length > 0 && (
            <section role="region" aria-label="En reparto" style={{ marginTop: listos.length ? 8 : 0 }}>
              {enReparto.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}

          {/* En producción */}
          {enProd.length > 0 && (
            <section role="region" aria-label="En producción" style={{ marginTop: enReparto.length || listos.length ? 8 : 0 }}>
              {enProd.map(p => (
                <CardRepartidor key={p.id} pedido={p}
                  isExpanded={expandedId === p.id} onToggle={() => handleToggle(p.id)}
                  isOnline={isOnline} addAction={addAction} onSaved={handleSaved}
                />
              ))}
            </section>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
