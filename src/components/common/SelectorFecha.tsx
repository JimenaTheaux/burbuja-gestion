import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DIAS  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function hoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

function navegar(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function etiquetaCorta(fecha: string): string {
  const d   = new Date(fecha + 'T00:00:00')
  const dia = d.getDate()
  const mes = MESES[d.getMonth()]
  if (fecha === hoyISO()) return `Hoy · ${dia} ${mes}`
  return `${DIAS[d.getDay()]} ${dia} ${mes}`
}

interface SelectorFechaProps {
  fecha:    string
  onChange: (fecha: string) => void
}

export function SelectorFecha({ fecha, onChange }: SelectorFechaProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef                    = useRef<HTMLInputElement>(null)
  const esHoy                       = fecha === hoyISO()

  useEffect(() => {
    if (pickerOpen) inputRef.current?.focus()
  }, [pickerOpen])

  const btnNavStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6,
    border: '0.5px solid #E5E5EA', background: '#fff',
    color: '#8E8E93', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    outline: 'none',
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

        {/* ‹ Día anterior */}
        <button
          aria-label="Día anterior"
          onClick={() => onChange(navegar(fecha, -1))}
          style={btnNavStyle}
          onMouseEnter={e => (e.currentTarget.style.background = '#F5F7F9')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Texto fecha — clic abre picker */}
        <button
          onClick={() => setPickerOpen(v => !v)}
          style={{
            minWidth: 110, textAlign: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 6,
            fontSize: 13,
            fontWeight: esHoy ? 500 : 400,
            color: esHoy ? '#3DD6B5' : '#1C1C1E',
          }}
        >
          {etiquetaCorta(fecha)}
        </button>

        {/* Día siguiente › */}
        <button
          aria-label="Día siguiente"
          onClick={() => onChange(navegar(fecha, 1))}
          style={btnNavStyle}
          onMouseEnter={e => (e.currentTarget.style.background = '#F5F7F9')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <ChevronRight size={14} />
        </button>

        {/* Botón Hoy — solo cuando no es hoy */}
        {!esHoy && (
          <button
            onClick={() => { onChange(hoyISO()); setPickerOpen(false) }}
            style={{
              fontSize: 11, color: '#3DD6B5',
              border: '0.5px solid #3DD6B5',
              borderRadius: 99, padding: '2px 10px',
              background: '#fff', cursor: 'pointer', outline: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#EBF5FF')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            Hoy
          </button>
        )}
      </div>

      {/* Date picker nativo (dropdown bajo el selector) */}
      {pickerOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: '#fff', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10,
        }}>
          <input
            ref={inputRef}
            type="date"
            value={fecha}
            onChange={e => {
              if (e.target.value) onChange(e.target.value)
              setPickerOpen(false)
            }}
            onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
            style={{
              padding: '6px 10px', border: '1px solid #E5E5EA',
              borderRadius: 8, fontSize: 13, fontFamily: 'Inter Variable, sans-serif',
              outline: 'none', cursor: 'pointer',
            }}
            onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
          />
        </div>
      )}
    </div>
  )
}
