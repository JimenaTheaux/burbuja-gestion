import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart, registerables, type TooltipItem } from 'chart.js'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { BadgeEstado } from '@/components/common/BadgeEstado'
import { useEditarCobro } from '@/services/pedidos'
import { useDashboard } from '@/services/produccion'
import { ESTADO_CONFIG, type EstadoPedido } from '@/types'
import type { PedidoPendienteCobro } from '@/services/produccion'
import { supabase } from '@/lib/supabase'

Chart.register(...registerables)

// ─── Types ────────────────────────────────────────────────────────────────────

type Periodo   = 'hoy' | 'semana' | 'mes'
type RangoEvol = '3m'  | '6m'     | '1a'

interface PedidoRow {
  id:               string
  estado:           EstadoPedido
  estado_pago:      string | null
  forma_cobro:      string | null
  monto_cobrado:    string | null
  total_calculado:  string
  total_manual:     string | null
  fecha_produccion: string | null
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getRango(periodo: Periodo): { inicio: string; fin: string } {
  const hoy = new Date()
  if (periodo === 'hoy') {
    const s = fmtDate(hoy)
    return { inicio: s, fin: s }
  }
  if (periodo === 'semana') {
    const dow  = hoy.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    const lun  = new Date(hoy); lun.setDate(hoy.getDate() + diff)
    const dom  = new Date(lun); dom.setDate(lun.getDate() + 6)
    return { inicio: fmtDate(lun), fin: fmtDate(dom) }
  }
  const pri = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { inicio: fmtDate(pri), fin: fmtDate(ult) }
}

function getRangoPrevio(periodo: Periodo): { inicio: string; fin: string } {
  const hoy = new Date()
  if (periodo === 'hoy') {
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
    const s = fmtDate(ayer)
    return { inicio: s, fin: s }
  }
  if (periodo === 'semana') {
    const { inicio } = getRango('semana')
    const fp = new Date(inicio); fp.setDate(fp.getDate() - 1)
    const ip = new Date(fp);    ip.setDate(fp.getDate() - 6)
    return { inicio: fmtDate(ip), fin: fmtDate(fp) }
  }
  const pri = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const ult = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  return { inicio: fmtDate(pri), fin: fmtDate(ult) }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function usePedidosPeriodo(inicio: string, fin: string) {
  return useQuery({
    // Prefix ['pedidos'] para que los mutations de pedidos invaliden este cache
    queryKey: ['pedidos', 'dash-periodo', inicio, fin],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, estado, estado_pago, forma_cobro, monto_cobrado, total_calculado, total_manual, fecha_produccion')
        .gte('fecha_produccion', inicio)
        .lte('fecha_produccion', fin)
      if (error) throw new Error(error.message)
      return (data ?? []) as PedidoRow[]
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

function useEvolucion(range: RangoEvol) {
  const mesesN = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const hoy    = new Date()
  const iniRef = new Date(hoy.getFullYear() - 1, hoy.getMonth() - mesesN + 1, 1)
  const inicio = fmtDate(iniRef)
  const fin    = fmtDate(hoy)

  return useQuery({
    // Prefix ['pedidos'] para que los mutations de pedidos invaliden este cache
    queryKey: ['pedidos', 'dash-evolucion', range],
    queryFn:  async () => {
      // Sin filtrar por estado_pago en Supabase — lo hacemos client-side
      // para incluir registros legacy donde estado_pago es null
      const { data, error } = await supabase
        .from('pedidos')
        .select('monto_cobrado, fecha_produccion, estado_pago, forma_cobro')
        .eq('estado', 'cerrado')
        .gte('fecha_produccion', inicio)
        .lte('fecha_produccion', fin)
      if (error) throw new Error(error.message)
      return (data ?? []) as {
        monto_cobrado:    string | null
        fecha_produccion: string | null
        estado_pago:      string | null
        forma_cobro:      string | null
      }[]
    },
    refetchInterval: 60_000,
    staleTime:       0,
  })
}

// ─── Calculation helpers ──────────────────────────────────────────────────────

// Compat legacy: estado_pago puede ser null en registros viejos;
// en ese caso se infiere de forma_cobro (igual que useDashboard fallback).
function esCobrado(p: { estado: string; estado_pago: string | null; forma_cobro: string | null }): boolean {
  if (p.estado !== 'cerrado') return false
  if (p.estado_pago === 'cobrado') return true
  return p.estado_pago == null && !!p.forma_cobro && p.forma_cobro !== 'pendiente'
}

function calcKPIs(pedidos: PedidoRow[]) {
  const cobrados   = pedidos.filter(esCobrado)
  const totalCob   = cobrados.reduce((a, p) => a + (Number(p.monto_cobrado) || 0), 0)
  const totalEf    = cobrados.filter(p => p.forma_cobro === 'efectivo')
                             .reduce((a, p) => a + (Number(p.monto_cobrado) || 0), 0)
  const totalTr    = cobrados.filter(p => p.forma_cobro === 'transferencia')
                             .reduce((a, p) => a + (Number(p.monto_cobrado) || 0), 0)
  const pendCierre = pedidos.filter(p => !['cerrado', 'anulado'].includes(p.estado)).length
  const porEstado: Record<string, number> = {}
  for (const p of pedidos) porEstado[p.estado] = (porEstado[p.estado] || 0) + 1
  return { totalCob, totalEf, totalTr, pendCierre, porEstado, count: pedidos.length }
}

function calcEvolucion(
  pedidos: { monto_cobrado: string | null; fecha_produccion: string | null; estado_pago: string | null; forma_cobro: string | null }[],
  range:   RangoEvol
) {
  const mesesN = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes  = hoy.getMonth()

  const labels:     string[] = []
  const keysActual: string[] = []
  const keysPrev:   string[] = []

  for (let i = mesesN - 1; i >= 0; i--) {
    const d  = new Date(anio,     mes - i, 1)
    const dp = new Date(anio - 1, mes - i, 1)
    labels.push(MESES_LABEL[d.getMonth()])
    keysActual.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    keysPrev.push(`${dp.getFullYear()}-${String(dp.getMonth() + 1).padStart(2, '0')}`)
  }

  const byKey: Record<string, number> = {}
  for (const p of pedidos) {
    if (!p.fecha_produccion || !p.monto_cobrado) continue
    if (!esCobrado({ estado: 'cerrado', estado_pago: p.estado_pago, forma_cobro: p.forma_cobro })) continue
    const d   = new Date(p.fecha_produccion + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byKey[key] = (byKey[key] || 0) + Number(p.monto_cobrado)
  }

  const anioActual = keysActual.map(k => byKey[k] || 0)
  const anioPrev   = keysPrev.map(k   => byKey[k] || 0)
  const totalPer   = anioActual.reduce((a, b) => a + b, 0)

  return { labels, anioActual, anioPrev, totalPer }
}

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function deltaCalc(cur: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}

// ─── PeriodoSelector ──────────────────────────────────────────────────────────

function PeriodoSelector({ opciones, valor, onChange }: {
  opciones: { label: string; value: string }[]
  valor:    string
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: '#F4F6F8', border: '0.5px solid #D1D5DB',
      borderRadius: 8, padding: 2, height: 32, gap: 1,
    }}>
      {opciones.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          style={{
            height: 26, padding: '0 10px',
            fontSize: 11,
            fontWeight: valor === value ? 500 : 400,
            color:      valor === value ? '#0D5C8A' : '#4A5568',
            background: valor === value ? '#fff' : 'transparent',
            border:     valor === value ? '0.5px solid #D1D5DB' : 'none',
            borderRadius: 6, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── GraficoLinea ─────────────────────────────────────────────────────────────

function GraficoLinea({ labels, anioActual, anioPrev }: {
  labels:     string[]
  anioActual: number[]
  anioPrev:   number[]
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
            data:                 anioActual,
            borderColor:          '#0D5C8A',
            borderWidth:          1.5,
            pointRadius:          2,
            pointBackgroundColor: '#0D5C8A',
            tension:              0.4,
            fill:                 false,
          },
          {
            data:        anioPrev,
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
              label: (c: TooltipItem<'line'>) => ` $${(c.parsed.y ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`,
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
  }, [labels, anioActual, anioPrev])

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
  const [abierto, setAbierto] = useState(false)
  const [forma,   setForma]   = useState<'efectivo' | 'transferencia'>('efectivo')
  const [monto,   setMonto]   = useState(String(Math.round(p.totalPedido)))
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const montoRef = useRef<HTMLInputElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (abierto) montoRef.current?.focus() }, [abierto])

  const dias = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86_400_000)

  const handleAbrir = () => {
    setMonto(String(Math.round(p.totalPedido)))
    setForma('efectivo')
    setError(null)
    setAbierto(true)
  }

  const handleConfirmar = async () => {
    if (!monto.trim()) { setError('Ingresá el monto cobrado'); return }
    setLoading(true); setError(null)
    try {
      await editarCobro.mutateAsync({ id: p.id, forma_cobro: forma, monto_cobrado: monto, estado_pago: 'cobrado' })
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
        </div>

        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: 17, color: '#0D5C8A', letterSpacing: -0.5 }}>
            {pesos(p.totalPedido)}
          </p>
          {!abierto && (
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
                  {f === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}
                </button>
              ))}
            </div>
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

  const [periodo,    setPeriodo]    = useState<Periodo>('hoy')
  const [rangoEvol,  setRangoEvol]  = useState<RangoEvol>('6m')
  const [periodoEst, setPeriodoEst] = useState<'hoy' | 'semana'>('hoy')
  const [sheetPend,  setSheetPend]  = useState(false)

  const rango     = getRango(periodo)
  const rangoPrev = getRangoPrevio(periodo)
  const rangoEst  = getRango(periodoEst)

  const { data: pedidos,    isLoading } = usePedidosPeriodo(rango.inicio, rango.fin)
  const { data: pedidosPrev }           = usePedidosPeriodo(rangoPrev.inicio, rangoPrev.fin)
  const { data: pedidosEst }            = usePedidosPeriodo(rangoEst.inicio, rangoEst.fin)
  const { data: dashData, refetch }     = useDashboard()
  const { data: evolData }              = useEvolucion(rangoEvol)

  const kpi      = pedidos     ? calcKPIs(pedidos)     : null
  const kpiPrev  = pedidosPrev ? calcKPIs(pedidosPrev) : null
  const kpiEst   = pedidosEst  ? calcKPIs(pedidosEst)  : null
  const delta    = kpi && kpiPrev ? deltaCalc(kpi.totalCob, kpiPrev.totalCob) : null
  const evolucion = evolData ? calcEvolucion(evolData, rangoEvol) : null
  const pendientes = dashData?.pendientes

  const todayStr = new Date().toISOString().split('T')[0]

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 48 }}>
          <Skeleton style={{ height: 14, width: 72, borderRadius: 4 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton style={{ height: 32, width: 150, borderRadius: 8 }} />
            <Skeleton style={{ height: 32, width: 112, borderRadius: 6 }} />
          </div>
        </div>
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
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.3px' }}>
          Dashboard
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <PeriodoSelector
            opciones={[
              { label: 'Hoy',    value: 'hoy'    },
              { label: 'Semana', value: 'semana' },
              { label: 'Mes',    value: 'mes'    },
            ]}
            valor={periodo}
            onChange={v => setPeriodo(v as Periodo)}
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

      {/* ── KPIs — 3 columnas ── */}
      <div className="grid grid-cols-3 gap-3">

        {/* KPI 1 — Total cobrado */}
        <div style={card}>
          <span style={labelSt}>Total cobrado</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>
            <span style={valorSt}>{pesos(kpi?.totalCob ?? 0)}</span>
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
            Ef. {pesos(kpi?.totalEf ?? 0)} · Tr. {pesos(kpi?.totalTr ?? 0)}
          </p>
        </div>

        {/* KPI 2 — Pedidos */}
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
      </div>

      {/* ── Panel inferior — 2 columnas ── */}
      <div className="grid md:grid-cols-2 grid-cols-1 gap-3">

        {/* Panel izquierdo — Evolución de ventas */}
        <div style={{ background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '0.5px solid #F4F6F8',
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.3px' }}>
              Evolución de ventas
            </span>
            <PeriodoSelector
              opciones={[
                { label: '3m', value: '3m' },
                { label: '6m', value: '6m' },
                { label: '1a', value: '1a' },
              ]}
              valor={rangoEvol}
              onChange={v => setRangoEvol(v as RangoEvol)}
            />
          </div>
          {/* Cuerpo */}
          <div style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 20, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.5px' }}>
              {pesos(evolucion?.totalPer ?? 0)}
            </span>
            <p style={{ ...subSt, marginTop: 2 }}>
              Últimos {rangoEvol === '3m' ? '3' : rangoEvol === '6m' ? '6' : '12'} meses
            </p>
            {/* Leyenda custom */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#0D5C8A' }} />
                <span style={{ fontSize: 10, color: '#4A5568' }}>Este año</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 14, height: 2, borderRadius: 1,
                  background: 'repeating-linear-gradient(90deg, #D1D5DB 0, #D1D5DB 3px, transparent 3px, transparent 6px)',
                }} />
                <span style={{ fontSize: 10, color: '#4A5568' }}>Año anterior</span>
              </div>
            </div>
            {evolucion ? (
              <GraficoLinea
                labels={evolucion.labels}
                anioActual={evolucion.anioActual}
                anioPrev={evolucion.anioPrev}
              />
            ) : (
              <div style={{ height: 100, background: '#F4F6F8', borderRadius: 6 }} />
            )}
          </div>
        </div>

        {/* Panel derecho — Estado de pedidos */}
        <div style={{ background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '0.5px solid #F4F6F8',
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.3px' }}>
              Estado de pedidos
            </span>
            <PeriodoSelector
              opciones={[
                { label: 'Hoy',    value: 'hoy'    },
                { label: 'Semana', value: 'semana' },
              ]}
              valor={periodoEst}
              onChange={v => setPeriodoEst(v as 'hoy' | 'semana')}
            />
          </div>
          {/* Filas por estado */}
          <div>
            {(() => {
              const porEst   = kpiEst?.porEstado ?? {}
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
