import { useEffect } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open:     boolean
  onClose:  () => void
  title:    string
  children: React.ReactNode
  footer?:  React.ReactNode
}

export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
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
          background: 'rgba(0,0,0,0.45)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer-panel"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          background: '#F4F6F8',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInDrawer 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header sticky */}
        <div style={{
          background: '#fff',
          borderBottom: '0.5px solid #D1D5DB',
          padding: '0 16px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2B3C' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="btn-press"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#4A5568', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          paddingBottom: footer ? 8 : 32,
          overscrollBehavior: 'contain',
        }}>
          {children}
        </div>

        {/* Footer fijo — botones siempre visibles aunque el teclado suba */}
        {footer && (
          <div style={{
            background: '#fff',
            borderTop: '0.5px solid #D1D5DB',
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
