import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { totalPedido } from '@/types'
import type { Pedido, PedidoItem, PedidoHistorial, Cliente, Producto, EstadoPedido } from '@/types'

export { totalPedido }

// ─── Tipos extendidos (con joins de Supabase) ────────────────────────────────

export type PedidoConCliente = Pedido & {
  clientes: Pick<Cliente, 'nombre' | 'direccion' | 'tipo_cliente' | 'telefono'>
}

export type ItemDetalle = PedidoItem & {
  productos: Pick<Producto, 'nombre' | 'fragancia' | 'presentacion' | 'precio_minorista' | 'precio_mayorista'>
}

export type HistorialDetalle = PedidoHistorial & {
  perfiles: { nombre: string } | null
}

export type PedidoDetalle = PedidoConCliente & {
  pedido_items:     ItemDetalle[]
  pedido_historial: HistorialDetalle[]
}

export type PedidoListItem = PedidoConCliente

// ─── Tipo para ítems del formulario (strings para inputs numéricos) ───────────

export interface ItemForm {
  producto_id:       string
  producto_nombre:   string
  presentacion:      string
  cantidad:          string
  precio_unitario:   string
  precio_referencia: string
  costo_snapshot:    string
  bidon_nuevo:       boolean
}

// ─── Tipo de entrada para crear/editar pedido ─────────────────────────────────

export interface CrearPedidoInput {
  cliente_id:        string
  tipo_precio:       'minorista' | 'mayorista'
  direccion_entrega: string
  fecha_produccion:  string
  notas_internas:    string
  notas_produccion:  string
  costo_envio:       string
  costo_bidones:     string
  total_manual:      string
  items:             ItemForm[]
  accion:            'borrador' | 'confirmar'
}

// ─── Parseo de numéricos ──────────────────────────────────────────────────────
// Supabase retorna NUMERIC/DECIMAL como string — convertimos a number

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePedido(row: any): PedidoConCliente {
  return {
    ...row,
    costo_envio:     Number(row.costo_envio     ?? 0),
    costo_bidones:   Number(row.costo_bidones   ?? 0),
    total_calculado: Number(row.total_calculado ?? 0),
    total_manual:    row.total_manual  != null ? Number(row.total_manual)  : null,
    monto_cobrado:   row.monto_cobrado != null ? Number(row.monto_cobrado) : null,
  } as PedidoConCliente
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItemDetalle(item: any): ItemDetalle {
  return {
    ...item,
    cantidad:          Number(item.cantidad),
    precio_unitario:   Number(item.precio_unitario),
    precio_referencia: Number(item.precio_referencia),
    costo_snapshot:    Number(item.costo_snapshot ?? 0),
    bidon_nuevo:       item.bidon_nuevo ?? false,
    productos: item.productos
      ? {
          nombre:           item.productos.nombre,
          fragancia:        item.productos.fragancia   ?? null,
          presentacion:     Number(item.productos.presentacion),
          precio_minorista: Number(item.productos.precio_minorista),
          precio_mayorista: Number(item.productos.precio_mayorista),
        }
      : null,
  } as ItemDetalle
}

// ─── Select para listas ───────────────────────────────────────────────────────

const LIST_SELECT = `
  id, numero, estado, tipo_precio, direccion_entrega, fecha_produccion,
  total_calculado, total_manual, costo_envio, costo_bidones, forma_cobro, monto_cobrado,
  fecha_cobro, estado_pago, motivo_falla,
  notas_produccion, notas_internas, created_at, updated_at, cliente_id,
  clientes!inner(nombre, direccion, tipo_cliente, telefono)
` as const

const KEY = ['pedidos']

// El Dashboard usa queryKey ['dashboard', fecha] — no comparte prefijo con
// 'pedidos', así que cualquier mutación que cambie cobros/estados debe
// invalidarlo explícitamente o el panel queda desactualizado hasta que
// venza el staleTime global.
function invalidarDashboard(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['dashboard'] })
}

// ─── usePedidos ───────────────────────────────────────────────────────────────

export const usePedidos = (filtros?: {
  estado?:          EstadoPedido
  estados?:         EstadoPedido[]
  clienteId?:       string
  fechaProduccion?: string
  q?:               string
}) =>
  useQuery({
    queryKey:        [...KEY, filtros],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from('pedidos')
        .select(LIST_SELECT)
        .order('created_at', { ascending: false })

      if (filtros?.estado)          q = q.eq('estado', filtros.estado)
      if (filtros?.estados?.length) q = q.in('estado', filtros.estados)
      if (filtros?.clienteId)       q = q.eq('cliente_id', filtros.clienteId)
      if (filtros?.fechaProduccion) q = q.eq('fecha_produccion', filtros.fechaProduccion)

      const { data, error } = await q
      if (error) throw new Error(error.message)

      let pedidos = (data ?? []).map(parsePedido)

      if (filtros?.q) {
        const lower = filtros.q.toLowerCase()
        pedidos = pedidos.filter(p =>
          String(p.numero).includes(filtros.q!) ||
          (p.clientes?.nombre ?? '').toLowerCase().includes(lower)
        )
      }
      return pedidos
    },
    refetchInterval: 30_000,
  })

