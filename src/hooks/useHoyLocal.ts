import { useEffect, useState } from 'react'
import { hoyLocal, msHastaMedianocheLocal } from '@/lib/fechas'

// "Hoy" en Argentina que se actualiza solo a la medianoche local: una vista
// abierta toda la noche (reparto, producción) pasa al día nuevo sin recargar.
export function useHoyLocal(): string {
  const [hoy, setHoy] = useState(hoyLocal)

  useEffect(() => {
    // +1 s de margen para no caer justo antes del cambio de día
    const t = setTimeout(() => setHoy(hoyLocal()), msHastaMedianocheLocal() + 1000)
    return () => clearTimeout(t)
  }, [hoy])

  return hoy
}
