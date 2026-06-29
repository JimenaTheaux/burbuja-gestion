import { Share2 } from 'lucide-react'

interface BtnWhatsappProps {
  onClick:       () => void
  loading?:      boolean
  disabled?:     boolean
  numeroLabel?:  string   // para aria-label
  variante?:     'icono' | 'pill'
}

export function BtnWhatsapp({
  onClick,
  loading   = false,
  disabled  = false,
  numeroLabel,
  variante  = 'icono',
}: BtnWhatsappProps) {
  const ariaLabel = `Compartir factura${numeroLabel ? ` del pedido ${numeroLabel}` : ''} por WhatsApp`
  const isDisabled = disabled || loading

  if (variante === 'pill') {
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick() }}
        disabled={isDisabled}
        aria-label={ariaLabel}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            6,
          width:          '100%',
          height:         44,
          padding:        '0 14px',
          borderRadius:   10,
          background:     isDisabled ? 'rgba(37,211,102,0.5)' : '#25D366',
          color:          '#fff',
          border:         'none',
          fontSize:       14,
          fontWeight:     600,
          cursor:         isDisabled ? 'not-allowed' : 'pointer',
          transition:     'background 0.15s',
          whiteSpace:     'nowrap',
          fontFamily:     'Inter, sans-serif',
        }}
        onMouseEnter={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = '#1ebe5a' }}
        onMouseLeave={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = '#25D366' }}
      >
        <Share2 size={15} />
        {loading ? 'Generando…' : 'Compartir factura'}
      </button>
    )
  }

  // variante "icono"
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      disabled={isDisabled}
      aria-label={ariaLabel}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           28,
        height:          28,
        borderRadius:    6,
        background:      isDisabled ? '#F5F7F9' : 'transparent',
        border:          '0.5px solid #E5E5EA',
        cursor:          isDisabled ? 'not-allowed' : 'pointer',
        color:           isDisabled ? '#E5E5EA' : '#25D366',
        flexShrink:      0,
        transition:      'background 0.15s',
      }}
      onMouseEnter={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = '#F0FDF4' }}
      onMouseLeave={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {loading
        ? <span style={{ fontSize: 10, color: '#8E8E93' }}>…</span>
        : <Share2 size={14} />
      }
    </button>
  )
}
