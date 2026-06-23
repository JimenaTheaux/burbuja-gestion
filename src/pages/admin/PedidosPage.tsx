import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Search, ShoppingCart, Printer, X, MoreHorizontal, ChevronDown } from 'lucide-react'
import { Skeleton }         from '@/components/ui/skeleton'
import { ToastContainer }   from '@/components/common/ToastContainer'
import { BtnWhatsapp }      from '@/components/common/BtnWhatsapp'
import { useToast }         from '@/hooks/useToast'
import { useCompartirFactura } from '@/hooks/useCompartirFactura'
import { DrawerPedido }     from '@/components/pedidos/DrawerPedido'
import { DrawerDetalle }    from '@/components/pedidos/DrawerDetalle'
import {
  usePedidos, useCambiarEstado, useAnularPedido, totalPedido,
  fetchPedidoDetalle, type PedidoListItem, type PedidoDetalle,
} from '@/services/pedidos'
import { ESTADO_CONFIG, type EstadoPedido, formatNumero } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PILLS_PRIMARIOS: { value: EstadoPedido | ''; label: string }[] = [
  { value: '',              label: 'Todos'         },
  { value: 'confirmado',   label: 'Confirmado'    },
  { value: 'en_produccion', label: 'En producción' },
  { value: 'cerrado',      label: 'Cerrado'       },
]

const PILLS_MAS: { value: EstadoPedido; label: string }[] = [
  { value: 'borrador',        label: 'Borrador'        },
  { value: 'listo_reparto',   label: 'Listo reparto'   },
  { value: 'en_reparto',      label: 'En reparto'      },
  { value: 'entrega_fallida', label: 'Entrega fallida' },
  { value: 'anulado',         label: 'Anulado'         },
]

const PRIMARY_ACTION: Partial<Record<EstadoPedido, { label: string; labelCorto: string; next: EstadoPedido }>> = {
  borrador:        { label: 'Confirmar',           labelCorto: 'Confirmar',    next: 'confirmado'    },
  confirmado:      { label: 'Enviar a producción', labelCorto: 'A producción', next: 'en_produccion' },
  en_produccion:   { label: 'Marcar listo',        labelCorto: 'Marcar listo', next: 'listo_reparto' },
  listo_reparto:   { label: 'Iniciar reparto',     labelCorto: 'A reparto',    next: 'en_reparto'    },
  en_reparto:      { label: 'Cerrar pedido',       labelCorto: 'Cerrar',       next: 'cerrado'       },
  entrega_fallida: { label: 'Reagendar',           labelCorto: 'Reagendar',    next: 'listo_reparto' },
}

const hoy = new Date().toISOString().slice(0, 10)

function fechaColor(fecha: string | null, estado: EstadoPedido): string {
  if (!fecha) return '#4A5568'
  if (fecha === hoy) return '#0D5C8A'
  const activo = !['cerrado', 'anulado', 'entregado'].includes(estado)
  if (fecha < hoy && activo) return '#D32F2F'
  return '#4A5568'
}

