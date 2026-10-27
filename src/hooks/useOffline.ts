import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addToQueue, getQueue, removeFromQueue, getQueueCount,
  type OfflineAction,
} from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { hoyLocal } from '@/lib/fechas'
import { useAuthStore } from '@/store/authStore'
import type { EstadoPedido } from '@/types'

// ─── Tipos públicos ───────────────────────────────────────────────────────────
// Mismas RPCs que el flujo online (cambiar_estado_pedido / cerrar_pedido) —
// así la cola offline respeta la misma validación de rol y queda registrada
// en pedido_historial, en vez de hacer UPDATE directo sobre `pedidos`.

export type AddActionInput =
  | { type: 'cambiarEstado'; pedidoId: string; estadoActual: EstadoPedido; estadoNuevo: EstadoPedido; notas?: string }
  | { type: 'cerrarPedido';  pedidoId: string; estadoActual: EstadoPedido; pagos: { forma_pago: string; monto: number; fecha_pago?: string }[]; notas?: string }

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOffline() {
  const usuario = useAuthStore(s => s.usuario)
  const [isOnline,     setIsOnline]     = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing,      setSyncing]      = useState(false)
  const syncingRef = useRef(false)

  // ── Leer cuenta de la cola ──────────────────────────────────────────────────

  const refreshCount = useCallback(async () => {
    const count = await getQueueCount()
    setPendingCount(count)
  }, [])

  useEffect(() => { refreshCount() }, [refreshCount])

  // ── Procesar cola al reconectar ─────────────────────────────────────────────

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)

    let procesadas = 0
    try {
      const queue = (await getQueue()).sort((a, b) => a.timestamp - b.timestamp)

      for (const action of queue) {
        try {
          if (action.type === 'cambiarEstado') {
            const { error } = await supabase.rpc('cambiar_estado_pedido', {
              p_pedido_id:       action.pedidoId,
              p_estado_nuevo:    action.estadoNuevo,
              p_estado_anterior: action.estadoActual,
              p_usuario_id:      usuario?.id ?? null,
              p_notas:           action.notas ?? null,
            })
            if (error) throw new Error(error.message)
          } else if (action.type === 'cerrarPedido') {
            const { error } = await supabase.rpc('cerrar_pedido', {
              p_pedido_id:  action.pedidoId,
              p_usuario_id: usuario?.id ?? null,
              p_pagos:      action.pagos,
              p_notas:      action.notas ?? null,
            })
            if (error) throw new Error(error.message)
          }
          await removeFromQueue(action.id)
          procesadas++
        } catch (e) {
          // Error de red → parar para reintentar después
          if (e instanceof TypeError) break
          // Error de API (404, estado inválido) → descartar para no bloquear la cola
          await removeFromQueue(action.id)
        }
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
      await refreshCount()
      // Una sola invalidación al terminar la cola (no por acción).
      if (procesadas > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pedidos.all() })
        queryClient.invalidateQueries({ queryKey: queryKeys.produccion.all() })
      }
    }
  }, [refreshCount])

  // ── Escuchar eventos de red ─────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      sync()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  // ── Agregar acción a la cola ────────────────────────────────────────────────

  const addAction = useCallback(async (input: AddActionInput) => {
    // La fecha de cada pago se fija al encolar (momento del cobro), no al
    // sincronizar: una cola que se vacía al día siguiente no cambia el día.
    const conFecha: AddActionInput = input.type === 'cerrarPedido'
      ? { ...input, pagos: input.pagos.map(p => ({ ...p, fecha_pago: p.fecha_pago ?? hoyLocal() })) }
      : input
    const action: OfflineAction = {
      ...conFecha,
      id:        crypto.randomUUID(),
      timestamp: Date.now(),
    }
    await addToQueue(action)
    await refreshCount()
  }, [refreshCount])

  return { isOnline, pendingCount, syncing, addAction, sync }
}
