import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstadoPedido } from '@/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

// snake_case — coincide con columnas de Supabase
export interface ItemProduccion {
  pedido_id:    string
  producto_id:  string
  cantidad:     number
  bidon_nuevo:  boolean
  nombre:       string | null
  fragancia:    string | null
  presentacion: number | null
}

export interface PedidoProduccion {
  id:               string
  numero:           number
  estado:           EstadoPedido
  fecha_produccion: string | null
  notas_produccion: string | null
  direccion_entrega: string | null
  created_at:       string
  updated_at:       string
  cliente_id:       string
  clientes:         { nombre: string } | null
  pedido_items:     ItemProduccion[]
}

export interface PedidoListoHoy {
  id:               string
  numero:           number
  estado:           EstadoPedido
  fecha_produccion: string | null
  notas_produccion: string | null
  updated_at:       string
  clientes:         { nombre: string } | null
}

export interface ResumenProduccion {
  producto_id:      string
  nombre_producto:  string | null
  presentacion:     number | null
  unidad_medida:    string | null
  fecha_produccion: string | null
  total_cantidad:   number
  total_bidon_nuevo: number
}

export interface DashboardData {
  hoy: {
    total:              number
    porEstado:          Record<string, number>
    totalEfectivo:      number
    totalTransferencia: number
    totalCobrado:       number
    cobrandoPendientes: number
  }
  activos: {
    total:     number
    porEstado: Record<string, number>
  }
  pedidosHoy: {
    id: string; numero: number; estado: EstadoPedido
    totalCalculado: string; totalManual: string | null
    formaCobro: string | null; montoCobrado: string | null
    fechaProduccion: string | null; clienteId: string
  }[]
}

// ─── Estados terminales (excluidos de "activos") ─────────────────────────────

const ESTADOS_TERMINALES: EstadoPedido[] = ['cerrado', 'anulado']

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const usePedidosProduccion = (fecha?: string) =>
  useQuery({
    queryKey: ['produccion', fecha],
    queryFn: async () => {
      let q = supabase
        .from('pedidos')
        .select(`
          id, numero, estado, fecha_produccion, notas_produccion,
          direccion_entrega, created_at, updated_at, cliente_id,
          clientes(nombre),
          pedido_items(
            id, pedido_id, producto_id, cantidad, bidon_nuevo,
            productos(nombre, fragancia, presentacion)
          )
        `)
        .eq('estado', 'en_produccion')
        .order('fecha_produccion', { ascending: true })
        .order('created_at', { ascending: true })

      if (fecha) q = q.eq('fecha_produccion', fecha)

      const { data, error } = await q
      if (error) throw new Error(error.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any): PedidoProduccion => ({
        id:                row.id,
        numero:            row.numero,
        estado:            row.estado,
        fecha_produccion:  row.fecha_produccion,
        notas_produccion:  row.notas_produccion,
        direccion_entrega: row.direccion_entrega,
        created_at:        row.created_at,
        updated_at:        row.updated_at,
        cliente_id:        row.cliente_id,
        clientes:          row.clientes ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pedido_items: (row.pedido_items ?? []).map((item: any): ItemProduccion => ({
          pedido_id:    item.pedido_id,
          producto_id:  item.producto_id,
          cantidad:     Number(item.cantidad),
          bidon_nuevo:  item.bidon_nuevo ?? false,
          nombre:       item.productos?.nombre      ?? null,
          fragancia:    item.productos?.fragancia   ?? null,
          presentacion: item.productos?.presentacion != null
            ? Number(item.productos.presentacion) : null,
        })),
      }))
    },
    refetchInterval: 30_000,
  })

export const usePedidosListosHoy = () => {
  const hoy = new Date().toISOString().split('T')[0]
  return useQuery({
    queryKey: ['produccion', 'listos', hoy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero, estado, fecha_produccion, notas_produccion, updated_at, clientes(nombre)')
        .eq('estado', 'listo_reparto')
        .eq('fecha_produccion', hoy)
        .order('updated_at', { ascending: false })

      if (error) throw new Error(error.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any): PedidoListoHoy => ({
        id:               row.id,
        numero:           row.numero,
        estado:           row.estado,
        fecha_produccion: row.fecha_produccion,
        notas_produccion: row.notas_produccion,
        updated_at:       row.updated_at,
        clientes:         row.clientes ?? null,
      }))
    },
    refetchInterval: 30_000,
  })
}

