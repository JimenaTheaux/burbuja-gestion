import { useState } from 'react'
import { Plus, X, CheckCircle2, AlertCircle } from 'lucide-react'
import type { FormaPago } from '@/types'

type FilaPago = {
  forma_pago: FormaPago
  monto:      string
}

type Props = {
  totalPedido: number
  onConfirmar: (pagos: { forma_pago: string; monto: number }[]) => void
  onCancelar:  () => void
  loading?:    boolean
}

const pesos = (n: number): string =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const inputSt: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 10px',
  border: '1px solid #E5E5EA', borderRadius: 10,
  fontSize: 13, fontFamily: 'Inter Variable, sans-serif',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}

export function FormPagos({ totalPedido, onConfirmar, onCancelar, loading }: Props) {
  const [pagos, setPagos] = useState<FilaPago[]>([
    { forma_pago: 'efectivo', monto: totalPedido > 0 ? String(Math.round(totalPedido)) : '' },
  ])

  const totalPagado = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  const diferencia  = totalPedido - totalPagado
  const completo    = Math.abs(diferencia) < 0.01

  const setFila = (i: number, patch: Partial<FilaPago>) => {
    setPagos(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  }

  const agregarFila = () => setPagos(prev => [...prev, { forma_pago: 'efectivo', monto: '' }])
  const quitarFila   = (i: number) => setPagos(prev => prev.filter((_, idx) => idx !== i))

  const handleConfirmar = () => {
    const validos = pagos
      .map(p => ({ forma_pago: p.forma_pago, monto: parseFloat(p.monto) || 0 }))
      .filter(p => p.monto > 0)
    onConfirmar(validos)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pagos.map((pago, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={pago.forma_pago}
            onChange={e => setFila(i, { forma_pago: e.target.value as FormaPago })}
            style={{ ...inputSt, flex: 1, cursor: 'pointer' }}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={pago.monto}
            onChange={e => setFila(i, { monto: e.target.value })}
            style={{ ...inputSt, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => quitarFila(i)}
            disabled={pagos.length === 1}
            aria-label="Quitar pago"
            style={{
              width: 40, height: 40, flexShrink: 0,
              border: '1px solid #E5E5EA', borderRadius: 10,
              background: 'transparent', color: pagos.length === 1 ? '#E5E5EA' : '#D32F2F',
              cursor: pagos.length === 1 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={agregarFila}
        style={{
          alignSelf: 'flex-start',
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', color: '#3DD6B5',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0',
          fontFamily: 'Inter Variable, sans-serif',
        }}
      >
        <Plus size={13} /> Agregar pago
      </button>

      {/* Resumen */}
      <div style={{ background: '#F5F7F9', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#8E8E93' }}>Total pedido</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{pesos(totalPedido)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#8E8E93' }}>Total pagado</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: totalPagado >= totalPedido ? '#28B99A' : '#1C1C1E' }}>
            {pesos(totalPagado)}
          </span>
        </div>
        <div style={{ height: 1, background: '#E5E5EA', margin: '2px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {completo
            ? <CheckCircle2 size={14} color="#28B99A" />
            : <AlertCircle size={14} color={diferencia > 0 ? '#C47B00' : '#2B6CB0'} />
          }
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: completo ? '#28B99A' : diferencia > 0 ? '#C47B00' : '#2B6CB0',
          }}>
            {completo
              ? 'Pago completo'
              : diferencia > 0
              ? `Queda pendiente ${pesos(diferencia)}`
              : `A favor ${pesos(Math.abs(diferencia))}`
            }
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={loading}
          aria-disabled={loading}
          style={{
            flex: 1, height: 44, border: 'none', borderRadius: 10,
            background: loading ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter Variable, sans-serif',
          }}
        >
          {loading ? 'Guardando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={loading}
          style={{
            flex: 1, height: 44, border: '1.5px solid #E5E5EA', borderRadius: 10,
            background: 'transparent', color: '#8E8E93', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter Variable, sans-serif',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
