import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_VIVO, POLL_VIVO } from '@/lib/queryClient'
import { hoyLocal } from '@/lib/fechas'
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

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const usePedidosProduccion = (fecha?: string) =>
  useQuery({
    queryKey:        [...queryKeys.produccion.all(), fecha],
    placeholderData: keepPreviousData,
    staleTime:       STALE_VIVO,
    refetchInterval: POLL_VIVO,
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
  })

export const usePedidosListosHoy = () => {
  return useQuery({
    queryKey:        [...queryKeys.produccion.all(), 'listos'],
    staleTime:       STALE_VIVO,
    refetchInterval: POLL_VIVO,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero, estado, fecha_produccion, notas_produccion, updated_at, clientes(nombre)')
        .eq('estado', 'listo_reparto')
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
  })
}

export const useResumenProduccion = (fecha?: string) => {
  const fechaTarget = fecha ?? hoyLocal()

  return useQuery({
    queryKey:        [...queryKeys.produccion.all(), 'resumen', fechaTarget],
    placeholderData: keepPreviousData,
    staleTime:       STALE_VIVO,
    refetchInterval: POLL_VIVO,
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
