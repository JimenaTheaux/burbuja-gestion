import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/store/authStore'
import type { FormaPago, PedidoPago } from '@/types'

const KEY = queryKeys.pedidos.all()

// pedidoPagos vive bajo el prefijo 'pedidos' a propósito: así cualquier
// invalidateQueries({ queryKey: KEY }) ya existente (cambiar estado, anular,
// etc.) invalida también estas queries sin tocar cada call site.
function invalidarDashboard(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() })
}

// ─── usePagosPedido — historial de pagos de un pedido ────────────────────────

export const usePagosPedido = (pedidoId: string | null) =>
  useQuery({
    queryKey: [...KEY, 'pagos', pedidoId],
    enabled:  !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedido_pagos')
        .select('id, pedido_id, forma_pago, monto, fecha_pago, created_at')
        .eq('pedido_id', pedidoId!)
        .order('fecha_pago', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []).map(p => ({ ...p, monto: Number(p.monto) })) as PedidoPago[]
    },
  })

// ─── useRegistrarPago — agrega un pago a un pedido ya cerrado/pendiente ──────

export const useRegistrarPago = () => {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)

  return useMutation({
    mutationFn: async ({ pedido_id, forma_pago, monto, fecha_pago }: {
      pedido_id:  string
      forma_pago: FormaPago
      monto:      number
      fecha_pago?: string
    }) => {
      const { error } = await supabase.rpc('registrar_pago', {
        p_pedido_id:  pedido_id,
        p_usuario_id: usuario?.id ?? null,
        p_forma_pago: forma_pago,
        p_monto:      monto,
        p_fecha_pago: fecha_pago ?? new Date().toISOString().split('T')[0],
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      invalidarDashboard(qc)
    },
  })
}

// ─── usePendientesCobro — pedidos cerrados con saldo pendiente ───────────────

export interface PedidoPendienteDetalle {
  id:               string
  numero:           number
  clienteNombre:    string
  clienteTelefono:  string | null
  fechaProduccion:  string | null
  totalPedido:      number
  pagos:            { forma_pago: FormaPago; monto: number; fecha_pago: string }[]
  totalPagado:       number
  restante:          number
}

export const usePendientesCobro = () =>
  useQuery({
    queryKey:        [...KEY, 'pendientes-cobro'],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id, numero, total_calculado, total_manual, fecha_produccion,
          clientes (nombre, telefono),
          pedido_pagos (forma_pago, monto, fecha_pago)
        `)
        .eq('estado', 'cerrado')
        .eq('estado_pago', 'pendiente')
        .order('fecha_produccion', { ascending: true })
      if (error) throw new Error(error.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pedidos: PedidoPendienteDetalle[] = (data ?? []).map((p: any) => {
        const totalPedido = Number(p.total_manual ?? p.total_calculado ?? 0)
        const pagos = (p.pedido_pagos ?? []).map((pg: any) => ({
          forma_pago: pg.forma_pago as FormaPago,
          monto:      Number(pg.monto),
          fecha_pago: pg.fecha_pago,
        }))
        const totalPagado = pagos.reduce((s: number, pg: { monto: number }) => s + pg.monto, 0)
        return {
          id:              p.id,
          numero:          p.numero,
          clienteNombre:   p.clientes?.nombre ?? '—',
          clienteTelefono: p.clientes?.telefono ?? null,
          fechaProduccion: p.fecha_produccion,
          totalPedido,
          pagos,
          totalPagado,
          restante: Math.max(0, totalPedido - totalPagado),
        }
      })

      return {
        count:   pedidos.length,
        total:   pedidos.reduce((s, p) => s + p.restante, 0),
        pedidos,
      }
    },
    refetchInterval: 30_000,
    staleTime:       0,
  })