export const useResumenProduccion = (fecha?: string) => {
  const hoy = new Date().toISOString().split('T')[0]
  const fechaTarget = fecha ?? hoy

  return useQuery({
    queryKey: ['produccion', 'resumen', fechaTarget],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id, fecha_produccion,
          pedido_items(
            cantidad, bidon_nuevo, producto_id,
            productos(nombre, presentacion, unidad_medida)
          )
        `)
        .eq('estado', 'en_produccion')
        .eq('fecha_produccion', fechaTarget)

      if (error) throw new Error(error.message)

      // Agrupar por producto
      const mapa = new Map<string, ResumenProduccion>()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const pedido of data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of (pedido.pedido_items ?? []) as any[]) {
          const prodId     = item.producto_id
          const cantidad   = parseFloat(item.cantidad)
          const esBidon    = item.bidon_nuevo ?? false
          const existing   = mapa.get(prodId)

          if (existing) {
            existing.total_cantidad    += cantidad
            if (esBidon) existing.total_bidon_nuevo += cantidad
          } else {
            mapa.set(prodId, {
              producto_id:       prodId,
              nombre_producto:   item.productos?.nombre          ?? null,
              presentacion:      item.productos?.presentacion != null
                ? Number(item.productos.presentacion) : null,
              unidad_medida:     item.productos?.unidad_medida   ?? null,
              fecha_produccion:  pedido.fecha_produccion         ?? null,
              total_cantidad:    cantidad,
              total_bidon_nuevo: esBidon ? cantidad : 0,
            })
          }
        }
      }

      return Array.from(mapa.values()).sort((a, b) =>
        (a.nombre_producto ?? '').localeCompare(b.nombre_producto ?? '')
      )
    },
  })
}

export const useDashboard = () => {
  const hoy = new Date().toISOString().split('T')[0]

  return useQuery({
    queryKey: ['dashboard', hoy],
    queryFn: async () => {
      // Usa la RPC get_dashboard_stats: 1 HTTP request en vez de 2
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_fecha: hoy,
      })

      if (error) {
        // Fallback si la RPC aún no existe: 2 queries directas
        console.warn('RPC get_dashboard_stats no disponible, usando fallback:', error.message)
        return fallbackDashboard(hoy)
      }

      // La RPC devuelve JSON — los keys ya están en camelCase (definidos en el SQL)
      return data as DashboardData
    },
    refetchInterval: 60_000,
  })
}

// Fallback usado si la RPC aún no está deployada en Supabase
async function fallbackDashboard(hoy: string): Promise<DashboardData> {
  const desde = `${hoy}T00:00:00`
  const hasta = `${hoy}T23:59:59`

  const [{ data: pedidosHoyRaw, error: e1 }, { data: pedidosActivosRaw, error: e2 }] =
    await Promise.all([
      supabase
        .from('pedidos')
        .select('id, numero, estado, total_calculado, total_manual, forma_cobro, monto_cobrado, fecha_produccion, cliente_id')
        .gte('created_at', desde)
        .lte('created_at', hasta),
      supabase
        .from('pedidos')
        .select('id, estado')
        .not('estado', 'in', `(${ESTADOS_TERMINALES.join(',')})`),
    ])

  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)

  const pedidosHoy = pedidosHoyRaw ?? []
  const porEstadoHoy: Record<string, number> = {}
  let totalEfectivo = 0, totalTransferencia = 0, totalCobrado = 0, cobrandoPendientes = 0

  for (const p of pedidosHoy) {
    porEstadoHoy[p.estado] = (porEstadoHoy[p.estado] ?? 0) + 1
    if (p.estado === 'entregado' || p.estado === 'cerrado') {
      const monto = parseFloat(p.monto_cobrado ?? '0') || 0
      totalCobrado += monto
      if (p.forma_cobro === 'efectivo')      totalEfectivo      += monto
      if (p.forma_cobro === 'transferencia') totalTransferencia += monto
      if (p.forma_cobro === 'pendiente' || !p.forma_cobro) cobrandoPendientes++
    }
  }

  const activos = pedidosActivosRaw ?? []
  const porEstadoActivos: Record<string, number> = {}
  for (const p of activos) {
    porEstadoActivos[p.estado] = (porEstadoActivos[p.estado] ?? 0) + 1
  }

  return {
    hoy: {
      total: pedidosHoy.length,
      porEstado: porEstadoHoy,
      totalEfectivo,
      totalTransferencia,
      totalCobrado,
      cobrandoPendientes,
    },
    activos: { total: activos.length, porEstado: porEstadoActivos },
    pedidosHoy: pedidosHoy.map(p => ({
      id:              p.id,
      numero:          p.numero,
      estado:          p.estado as EstadoPedido,
      totalCalculado:  String(p.total_calculado ?? '0'),
      totalManual:     p.total_manual != null ? String(p.total_manual) : null,
      formaCobro:      p.forma_cobro,
      montoCobrado:    p.monto_cobrado != null ? String(p.monto_cobrado) : null,
      fechaProduccion: p.fecha_produccion,
      clienteId:       p.cliente_id,
    })),
  }
}
