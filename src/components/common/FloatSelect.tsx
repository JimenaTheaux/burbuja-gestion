import { forwardRef } from 'react'

interface FloatSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  children: React.ReactNode
}

export const FloatSelect = forwardRef<HTMLSelectElement, FloatSelectProps>(
  ({ label, error, children, ...props }, ref) => {
    const hasValue = props.value !== '' && props.value !== undefined

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ position: 'relative' }}>
          <select
            ref={ref}
            style={{
              width:        '100%',
              padding:      hasValue ? '22px 10px 8px 10px' : '15px 10px',
              outline:      0,
              border:       '1px solid rgba(105,105,105,0.4)',
              borderRadius: 10,
              fontFamily:   'Inter, sans-serif',
              fontSize:     14,
              background:   'white',
              appearance:   'none',
              cursor:       'pointer',
              transition:   'border-color 0.2s ease, padding 0.2s ease',
              color:        hasValue ? '#1C1C1E' : 'rgba(88,87,87,0.82)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#3DD6B5' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(105,105,105,0.4)' }}
            {...props}
          >
            {children}
          </select>

          {/* Flecha custom */}
          <span style={{
            position:       'absolute',
            right:          10,
            top:            '50%',
            transform:      'translateY(-50%)',
            pointerEvents:  'none',
            color:          '#8E8E93',
            fontSize:       10,
          }}>▼</span>

          {/* Float label */}
          <span style={{
            position:    'absolute',
            left:        10,
            top:         hasValue ? 4 : 15,
            color:       hasValue ? '#3DD6B5' : 'rgba(88,87,87,0.82)',
            fontSize:    hasValue ? 10 : 14,
            fontWeight:  hasValue ? 600 : 400,
            transition:  'all 0.2s ease',
            pointerEvents: 'none',
            textTransform: hasValue ? 'uppercase' : 'none',
            letterSpacing: hasValue ? '0.08em' : 'normal',
          }}>
            {label}
          </span>
        </div>
        {error && (
          <p style={{ color: '#D32F2F', fontSize: 11, margin: '0 0 0 2px' }}>{error}</p>
        )}
      </div>
    )
  }
)
FloatSelect.displayName = 'FloatSelect'