// ─── usePedidoDetalle ─────────────────────────────────────────────────────────

export const usePedidoDetalle = (id: string | null) =>
  useQuery({
    queryKey: [...KEY, id],
    enabled:  !!id,
    queryFn: async () => {
      const [
        { data: pedido,       error: e1 },
        { data: itemsRaw,     error: e2 },
        { data: historialRaw, error: e3 },
      ] = await Promise.all([
        supabase
          .from('pedidos')
          .select(`
            id, numero, estado, tipo_precio, direccion_entrega, fecha_produccion,
            total_calculado, total_manual, costo_envio, costo_bidones, forma_cobro, monto_cobrado, fecha_cobro,
            estado_pago, notas_produccion, notas_internas, notas_entrega, motivo_falla,
            motivo_anulacion, created_at, updated_at, cliente_id,
            clientes!inner(nombre, direccion, tipo_cliente, telefono)
          `)
          .eq('id', id!)
          .maybeSingle(),
        supabase
          .from('pedido_items')
          .select('*, productos(nombre, fragancia, presentacion, precio_minorista, precio_mayorista)')
          .eq('pedido_id', id!),
        supabase
          .from('pedido_historial')
          .select('*, perfiles(nombre)')
          .eq('pedido_id', id!)
          .order('created_at', { ascending: true }),
      ])

      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)
      if (e3) throw new Error(e3.message)
      if (!pedido) throw new Error('Pedido no encontrado')

      return {
        ...parsePedido(pedido),
        pedido_items:     (itemsRaw    ?? []).map(parseItemDetalle),
        pedido_historial: (historialRaw ?? []) as HistorialDetalle[],
      } as PedidoDetalle
    },
  })

// ─── fetchPedidoDetalle — imperativo para uso fuera de hooks ─────────────────

