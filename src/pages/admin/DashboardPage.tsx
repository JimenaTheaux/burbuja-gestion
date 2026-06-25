import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart, registerables, type TooltipItem } from 'chart.js'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { BadgeEstado } from '@/components/common/BadgeEstado'
import { BtnWhatsapp } from '@/components/common/BtnWhatsapp'
import { useEditarCobro, fetchPedidoDetalle } from '@/services/pedidos'
import { useCompartirFactura } from '@/hooks/useCompartirFactura'
import { useDashboard } from '@/services/produccion'
import { ESTADO_CONFIG, formatNumero, CATEGORIA_EGRESO_LABELS, type EstadoPedido, type CategoriaEgreso } from '@/types'
import type { PedidoPendienteCobro } from '@/services/produccion'
import { supabase } from '@/lib/supabase'

Chart.register(...registerables)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PedidoItemRow {
  cantidad:    number
  producto_id: string
  productos?:  { nombre: string; presentacion: number } | null
}

interface PedidoRow {
  id:               string
  estado:           EstadoPedido
  fecha_produccion: string | null
  pedido_items?:    PedidoItemRow[]
}

interface CobroRow {
  id:            string
  forma_cobro:   string | null
  monto_cobrado: string | null
  fecha_cobro:   string | null
}

type EgresoItem = {
  monto:        number | string
  categoria:    string
  fecha_egreso: string
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function primerDiaMes(): string {
  const hoy = new Date()
  return fmtDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
}

function restarUnMes(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Pedidos por created_at — para conteos y panel de estados
function usePedidosPeriodo(inicio: string, fin: string) {
  return useQuery({
    queryKey:        ['pedidos', 'dash-periodo', inicio, fin],
    placeholderData: keepPreviousData,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, estado, fecha_produccion, pedido_items(cantidad, producto_id, productos(nombre, presentacion))')
        .gte('created_at', inicio)
        .lte('created_at', fin + 'T23:59:59')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as PedidoRow[]
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

// Cobros por fecha_cobro — para KPIs de dinero
function useCobrosperiodo(inicio: string, fin: string) {
  return useQuery({
    queryKey:        ['pedidos', 'dash-cobros', inicio, fin],
    placeholderData: keepPreviousData,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, forma_cobro, monto_cobrado, fecha_cobro')
        .eq('estado', 'cerrado')
        .gte('fecha_cobro', inicio)
        .lte('fecha_cobro', fin)
      if (error) throw new Error(error.message)
      return (data ?? []) as CobroRow[]
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

type EvolItem = {
  monto_cobrado: string | null
  fecha_cobro:   string | null
  estado_pago:   string | null
  forma_cobro:   string | null
}

// Chart: cubre período actual + mes anterior, filtrado por fecha_cobro
function useEvolucionRango(desde: string, hasta: string) {
  const mesAnteriorDesde = restarUnMes(desde)
  return useQuery({
    queryKey:        ['pedidos', 'dash-evolucion-rango', desde, hasta],
    placeholderData: keepPreviousData,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('monto_cobrado, fecha_cobro, estado_pago, forma_cobro')
        .eq('estado', 'cerrado')
        .gte('fecha_cobro', mesAnteriorDesde)
        .lte('fecha_cobro', hasta)
      if (error) throw new Error(error.message)
      return (data ?? []) as EvolItem[]
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

function useEgresosDashboard(desde: string, hasta: string) {
  return useQuery({
    queryKey:        ['dashboard-egresos', desde, hasta],
    placeholderData: keepPreviousData,
    queryFn:  async () => {
      const { data } = await supabase
        .from('egresos')
        .select('monto, categoria, fecha_egreso')
        .gte('fecha_egreso', desde)
        .lte('fecha_egreso', hasta)
      return (data ?? []) as EgresoItem[]
    },
    staleTime: 1000 * 60 * 3,
  })
}

// ─── Calculation helpers ──────────────────────────────────────────────────────

function esCobrado(p: { estado: string; estado_pago: string | null; forma_cobro: string | null }): boolean {
  if (p.estado !== 'cerrado') return false
  if (p.estado_pago === 'cobrado') return true
  return p.estado_pago == null && !!p.forma_cobro && p.forma_cobro !== 'pendiente'
}

// Pedidos por fecha_produccion: conteos y distribución de estados
function calcKPIs(pedidos: PedidoRow[]) {
  const pendCierre = pedidos.filter(p => !['cerrado', 'anulado'].includes(p.estado)).length
  const porEstado: Record<string, number> = {}
  for (const p of pedidos) porEstado[p.estado] = (porEstado[p.estado] || 0) + 1
  return { pendCierre, porEstado, count: pedidos.length }
}

// Cobros por fecha_cobro: totales de dinero
function calcCobrosKPI(cobros: CobroRow[]) {
  const totalCob = cobros.reduce((a, p) => a + (Number(p.monto_cobrado) || 0), 0)
  const totalEf  = cobros.filter(p => p.forma_cobro === 'efectivo')
                         .reduce((a, p) => a + (Number(p.monto_cobrado) || 0), 0)
  const totalTr  = cobros.filter(p => p.forma_cobro === 'transferencia')
                         .reduce((a, p) => a + (Number(p.monto_cobrado) || 0), 0)
  return { totalCob, totalEf, totalTr }
}

function calcEvolucionRango(pedidosTodos: EvolItem[], desde: string, hasta: string) {
  const mesAnteriorDesde = restarUnMes(desde)

  const dDesde    = new Date(desde + 'T12:00:00')
  const dHasta    = new Date(hasta + 'T12:00:00')
  const totalDays = Math.round((dHasta.getTime() - dDesde.getTime()) / 86_400_000) + 1
  const porDia    = totalDays <= 31

  const byDia: Record<string, number> = {}
  for (const p of pedidosTodos) {
    if (!p.fecha_cobro || !p.monto_cobrado) continue
    if (!esCobrado({ estado: 'cerrado', estado_pago: p.estado_pago, forma_cobro: p.forma_cobro })) continue
    byDia[p.fecha_cobro] = (byDia[p.fecha_cobro] || 0) + Number(p.monto_cobrado)
  }

  const labels:   string[] = []
  const actual:   number[] = []
  const anterior: number[] = []

  if (porDia) {
    for (let i = 0; i < totalDays; i++) {
      const keyA = addDays(desde, i)
      const keyP = addDays(mesAnteriorDesde, i)
      const dA   = new Date(keyA + 'T12:00:00')
      labels.push(`${String(dA.getDate()).padStart(2, '0')}/${String(dA.getMonth() + 1).padStart(2, '0')}`)
      actual.push(byDia[keyA] || 0)
      anterior.push(byDia[keyP] || 0)
    }
  } else {
    const chunkSize = 7
    const numChunks = Math.ceil(totalDays / chunkSize)
    for (let i = 0; i < numChunks; i++) {
      const startA = addDays(desde, i * chunkSize)
      const startP = addDays(mesAnteriorDesde, i * chunkSize)
      const dA     = new Date(startA + 'T12:00:00')
      labels.push(`${String(dA.getDate()).padStart(2, '0')}/${String(dA.getMonth() + 1).padStart(2, '0')}`)
      let sumA = 0, sumP = 0
      for (let j = 0; j < chunkSize; j++) {
        sumA += byDia[addDays(startA, j)] || 0
        sumP += byDia[addDays(startP, j)] || 0
      }
      actual.push(sumA)
      anterior.push(sumP)
    }
  }

  return { labels, actual, anterior }
}

function fmtRango(desde: string, hasta: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  const d = new Date(desde + 'T12:00:00').toLocaleDateString('es-AR', opts)
  const h = new Date(hasta + 'T12:00:00').toLocaleDateString('es-AR', opts)
  return `${d} — ${h}`
}

function calcTopProductos(pedidos: PedidoRow[]) {
  const acc: Record<string, { nombre: string; presentacion: number; total: number }> = {}
  for (const p of pedidos) {
    if (p.estado !== 'cerrado') continue
    for (const item of p.pedido_items ?? []) {
      const key = item.producto_id
      if (!acc[key]) acc[key] = {
        nombre:       item.productos?.nombre       ?? '—',
        presentacion: item.productos?.presentacion ?? 0,
        total:        0,
      }
      acc[key].total += Number(item.cantidad)
    }
  }
  return Object.values(acc).sort((a, b) => b.total - a.total).slice(0, 5)
}

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function deltaCalc(cur: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function calcEgresos(egresos: EgresoItem[]) {
  const total = egresos.reduce((s, e) => s + Number(e.monto), 0)
  const byCateg: Record<string, number> = {}
  for (const e of egresos) {
    byCateg[e.categoria] = (byCateg[e.categoria] || 0) + Number(e.monto)
  }
  const top2 = Object.entries(byCateg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
  return { total, top2 }
}

// ─── GraficoLinea ─────────────────────────────────────────────────────────────

function GraficoLinea({ labels, actual, anterior }: {
  labels:   string[]
  actual:   number[]
  anterior: number[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:                'Período actual',
            data:                 actual,
            borderColor:          '#0D5C8A',
            borderWidth:          1.5,
            pointRadius:          2,
            pointBackgroundColor: '#0D5C8A',
            tension:              0.4,
            fill:                 false,
          },
          {
            label:       'Mes anterior',
            data:        anterior,
            borderColor: '#D1D5DB',
            borderWidth: 1,
            pointRadius: 0,
            tension:     0.4,
            borderDash:  [3, 3],
            fill:        false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c: TooltipItem<'line'>) =>
                ` ${c.dataset.label}: $${(c.parsed.y ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`,
            },
          },
        },
        scales: {
          x: {
            grid:   { display: false },
            ticks:  { font: { size: 10, family: 'Inter' }, color: '#9CA3AF' },
            border: { display: false },
          },
          y: { display: false },
        },
      },
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [labels, actual, anterior])

  return (
    <div style={{ height: 100, position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

// ─── FilaPendiente ────────────────────────────────────────────────────────────

function FilaPendiente({ p, onCobrado }: {
  p:         PedidoPendienteCobro
  onCobrado: (msg: string) => void
}) {
  const editarCobro = useEditarCobro()
  const { compartir, loading: loadingWA } = useCompartirFactura()
  const [abierto,    setAbierto]    = useState(false)
  const [forma,      setForma]      = useState<'efectivo' | 'transferencia'>('efectivo')
  const [monto,      setMonto]      = useState(String(Math.round(p.totalPedido)))
  const [fechaCobro, setFechaCobro] = useState(() => new Date().toISOString().split('T')[0])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const montoRef = useRef<HTMLInputElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (abierto) montoRef.current?.focus() }, [abierto])

  const dias = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86_400_000)

  const handleAbrir = () => {
    setMonto(String(Math.round(p.totalPedido)))
    setForma('efectivo')
    setFechaCobro(new Date().toISOString().split('T')[0])
    setError(null)
    setAbierto(true)
  }

  const handleConfirmar = async () => {
    if (!monto.trim()) { setError('Ingresá el monto cobrado'); return }
    setLoading(true); setError(null)
    try {
      await editarCobro.mutateAsync({
        id:          p.id,
        forma_cobro: forma,
        monto_cobrado: monto,
        estado_pago: 'cobrado',
        fecha_cobro: fechaCobro,
      })
      onCobrado(`P-${String(p.numero).padStart(5, '0')} marcado como cobrado`)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background:  abierto ? '#fff' : '#FFFDE7',
      border:      `1.5px solid ${abierto ? '#145A32' : '#F9A825'}`,
      borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      {/* Resumen */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, fontSize: 13, color: '#1A2B3C' }}>
              P-{String(p.numero).padStart(5, '0')}
            </span>
            {dias > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 500,
                background: dias > 2 ? '#FDECEA' : '#FFFDE7',
                color:      dias > 2 ? '#D32F2F' : '#F57C00',
                padding: '2px 7px', borderRadius: 99,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Clock size={9} />
                {dias === 1 ? 'ayer' : `${dias}d`}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: '#1A2B3C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.clienteNombre}
          </p>
          {p.fechaProduccion && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4A5568' }}>
              Prod: {new Date(p.fechaProduccion + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
            </p>
          )}
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4A5568' }}>
            Cobro: {p.fechaCobro
              ? new Date(p.fechaCobro + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
              : 'Sin fecha'}
          </p>
        </div>

        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: 17, color: '#0D5C8A', letterSpacing: -0.5 }}>
            {pesos(p.totalPedido)}
          </p>
          {!abierto && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <BtnWhatsapp
                variante="icono"
                loading={loadingWA}
                numeroLabel={formatNumero(p.numero)}
                onClick={async () => {
                  try {
                    const detalle = await fetchPedidoDetalle(p.id)
                    await compartir(detalle)
                  } catch {
                    // silencioso — el toast de error no está disponible aquí
                  }
                }}
              />
              <button
                ref={btnRef}
                onClick={handleAbrir}
                aria-label={`Marcar cobrado el pedido P-${String(p.numero).padStart(5, '0')}`}
                style={{
                  background: '#0D5C8A', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '7px 14px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', minHeight: 34,
                }}
              >
                Registrar cobro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mini-form cobro */}
      {abierto && (
        <div
          role="group"
          aria-label={`Registrar cobro — P-${String(p.numero).padStart(5, '0')}`}
          style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ height: 1, background: '#E8F0E8', margin: '0 0 4px' }} />

          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4A5568' }}>
              Forma de cobro
            </p>
            <div role="radiogroup" aria-label="Forma de cobro" style={{ display: 'flex', gap: 8 }}>
              {(['efectivo', 'transferencia'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={forma === f}
                  onClick={() => setForma(f)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10,
                    fontSize: 13, fontWeight: 500,
                    border:      `2px solid ${forma === f ? '#145A32' : '#D1D5DB'}`,
                    background:  forma === f ? '#D4EDDA' : '#F8F9FA',
                    color:       forma === f ? '#145A32' : '#4A5568',
                    cursor: 'pointer', transition: 'all 0.12s', minHeight: 44,
                  }}
                >
                  {f === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4A5568' }}>
              Fecha de cobro
            </p>
            <input
              type="date"
              value={fechaCobro}
              onChange={e => setFechaCobro(e.target.value)}
              style={{
                width: '100%', height: 44, padding: '0 10px',
                border: '1px solid rgba(105,105,105,0.4)',
                borderRadius: 10, fontSize: 14, fontFamily: 'Inter, sans-serif',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#1B9ED6')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(105,105,105,0.4)')}
            />
          </div>

          <div>
            <label
              htmlFor={`monto-${p.id}`}
              style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4A5568' }}
            >
              Monto cobrado *
            </label>
            <input
              ref={montoRef}
              id={`monto-${p.id}`}
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              aria-describedby={error ? `error-${p.id}` : undefined}
              aria-invalid={!!error}
              style={{
                width: '100%', padding: '11px 14px',
                border: `1.5px solid ${error ? '#D32F2F' : '#D1D5DB'}`,
                borderRadius: 10, fontSize: 15, fontFamily: 'Inter, sans-serif',
                outline: 0, boxSizing: 'border-box', transition: 'border-color 0.12s',
              }}
              onFocus={e  => (e.target.style.borderColor = '#145A32')}
              onBlur={e   => (e.target.style.borderColor = error ? '#D32F2F' : '#D1D5DB')}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmar() }}
            />
            {error && (
              <p id={`error-${p.id}`} role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: '#D32F2F' }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleConfirmar}
              disabled={loading}
              aria-disabled={loading}
              style={{
                flex: 1,
                background: loading ? 'rgba(20,90,50,0.5)' : '#145A32',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 14, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer', minHeight: 48,
              }}
            >
              {loading ? 'Guardando…' : '✓ Confirmar cobro'}
            </button>
            <button
              onClick={() => setAbierto(false)}
              disabled={loading}
              style={{
                flex: 1, background: 'transparent', color: '#4A5568',
                border: '1.5px solid #D1D5DB', borderRadius: 10,
                padding: '12px', fontSize: 14, cursor: 'pointer', minHeight: 48,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SheetPendientes ──────────────────────────────────────────────────────────

function SheetPendientes({ open, onClose, pendientes, onRefetch }: {
  open:       boolean
  onClose:    () => void
  pendientes: { count: number; total: number; pedidos: PedidoPendienteCobro[] }
  onRefetch:  () => void
}) {
  const [lista, setLista] = useState<PedidoPendienteCobro[]>(pendientes.pedidos)

  useEffect(() => { setLista(pendientes.pedidos) }, [pendientes.pedidos])

  const total = lista.reduce((acc, p) => acc + p.totalPedido, 0)

  const handleCobrado = (msg: string) => {
    const numero = parseInt(msg.match(/P-(\d+)/)?.[1] ?? '0')
    setLista(prev => prev.filter(p => p.numero !== numero))
    onRefetch()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <SheetHeader style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
          <SheetTitle style={{ fontSize: 16 }}>Pendientes de cobro</SheetTitle>
          {lista.length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4A5568' }}>
              {lista.length} pedido{lista.length !== 1 ? 's' : ''} sin cobrar
            </p>
          )}
        </SheetHeader>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>✓</p>
              <p style={{ fontWeight: 500, fontSize: 15, color: '#1A2B3C', margin: 0 }}>Todo al día</p>
              <p style={{ fontSize: 13, color: '#4A5568', margin: '4px 0 0' }}>No hay cobros pendientes</p>
            </div>
          ) : lista.map(p => (
            <FilaPendiente key={p.id} p={p} onCobrado={handleCobrado} />
          ))}
        </div>

        {lista.length > 0 && (
          <div style={{
            flexShrink: 0, padding: '16px 24px',
            borderTop: '2px solid #F0F0F0', background: '#FDECEA',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#D32F2F' }}>Total pendiente</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: '#D32F2F', letterSpacing: -0.5 }}>
              {pesos(total)}
            </span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Estados a mostrar en el panel ────────────────────────────────────────────

const ESTADOS_PANEL: EstadoPedido[] = [
  'en_produccion', 'listo_reparto', 'en_reparto', 'cerrado', 'entrega_fallida',
]

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()

  const [desde,     setDesde]    = useState<string>(primerDiaMes())
  const [hasta,     setHasta]    = useState<string>(fmtDate(new Date()))
  const [sheetPend, setSheetPend] = useState(false)

  // Pedidos por fecha_produccion (conteos, estados)
  const { data: pedidos,    isLoading } = usePedidosPeriodo(desde, hasta)
  // Cobros por fecha_cobro (totales de dinero)
  const { data: cobros }                = useCobrosperiodo(desde, hasta)
  const { data: cobrosPrev }            = useCobrosperiodo(restarUnMes(desde), restarUnMes(hasta))
  const { data: dashData, refetch }     = useDashboard()
  const { data: evolData }              = useEvolucionRango(desde, hasta)
  const { data: egresosData, isLoading: isLoadingEgresos } = useEgresosDashboard(desde, hasta)
  const { data: egresosDataPrev }       = useEgresosDashboard(restarUnMes(desde), restarUnMes(hasta))

  const kpi        = pedidos    ? calcKPIs(pedidos)       : null
  const kpiCobros  = cobros     ? calcCobrosKPI(cobros)   : null
  const kpiCobrosPrev = cobrosPrev ? calcCobrosKPI(cobrosPrev) : null
  const delta      = kpiCobros && kpiCobrosPrev ? deltaCalc(kpiCobros.totalCob, kpiCobrosPrev.totalCob) : null
  const evolucion  = evolData ? calcEvolucionRango(evolData, desde, hasta) : null
  const pendientes = dashData?.pendientes

  const kpiEgresos     = egresosData     ? calcEgresos(egresosData)     : null
  const kpiEgresosPrev = egresosDataPrev ? calcEgresos(egresosDataPrev) : null
  const totalEgresos   = kpiEgresos?.total ?? 0
  const gananciaNeta   = (kpiCobros?.totalCob ?? 0) - totalEgresos
  const gananciaPrev   = kpiCobrosPrev && kpiEgresosPrev
    ? (kpiCobrosPrev.totalCob - kpiEgresosPrev.total)
    : null
  const deltaGanancia  = gananciaPrev !== null ? deltaCalc(gananciaNeta, gananciaPrev) : null

  const todayStr = fmtDate(new Date())

  const fechaDisplay = (() => {
    const f = new Date().toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    return f.charAt(0).toUpperCase() + f.slice(1)
  })()

  const handleDesde = (val: string) => {
    if (!val) return
    if (val > hasta) { setDesde(hasta); setHasta(val) }
    else setDesde(val)
  }

  const handleHasta = (val: string) => {
    if (!val) return
    if (val < desde) { setDesde(val); setHasta(desde) }
    else setHasta(val)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 48 }}>
          <Skeleton style={{ height: 14, width: 72, borderRadius: 4 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton style={{ height: 32, width: 120, borderRadius: 6 }} />
            <Skeleton style={{ height: 32, width: 120, borderRadius: 6 }} />
            <Skeleton style={{ height: 32, width: 112, borderRadius: 6 }} />
          </div>
        </div>
        <Skeleton style={{ height: 14, width: 200, borderRadius: 4 }} />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} style={{ height: 88, borderRadius: 10 }} />)}
        </div>
        <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
          <Skeleton style={{ height: 240, borderRadius: 10 }} />
          <Skeleton style={{ height: 240, borderRadius: 10 }} />
        </div>
      </div>
    )
  }

  const card = {
    background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10, padding: '14px 16px',
  }
  const labelSt = {
    fontSize: 10, fontWeight: 500, color: '#4A5568',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    marginBottom: 10, display: 'block',
  }
  const valorSt = {
    fontSize: 22, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.5px', lineHeight: 1,
  }
  const subSt = {
    fontSize: 11, fontWeight: 400, color: '#4A5568', marginTop: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, sans-serif' }}>

      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 48, flexWrap: 'wrap', gap: 8,
      }}>
        <h1 className="section-title">Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={desde}
            onChange={e => handleDesde(e.target.value)}
            style={{
              height: 32, border: '0.5px solid #D1D5DB', borderRadius: 6,
              padding: '0 10px', fontSize: 11, fontFamily: 'Inter, sans-serif',
              color: '#1A2B3C', background: '#fff', outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#1B9ED6')}
            onBlur={e  => (e.target.style.borderColor = '#D1D5DB')}
          />
          <input
            type="date"
            value={hasta}
            onChange={e => handleHasta(e.target.value)}
            style={{
              height: 32, border: '0.5px solid #D1D5DB', borderRadius: 6,
              padding: '0 10px', fontSize: 11, fontFamily: 'Inter, sans-serif',
              color: '#1A2B3C', background: '#fff', outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#1B9ED6')}
            onBlur={e  => (e.target.style.borderColor = '#D1D5DB')}
          />
          <button
            onClick={() => window.open(`/print/listado?fecha=${todayStr}`, '_blank')}
            style={{
              height: 32, padding: '0 12px', fontSize: 11, fontWeight: 500,
              color: '#4A5568', background: '#fff',
              border: '0.5px solid #D1D5DB', borderRadius: 6,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            Listado del día
          </button>
        </div>
      </div>

      {/* ── Fecha del día ── */}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: '#4A5568' }}>
        {fechaDisplay}
      </p>

      {/* ── KPIs — 5 columnas desktop / 2 columnas mobile ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

        {/* KPI 1 — Total cobrado (filtrado por fecha_cobro) */}
        <div style={card}>
          <span style={labelSt}>Total cobrado</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>
            <span style={valorSt}>{pesos(kpiCobros?.totalCob ?? 0)}</span>
            {delta !== null && (
              <span style={{
                fontSize: 10, fontWeight: 500, borderRadius: 99, padding: '1px 6px',
                background: delta >= 0 ? '#E8F8F0' : '#FDECEA',
                color:      delta >= 0 ? '#145A32' : '#B71C1C',
                flexShrink: 0,
              }}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
              </span>
            )}
          </div>
          <p style={subSt}>
            Ef. {pesos(kpiCobros?.totalEf ?? 0)} · Tr. {pesos(kpiCobros?.totalTr ?? 0)}
          </p>
        </div>

        {/* KPI 2 — Pedidos (filtrado por fecha_produccion) */}
        <div style={card}>
          <span style={labelSt}>Pedidos</span>
          <span style={valorSt}>{kpi?.count ?? 0}</span>
          <p style={subSt}>{kpi?.pendCierre ?? 0} pendientes de cierre</p>
        </div>

        {/* KPI 3 — Pendiente de cobro */}
        <div style={{
          ...card,
          ...(pendientes && pendientes.total > 0
            ? { background: '#FFF8F8', border: '0.5px solid rgba(211,47,47,0.3)' }
            : {}
          ),
        }}>
          <span style={{
            ...labelSt,
            color: pendientes && pendientes.total > 0 ? '#D32F2F' : '#4A5568',
          }}>
            Pendiente de cobro
          </span>
          <span style={{
            ...valorSt,
            color: pendientes && pendientes.total > 0 ? '#D32F2F' : '#1A2B3C',
          }}>
            {pesos(pendientes?.total ?? 0)}
          </span>
          {pendientes && pendientes.total > 0 ? (
            <button
              onClick={() => setSheetPend(true)}
              style={{
                ...subSt, display: 'inline-block', marginTop: 4,
                color: '#D32F2F', background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif',
              }}
            >
              Ver detalle →
            </button>
          ) : (
            <p style={subSt}>Sin pendientes</p>
          )}
        </div>

        {/* KPI 4 — Egresos del período */}
        <div style={card} aria-label={`KPI: Egresos del período, ${pesos(totalEgresos)}`}>
          <span style={labelSt}>Egresos</span>
          {isLoadingEgresos ? (
            <Skeleton style={{ height: 28, width: 100, borderRadius: 4, marginBottom: 6 }} />
          ) : (
            <>
              <span style={valorSt}>{kpiEgresos ? pesos(kpiEgresos.total) : '—'}</span>
              <p style={subSt}>
                {kpiEgresos && kpiEgresos.top2.length > 0
                  ? kpiEgresos.top2
                      .map(([cat, monto]) => `${CATEGORIA_EGRESO_LABELS[cat as CategoriaEgreso] ?? cat} ${pesos(monto)}`)
                      .join(' · ')
                  : 'Sin egresos en el período'
                }
              </p>
            </>
          )}
        </div>

        {/* KPI 5 — Ganancia neta */}
        <div
          className="col-span-2 lg:col-span-1"
          style={{
            ...card,
            ...(gananciaNeta < 0 ? { background: '#FFF8F8', border: '0.5px solid rgba(211,47,47,0.25)' } : {}),
          }}
          aria-label={`KPI: Ganancia neta del período, ${pesos(gananciaNeta)}`}
        >
          <span style={labelSt}>Ganancia neta</span>
          {isLoadingEgresos ? (
            <Skeleton style={{ height: 28, width: 100, borderRadius: 4, marginBottom: 6 }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>
                <span style={{
                  ...valorSt,
                  color: gananciaNeta > 0 ? '#145A32' : gananciaNeta < 0 ? '#D32F2F' : '#1A2B3C',
                }}>
                  {pesos(gananciaNeta)}
                </span>
                {deltaGanancia !== null && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, borderRadius: 99, padding: '1px 6px',
                    background: deltaGanancia >= 0 ? '#E8F8F0' : '#FDECEA',
                    color:      deltaGanancia >= 0 ? '#145A32' : '#D32F2F',
                    flexShrink: 0,
                  }}>
                    {deltaGanancia >= 0 ? '↑' : '↓'} {Math.abs(deltaGanancia)}%
                  </span>
                )}
              </div>
              {gananciaNeta < 0 ? (
                <p style={{ ...subSt, color: '#D32F2F', fontSize: 10 }}>
                  Egresos superan los ingresos en este período
                </p>
              ) : (
                <p style={subSt}>Cobrado − Egresos</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Panel inferior — 2 columnas ── */}
      <div className="grid md:grid-cols-2 grid-cols-1 gap-3">

        {/* Panel izquierdo — Evolución de cobros (por fecha_cobro) */}
        <div style={{ background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F4F6F8' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.3px' }}>
              Evolución de ventas
            </span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 20, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.5px' }}>
              {pesos(kpiCobros?.totalCob ?? 0)}
            </span>
            {/* Leyenda custom */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#0D5C8A' }} />
                <span style={{ fontSize: 10, color: '#4A5568' }}>Período actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 14, height: 2, borderRadius: 1,
                  background: 'repeating-linear-gradient(90deg, #D1D5DB 0, #D1D5DB 3px, transparent 3px, transparent 6px)',
                }} />
                <span style={{ fontSize: 10, color: '#4A5568' }}>Mes anterior</span>
              </div>
            </div>
            {evolucion ? (
              <GraficoLinea
                labels={evolucion.labels}
                actual={evolucion.actual}
                anterior={evolucion.anterior}
              />
            ) : (
              <div style={{ height: 100, background: '#F4F6F8', borderRadius: 6 }} />
            )}
          </div>
        </div>

        {/* Panel derecho — Estado de pedidos (por fecha_produccion) */}
        <div style={{ background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F4F6F8' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.3px' }}>
              Estado de pedidos
            </span>
          </div>
          <div>
            {(() => {
              const porEst   = kpi?.porEstado ?? {}
              const visible  = ESTADOS_PANEL.filter(e =>
                e === 'entrega_fallida' ? (porEst[e] ?? 0) > 0 : true
              )
              const maxCount = Math.max(1, ...visible.map(e => porEst[e] ?? 0))

              if (visible.every(e => !(porEst[e] ?? 0))) {
                return (
                  <p style={{ fontSize: 13, color: '#4A5568', textAlign: 'center', padding: '28px 16px' }}>
                    Sin pedidos en el período
                  </p>
                )
              }

              return visible.map((estado, i) => {
                const count  = porEst[estado] ?? 0
                const cfg    = ESTADO_CONFIG[estado]
                const pct    = (count / maxCount) * 100
                const isLast = i === visible.length - 1

                return (
                  <button
                    key={estado}
                    onClick={() => navigate('/admin/pedidos')}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 16px',
                      borderBottom: isLast ? 'none' : '0.5px solid #F4F6F8',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <BadgeEstado estado={estado} />
                    <div style={{ flex: 1, height: 3, borderRadius: 99, background: '#F4F6F8' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        borderRadius: 99, background: cfg.color,
                        transition: 'width 0.4s ease',
                        minWidth: count > 0 ? 4 : 0,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C', minWidth: 20, textAlign: 'right' }}>
                      {count}
                    </span>
                  </button>
                )
              })
            })()}
          </div>
        </div>
      </div>

      {/* ── Top 5 productos más vendidos ── */}
      {(() => {
        const top5 = pedidos ? calcTopProductos(pedidos) : []
        const maxU  = top5[0]?.total ?? 1

        return (
          <div style={{ background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C' }}>Productos más vendidos</span>
              <span style={{ fontSize: 10, color: '#4A5568' }}>{fmtRango(desde, hasta)}</span>
            </div>
            {top5.length === 0 ? (
              <p style={{ fontSize: 12, color: '#4A5568', textAlign: 'center', padding: 16, margin: 0 }}>
                Sin ventas en el período seleccionado
              </p>
            ) : top5.map((prod, i) => (
              <div
                key={prod.nombre + prod.presentacion}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 16px',
                  borderBottom: i < top5.length - 1 ? '0.5px solid #F4F6F8' : 'none',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, color: '#4A5568', minWidth: 16 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {prod.nombre}
                  </span>
                  {prod.presentacion > 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: 9, color: '#4A5568',
                      background: '#F4F6F8', padding: '1px 5px', borderRadius: 4,
                      flexShrink: 0,
                    }}>
                      {prod.presentacion} L
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#0D5C8A', minWidth: 60, textAlign: 'right' }}>
                  {prod.total} u.
                </span>
                <div style={{ width: 80, height: 3, borderRadius: 99, background: '#F4F6F8', flexShrink: 0 }}>
                  <div style={{
                    width: `${(prod.total / maxU) * 100}%`,
                    height: '100%', borderRadius: 99, background: '#0D5C8A',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Sheet pendientes ── */}
      {pendientes && (
        <SheetPendientes
          open={sheetPend}
          onClose={() => setSheetPend(false)}
          pendientes={pendientes}
          onRefetch={() => refetch()}
        />
      )}
    </div>
  )
}
