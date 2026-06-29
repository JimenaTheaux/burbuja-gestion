import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addToQueue, getQueue, removeFromQueue, getQueueCount,
  type OfflineAction,
} from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { EstadoPedido } from '@/types'

// ─── Tipos públicos ───────────────────────────────────────────────────────────
// Mismas RPCs que el flujo online (cambiar_estado_pedido / cerrar_pedido) —
// así la cola offline respeta la misma validación de rol y queda registrada
// en pedido_historial, en vez de hacer UPDATE directo sobre `pedidos`.

export type AddActionInput =
  | { type: 'cambiarEstado'; pedidoId: string; estadoActual: EstadoPedido; estadoNuevo: EstadoPedido; notas?: string }
  | { type: 'cerrarPedido';  pedidoId: string; estadoActual: EstadoPedido; formaCobro: string; montoCobrado?: string; estadoPago: 'cobrado' | 'pendiente'; notasEntrega?: string; fechaCobro?: string }

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
              p_pedido_id:       action.pedidoId,
              p_estado_anterior: action.estadoActual,
              p_forma_cobro:     action.formaCobro,
              p_monto_cobrado:   action.montoCobrado ? parseFloat(action.montoCobrado) : null,
              p_estado_pago:     action.estadoPago,
              p_notas_entrega:   action.notasEntrega ?? null,
              p_fecha_cobro:     action.formaCobro === 'pendiente'
                ? null
                : (action.fechaCobro ?? new Date().toISOString().split('T')[0]),
              p_usuario_id:      usuario?.id ?? null,
            })
            if (error) throw new Error(error.message)
          }
          await removeFromQueue(action.id)
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
    const action: OfflineAction = {
      ...input,
      id:        crypto.randomUUID(),
      timestamp: Date.now(),
    }
    await addToQueue(action)
    await refreshCount()
  }, [refreshCount])

  return { isOnline, pendingCount, syncing, addAction, sync }
}