export async function fetchPedidoDetalle(id: string): Promise<PedidoDetalle> {
  const [
    { data: pedido,       error: e1 },
    { data: itemsRaw,     error: e2 },
    { data: historialRaw, error: e3 },
  ] = await Promise.all([
    supabase
      .from('pedidos')
      .select(`
        id, numero, estado, tipo_precio, direccion_entrega, fecha_produccion,
        total_calculado, total_manual, costo_envio, costo_bidones, forma_cobro, monto_cobrado, fecha_cobro,
        notas_produccion, notas_internas, notas_entrega, motivo_falla,
        motivo_anulacion, created_at, updated_at, cliente_id, estado_pago,
        clientes!inner(nombre, direccion, tipo_cliente, telefono)
      `)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('pedido_items')
      .select('*, productos(nombre, fragancia, presentacion, precio_minorista, precio_mayorista)')
      .eq('pedido_id', id),
    supabase
      .from('pedido_historial')
      .select('*, perfiles(nombre)')
      .eq('pedido_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  if (e3) throw new Error(e3.message)
  if (!pedido) throw new Error('Pedido no encontrado')

  return {
    ...parsePedido(pedido),
    pedido_items:     (itemsRaw    ?? []).map(parseItemDetalle),
    pedido_historial: (historialRaw ?? []) as HistorialDetalle[],
  } as PedidoDetalle
}

// ─── useCrearPedido ───────────────────────────────────────────────────────────

export const useCrearPedido = () => {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)

  return useMutation({
    mutationFn: async (data: CrearPedidoInput) => {
      const estadoInicial: EstadoPedido =
        data.accion === 'confirmar' ? 'en_produccion' : 'borrador'
      const costoEnvio    = parseFloat(data.costo_envio) || 0
      const costoBidones  = parseFloat(data.costo_bidones) || 0
      const subtotal      = data.items.reduce(
        (acc, item) => acc + parseFloat(item.cantidad) * parseFloat(item.precio_unitario),
        0
      )
      const totalCalculado = subtotal + costoEnvio + costoBidones

      const { data: pedido, error: e1 } = await supabase
        .from('pedidos')
        .insert({
          cliente_id:        data.cliente_id,
          tipo_precio:       data.tipo_precio,
          direccion_entrega: data.direccion_entrega || null,
          fecha_produccion:  data.fecha_produccion  || null,
          notas_internas:    data.notas_internas    || null,
          notas_produccion:  data.notas_produccion  || null,
          costo_envio:       costoEnvio,
          costo_bidones:     costoBidones,
          total_calculado:   totalCalculado,
          total_manual:      data.total_manual ? parseFloat(data.total_manual) : null,
          estado:            estadoInicial,
          creado_por:        usuario?.id ?? null,
        })
        .select(LIST_SELECT)
        .single()

      if (e1) throw new Error(e1.message)

      await Promise.all([
        supabase.from('pedido_items').insert(
          data.items.map(item => ({
            pedido_id:         pedido.id,
            producto_id:       item.producto_id,
            cantidad:          parseFloat(item.cantidad),
            precio_unitario:   parseFloat(item.precio_unitario),
            precio_referencia: parseFloat(item.precio_referencia),
            costo_snapshot:    parseFloat(item.costo_snapshot) || 0,
            bidon_nuevo:       item.bidon_nuevo,
          }))
        ),
        supabase.from('pedido_historial').insert({
          pedido_id:       pedido.id,
          estado_anterior: null,
          estado_nuevo:    estadoInicial,
          usuario_id:      usuario?.id ?? null,
          notas:           'Pedido creado',
        }),
      ])

      return parsePedido(pedido)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      invalidarDashboard(qc)
    },
  })
}

// ─── useEditarPedido ──────────────────────────────────────────────────────────

export const useEditarPedido = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, items, ...data }: Partial<CrearPedidoInput> & { id: string }) => {
      const costoEnvio   = data.costo_envio   != null ? parseFloat(data.costo_envio)   || 0 : undefined
      const costoBidones = data.costo_bidones != null ? parseFloat(data.costo_bidones) || 0 : undefined

      let totalCalculado: number | undefined
      if (items && items.length > 0 && costoEnvio !== undefined && costoBidones !== undefined) {
        const subtotal = items.reduce(
          (acc, item) => acc + parseFloat(item.cantidad) * parseFloat(item.precio_unitario),
          0
        )
        totalCalculado = subtotal + costoEnvio + costoBidones
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (data.direccion_entrega !== undefined) patch.direccion_entrega = data.direccion_entrega || null
      if (data.fecha_produccion  !== undefined) patch.fecha_produccion  = data.fecha_produccion  || null
      if (data.notas_internas    !== undefined) patch.notas_internas    = data.notas_internas    || null
      if (data.notas_produccion  !== undefined) patch.notas_produccion  = data.notas_produccion  || null
      if (costoEnvio             !== undefined) patch.costo_envio       = costoEnvio
      if (costoBidones           !== undefined) patch.costo_bidones     = costoBidones
      if (data.total_manual      !== undefined) patch.total_manual      = data.total_manual ? parseFloat(data.total_manual) : null
      if (totalCalculado         !== undefined) patch.total_calculado   = totalCalculado

      const { error: updateErr } = await supabase.from('pedidos').update(patch).eq('id', id)
      if (updateErr) throw new Error(updateErr.message)

      if (items && items.length > 0) {
        const { error: delErr } = await supabase.from('pedido_items').delete().eq('pedido_id', id)
        if (delErr) throw new Error(delErr.message)

        const { error: insErr } = await supabase.from('pedido_items').insert(
          items.map(item => ({
            pedido_id:         id,
            producto_id:       item.producto_id,
            cantidad:          parseFloat(item.cantidad),
            precio_unitario:   parseFloat(item.precio_unitario),
            precio_referencia: parseFloat(item.precio_referencia),
            costo_snapshot:    parseFloat(item.costo_snapshot) || 0,
            bidon_nuevo:       item.bidon_nuevo,
          }))
        )
        if (insErr) throw new Error(insErr.message)
      }

      const { data: updated, error } = await supabase
        .from('pedidos').select(LIST_SELECT).eq('id', id).single()

      if (error) throw new Error(error.message)
      return parsePedido(updated)
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: [...KEY, id] })
      invalidarDashboard(qc)
    },
  })
}

// ─── useCambiarEstado ─────────────────────────────────────────────────────────

