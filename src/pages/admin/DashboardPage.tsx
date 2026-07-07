import { useState, useEffect, useRef } from 'react'
import { Chart, registerables, type TooltipItem } from 'chart.js'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  Share2, CheckCircle2,
  Package, Banknote, Clock, FlaskConical, BarChart2, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { FormPagos } from '@/components/pedidos/FormPagos'
import { queryKeys } from '@/lib/queryKeys'
import { fetchPedidoDetalle } from '@/services/pedidos'
import { useRegistrarPago, usePendientesCobro, type PedidoPendienteDetalle } from '@/services/pedidoPagos'
import { useCompartirFactura } from '@/hooks/useCompartirFactura'
import { formatNumero, type EstadoPedido } from '@/types'
import { supabase } from '@/lib/supabase'

Chart.register(...registerables)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PagoPeriodo {
  pedido_id:  string
  monto:      number
  forma_pago: string
  fecha_pago: string
}

interface ItemConCosto {
  cantidad:        number
  costo_snapshot:  number
  precio_unitario: number
  productos?: {
    nombre:    string
    fragancia: string | null
    categorias_producto?: { nombre: string } | null
  } | null
}

interface PedidoConItems {
  id:           string
  pedido_items: ItemConCosto[]
}

interface PedidoRow {
  id:               string
  estado:           EstadoPedido
  fecha_produccion: string | null
}

type EgresoItem = {
  monto:        number | string
  fecha_egreso: string
}

