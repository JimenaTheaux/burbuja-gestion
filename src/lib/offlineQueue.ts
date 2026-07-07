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
  pagos?:        { forma_pago: string; monto: number }[]
  timestamp:     number
}

const DB_NAME    = 'burbuja-offline'
const DB_VERSION = 1
const STORE      = 'queue'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
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
