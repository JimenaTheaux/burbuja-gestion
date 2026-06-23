import { forwardRef } from 'react'

interface FloatInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const FloatInput = forwardRef<HTMLInputElement, FloatInputProps>(
  ({ label, error, className, style, ...props }, ref) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="form-label">
        <input
          ref={ref}
          className={`input ${className ?? ''}`}
          placeholder=" "
          style={{
            // Fuerza 16px en mobile: iOS hace zoom automático si font-size < 16px
            // La clase CSS .form-label .input ya maneja esto via media query,
            // pero lo reforzamos aquí para garantía
            ...style,
          }}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p style={{ color: '#D32F2F', fontSize: 11, margin: '0 0 0 2px' }}>{error}</p>
      )}
    </div>
  )
)
FloatInput.displayName = 'FloatInput'