type PagoEvol = {
  monto:      number
  fecha_pago: string
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

function fmtDia(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtDiaAno(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function usePedidosPeriodo(inicio: string, fin: string) {
  return useQuery({
    queryKey:        [...queryKeys.pedidos.all(), 'dash-periodo-v2', inicio, fin],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, estado, fecha_produccion')
        .gte('fecha_produccion', inicio)
        .lte('fecha_produccion', fin)
      if (error) throw new Error(error.message)
      return (data ?? []) as PedidoRow[]
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

function usePendientesCierre() {
  return useQuery({
    queryKey:        [...queryKeys.pedidos.all(), 'pendientes-cierre'],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id')
        .not('estado', 'in', '("cerrado","anulado")')
      if (error) throw new Error(error.message)
      return (data ?? []).length
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

// Pagos del período + los pedidos (con items/costo) que generaron esos pagos.
// Se usa para KPIs de cobro, costo de producción, top ventas y resumen quincenal —
// todo se ancla a pedido_pagos.fecha_pago en vez de pedidos.fecha_cobro.
function usePagosPeriodoDetalle(desde: string, hasta: string) {
  return useQuery({
    queryKey:        [...queryKeys.pedidos.all(), 'dash-pagos-detalle', desde, hasta],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: pagosRaw, error: e1 } = await supabase
        .from('pedido_pagos')
        .select('pedido_id, monto, forma_pago, fecha_pago')
        .gte('fecha_pago', desde)
        .lte('fecha_pago', hasta)
      if (e1) throw new Error(e1.message)

      const pagos: PagoPeriodo[] = (pagosRaw ?? []).map(p => ({
        pedido_id:  p.pedido_id,
        monto:      Number(p.monto),
        forma_pago: p.forma_pago,
        fecha_pago: p.fecha_pago,
      }))

      const ids = [...new Set(pagos.map(p => p.pedido_id))]
      if (ids.length === 0) return { pagos, pedidos: [] as PedidoConItems[] }

      const { data: pedidosRaw, error: e2 } = await supabase
        .from('pedidos')
        .select(`
          id,
          pedido_items (
            cantidad, costo_snapshot, precio_unitario,
            productos ( nombre, fragancia, categorias_producto (nombre) )
          )
        `)
        .in('id', ids)
      if (e2) throw new Error(e2.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pedidos = (pedidosRaw ?? []).map((p: any): PedidoConItems => ({
        id: p.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pedido_items: (p.pedido_items ?? []).map((i: any): ItemConCosto => ({
          cantidad:        Number(i.cantidad),
          costo_snapshot:  Number(i.costo_snapshot),
          precio_unitario: Number(i.precio_unitario),
          productos:       i.productos ?? null,
        })),
      }))

      return { pagos, pedidos }
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

function useEvolucionRango(desde: string, hasta: string) {
  const mesAnteriorDesde = restarUnMes(desde)
  return useQuery({
    queryKey:        [...queryKeys.pedidos.all(), 'dash-evolucion-rango-v2', desde, hasta],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedido_pagos')
        .select('monto, fecha_pago')
        .gte('fecha_pago', mesAnteriorDesde)
        .lte('fecha_pago', hasta)
      if (error) throw new Error(error.message)
      return (data ?? []).map(p => ({ monto: Number(p.monto), fecha_pago: p.fecha_pago as string })) as PagoEvol[]
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

function useEgresosDashboard(desde: string, hasta: string) {
  return useQuery({
    queryKey:        [...queryKeys.egresos.all(), 'dashboard', desde, hasta],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await supabase
        .from('egresos')
        .select('monto, fecha_egreso')
        .gte('fecha_egreso', desde)
        .lte('fecha_egreso', hasta)
      return (data ?? []) as EgresoItem[]
    },
    staleTime: 1000 * 60 * 3,
  })
}

// ─── Calculation helpers ──────────────────────────────────────────────────────

function calcEvolucionRango(pagos: PagoEvol[], desde: string, hasta: string) {
  const mesAnteriorDesde = restarUnMes(desde)
  const dDesde    = new Date(desde + 'T12:00:00')
  const dHasta    = new Date(hasta + 'T12:00:00')
  const totalDays = Math.round((dHasta.getTime() - dDesde.getTime()) / 86_400_000) + 1
  const porDia    = totalDays <= 31

  const byDia: Record<string, number> = {}
  for (const p of pagos) {
    if (!p.fecha_pago) continue
    byDia[p.fecha_pago] = (byDia[p.fecha_pago] || 0) + p.monto
  }

  const labels: string[] = []
  const actual: number[] = []
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

function calcTopVentas(pedidos: PedidoConItems[]) {
  const porCategoria: Record<string, number> = {}
  const porProducto: Record<string, { nombre: string; fragancia: string | null; cantidad: number }> = {}

  for (const pedido of pedidos) {
    for (const item of pedido.pedido_items) {
      const cat = item.productos?.categorias_producto?.nombre ?? 'Sin categoría'
      porCategoria[cat] = (porCategoria[cat] ?? 0) + Number(item.cantidad) * Number(item.precio_unitario)

      const nombre    = item.productos?.nombre ?? '—'
      const fragancia = item.productos?.fragancia ?? null
      const key       = `${nombre}|||${fragancia ?? ''}`
      if (!porProducto[key]) porProducto[key] = { nombre, fragancia, cantidad: 0 }
      porProducto[key].cantidad += Number(item.cantidad)
    }
  }

  const topCategorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topProductos  = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)

  return { topCategorias, topProductos }
}

function generarQuincenas(desde: string, hasta: string): { inicio: Date; fin: Date }[] {
  const quincenas: { inicio: Date; fin: Date }[] = []
  let cursor      = new Date(hasta + 'T12:00:00')
  const desdeDate = new Date(desde + 'T12:00:00')

  for (let i = 0; i < 24; i++) {
    const dia = cursor.getDate()
    let inicio: Date, fin: Date

    if (dia >= 16) {
      fin    = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12)
      inicio = new Date(cursor.getFullYear(), cursor.getMonth(), 16, 12)
    } else {
      fin    = new Date(cursor.getFullYear(), cursor.getMonth(), 15, 12)
      inicio = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
    }

    if (fin < desdeDate) break
    quincenas.push({ inicio, fin })

    const prevDay = new Date(inicio)
    prevDay.setDate(prevDay.getDate() - 1)
    if (prevDay < desdeDate) break
    cursor = prevDay
  }

  return quincenas
}

function calcQuincena(pagos: PagoPeriodo[], pedidosMap: Map<string, PedidoConItems>, inicio: Date, fin: Date) {
  const filtrados = pagos.filter(p => {
    if (!p.fecha_pago) return false
    const fecha = new Date(p.fecha_pago + 'T12:00:00')
    return fecha >= inicio && fecha <= fin
  })
  const totalVendido = filtrados.reduce((s, p) => s + p.monto, 0)
  const idsUnicos     = [...new Set(filtrados.map(p => p.pedido_id))]
  const totalCosto    = idsUnicos.reduce((sum, id) => {
    const pedido = pedidosMap.get(id)
    if (!pedido) return sum
    return sum + pedido.pedido_items.reduce((s, i) => s + i.cantidad * i.costo_snapshot, 0)
  }, 0)
  return { totalVendido, totalCosto, ganancia: totalVendido - totalCosto }
}

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
            borderColor:          '#3DD6B5',
            borderWidth:          1.5,
            pointRadius:          2,
            pointBackgroundColor: '#3DD6B5',
            tension:              0.4,
            fill:                 false,
          },
          {
            label:       'Mes anterior',
            data:        anterior,
            borderColor: '#E5E5EA',
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
            ticks:  { font: { size: 10, family: 'Inter Variable' }, color: '#9CA3AF' },
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

const FORMA_PAGO_LABEL: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia' }

function FilaPendiente({ p, onPagoRegistrado }: {
  p:                PedidoPendienteDetalle
  onPagoRegistrado: () => void
}) {
  const registrarPago = useRegistrarPago()
  const { compartir, loading: loadingWA } = useCompartirFactura()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleConfirmarPagos = async (pagosForm: { forma_pago: string; monto: number }[]) => {
    setLoading(true); setError(null)
    try {
      for (const pago of pagosForm) {
        await registrarPago.mutateAsync({
          pedido_id:  p.id,
          forma_pago: pago.forma_pago as 'efectivo' | 'transferencia',
          monto:      pago.monto,
        })
      }
      onPagoRegistrado()
      setAbierto(false)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const pagadoPorForma = p.pagos.reduce<Record<string, number>>((acc, pg) => {
    acc[pg.forma_pago] = (acc[pg.forma_pago] ?? 0) + pg.monto
    return acc
  }, {})

  const fmtCorta = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

  return (
    <div style={{
      background:   '#FFFFFF',
      borderRadius: 16,
      padding:      '16px 20px',
      boxShadow:    '0 1px 3px rgba(0,0,0,0.06)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#3DD6B5' }}>
          {formatNumero(p.numero)}
        </span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px' }}>
          {pesos(p.totalPedido)}
        </span>
      </div>

      <div style={{
        fontSize: 13, fontWeight: 500, color: '#1C1C1E', marginBottom: 4,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {p.clienteNombre}
      </div>

      {p.fechaProduccion && (
        <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 6 }}>
          Prod: {fmtCorta(p.fechaProduccion)}
        </div>
      )}

      {p.totalPagado > 0 && (
        <div style={{ fontSize: 12, color: '#28B99A', marginBottom: 2 }}>
          Pagado: {pesos(p.totalPagado)} ({Object.entries(pagadoPorForma)
            .map(([forma, monto]) => `${FORMA_PAGO_LABEL[forma] ?? forma} ${pesos(monto)}`)
            .join(', ')})
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#D32F2F', marginBottom: 14 }}>
        Resta: {pesos(p.restante)}
      </div>

      {!abierto ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={loadingWA}
            aria-label={`Compartir factura del pedido ${formatNumero(p.numero)} por WhatsApp`}
            onClick={async () => {
              try {
                const detalle = await fetchPedidoDetalle(p.id)
                await compartir(detalle)
              } catch {
                // silencioso
              }
            }}
            style={{
              flex: 1, height: 36, border: '1px solid #E5E5EA', borderRadius: 10,
              background: 'transparent', color: '#8E8E93', fontSize: 12, fontWeight: 500,
              cursor: loadingWA ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3DD6B5'; e.currentTarget.style.color = '#28B99A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5EA'; e.currentTarget.style.color = '#8E8E93' }}
          >
            <Share2 size={13} /> {loadingWA ? 'Generando…' : 'Compartir factura'}
          </button>

          <button
            onClick={() => setAbierto(true)}
            aria-label={`Agregar pago al pedido ${formatNumero(p.numero)}`}
            style={{
              flex: 1, height: 36, border: 'none', borderRadius: 10,
              background: '#3DD6B5', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#28B99A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#3DD6B5')}
          >
            Agregar pago
          </button>
        </div>
      ) : (
        <div role="group" aria-label={`Registrar pago — ${formatNumero(p.numero)}`}>
          <div style={{ height: 1, background: '#E5E5EA', margin: '0 0 14px' }} />
          <FormPagos
            totalPedido={p.restante}
            loading={loading}
            onConfirmar={handleConfirmarPagos}
            onCancelar={() => setAbierto(false)}
          />
          {error && (
            <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: '#F05252' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SheetPendientes ──────────────────────────────────────────────────────────

function SheetPendientes({ open, onClose, pendientes, onRefetch }: {
  open:       boolean
  onClose:    () => void
  pendientes: { count: number; total: number; pedidos: PedidoPendienteDetalle[] }
  onRefetch:  () => void
}) {
  const [lista, setLista] = useState<PedidoPendienteDetalle[]>(pendientes.pedidos)

  useEffect(() => { setLista(pendientes.pedidos) }, [pendientes.pedidos])

  const total = lista.reduce((acc, p) => acc + p.restante, 0)

  const handlePagoRegistrado = (id: string) => {
    setLista(prev => prev.filter(p => p.id !== id))
    onRefetch()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E5E5EA', flexShrink: 0 }}>
          <SheetTitle style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>
            Pendientes de cobro
          </SheetTitle>
          <p style={{ margin: 0, fontSize: 12, color: '#8E8E93' }}>
            {lista.length} pedido{lista.length !== 1 ? 's' : ''} sin cobrar
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {lista.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle2 size={32} color="#28B99A" style={{ margin: '0 0 8px' }} />
              <p style={{ fontWeight: 500, fontSize: 15, color: '#1C1C1E', margin: 0 }}>Todo al día</p>
              <p style={{ fontSize: 13, color: '#8E8E93', margin: '4px 0 0' }}>No hay cobros pendientes</p>
            </div>
          ) : lista.map(p => (
            <FilaPendiente key={p.id} p={p} onPagoRegistrado={() => handlePagoRegistrado(p.id)} />
          ))}
        </div>

        {lista.length > 0 && (
          <div style={{
            flexShrink: 0, padding: '16px 20px',
            borderTop: '1px solid #E5E5EA', background: '#FFFFFF',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93' }}>Total pendiente</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px' }}>
              {pesos(total)}
            </span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [desde,     setDesde]    = useState<string>(primerDiaMes())
  const [hasta,     setHasta]    = useState<string>(fmtDate(new Date()))
  const [sheetPend, setSheetPend] = useState(false)
  const [tabTop,    setTabTop]   = useState<'categoria' | 'producto'>('categoria')

  const { data: pedidos,    isLoading }              = usePedidosPeriodo(desde, hasta)
  const { data: pendCierre }                         = usePendientesCierre()
  const { data: pagosDetalle }                       = usePagosPeriodoDetalle(desde, hasta)
  const { data: pendientes, refetch: refetchPend }   = usePendientesCobro()
  const { data: evolData }                           = useEvolucionRango(desde, hasta)
  const { data: egresosData, isLoading: loadingEg }  = useEgresosDashboard(desde, hasta)

  // ── Derivados ───────────────────────────────────────────────────────────────

  const countPedidos      = pedidos?.length ?? 0
  const pendientesCierre  = pendCierre ?? 0

  const pagosPeriodo    = pagosDetalle?.pagos ?? []
  const pedidosConItems = pagosDetalle?.pedidos ?? []
  const pedidosMap       = new Map(pedidosConItems.map(p => [p.id, p]))

  const totalCobrado = pagosPeriodo.reduce((s, p) => s + p.monto, 0)
  const totalEfectivo = pagosPeriodo
    .filter(p => p.forma_pago === 'efectivo')
    .reduce((s, p) => s + p.monto, 0)
  const totalTransf = pagosPeriodo
    .filter(p => p.forma_pago === 'transferencia')
    .reduce((s, p) => s + p.monto, 0)

  const totalCostoProduccion = pedidosConItems.reduce((sum, p) =>
    sum + p.pedido_items.reduce((s, i) => s + i.cantidad * i.costo_snapshot, 0), 0
  )

  const totalEgresos  = egresosData ? egresosData.reduce((s, e) => s + Number(e.monto), 0) : 0
  const gananciaNeta  = totalCobrado - totalCostoProduccion - totalEgresos

  const montoPendienteCobro = pendientes?.total ?? 0

  const { topCategorias, topProductos } = pedidosConItems.length > 0
    ? calcTopVentas(pedidosConItems)
    : { topCategorias: [] as [string, number][], topProductos: [] as { nombre: string; fragancia: string | null; cantidad: number }[] }

  const evolucion = evolData ? calcEvolucionRango(evolData, desde, hasta) : null
  const quincenas = generarQuincenas(desde, hasta)

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

  const descargarExcel = () => {
    const filas = quincenas.map(({ inicio, fin }) => {
      const { totalVendido, totalCosto, ganancia } = calcQuincena(pagosPeriodo, pedidosMap, inicio, fin)
      return {
        'Período':          `${fmtDia(inicio)} al ${fmtDiaAno(fin)}`,
        'Total vendido':    totalVendido,
        'Costo producción': totalCosto,
        'Ganancia':         ganancia,
      }
    })
    filas.push({
      'Período':          'TOTAL PERÍODO',
      'Total vendido':    totalCobrado,
      'Costo producción': totalCostoProduccion,
      'Ganancia':         totalCobrado - totalCostoProduccion,
    })
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen quincenal')
    const d = new Date(desde + 'T12:00:00')
    XLSX.writeFile(wb, `burbuja-resumen-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.xlsx`)
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter Variable, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 48 }}>
          <Skeleton style={{ height: 14, width: 72, borderRadius: 4 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton style={{ height: 32, width: 120, borderRadius: 6 }} />
            <Skeleton style={{ height: 32, width: 120, borderRadius: 6 }} />
            <Skeleton style={{ height: 32, width: 112, borderRadius: 6 }} />
          </div>
        </div>
        <Skeleton style={{ height: 14, width: 200, borderRadius: 4 }} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} style={{ height: 88, borderRadius: 10 }} />)}
        </div>
        <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
          <Skeleton style={{ height: 220, borderRadius: 10 }} />
          <Skeleton style={{ height: 220, borderRadius: 10 }} />
        </div>
        <Skeleton style={{ height: 200, borderRadius: 10 }} />
      </div>
    )
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const card = {
    background: '#fff', border: '0.5px solid #E5E5EA', borderRadius: 10, padding: '14px 16px',
  }
  const labelRow = {
    display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6,
  }
  const labelSt = {
    fontSize: 10, fontWeight: 500, color: '#8E8E93',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  }
  const valorSt = {
    fontSize: 22, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.5px', lineHeight: 1,
  }
  const subSt = {
    fontSize: 11, fontWeight: 400, color: '#8E8E93', marginTop: 4,
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 20px', fontSize: 9, fontWeight: 700,
    color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
  }
  const tdStyle: React.CSSProperties = {
    padding: '12px 20px', fontSize: 13, color: '#1C1C1E',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter Variable, sans-serif' }}>

      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 48, flexWrap: 'wrap', gap: 8,
      }}>
        <h1 className="section-title">Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date" value={desde}
            onChange={e => handleDesde(e.target.value)}
            style={{
              height: 32, border: '0.5px solid #E5E5EA', borderRadius: 6,
              padding: '0 10px', fontSize: 11, fontFamily: 'Inter Variable, sans-serif',
              color: '#1C1C1E', background: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
            onBlur={e  => (e.target.style.borderColor = '#E5E5EA')}
          />
          <input
            type="date" value={hasta}
            onChange={e => handleHasta(e.target.value)}
            style={{
              height: 32, border: '0.5px solid #E5E5EA', borderRadius: 6,
              padding: '0 10px', fontSize: 11, fontFamily: 'Inter Variable, sans-serif',
              color: '#1C1C1E', background: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
            onBlur={e  => (e.target.style.borderColor = '#E5E5EA')}
          />
          <button
            onClick={() => window.open(`/print/listado?fecha=${todayStr}`, '_blank')}
            style={{
              height: 32, padding: '0 12px', fontSize: 11, fontWeight: 500,
              color: '#8E8E93', background: '#fff',
              border: '0.5px solid #E5E5EA', borderRadius: 6,
              cursor: 'pointer', fontFamily: 'Inter Variable, sans-serif',
            }}
          >
            Listado del día
          </button>
        </div>
      </div>

      {/* ── Fecha ── */}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: '#8E8E93' }}>{fechaDisplay}</p>

      {/* ── KPIs — 3 cols desktop / 2 mobile ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

        {/* 1 — Pedidos */}
        <div style={card}>
          <div style={labelRow}>
            <Package size={14} color="#28B99A" />
            <span style={labelSt}>Pedidos</span>
          </div>
          <span style={valorSt}>{countPedidos}</span>
          <p style={subSt}>{pendientesCierre} pendiente{pendientesCierre !== 1 ? 's' : ''} de cierre</p>
        </div>

        {/* 2 — Total cobrado */}
        <div style={card}>
          <div style={labelRow}>
            <Banknote size={14} color="#7EB8E8" />
            <span style={labelSt}>Total cobrado</span>
          </div>
          <span style={valorSt}>{pesos(totalCobrado)}</span>
          <p style={subSt}>Ef. {pesos(totalEfectivo)} · Tr. {pesos(totalTransf)}</p>
        </div>

        {/* 3 — Pendiente de cobro */}
        <div style={{
          ...card,
          ...(montoPendienteCobro > 0 ? { background: '#FFF8F8', border: '0.5px solid rgba(211,47,47,0.3)' } : {}),
        }}>
          <div style={labelRow}>
            <Clock size={14} color={montoPendienteCobro > 0 ? '#D32F2F' : '#C47B00'} />
            <span style={{ ...labelSt, color: montoPendienteCobro > 0 ? '#D32F2F' : '#8E8E93' }}>
              Pend. cobro
            </span>
          </div>
          <span style={{ ...valorSt, color: montoPendienteCobro > 0 ? '#D32F2F' : '#1C1C1E' }}>
            {pesos(montoPendienteCobro)}
          </span>
          {montoPendienteCobro > 0 ? (
            <button
              onClick={() => setSheetPend(true)}
              style={{
                ...subSt, display: 'inline-block', marginTop: 4,
                color: '#D32F2F', background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, fontFamily: 'Inter Variable, sans-serif',
              }}
            >
              Ver detalle →
            </button>
          ) : (
            <p style={subSt}>Sin pendientes</p>
          )}
        </div>

        {/* 4 — Costo de producción */}
        <div style={card}>
          <div style={labelRow}>
            <FlaskConical size={14} color="#7EB8E8" />
            <span style={labelSt}>Costo prod.</span>
          </div>
          <span style={valorSt}>{pesos(totalCostoProduccion)}</span>
          <p style={subSt}>ventas cobradas del período</p>
        </div>

        {/* 6 — Ganancia neta */}
        <div style={{
          ...card,
          ...(gananciaNeta < 0 ? { background: '#FEF2F2', border: '0.5px solid rgba(240,82,82,0.3)' } : {}),
        }}>
          <div style={labelRow}>
            <BarChart2 size={14} color={gananciaNeta >= 0 ? '#28B99A' : '#F05252'} />
            <span style={labelSt}>Ganancia neta</span>
          </div>
          {loadingEg ? (
            <Skeleton style={{ height: 28, width: 100, borderRadius: 4, marginBottom: 6 }} />
          ) : (
            <>
              <span style={{ ...valorSt, color: gananciaNeta >= 0 ? '#28B99A' : '#F05252' }}>
                {pesos(gananciaNeta)}
              </span>
              <p style={subSt}>Egresos {pesos(totalEgresos)}</p>
            </>
          )}
        </div>
      </div>

      {/* ── Panel — Gráfico + Top ventas ── */}
      <div className="grid md:grid-cols-2 grid-cols-1 gap-3">

        {/* Evolución de ventas */}
        <div style={{ background: '#fff', border: '0.5px solid #E5E5EA', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F5F7F9' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.3px' }}>
              Evolución de ventas
            </span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 20, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.5px' }}>
              {pesos(totalCobrado)}
            </span>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3DD6B5' }} />
                <span style={{ fontSize: 10, color: '#8E8E93' }}>Período actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 14, height: 2, borderRadius: 1,
                  background: 'repeating-linear-gradient(90deg, #E5E5EA 0, #E5E5EA 3px, transparent 3px, transparent 6px)',
                }} />
                <span style={{ fontSize: 10, color: '#8E8E93' }}>Mes anterior</span>
              </div>
            </div>
            {evolucion
              ? <GraficoLinea labels={evolucion.labels} actual={evolucion.actual} anterior={evolucion.anterior} />
              : <div style={{ height: 100, background: '#F5F7F9', borderRadius: 6 }} />
            }
          </div>
        </div>

        {/* Top ventas con tabs */}
        <div style={{ background: '#fff', border: '0.5px solid #E5E5EA', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #F5F7F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.3px' }}>Top ventas</span>
            <div style={{ display: 'flex', gap: 2, background: '#F5F7F9', borderRadius: 8, padding: 3 }}>
              {(['categoria', 'producto'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTabTop(tab)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none',
                    background: tabTop === tab ? '#FFFFFF' : 'transparent',
                    color:      tabTop === tab ? '#1C1C1E' : '#8E8E93',
                    fontSize: 11, fontWeight: tabTop === tab ? 600 : 500,
                    cursor: 'pointer',
                    boxShadow: tabTop === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'categoria' ? 'Categoría' : 'Producto'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            {tabTop === 'categoria' ? (
              topCategorias.length === 0 ? (
                <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', padding: '28px 0', margin: 0 }}>
                  Sin ventas cobradas en el período
                </p>
              ) : topCategorias.map(([nombre, monto], i) => (
                <div key={nombre} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: i < topCategorias.length - 1 ? '1px solid #E5E5EA' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: '#E8FAF6', color: '#28B99A',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>{nombre}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{pesos(monto)}</span>
                </div>
              ))
            ) : (
              topProductos.length === 0 ? (
                <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', padding: '28px 0', margin: 0 }}>
                  Sin ventas cobradas en el período
                </p>
              ) : topProductos.map((prod, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: i < topProductos.length - 1 ? '1px solid #E5E5EA' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: '#EBF5FF', color: '#2B6CB0',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>{prod.nombre}</div>
                      {prod.fragancia && (
                        <div style={{ fontSize: 11, color: '#8E8E93' }}>{prod.fragancia}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>{prod.cantidad} u.</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Resumen quincenal ── */}
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '0.5px solid #E5E5EA', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E5EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E' }}>Resumen quincenal</span>
          <button
            onClick={descargarExcel}
            style={{
              height: 30, padding: '0 12px',
              border: '1px solid #E5E5EA', borderRadius: 8,
              background: 'transparent', color: '#8E8E93',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'Inter Variable, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3DD6B5'; e.currentTarget.style.color = '#28B99A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5EA'; e.currentTarget.style.color = '#8E8E93' }}
          >
            <Download size={13} /> Exportar Excel
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F5F7F9' }}>
              <th style={thStyle}>Período</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total vendido</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Costo producción</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {quincenas.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#8E8E93' }}>
                  Sin datos en el período seleccionado
                </td>
              </tr>
            ) : quincenas.map(({ inicio, fin }, i) => {
              const { totalVendido, totalCosto, ganancia } = calcQuincena(pagosPeriodo, pedidosMap, inicio, fin)
              return (
                <tr key={i} style={{ borderBottom: '1px solid #E5E5EA' }}>
                  <td style={tdStyle}>{fmtDia(inicio)} al {fmtDiaAno(fin)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {pesos(totalVendido)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#8E8E93' }}>
                    {pesos(totalCosto)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: ganancia >= 0 ? '#28B99A' : '#F05252' }}>
                    {pesos(ganancia)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F5F7F9' }}>
              <td style={{ ...tdStyle, fontWeight: 700 }}>Total período</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{pesos(totalCobrado)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#8E8E93' }}>{pesos(totalCostoProduccion)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: (totalCobrado - totalCostoProduccion) >= 0 ? '#28B99A' : '#F05252' }}>
                {pesos(totalCobrado - totalCostoProduccion)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Sheet pendientes ── */}
      {pendientes && (
        <SheetPendientes
          open={sheetPend}
          onClose={() => setSheetPend(false)}
          pendientes={pendientes}
          onRefetch={() => refetchPend()}
        />
      )}
    </div>
  )
}
