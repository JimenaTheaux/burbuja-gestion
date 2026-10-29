import { openDB } from 'idb'
import type { EstadoPedido } from '@/types'

export interface OfflineAction {
  id:            string
  type:          'cambiarEstado' | 'cerrarPedido'
  pedidoId:      string
  estadoActual:  EstadoPedido
  // cambiarEstado
  estadoNuevo?:  EstadoPedido
  notas?:        string
  // cerrarPedido
  // fecha_pago se fija al encolar (cerrar_pedido la respeta; si falta usa hoy_local())
  pagos?:        { forma_pago: string; monto: number; fecha_pago?: string }[]
  timestamp:     number
}

// Acción que el servidor rechazó por una regla de negocio: no se reintenta
// sola ni se borra en silencio; queda hasta que alguien la descarte a mano.
export interface AccionFallida extends OfflineAction {
  motivo:    string
  numero:    number | null   // P-00XXX si se pudo leer al fallar
  fallidaEn: number
}

const DB_NAME    = 'burbuja-offline'
const DB_VERSION = 2          // v2: store 'fallidas' (la cola 'queue' no cambia)
const STORE      = 'queue'
const FALLIDAS   = 'fallidas'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FALLIDAS)) {
        db.createObjectStore(FALLIDAS, { keyPath: 'id' })
      }
    },
  })
}

export async function addToQueue(action: OfflineAction): Promise<void> {
  const db = await getDB()
  await db.put(STORE, action)
}

export async function getQueue(): Promise<OfflineAction[]> {
  const db = await getDB()
  return db.getAll(STORE)
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORE)
}

// Saca la acción de la cola y la guarda en 'fallidas' en una sola transacción.
export async function moverAFallidas(fallida: AccionFallida): Promise<void> {
  const db = await getDB()
  const tx = db.transaction([STORE, FALLIDAS], 'readwrite')
  await Promise.all([
    tx.objectStore(FALLIDAS).put(fallida),
    tx.objectStore(STORE).delete(fallida.id),
    tx.done,
  ])
}

export async function getFallidas(): Promise<AccionFallida[]> {
  const db = await getDB()
  return db.getAll(FALLIDAS)
}

export async function descartarFallida(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(FALLIDAS, id)
}
