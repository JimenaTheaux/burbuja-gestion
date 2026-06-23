import { CheckCircle, XCircle, Info, X } from 'lucide-react'

interface Toast {
  id:      number
  message: string
  type:    'success' | 'error' | 'info'
}

const STYLES = {
  success: { bg: '#E8F8F0', border: '#2E9E5C', color: '#145A32' },
  error:   { bg: '#FDECEA', border: '#D32F2F', color: '#B71C1C' },
  info:    { bg: '#E8F4FF', border: '#1B9ED6', color: '#0D5C8A' },
}

const ICONS = {
  success: <CheckCircle size={15} strokeWidth={2} />,
  error:   <XCircle    size={15} strokeWidth={2} />,
  info:    <Info        size={15} strokeWidth={2} />,
}

interface Props {
  toasts:  Toast[]
  dismiss: (id: number) => void
}

export function ToastContainer({ toasts, dismiss }: Props) {
  if (!toasts.length) return null

  return (
    <>
      <style>{`
        .toast-container {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          pointer-events: none;
        }
        @media (min-width: 768px) {
          .toast-container {
            top: auto;
            bottom: 24px;
            right: 24px;
            left: auto;
            transform: none;
            align-items: flex-end;
          }
        }
        .toast-item {
          pointer-events: all;
          animation: toastSlideDown 0.25s ease;
        }
        @media (min-width: 768px) {
          .toast-item { animation: toastSlideUp 0.25s ease; }
        }
        @keyframes toastSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="toast-container">
        {toasts.map(t => {
          const s = STYLES[t.type]
          return (
            <div
              key={t.id}
              className="toast-item"
              style={{
                background:   s.bg,
                border:       `1px solid ${s.border}`,
                borderRadius: 10,
                padding:      '10px 14px',
                fontSize:     13,
                fontWeight:   500,
                color:        s.color,
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                boxShadow:    '0 4px 12px rgba(0,0,0,0.10)',
                minWidth:     200,
                maxWidth:     320,
                position:     'relative',
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {ICONS[t.type]}
              </span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: s.color,
                  padding: 2, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  opacity: 0.6,
                }}
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
