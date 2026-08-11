import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdater() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Chequear actualizaciones cada hora (pestaña abierta todo el día)
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000)
      }
    }
  })

  useEffect(() => {
    if (!needRefresh) return

    // Si no hay input/dialog activo, recargar silenciosamente
    const hayDialogAbierto = document.querySelector('[role="dialog"]')
    const hayInputFocused = document.activeElement?.tagName === 'INPUT'
      || document.activeElement?.tagName === 'TEXTAREA'

    if (!hayDialogAbierto && !hayInputFocused) {
      updateServiceWorker(true)
      return
    }

    // Si hay algo en curso, reintentar cada 15s
    const interval = setInterval(() => {
      const dialogAbierto = document.querySelector('[role="dialog"]')
      const inputFocused = document.activeElement?.tagName === 'INPUT'
        || document.activeElement?.tagName === 'TEXTAREA'

      if (!dialogAbierto && !inputFocused) {
        updateServiceWorker(true)
        clearInterval(interval)
      }
    }, 15_000)

    return () => clearInterval(interval)
  }, [needRefresh, updateServiceWorker])

  return null  // sin UI — recarga silenciosa
}