export const useCambiarEstado = () => {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)

  return useMutation({
    mutationFn: async ({ id, estadoActual, estado, notas }: {
      id:            string
      estadoActual?: EstadoPedido
      estado:        EstadoPedido
      notas?:        string
    }) => {
      let estadoAnterior: EstadoPedido | undefined = estadoActual

      if (!estadoAnterior) {
        const { data, error } = await supabase
          .from('pedidos').select('estado').eq('id', id).maybeSingle()
        if (error) throw new Error(error.message)
        estadoAnterior = data?.estado as EstadoPedido
      }

      const { error } = await supabase.rpc('cambiar_estado_pedido', {
        p_pedido_id:       id,
        p_estado_nuevo:    estado,
        p_estado_anterior: estadoAnterior,
        p_usuario_id:      usuario?.id ?? null,
        p_notas:           notas ?? null,
      })
      if (error) throw new Error(error.message)
    },

    onMutate: async ({ id, estado }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const snapshots = qc.getQueriesData<PedidoConCliente[]>({ queryKey: KEY })
      qc.setQueriesData<PedidoConCliente[]>({ queryKey: KEY }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(p => p.id === id ? { ...p, estado } : p)
      })
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['produccion'] })
      invalidarDashboard(qc)
    },
  })
}

// ─── useAnularPedido ──────────────────────────────────────────────────────────

export const useAnularPedido = () => {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)

  return useMutation({
    mutationFn: async ({ id, motivo, estadoActual }: {
      id:            string
      motivo:        string
      estadoActual?: EstadoPedido
    }) => {
      let estadoAnterior: EstadoPedido | undefined = estadoActual

      if (!estadoAnterior) {
        const { data } = await supabase
          .from('pedidos').select('estado').eq('id', id).maybeSingle()
        estadoAnterior = data?.estado as EstadoPedido
      }

      const { error } = await supabase.rpc('anular_pedido', {
        p_pedido_id:       id,
        p_estado_anterior: estadoAnterior,
        p_motivo:          motivo,
        p_usuario_id:      usuario?.id ?? null,
      })
      if (error) throw new Error(error.message)
    },

    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const snapshots = qc.getQueriesData<PedidoConCliente[]>({ queryKey: KEY })
      qc.setQueriesData<PedidoConCliente[]>({ queryKey: KEY }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(p => p.id === id ? { ...p, estado: 'anulado' } : p)
      })
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['produccion'] })
      invalidarDashboard(qc)
    },
  })
}

// ─── useCerrarPedido ──────────────────────────────────────────────────────────
// Cierra un pedido en_reparto: registra cobro y cambia estado a 'cerrado' en un solo RPC.

export const useCerrarPedido = () => {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)

  return useMutation({
    mutationFn: async ({ id, estadoActual, forma_cobro, monto_cobrado, estado_pago, notas_entrega, fecha_cobro }: {
      id:              string
      estadoActual:    EstadoPedido
      forma_cobro:     'efectivo' | 'transferencia' | 'pendiente'
      monto_cobrado?:  string
      estado_pago:     'cobrado' | 'pendiente'
      notas_entrega?:  string
      fecha_cobro?:    string
    }) => {
      const fechaCobroFinal = forma_cobro === 'pendiente'
        ? null
        : (fecha_cobro ?? new Date().toISOString().split('T')[0])

      const { error } = await supabase.rpc('cerrar_pedido', {
        p_pedido_id:       id,
        p_estado_anterior: estadoActual,
        p_forma_cobro:     forma_cobro,
        p_monto_cobrado:   monto_cobrado ? parseFloat(monto_cobrado) : null,
        p_estado_pago:     estado_pago,
        p_notas_entrega:   notas_entrega ?? null,
        p_fecha_cobro:     fechaCobroFinal,
        p_usuario_id:      usuario?.id ?? null,
      })
      if (error) throw new Error(error.message)
    },

    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const snapshots = qc.getQueriesData<PedidoConCliente[]>({ queryKey: KEY })
      qc.setQueriesData<PedidoConCliente[]>({ queryKey: KEY }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map(p => p.id === id ? { ...p, estado: 'cerrado' as EstadoPedido } : p)
      })
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
      invalidarDashboard(qc)
    },
  })
}

// ─── useEditarCobro ───────────────────────────────────────────────────────────

export const useEditarCobro = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, forma_cobro, monto_cobrado, estado_pago, fecha_cobro }: {
      id:              string
      forma_cobro:     string
      monto_cobrado?:  string
      estado_pago?:    'cobrado' | 'pendiente'
      fecha_cobro?:    string
    }) => {
      const patch: Record<string, unknown> = {
        forma_cobro,
        monto_cobrado: monto_cobrado ? parseFloat(monto_cobrado) : null,
        updated_at:    new Date().toISOString(),
      }
      if (estado_pago !== undefined) patch.estado_pago = estado_pago
      if (fecha_cobro !== undefined) {
        patch.fecha_cobro = forma_cobro === 'pendiente'
          ? null
          : (fecha_cobro || new Date().toISOString().split('T')[0])
      }

      const { error } = await supabase
        .from('pedidos')
        .update(patch)
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      invalidarDashboard(qc)
    },
  })
}
