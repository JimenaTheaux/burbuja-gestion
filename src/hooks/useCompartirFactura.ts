import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import { createElement } from 'react'
import { FacturaCanvas } from '@/components/pedidos/FacturaCanvas'
import type { PedidoDetalle } from '@/services/pedidos'
import { formatNumero } from '@/types'

export function useCompartirFactura() {
  const [loading, setLoading] = useState(false)

  const compartir = async (
    pedido: PedidoDetalle,
    onError?: (msg: string) => void,
  ) => {
    setLoading(true)

    // 1. Montar FacturaCanvas en div oculto
    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;pointer-events:none'
    document.body.appendChild(container)

    let canvas: HTMLCanvasElement | null = null

    try {
      // 2. Renderizar el componente React en el container
      await new Promise<void>(resolve => {
        const root = createRoot(container)
        root.render(createElement(FacturaCanvas, { pedido }))
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      // 3. Capturar con html2canvas
      canvas = await html2canvas(container, {
        scale:           2,
        useCORS:         true,
        backgroundColor: '#ffffff',
        width:           600,
        logging:         false,
      })
    } catch (err) {
      console.error('useCompartirFactura: error al generar imagen', err)
      onError?.('No se pudo generar la imagen. Intentá de nuevo.')
      document.body.removeChild(container)
      setLoading(false)
      return
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container)
      }
    }

    if (!canvas) {
      onError?.('No se pudo generar la imagen. Intentá de nuevo.')
      setLoading(false)
      return
    }

    // 4. Convertir canvas a Blob JPG
    let blob: Blob
    try {
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas!.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob falló'))), 'image/jpeg', 0.95)
      )
    } catch {
      onError?.('No se pudo generar la imagen. Intentá de nuevo.')
      setLoading(false)
      return
    }

    const numeroFormateado = `P-${String(pedido.numero).padStart(5, '0')}`
    const clienteSlug = (pedido.clientes?.nombre ?? 'cliente')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 30)
    const fileName = `burbuja-${numeroFormateado}-${clienteSlug}.jpg`
    const file     = new File([blob], fileName, { type: 'image/jpeg' })
    const numero   = formatNumero(pedido.numero)

    // Limpiar teléfono: quitar no-dígitos, 0 inicial y 54 si ya lo tenía
    const telefono = pedido.clientes?.telefono
      ?.replace(/\D/g, '')
      ?.replace(/^0/, '')
      ?.replace(/^54/, '') ?? ''

    const mensaje = encodeURIComponent(
      `Hola! Te comparto el detalle de tu pedido Burbuja 🫧 (${numero})`
    )

    const esMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (esMobile) {
      // Intentar Web Share API primero (más moderno)
      if (
        navigator.share &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Factura ${numero}`,
          })
          setLoading(false)
          return
        } catch (err) {
          if ((err as Error)?.name !== 'AbortError') {
            console.warn('useCompartirFactura: share nativo falló, usando fallback', err)
          } else {
            setLoading(false)
            return
          }
        }
      }

      // Fallback mobile: descargar JPG + abrir WhatsApp nativo
      const objectUrl = URL.createObjectURL(blob)
      const a         = document.createElement('a')
      a.href          = objectUrl
      a.download      = fileName
      a.click()
      URL.revokeObjectURL(objectUrl)

      const waUrl = telefono
        ? `whatsapp://send?phone=54${telefono}&text=${mensaje}`
        : `whatsapp://send?text=${mensaje}`
      window.location.href = waUrl
    } else {
      // Desktop: descargar JPG + abrir WhatsApp Web en nueva pestaña
      const objectUrl = URL.createObjectURL(blob)
      const a         = document.createElement('a')
      a.href          = objectUrl
      a.download      = fileName
      a.click()
      URL.revokeObjectURL(objectUrl)

      const waUrl = telefono
        ? `https://web.whatsapp.com/send?phone=54${telefono}&text=${mensaje}`
        : `https://web.whatsapp.com/send?text=${mensaje}`
      window.open(waUrl, '_blank')
    }

    setLoading(false)
  }

  return { compartir, loading }
}
