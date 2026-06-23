import { useState } from 'react'
import {
  IconCash, IconBuildingBank, IconClock, IconX, IconChevronRight,
} from '@tabler/icons-react'
import { BadgeEstado }   from '@/components/common/BadgeEstado'
import { SelectorFecha } from '@/components/common/SelectorFecha'
import { Skeleton }      from '@/components/ui/skeleton'
import { usePedidos, usePedidoDetalle, totalPedido } from '@/services/pedidos'
import { ESTADO_CONFIG } from '@/types'

// ─── Date helpers ──────────────────────────────────────────────────────────────

const _d  = new Date()
const HOY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

const DIAS_CORTO  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

function labelFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  return `${DIAS_CORTO[d.getDay()].toLowerCase()} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
}

// ─── Expanded items — lazy load ───────────────────────────────────────────────

function ExpandedItemsHistorial({ pedidoId }: { pedidoId: string }) {
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
            <span style={{ fontSize: 12, color: '#4A5568' }}>
              {prod?.nombre ?? '—'}
              {prod?.presentacion ? ` · ${prod.presentacion}L` : ''}
              {' · '}{item.cantidad}
            </span>
            {item.bidon_nuevo && (
              <span style={{
                fontSize: 9, fontWeight: 500,
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

// ─── Historial card ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CardHistorial({ pedido }: { pedido: any }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const cfg    = ESTADO_CONFIG[pedido.estado as keyof typeof ESTADO_CONFIG]
  const total  = Number(totalPedido(pedido))
  const numStr = `P-${String(pedido.numero).padStart(5, '0')}`

  const formaIcon = pedido.forma_cobro === 'efectivo'
    ? <IconCash size={13} color="#2E9E5C" style={{ flexShrink: 0 }} />
    : pedido.forma_cobro === 'transferencia'
    ? <IconBuildingBank size={13} color="#1565C0" style={{ flexShrink: 0 }} />
    : <IconClock size={13} color="#F57C00" style={{ flexShrink: 0 }} />

  return (
    <div
      style={{
        background:   '#fff',
        borderRadius: 10,
        border:       '0.5px solid #D1D5DB',
        borderLeft:   `3px solid ${cfg.color}`,
        marginBottom: 6,
        overflow:     'hidden',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${numStr}, ${pedido.clientes?.nombre ?? ''}`}
        onClick={() => setIsExpanded(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(v => !v) }
        }}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B9ED6] focus-visible:ring-offset-2"
        style={{ padding: '12px 14px', cursor: 'pointer' }}
      >
        {/* Line 1: número · badge · spacer · total · chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#0D5C8A', whiteSpace: 'nowrap' }}>
            {numStr}
          </span>
          <BadgeEstado estado={pedido.estado} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2B3C', whiteSpace: 'nowrap' }}>
            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
          <IconChevronRight
            size={14}
            color="#D1D5DB"
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

        {/* Line 3: dirección (izq) · spacer · forma de cobro o falla (der) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pedido.clientes?.direccion
            ? <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C' }}>{pedido.clientes.direccion}</span>
            : <span style={{ fontSize: 11, fontStyle: 'italic', color: '#D1D5DB' }}>Sin dirección</span>
          }
          <div style={{ flex: 1 }} />
          {pedido.estado === 'entrega_fallida' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <IconX size={13} color="#D32F2F" />
              <span style={{ fontSize: 11, color: '#D32F2F' }}>fallida</span>
            </div>
          ) : pedido.forma_cobro ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {formaIcon}
              <span style={{ fontSize: 11, color: '#4A5568' }}>{pedido.forma_cobro}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Ítems expandidos */}
      {isExpanded && (
        <div>
          <div style={{ borderTop: '0.5px solid #F4F6F8' }} />
          <ExpandedItemsHistorial pedidoId={pedido.id} />
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HistorialPage() {
  const [fechaHistorial, setFechaHistorial] = useState(HOY)
  const esHoy = fechaHistorial === HOY

  const { data: pedidos = [], isLoading } = usePedidos({
    fechaProduccion: fechaHistorial,
    estados: ['cerrado', 'entrega_fallida'],
  })

  const pedidosOrdenados = [...pedidos].sort((a, b) => b.numero - a.numero)

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      {/* Selector de fecha — encima del listado */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <SelectorFecha fecha={fechaHistorial} onChange={setFechaHistorial} />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2].map(i => <Skeleton key={i} style={{ height: 78, borderRadius: 10 }} />)}
        </div>

      ) : !pedidosOrdenados.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
          <IconClock size={40} strokeWidth={1.2} color="#D1D5DB" />
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>Sin registros</p>
          <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>
            No hay entregas registradas para el {labelFechaLarga(fechaHistorial)}
          </p>
          {!esHoy && (
            <button
              onClick={() => setFechaHistorial(HOY)}
              className="btn-press"
              style={{
                background: 'none', border: '1px solid #D1D5DB', color: '#0D5C8A',
                fontSize: 13, cursor: 'pointer', borderRadius: 8,
                padding: '8px 16px', fontFamily: 'Inter, sans-serif', minHeight: 36,
              }}
            >
              Ver hoy →
            </button>
          )}
        </div>

      ) : (
        <div>
          {pedidosOrdenados.map(p => (
            <CardHistorial key={p.id} pedido={p} />
          ))}
        </div>
      )}
    </div>
  )
}
