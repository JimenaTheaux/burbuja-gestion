interface Option<T extends string> {
  value:   T
  label:   string
  color?:  string  // color activo personalizado (hex)
}

interface ButtonGroupProps<T extends string> {
  label:    string
  options:  Option<T>[]
  value:    T
  onChange: (val: T) => void
  error?:   string
  disabled?: boolean
  compact?:  boolean  // altura 34px, font 12px, borde 0.5px
}

export function ButtonGroup<T extends string>({
  label, options, value, onChange, error, disabled, compact,
}: ButtonGroupProps<T>) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: compact ? 5 : 6 }}>
      <span style={{
        fontSize: 10, fontWeight: compact ? 500 : 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#4A5568',
      }}>
        {label}
      </span>

      <div style={{ display: 'flex', gap: compact ? 6 : 8, flexWrap: compact ? undefined : 'wrap' }}>
        {options.map(opt => {
          const isSelected = opt.value === value
          const activeColor = opt.color ?? '#0D5C8A'

          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              style={{
                flex:         1,
                minWidth:     compact ? 0 : 80,
                height:       compact ? 34 : undefined,
                minHeight:    compact ? undefined : 44,
                padding:      compact ? '0 12px' : '10px 14px',
                borderRadius: compact ? 8 : 10,
                border:       `${compact ? '0.5px' : '1.5px'} solid ${isSelected ? activeColor : '#D1D5DB'}`,
                background:   isSelected ? activeColor : '#fff',
                color:        isSelected ? '#fff' : '#4A5568',
                fontSize:     compact ? 12 : 14,
                fontWeight:   isSelected ? (compact ? 500 : 600) : 400,
                cursor:       disabled ? 'not-allowed' : 'pointer',
                opacity:      disabled ? 0.5 : 1,
                transition:   'all 0.15s ease',
                fontFamily:   'Inter, sans-serif',
                whiteSpace:   'nowrap',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {error && (
        <p style={{ color: '#D32F2F', fontSize: 11, margin: '0 0 0 2px' }}>{error}</p>
      )}
    </div>
  )
}