function fechaLabel(fecha: string | null): string {
  if (!fecha) return '—'
  const d = new Date(fecha + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function ShimmerRow() {
  return (
    <tr>
      {[60, 160, 80, 90, 70, 80].map((w, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <Skeleton style={{ height: 14, width: w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

function ShimmerCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', borderLeft: '3px solid #D1D5DB' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Skeleton style={{ height: 12, width: 60, borderRadius: 6 }} />
        <Skeleton style={{ height: 12, width: 50, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Skeleton style={{ height: 14, width: 140, borderRadius: 6 }} />
        <Skeleton style={{ height: 12, width: 50, borderRadius: 6 }} />
      </div>
      <Skeleton style={{ height: 11, width: 180, borderRadius: 6 }} />
    </div>
  )
}

// ─── Dropdown de acciones (desktop) ──────────────────────────────────────────

function AccionesDropdown({ pedido, onVerDetalle, onEditar, onAnular }: {
  pedido:       PedidoListItem
  onVerDetalle: () => void
  onEditar:     () => void
  onAnular:     () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const canEditar = !['cerrado', 'anulado'].includes(pedido.estado)
  const canAnular = !['cerrado', 'anulado'].includes(pedido.estado)

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Más acciones"
        aria-haspopup="true"
        aria-expanded={open}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500"
        style={{
          background: open ? '#F4F6F8' : 'transparent',
          border: '1px solid #D1D5DB',
          borderRadius: 6,
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#4A5568', flexShrink: 0,
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: 32,
            background: '#fff', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: '1px solid #E5E7EB',
            minWidth: 160, zIndex: 300,
            padding: '4px 0',
          }}
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onVerDetalle() }}
            style={menuItemStyle}
          >
            Ver detalle
          </button>
          {canEditar && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onEditar() }}
              style={menuItemStyle}
            >
              Editar
            </button>
          )}
          {canAnular && (
            <>
              <div style={{ borderTop: '1px solid #F4F6F8', margin: '4px 0' }} />
              <button
                role="menuitem"
                onClick={() => { setOpen(false); onAnular() }}
                style={{ ...menuItemStyle, color: '#D32F2F' }}
              >
                Anular
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 14px', background: 'none', border: 'none',
  fontSize: 13, cursor: 'pointer', color: '#1A2B3C',
}

// ─── Modal de anulación ───────────────────────────────────────────────────────

function ModalAnular({ pedido, onConfirm, onCancel, loading }: {
  pedido:    PedidoListItem
  onConfirm: (motivo: string) => void
  onCancel:  () => void
  loading:   boolean
}) {
  const [motivo, setMotivo] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anular pedido"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: 24,
          width: '100%', maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        }}
      >
        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1A2B3C' }}>
          Anular pedido P-{String(pedido.numero).padStart(5, '0')}
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4A5568' }}>
          Esta acción no se puede deshacer.
        </p>
        <textarea
          ref={inputRef}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Motivo de anulación…"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px',
            border: '1.5px solid #D1D5DB', borderRadius: 10,
            fontSize: 13, resize: 'none', fontFamily: 'Inter, sans-serif',
            outline: 0, boxSizing: 'border-box', marginBottom: 12,
          }}
          onFocus={e => (e.target.style.borderColor = '#D32F2F')}
          onBlur={e  => (e.target.style.borderColor = '#D1D5DB')}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onConfirm(motivo.trim())}
            disabled={loading || !motivo.trim()}
            style={{
              flex: 1, background: motivo.trim() ? '#D32F2F' : 'rgba(211,47,47,0.4)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px', fontSize: 14, fontWeight: 700,
              cursor: motivo.trim() ? 'pointer' : 'not-allowed', minHeight: 44,
            }}
          >
            {loading ? 'Anulando…' : 'Confirmar anulación'}
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1, background: 'transparent', color: '#4A5568',
              border: '1.5px solid #D1D5DB', borderRadius: 10,
              padding: '10px', fontSize: 14, cursor: 'pointer', minHeight: 44,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila de tabla (desktop) ──────────────────────────────────────────────────

function FilaPedido({ pedido, onVerDetalle, onEditar, onAnularRequest, selected, onSelect, onToast }: {
  pedido:          PedidoListItem
  onVerDetalle:    () => void
  onEditar:        () => void
  onAnularRequest: () => void
  selected?:       boolean
  onSelect?:       () => void
  onToast?:        (msg: string, type: 'success' | 'error') => void
}) {
  const cambiarEstado = useCambiarEstado()
  const { compartir, loading: loadingWA } = useCompartirFactura()
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleWhatsapp = async () => {
    try {
      const detalle = await fetchPedidoDetalle(pedido.id)
      await compartir(detalle, msg => onToast?.(msg, 'error'))
    } catch {
      onToast?.('No se pudo generar la imagen', 'error')
    }
  }

  const cfg     = ESTADO_CONFIG[pedido.estado]
  const total   = Number(totalPedido(pedido))
  const action  = PRIMARY_ACTION[pedido.estado]
  const nextCfg = action ? ESTADO_CONFIG[action.next] : null
  const vencida = pedido.fecha_produccion && pedido.fecha_produccion < hoy &&
    !['cerrado', 'anulado', 'entregado'].includes(pedido.estado)

  const handleAccion = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!action) return
    if (pedido.estado === 'en_reparto') { onVerDetalle(); return }
    setLoading(true)
    setError(null)
    try {
      await cambiarEstado.mutateAsync({ id: pedido.id, estadoActual: pedido.estado, estado: action.next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  const fColor = fechaColor(pedido.fecha_produccion, pedido.estado)
  const fBold  = pedido.fecha_produccion === hoy

  const baseBg = selected ? '#EFF6FF' : vencida ? '#FFF8F8' : '#fff'
  const hoverBg = selected ? '#DBEAFE' : vencida ? '#FFF0F0' : '#F4F6F8'

  return (
    <tr
      style={{ background: baseBg, cursor: onSelect ? 'pointer' : 'default' }}
      onClick={onSelect}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = hoverBg)}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = baseBg)}
    >
      {/* N° pedido */}
      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onSelect && (
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              background: selected ? '#0D5C8A' : '#fff',
              border: `1.5px solid ${selected ? '#0D5C8A' : '#D1D5DB'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D5C8A', fontVariantNumeric: 'tabular-nums' }}>
            P-{String(pedido.numero).padStart(5, '0')}
          </span>
        </div>
      </td>

      {/* Cliente + dirección */}
      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #F4F6F8', maxWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#1A2B3C' }}>
            {pedido.clientes?.nombre ?? '—'}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
            background: pedido.tipo_precio === 'mayorista' ? '#E8F4FF' : '#F4F6F8',
            color:      pedido.tipo_precio === 'mayorista' ? '#1B9ED6' : '#4A5568',
            flexShrink: 0,
          }}>
            {pedido.tipo_precio === 'mayorista' ? 'MAYORISTA' : 'MINORISTA'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pedido.direccion_entrega ?? '—'}
        </div>
      </td>

      {/* Fecha prod. */}
      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 12, color: fColor, fontWeight: fBold ? 600 : 400 }}>
          {fechaLabel(pedido.fecha_produccion)}
        </span>
      </td>

      {/* Estado */}
      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #F4F6F8' }}>
        <span style={{
          backgroundColor: cfg.bg,
          color: cfg.color,
          fontSize: 9, fontWeight: 700,
          padding: '2px 8px', borderRadius: 99,
          display: 'inline-block', whiteSpace: 'nowrap',
        }}>
          {cfg.label}
        </span>
      </td>

      {/* Total */}
      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #F4F6F8', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B3C' }}>
          ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
        {pedido.total_manual && (
          <div style={{ fontSize: 9, color: '#F57C00', fontWeight: 600 }}>MANUAL</div>
        )}
      </td>

      {/* Acciones */}
      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #F4F6F8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {error && (
            <span style={{ fontSize: 10, color: '#D32F2F', maxWidth: 100 }}>{error}</span>
          )}
          {action && nextCfg && (
            <button
              onClick={handleAccion}
              disabled={loading}
              aria-label={`${action.label} pedido P-${String(pedido.numero).padStart(5, '0')}`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500"
              style={{
                height: 28, padding: '0 10px',
                background: loading ? `${nextCfg.color}80` : nextCfg.color,
                color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 11, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {loading ? '…' : action.labelCorto}
            </button>
          )}
          <BtnWhatsapp
            variante="icono"
            onClick={handleWhatsapp}
            loading={loadingWA}
            numeroLabel={formatNumero(pedido.numero)}
          />
          <AccionesDropdown
            pedido={pedido}
            onVerDetalle={onVerDetalle}
            onEditar={onEditar}
            onAnular={onAnularRequest}
          />
        </div>
      </td>
    </tr>
  )
}

// ─── Card mobile expandible ───────────────────────────────────────────────────

function CardMobile({ pedido, expandida, onToggle, onVerDetalle, onAnularRequest }: {
  pedido:          PedidoListItem
  expandida:       boolean
  onToggle:        () => void
  onVerDetalle:    () => void
  onAnularRequest: () => void
}) {
  const cambiarEstado = useCambiarEstado()
  const [loading,    setLoading]    = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const cfg    = ESTADO_CONFIG[pedido.estado]
  const total  = Number(totalPedido(pedido))
  const action = PRIMARY_ACTION[pedido.estado]
  const nextCfg = action ? ESTADO_CONFIG[action.next] : null
  const canAnular = !['cerrado', 'anulado'].includes(pedido.estado)

  const handleAccion = async () => {
    if (!action) return
    if (pedido.estado === 'en_reparto') { onVerDetalle(); return }
    setLoading(true)
    setError(null)
    try {
      await cambiarEstado.mutateAsync({ id: pedido.id, estadoActual: pedido.estado, estado: action.next })
      setConfirmando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      borderLeft: `3px solid ${cfg.color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      {/* Cabecera clickeable */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
        }}
        aria-expanded={expandida}
        aria-label={`Pedido P-${String(pedido.numero).padStart(5, '0')} — ${pedido.clientes?.nombre ?? ''}`}
      >
        {/* Línea 1 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D5C8A', fontVariantNumeric: 'tabular-nums' }}>
            P-{String(pedido.numero).padStart(5, '0')}
          </span>
          <span style={{
            marginLeft: 8,
            backgroundColor: cfg.bg, color: cfg.color,
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
          }}>
            {cfg.label}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#1A2B3C' }}>
            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        {/* Línea 2 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B3C', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pedido.clientes?.nombre ?? '—'}
          </span>
          <span style={{
            fontSize: 11, flexShrink: 0, marginLeft: 8,
            color: fechaColor(pedido.fecha_produccion, pedido.estado),
            fontWeight: pedido.fecha_produccion === hoy ? 600 : 400,
          }}>
            {fechaLabel(pedido.fecha_produccion)}
          </span>
        </div>
        {/* Línea 3 */}
        {pedido.direccion_entrega && (
          <div style={{ fontSize: 11, color: '#4A5568' }}>
            {pedido.direccion_entrega}
          </div>
        )}
      </button>

      {/* Panel expandible */}
      <div style={{
        maxHeight: expandida ? 300 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease',
      }}>
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F4F6F8' }}>
          {confirmando && action && nextCfg ? (
            <div style={{ paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B3C', flex: 1 }}>
                ¿Confirmás?
              </span>
              <button
                onClick={handleAccion}
                disabled={loading}
                style={{
                  background: nextCfg.color, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 16px', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer', minHeight: 36,
                }}
              >
                {loading ? '…' : 'Sí'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                style={{
                  background: 'transparent', color: '#4A5568',
                  border: '1.5px solid #D1D5DB', borderRadius: 8,
                  padding: '8px 16px', fontSize: 13, cursor: 'pointer', minHeight: 36,
                }}
              >
                No
              </button>
            </div>
          ) : (
            <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {action && nextCfg && (
                <button
                  onClick={() => {
                    if (pedido.estado === 'en_reparto') { onVerDetalle(); return }
                    setConfirmando(true)
                  }}
                  className="btn-press"
                  style={{
                    width: '100%', background: nextCfg.color, color: '#fff',
                    border: 'none', borderRadius: 10, height: 48,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {action.label}
                </button>
              )}
              <button
                onClick={onVerDetalle}
                style={{
                  background: 'none', border: 'none',
                  color: '#1B9ED6', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', padding: '4px 0', textAlign: 'center',
                }}
              >
                Ver detalle completo →
              </button>
              {canAnular && (
                <button
                  onClick={onAnularRequest}
                  style={{
                    background: 'none', border: 'none',
                    color: '#D32F2F', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', padding: '2px 0', textAlign: 'center',
                  }}
                >
                  Anular
                </button>
              )}
              {error && (
                <p style={{ color: '#D32F2F', fontSize: 12, margin: 0, textAlign: 'center' }} role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pills de filtro ──────────────────────────────────────────────────────────

function PillsFiltro({ pedidos, estadoFiltro, setEstado }: {
  pedidos:      PedidoListItem[] | undefined
  estadoFiltro: EstadoPedido | ''
  setEstado:    (v: EstadoPedido | '') => void
}) {
  const [masOpen, setMasOpen] = useState(false)
  const masRef       = useRef<HTMLDivElement>(null)
  const masButtonRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!masOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (masRef.current && !masRef.current.contains(e.target as Node)) setMasOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMasOpen(false); masButtonRef.current?.focus() }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [masOpen])

  useEffect(() => {
    if (masOpen) firstItemRef.current?.focus()
  }, [masOpen])

  const masActivo = PILLS_MAS.some(p => p.value === estadoFiltro)

  const getCount = (value: EstadoPedido | '') =>
    value && pedidos ? pedidos.filter(p => p.estado === value).length : null

  const pillBase = (active: boolean): React.CSSProperties => ({
    flexShrink: 0, height: 32,
    padding: '0 14px', borderRadius: 99,
    border: `0.5px solid ${active ? '#0D5C8A' : '#D1D5DB'}`,
    background: active ? '#0D5C8A' : '#fff',
    color: active ? '#fff' : '#4A5568',
    fontSize: 12, fontWeight: active ? 600 : 400,
    cursor: 'pointer', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: 5,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {PILLS_PRIMARIOS.map(e => {
        const isActive = estadoFiltro === e.value
        const count = getCount(e.value)
        return (
          <button key={e.value} onClick={() => setEstado(e.value)} style={pillBase(isActive)}>
            {e.label}
            {count !== null && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : '#F0F0F0',
                borderRadius: 99, padding: '0 5px',
                fontSize: 10, fontWeight: 700, lineHeight: '16px',
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}

      {/* Botón "Más ↓" */}
      <div ref={masRef} style={{ position: 'relative' }}>
        <button
          ref={masButtonRef}
          onClick={() => setMasOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={masOpen}
          style={{
            ...pillBase(false),
            borderColor: masActivo ? '#0D5C8A' : '#D1D5DB',
            color:       masActivo ? '#0D5C8A' : '#4A5568',
          }}
        >
          Más <ChevronDown size={12} />
        </button>

        {masOpen && (
          <div
            role="listbox"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              zIndex: 50, minWidth: 180, padding: '4px 0',
            }}
          >
            {PILLS_MAS.map((e, i) => {
              const isActive = estadoFiltro === e.value
              const count = getCount(e.value)
              return (
                <button
                  key={e.value}
                  ref={i === 0 ? firstItemRef : undefined}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setEstado(e.value); setMasOpen(false) }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '8px 14px',
                    background: 'none', border: 'none',
                    fontSize: 12, cursor: 'pointer',
                    color: isActive ? '#0D5C8A' : '#4A5568',
                    fontWeight: isActive ? 500 : 400,
                    textAlign: 'left',
                  }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = '#F4F6F8')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                >
                  {e.label}
                  {count !== null && (
                    <span style={{
                      fontSize: 10, fontWeight: 500, color: '#4A5568',
                      background: '#F4F6F8', borderRadius: 99, padding: '1px 6px',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const [q, setQ]                   = useState('')
  const [estadoFiltro, setEstado]   = useState<EstadoPedido | ''>('')
  const [drawerForm, setDrawerForm] = useState(false)
  const [drawerDet, setDrawerDet]   = useState(false)
  const [pedidoEdit, setPedidoEdit] = useState<PedidoDetalle | null>(null)
  const [pedidoSelId, setSelId]     = useState<string | null>(null)
  const [expandidaId, setExpandida] = useState<string | null>(null)
  const [anularPedido, setAnularPedido] = useState<PedidoListItem | null>(null)
  const [anularLoading, setAnularLoading] = useState(false)

  const [modoSeleccion,  setModoSeleccion]  = useState(false)
  const [seleccionados,  setSeleccionados]  = useState<Set<string>>(new Set())

  const { toasts, show, dismiss } = useToast()
  const anular = useAnularPedido()

  const { data: pedidos, isLoading } = usePedidos({
    estado: estadoFiltro || undefined,
    q:      q || undefined,
  })

  const handleNuevo     = () => { setPedidoEdit(null); setDrawerForm(true) }
  const handleVerDetalle = (id: string) => { setSelId(id); setDrawerDet(true) }
  const handleEditar    = (p: PedidoDetalle) => { setPedidoEdit(p); setDrawerDet(false); setDrawerForm(true) }
  const handleSaved     = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else show(msg, 'success')
  }

  const handleToggleCard = useCallback((id: string) => {
    setExpandida(prev => prev === id ? null : id)
  }, [])

  const handleConfirmarAnular = async (motivo: string) => {
    if (!anularPedido || !motivo) return
    setAnularLoading(true)
    try {
      await anular.mutateAsync({ id: anularPedido.id, motivo, estadoActual: anularPedido.estado })
      show('Pedido anulado', 'success')
      setAnularPedido(null)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error al anular', 'error')
    } finally {
      setAnularLoading(false)
    }
  }

  const toggleSeleccion = (id: string) =>
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const imprimirSeleccionados = () => {
    if (!seleccionados.size) return
    window.open(`/print/facturas?ids=${Array.from(seleccionados).join(',')}`, '_blank')
  }

  const nSel = seleccionados.size

  return (
    <div style={{ paddingBottom: nSel > 0 ? 80 : 0, animation: 'fadeSlideIn 0.18s ease' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        .pedidos-table { width: 100%; border-collapse: collapse; }
        .pedidos-table tr { transition: background 0.15s; }
        @media (max-width: 1023px) { .pedidos-desktop { display: none !important; } }
        @media (min-width: 1024px) { .pedidos-mobile  { display: none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="section-title">Pedidos</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!modoSeleccion ? (
            <>
              <button
                onClick={() => setModoSeleccion(true)}
                style={{
                  background: '#fff', color: '#4A5568',
                  border: '1.5px solid #D1D5DB', borderRadius: 10,
                  padding: '8px 14px', minHeight: 40, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Printer size={14} /> Imprimir
              </button>
              <button onClick={handleNuevo} style={{
                background: '#0D5C8A', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 16px', minHeight: 40,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={16} /> Nuevo pedido
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#4A5568', fontWeight: 600 }}>
                {nSel} seleccionado{nSel !== 1 ? 's' : ''}
              </span>
              {nSel > 0 && (
                <button
                  onClick={imprimirSeleccionados}
                  style={{
                    background: '#0D5C8A', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '8px 14px', minHeight: 40,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Printer size={14} /> Imprimir facturas
                </button>
              )}
              <button
                onClick={() => { setModoSeleccion(false); setSeleccionados(new Set()) }}
                style={{
                  background: 'transparent', color: '#4A5568',
                  border: '1.5px solid #D1D5DB', borderRadius: 10,
                  padding: '8px 12px', minHeight: 40, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <X size={14} /> Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
      <div className="pedidos-desktop">
        {/* Filtros desktop: pills + buscador en la misma fila */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PillsFiltro pedidos={pedidos} estadoFiltro={estadoFiltro} setEstado={setEstado} />
          </div>
          <div style={{ position: 'relative', flexShrink: 0, width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4A5568' }} />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar…"
              style={{
                width: '100%', padding: '7px 10px 7px 30px',
                border: '1px solid #D1D5DB', borderRadius: 8,
                fontSize: 13, outline: 0, background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table className="pedidos-table" role="grid" aria-label="Listado de pedidos">
            <thead>
              <tr style={{ borderBottom: '1px solid #D1D5DB' }}>
                {['N° Pedido', 'Cliente', 'Fecha prod.', 'Estado', 'Total', 'Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 12px',
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: '#4A5568',
                      textAlign: i >= 4 ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <ShimmerRow key={i} />)
              ) : !pedidos?.length ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <ShoppingCart size={40} strokeWidth={1.2} color="#D1D5DB" />
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>Sin pedidos</p>
                      <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>
                        {q || estadoFiltro ? 'No hay pedidos para este filtro' : 'Creá el primer pedido del día'}
                      </p>
                      {!(q || estadoFiltro) && (
                        <button onClick={handleNuevo} className="btn-press" style={{
                          marginTop: 4, background: '#0D5C8A', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', minHeight: 40,
                        }}>
                          + Nuevo pedido
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pedidos.map(p => (
                  <FilaPedido
                    key={p.id}
                    pedido={p}
                    onVerDetalle={() => handleVerDetalle(p.id)}
                    onEditar={() => handleVerDetalle(p.id)}
                    onAnularRequest={() => setAnularPedido(p)}
                    selected={seleccionados.has(p.id)}
                    onSelect={modoSeleccion ? () => toggleSeleccion(p.id) : undefined}
                    onToast={(msg, type) => type === 'error' ? show(msg, 'error') : show(msg, 'success')}
                  />
                ))
              )}
            </tbody>
          </table>

          {!isLoading && !!pedidos?.length && (
            <div style={{ padding: '10px 12px', borderTop: '0.5px solid #F4F6F8' }}>
              <span style={{ fontSize: 12, color: '#4A5568' }}>
                {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────────── */}
      <div className="pedidos-mobile">
        {/* Buscador mobile encima de las pills */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4A5568' }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por N° o cliente…"
            style={{
              width: '100%', padding: '10px 10px 10px 36px',
              border: '1px solid #D1D5DB', borderRadius: 10,
              fontSize: 14, outline: 0, background: '#fff',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <PillsFiltro pedidos={pedidos} estadoFiltro={estadoFiltro} setEstado={setEstado} />
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />)}
          </div>
        ) : !pedidos?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
            <ShoppingCart size={40} strokeWidth={1.2} color="#D1D5DB" />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>Sin pedidos</p>
            <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>
              {q || estadoFiltro ? 'No hay pedidos para este filtro' : 'Creá el primer pedido del día'}
            </p>
            {!(q || estadoFiltro) && (
              <button onClick={handleNuevo} className="btn-press" style={{
                background: '#0D5C8A', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer', minHeight: 44,
              }}>
                + Nuevo pedido
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pedidos.map(p => (
              <CardMobile
                key={p.id}
                pedido={p}
                expandida={!modoSeleccion && expandidaId === p.id}
                onToggle={() => modoSeleccion ? toggleSeleccion(p.id) : handleToggleCard(p.id)}
                onVerDetalle={() => handleVerDetalle(p.id)}
                onAnularRequest={() => setAnularPedido(p)}
              />
            ))}
            <p style={{ fontSize: 12, color: '#4A5568', textAlign: 'center', marginTop: 4 }}>
              {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
        )}
      </div>

      {/* Barra flotante de selección */}
      {modoSeleccion && nSel > 0 && (
        <div style={{
          position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)',
          background: '#1A2B3C', color: '#fff', borderRadius: 99, padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 14, zIndex: 100,
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {nSel} pedido{nSel !== 1 ? 's' : ''} seleccionado{nSel !== 1 ? 's' : ''}
          </span>
          <button
            onClick={imprimirSeleccionados}
            style={{
              background: '#0D5C8A', color: '#fff', border: 'none', borderRadius: 20,
              padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Printer size={14} /> Imprimir facturas
          </button>
        </div>
      )}

      {/* Modal anular */}
      {anularPedido && (
        <ModalAnular
          pedido={anularPedido}
          onConfirm={handleConfirmarAnular}
          onCancel={() => setAnularPedido(null)}
          loading={anularLoading}
        />
      )}

      <DrawerPedido
        key={pedidoEdit?.id ?? 'new'}
        open={drawerForm}
        onClose={() => { setDrawerForm(false); setPedidoEdit(null) }}
        pedido={pedidoEdit}
        onSaved={handleSaved}
      />

      <DrawerDetalle
        open={drawerDet}
        pedidoId={pedidoSelId}
        onClose={() => { setDrawerDet(false); setSelId(null) }}
        onEditar={handleEditar}
        onSaved={handleSaved}
      />

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
