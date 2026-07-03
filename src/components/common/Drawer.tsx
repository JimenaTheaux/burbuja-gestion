import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface DrawerProps {
  open:        boolean
  onClose:     () => void
  title:       string
  children:    React.ReactNode
  footer?:     React.ReactNode
  scrollRef?:  React.RefObject<HTMLDivElement | null>
  panelStyle?: React.CSSProperties
}

export function Drawer({ open, onClose, title, children, footer, scrollRef, panelStyle }: DrawerProps) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Overlay — click fuera cierra */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
          pointerEvents: 'auto',
          ...(isDesktop && {
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }),
        }}
      >
        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="drawer-panel"
          onClick={e => e.stopPropagation()}
          style={{
            position: isDesktop ? 'relative' : 'fixed',
            ...(isDesktop
              ? { width: 480, maxWidth: '100%', maxHeight: '85vh', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', animation: 'dialogIn 0.18s ease' }
              : { top: 0, left: 0, right: 0, bottom: 0, animation: 'slideUpDrawer 0.25s ease' }),
            background: '#F5F7F9',
            zIndex: 201,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Un Sheet (Radix) que se cierra en el mismo tick deja
            // document.body.style.pointerEvents = 'none' hasta que termina
            // su animación de salida (~300ms). Sin este override, este panel
            // hereda ese `none` y queda inclickeable/no-tipeable al abrirse
            // justo cuando se cierra un Sheet (p.ej. Editar pedido).
            pointerEvents: 'auto',
            ...(!isDesktop ? panelStyle : undefined),
          }}
        >
          {/* Header sticky */}
          <div style={{
            background: '#fff',
            borderBottom: '0.5px solid #E5E5EA',
            padding: isDesktop ? '0 20px' : '0 16px',
            height: isDesktop ? 52 : 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="btn-press"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#8E8E93', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
              }}
            >
              <X size={isDesktop ? 16 : 18} />
            </button>
          </div>

          {/* Body scrollable */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: isDesktop ? '16px 20px' : 16,
              paddingBottom: footer ? 8 : 'max(32px, calc(16px + env(safe-area-inset-bottom)))',
              overscrollBehavior: 'contain',
            }}
          >
            {children}
          </div>

          {/* Footer fijo — botones siempre visibles aunque el teclado suba */}
          {footer && (
            <div
              className="drawer-footer"
              style={{
                background: '#fff',
                borderTop: '0.5px solid #E5E5EA',
                padding: isDesktop ? '12px 20px' : '12px 16px',
                paddingBottom: isDesktop ? 12 : 'max(12px, env(safe-area-inset-bottom))',
                flexShrink: 0,
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
