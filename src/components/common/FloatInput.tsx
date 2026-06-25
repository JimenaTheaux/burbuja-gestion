import { forwardRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FloatInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:      string
  error?:     string
  hint?:      string
  rightSlot?: React.ReactNode
  as?:        'input' | 'textarea'
  rows?:      number
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    500,
  color:         '#4A5568',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display:       'block',
  marginBottom:  5,
}

const BASE_INPUT: React.CSSProperties = {
  border:       '0.5px solid #D1D5DB',
  borderRadius: 8,
  fontFamily:   'Inter, sans-serif',
  color:        '#1A2B3C',
  outline:      'none',
  width:        '100%',
  boxSizing:    'border-box',
  transition:   'border-color 0.15s',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const FloatInput = forwardRef<HTMLInputElement, FloatInputProps>(
  (
    {
      label,
      error,
      hint,
      rightSlot,
      as: asEl = 'input',
      rows,
      style,
      id,
      name,
      disabled,
      onFocus: onFocusProp,
      onBlur:  onBlurProp,
      className: classNameProp,
      ...rest
    },
    ref,
  ) => {
    const inputId    = id ?? name
    const hasError   = !!error
    const borderBase = hasError ? '#D32F2F' : '#D1D5DB'
    const borderFocus = hasError ? '#D32F2F' : '#1B9ED6'

    // Composición de focus/blur para no sobreescribir los de RHF
    const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
      ;(e.currentTarget as HTMLElement).style.borderColor = borderFocus
      ;(onFocusProp as ((e: React.FocusEvent<HTMLElement>) => void) | undefined)?.(
        e as React.FocusEvent<HTMLInputElement>,
      )
    }
    const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
      ;(e.currentTarget as HTMLElement).style.borderColor = borderBase
      ;(onBlurProp as ((e: React.FocusEvent<HTMLElement>) => void) | undefined)?.(
        e as React.FocusEvent<HTMLInputElement>,
      )
    }

    const isTextarea = asEl === 'textarea'

    // height y fontSize vienen del CSS class fi-input / fi-textarea
    const inputStyle: React.CSSProperties = {
      ...BASE_INPUT,
      padding:    `0 ${rightSlot ? 44 : 12}px 0 12px`,
      borderColor: borderBase,
      background:  disabled ? '#F4F6F8' : '#fff',
      color:       disabled ? '#9CA3AF' : '#1A2B3C',
      cursor:      disabled ? 'not-allowed' : undefined,
      ...(style as React.CSSProperties),
    }

    const textareaStyle: React.CSSProperties = {
      ...BASE_INPUT,
      padding:     '8px 12px',
      resize:      'vertical',
      borderColor: borderBase,
      background:  disabled ? '#F4F6F8' : '#fff',
      color:       disabled ? '#9CA3AF' : '#1A2B3C',
      ...(style as React.CSSProperties),
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label htmlFor={inputId} style={LABEL_STYLE}>
          {label}
        </label>

        <div style={{ position: 'relative' }}>
          {isTextarea ? (
            <textarea
              id={inputId}
              name={name}
              rows={rows ?? 2}
              disabled={disabled}
              ref={ref as unknown as React.Ref<HTMLTextAreaElement>}
              className={`fi-textarea${classNameProp ? ` ${classNameProp}` : ''}`}
              style={textareaStyle}
              onFocus={handleFocus as React.FocusEventHandler<HTMLTextAreaElement>}
              onBlur={handleBlur as React.FocusEventHandler<HTMLTextAreaElement>}
              {...(rest as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              id={inputId}
              name={name}
              disabled={disabled}
              ref={ref}
              className={`fi-input${classNameProp ? ` ${classNameProp}` : ''}`}
              style={inputStyle}
              onFocus={handleFocus as React.FocusEventHandler<HTMLInputElement>}
              onBlur={handleBlur as React.FocusEventHandler<HTMLInputElement>}
              {...rest}
            />
          )}

          {rightSlot && !isTextarea && (
            <div
              style={{
                position:        'absolute',
                right:           0, top: 0, bottom: 0,
                width:           44,
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
              }}
            >
              {rightSlot}
            </div>
          )}
        </div>

        {error && (
          <span role="alert" style={{ color: '#D32F2F', fontSize: 11, marginTop: 4, display: 'block' }}>
            {error}
          </span>
        )}
        {hint && !error && (
          <span style={{ color: '#4A5568', fontSize: 11, marginTop: 4, display: 'block' }}>
            {hint}
          </span>
        )}
      </div>
    )
  },
)
FloatInput.displayName = 'FloatInput'
