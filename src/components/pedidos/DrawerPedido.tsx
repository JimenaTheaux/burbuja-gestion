import { useEffect, useState, useRef, useCallback } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, AlertTriangle, Package, ChevronUp, ChevronDown, Check, ArrowRight } from 'lucide-react'
import { Drawer }      from '@/components/common/Drawer'
import { FloatInput }  from '@/components/common/FloatInput'
import { ButtonGroup } from '@/components/common/ButtonGroup'
import { useClientes, useCrearCliente } from '@/services/clientes'
import { useProductos, useCategorias } from '@/services/productos'
import { useCrearPedido, useEditarPedido, type PedidoDetalle, type ItemForm, type CrearPedidoInput } from '@/services/pedidos'
import { useDebounce } from '@/hooks/useDebounce'
import type { Producto, Cliente } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productoId:       z.string().min(1, 'Seleccioná un producto'),
  productoNombre:   z.string(),
  presentacion:     z.string(),
  cantidad:         z.string().min(1).regex(/^\d+(\.\d+)?$/, 'Cantidad inválida'),
  precioUnitario:   z.string().min(1).regex(/^\d+(\.\d{0,2})?$/, 'Precio inválido'),
  precioReferencia: z.string(),
  costoSnapshot:    z.string(),
  bidonNuevo:       z.boolean(),
})

const schema = z.object({
  clienteId:        z.string().min(1, 'El cliente es obligatorio'),
  tipoPrecio:       z.enum(['minorista', 'mayorista']),
  fechaProduccion:  z.string().min(1, 'La fecha es obligatoria'),
  direccionEntrega: z.string().optional(),
  notasProduccion:  z.string().optional(),
  notasInternas:    z.string().optional(),
  costoEnvio:       z.string().optional(),
  costoBidones:     z.string().optional(),
  totalManual:      z.string().optional(),
  items:            z.array(itemSchema).min(1, 'Agregá al menos un producto'),
})

type FormData = z.infer<typeof schema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean
  onClose: () => void
  pedido:  PedidoDetalle | null
  onSaved: (msg: string) => void
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function SecLabel({ label, badge }: { label: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      {badge && (
        <span style={{
          fontSize: 10, background: '#F5F7F9', color: '#8E8E93',
          padding: '1px 6px', borderRadius: 99,
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#F5F7F9', margin: '4px 0' }} />
}

// ─── Toggle switch (bidón nuevo / reutilizable) ───────────────────────────────

function ToggleSwitch({ value, onChange, label }: {
  value:    boolean
  onChange: (v: boolean) => void
  label:    string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#1C1C1E' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 99,
          background: value ? '#3DD6B5' : '#E5E5EA',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s ease', flexShrink: 0, padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, background: '#fff', borderRadius: '50%',
          transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'block',
        }} />
      </button>
    </div>
  )
}

// ─── Selector de cliente ──────────────────────────────────────────────────────

function SelectorCliente({
  value, onChange, error,
}: {
  value:    string
  onChange: (id: string, tipo: 'minorista' | 'mayorista', dir: string) => void
  error?:   string
}) {
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)
  const qDebounced      = useDebounce(q, 300)
  const { data: clientes } = useClientes(qDebounced || undefined)
  const crearCliente       = useCrearCliente()

  const [miniOpen,     setMiniOpen]     = useState(false)
  const [miniNombre,   setMiniNombre]   = useState('')
  const [miniTel,      setMiniTel]      = useState('')
  const [miniDir,      setMiniDir]      = useState('')
  const [miniTipo,     setMiniTipo]     = useState<'minorista' | 'mayorista'>('minorista')
  const [miniErr,      setMiniErr]      = useState('')
  const [recienCreado, setRecienCreado] = useState<Cliente | null>(null)

  useEffect(() => {
    if (!value) { setQ(''); setOpen(false); setMiniOpen(false); setRecienCreado(null) }
  }, [value])

  const selected: Cliente | undefined =
    clientes?.find(c => c.id === value) ??
    (recienCreado !== null && recienCreado.id === value ? recienCreado : undefined)

  const guardarCliente = async () => {
    if (!miniNombre.trim()) { setMiniErr('El nombre es obligatorio'); return }
    setMiniErr('')
    try {
      const nuevo = await crearCliente.mutateAsync({
        nombre:       miniNombre.trim(),
        telefono:     miniTel.trim()  || null,
        direccion:    miniDir.trim()  || null,
        tipo_cliente: miniTipo,
        notas:        null,
        activo:       true,
      })
      setRecienCreado(nuevo)
      onChange(nuevo.id, nuevo.tipo_cliente, nuevo.direccion ?? '')
      setMiniOpen(false)
      setMiniNombre(''); setMiniTel(''); setMiniDir(''); setMiniTipo('minorista')
    } catch {
      setMiniErr('No se pudo crear el cliente')
    }
  }

  const cancelarMini = () => {
    setMiniOpen(false)
    setMiniNombre(''); setMiniTel(''); setMiniDir(''); setMiniTipo('minorista'); setMiniErr('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {selected ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: '#F5F7F9', borderRadius: 8,
          border: '0.5px solid #E5E5EA',
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 13, color: '#1C1C1E' }}>{selected.nombre}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#8E8E93' }}>
              {selected.tipo_cliente}{selected.direccion ? ` · ${selected.direccion}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onChange('', 'minorista', ''); setQ(''); setRecienCreado(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7EB8E8', fontSize: 11, fontWeight: 600, padding: '4px 8px' }}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Buscar cliente…"
              className="fi-input"
              style={{
                width: '100%', padding: '0 12px',
                border: `0.5px solid ${error ? '#D32F2F' : '#E5E5EA'}`,
                borderRadius: 8, outline: 0, background: '#fff',
                fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', color: '#1C1C1E',
              }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = '#7EB8E8' }}
              onBlurCapture={e  => { e.currentTarget.style.borderColor = error ? '#D32F2F' : '#E5E5EA' }}
            />
            {open && clientes && clientes.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: '#fff', border: '0.5px solid #E5E5EA', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 4,
              }}>
                {clientes.slice(0, 8).map(c => (
                  <button
                    key={c.id} type="button"
                    onClick={() => { onChange(c.id, c.tipo_cliente, c.direccion ?? ''); setQ(c.nombre); setOpen(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 12px',
                      background: 'none', border: 'none', cursor: 'pointer', display: 'block',
                      borderBottom: '0.5px solid #F5F7F9',
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{c.nombre}</span>
                    <span style={{
                      marginLeft: 8, fontSize: 9, fontWeight: 700,
                      background: c.tipo_cliente === 'mayorista' ? '#EBF5FF' : '#F5F7F9',
                      color:      c.tipo_cliente === 'mayorista' ? '#7EB8E8'  : '#8E8E93',
                      padding: '1px 6px', borderRadius: 99,
                    }}>
                      {c.tipo_cliente.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={() => { setMiniOpen(v => !v); setMiniErr('') }}
            style={{ fontSize: 12, color: '#7EB8E8', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0', alignSelf: 'flex-start' }}>
            {miniOpen ? '− Cerrar' : '+ Nuevo cliente'}
          </button>

          <div style={{ overflow: 'hidden', maxHeight: miniOpen ? 600 : 0, transition: 'max-height 0.2s ease' }}>
            <div style={{
              background: '#E8F6FC', borderRadius: 8, padding: 12,
              border: '0.5px solid #E5E5EA', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4,
            }}>
              <FloatInput label="Nombre *"  value={miniNombre} onChange={e => setMiniNombre(e.target.value)} />
              <FloatInput label="Teléfono"  value={miniTel}    onChange={e => setMiniTel(e.target.value)}    type="tel" inputMode="tel" />
              <FloatInput label="Dirección" value={miniDir}    onChange={e => setMiniDir(e.target.value)} />

              <div style={{ display: 'flex', gap: 8 }}>
                {(['minorista', 'mayorista'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setMiniTipo(t)}
                    style={{
                      flex: 1, height: 34, borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `0.5px solid ${miniTipo === t ? '#3DD6B5' : '#E5E5EA'}`,
                      background: miniTipo === t ? '#3DD6B5' : '#fff',
                      color: miniTipo === t ? '#fff' : '#8E8E93',
                      cursor: 'pointer',
                    }}>
                    {t === 'minorista' ? 'Min.' : 'May.'}
                  </button>
                ))}
              </div>

              {miniErr && <p style={{ color: '#D32F2F', fontSize: 12, margin: 0 }}>{miniErr}</p>}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={guardarCliente} disabled={crearCliente.isPending}
                  style={{
                    flex: 1,
                    background: crearCliente.isPending ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
                    color: '#fff', border: 'none', borderRadius: 8,
                    height: 40, fontSize: 13, fontWeight: 600,
                    cursor: crearCliente.isPending ? 'not-allowed' : 'pointer',
                  }}>
                  {crearCliente.isPending ? 'Guardando…' : 'Guardar cliente'}
                </button>
                <button type="button" onClick={cancelarMini}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8E8E93', fontSize: 13, padding: '8px', whiteSpace: 'nowrap' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {error && <p style={{ color: '#D32F2F', fontSize: 11, margin: 0 }}>{error}</p>}
    </div>
  )
}

// ─── Card compacta de ítem ya agregado ────────────────────────────────────────

function ItemCard({ index, watch, onEdit, onRemove }: {
  index:    number
  watch:    ReturnType<typeof useForm<FormData>>['watch']
  onEdit:   () => void
  onRemove: () => void
}) {
  const nombre         = watch(`items.${index}.productoNombre`)
  const presentacion   = watch(`items.${index}.presentacion`)
  const cantidad       = watch(`items.${index}.cantidad`)
  const precioUnitario = watch(`items.${index}.precioUnitario`)
  const bidonNuevo     = watch(`items.${index}.bidonNuevo`)

  const subtotal = (Number(cantidad) || 0) * (Number(precioUnitario) || 0)

  return (
    <div
      style={{
        background: '#F9FAFB', border: '0.5px solid #E5E5EA', borderRadius: 8,
        padding: '8px 12px', cursor: 'pointer', animation: 'fadeSlideIn 0.18s ease',
      }}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit() } }}
      aria-label={`Editar ${nombre || 'ítem'}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 12, color: '#1C1C1E', flex: 1 }}>
          {nombre || '—'}
        </span>
        {bidonNuevo && (
          <span style={{ fontSize: 9, fontWeight: 700, background: '#FFF3E0', color: '#E65100', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
            BIDÓN NUEVO
          </span>
        )}
        {presentacion && (
          <span style={{ fontSize: 9, background: '#F5F7F9', color: '#8E8E93', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
            {presentacion}L
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 500, color: '#3DD6B5', flexShrink: 0 }}>
          ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          aria-label={`Eliminar ${nombre || 'ítem'}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E5E5EA', padding: 2, flexShrink: 0, lineHeight: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#D32F2F' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E5E5EA' }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>
        x{cantidad} · ${Number(precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })} c/u
      </div>
    </div>
  )
}

// ─── Selector de producto con búsqueda ───────────────────────────────────────

function SelectorProducto({
  value, onChange, productos, error,
}: {
  value:     string
  onChange:  (id: string) => void
  productos: Producto[]
  error?:    string
}) {
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)

  const selected = productos.find(p => p.id === value)

  const filtrados = productos.filter(p => p.activo && (
    !q ||
    p.nombre.toLowerCase().includes(q.toLowerCase()) ||
    (p.fragancia ?? '').toLowerCase().includes(q.toLowerCase())
  ))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {selected ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px 0 12px', background: '#EBF5FF', borderRadius: 8,
          border: '0.5px solid #7EB8E8', minHeight: 40,
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.nombre}{selected.fragancia ? ` (${selected.fragancia})` : ''}
            <span style={{ marginLeft: 6, fontSize: 9, background: '#E8FAF6', color: '#3DD6B5', padding: '1px 5px', borderRadius: 99 }}>
              {selected.presentacion}L
            </span>
          </span>
          <button
            type="button"
            onClick={() => { onChange(''); setQ('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7EB8E8', fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar producto…"
            className="fi-input"
            style={{
              width: '100%', padding: '0 12px',
              border: `0.5px solid ${error ? '#D32F2F' : '#E5E5EA'}`,
              borderRadius: 8, outline: 0, background: '#fff',
              fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', color: '#1C1C1E',
            }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = '#7EB8E8' }}
            onBlurCapture={e  => { e.currentTarget.style.borderColor = error ? '#D32F2F' : '#E5E5EA' }}
          />
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
              background: '#fff', border: '0.5px solid #E5E5EA', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 4,
            }}>
              {filtrados.length > 0 ? filtrados.slice(0, 12).map(p => (
                <button
                  key={p.id} type="button"
                  onClick={() => { onChange(p.id); setQ(''); setOpen(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '0.5px solid #F5F7F9',
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: 13, color: '#1C1C1E', flex: 1 }}>
                    {p.nombre}
                    {p.fragancia && <span style={{ fontWeight: 400, color: '#8E8E93' }}> ({p.fragancia})</span>}
                  </span>
                  <span style={{ fontSize: 9, background: '#F5F7F9', color: '#8E8E93', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
                    {p.presentacion}L
                  </span>
                </button>
              )) : (
                <div style={{ padding: '10px 12px', fontSize: 12, color: '#8E8E93' }}>
                  {q ? 'Sin coincidencias' : 'No hay productos activos'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {error && <span style={{ color: '#D32F2F', fontSize: 11, marginTop: 4, display: 'block' }}>{error}</span>}
    </div>
  )
}

// ─── Formulario inline de ítem (editar o agregar) ────────────────────────────

interface ItemFormInlineProps {
  index?:    number
  control?:  ReturnType<typeof useForm<FormData>>['control']
  register?: ReturnType<typeof useForm<FormData>>['register']
  watch?:    ReturnType<typeof useForm<FormData>>['watch']
  setValue?: ReturnType<typeof useForm<FormData>>['setValue']
  productos:  (Producto & { categoriaNombre?: string })[]
  tipoPrecio: 'minorista' | 'mayorista'
  onConfirm:  (item?: {
    productoId:       string
    productoNombre:   string
    presentacion:     string
    cantidad:         string
    precioUnitario:   string
    precioReferencia: string
    costoSnapshot:    string
    bidonNuevo:       boolean
  }) => void
  onCancel:   () => void
  confirmLabel?: string
}

function ItemFormInline({
  index, control, register, watch, setValue,
  productos, tipoPrecio, onConfirm, onCancel, confirmLabel = 'Agregar ítem',
}: ItemFormInlineProps) {
  const isEdit = index !== undefined && index >= 0

  const { data: categorias } = useCategorias()
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null)

  const productosFiltrados = categoriaSeleccionada
    ? productos.filter(p => p.categoria_id === categoriaSeleccionada)
    : productos

  const [lProdId,  setLProdId]  = useState('')
  const [lCant,    setLCant]    = useState('1')
  const [lPrecio,  setLPrecio]  = useState('')
  const [lPrecRef, setLPrecRef] = useState('')
  const [lCosto,   setLCosto]   = useState('0')
  const [lBidon,   setLBidon]   = useState(false)
  const [lErr,     setLErr]     = useState('')

  const eProducId   = isEdit ? watch?.(`items.${index!}.productoId`)       : lProdId
  const eCant       = isEdit ? watch?.(`items.${index!}.cantidad`)          : lCant
  const ePrecio     = isEdit ? watch?.(`items.${index!}.precioUnitario`)    : lPrecio
  const ePrecRef    = isEdit ? watch?.(`items.${index!}.precioReferencia`)  : lPrecRef
  const eBidon      = isEdit ? watch?.(`items.${index!}.bidonNuevo`)        : lBidon

  const productoSel = productos.find(p => p.id === eProducId)

  useEffect(() => {
    if (!productoSel) return
    const precio = String(tipoPrecio === 'mayorista' ? productoSel.precio_mayorista : productoSel.precio_minorista)
    const costo  = String(productoSel.costo_produccion ?? 0)
    if (isEdit && setValue && index !== undefined) {
      setValue(`items.${index}.precioUnitario`,   precio)
      setValue(`items.${index}.precioReferencia`, precio)
      setValue(`items.${index}.costoSnapshot`,    costo)
      setValue(`items.${index}.productoNombre`,   productoSel.nombre)
      setValue(`items.${index}.presentacion`,     String(productoSel.presentacion))
    } else {
      setLPrecio(precio)
      setLPrecRef(precio)
      setLCosto(costo)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eProducId, tipoPrecio])

  const subtotal = (Number(eCant) || 0) * (Number(ePrecio) || 0)

  const precioActual = productoSel
    ? (tipoPrecio === 'mayorista' ? productoSel.precio_mayorista : productoSel.precio_minorista)
    : null
  const precioDesact = productoSel && precioActual !== null && ePrecRef !== undefined &&
    Number(precioActual) !== Number(ePrecRef)

  const handleConfirm = () => {
    if (isEdit) { onConfirm(); return }
    if (!lProdId) { setLErr('Seleccioná un producto'); return }
    if (!lCant || !/^\d+(\.\d+)?$/.test(lCant)) { setLErr('Cantidad inválida'); return }
    if (!lPrecio || !/^\d+(\.\d{0,2})?$/.test(lPrecio)) { setLErr('Precio inválido'); return }
    setLErr('')
    onConfirm({
      productoId:       lProdId,
      productoNombre:   productoSel?.nombre ?? '',
      presentacion:     String(productoSel?.presentacion ?? ''),
      cantidad:         lCant,
      precioUnitario:   lPrecio,
      precioReferencia: lPrecRef,
      costoSnapshot:    lCosto,
      bidonNuevo:       lBidon,
    })
  }

  return (
    <div style={{
      background: '#F5F7F9', borderRadius: 8, padding: 12,
      border: '0.5px solid #E5E5EA', display: 'flex', flexDirection: 'column',
      gap: 10, animation: 'fadeSlideIn 0.18s ease', marginTop: 4,
    }}>
      {/* Filtro por categoría */}
      {categorias && categorias.length > 0 && (
        <div>
          <label style={{ fontSize: 10, fontWeight: 500, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            Categoría
          </label>
          <div className="hide-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              type="button"
              onClick={() => setCategoriaSeleccionada(null)}
              style={{
                height: 30, padding: '0 14px', borderRadius: 99, flexShrink: 0,
                border: `0.5px solid ${categoriaSeleccionada === null ? '#3DD6B5' : '#E5E5EA'}`,
                background: categoriaSeleccionada === null ? '#E8FAF6' : '#fff',
                color: categoriaSeleccionada === null ? '#3DD6B5' : '#8E8E93',
                fontSize: 12, fontWeight: categoriaSeleccionada === null ? 600 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              Todos
            </button>
            {categorias.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaSeleccionada(categoriaSeleccionada === cat.id ? null : cat.id)}
                style={{
                  height: 30, padding: '0 14px', borderRadius: 99, flexShrink: 0,
                  border: `0.5px solid ${categoriaSeleccionada === cat.id ? '#3DD6B5' : '#E5E5EA'}`,
                  background: categoriaSeleccionada === cat.id ? '#E8FAF6' : '#fff',
                  color: categoriaSeleccionada === cat.id ? '#3DD6B5' : '#8E8E93',
                  fontSize: 12, fontWeight: categoriaSeleccionada === cat.id ? 600 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selector de producto con búsqueda */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 500, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
          Producto
        </label>
        {isEdit && control && index !== undefined ? (
          <Controller
            name={`items.${index}.productoId`}
            control={control}
            render={({ field, fieldState }) => (
              <SelectorProducto
                value={field.value}
                onChange={field.onChange}
                productos={productosFiltrados}
                error={fieldState.error?.message}
              />
            )}
          />
        ) : (
          <SelectorProducto
            value={lProdId}
            onChange={id => { setLProdId(id); setLErr('') }}
            productos={productosFiltrados}
            error={lErr && !lProdId ? lErr : undefined}
          />
        )}
      </div>

      {/* Cantidad + precio */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {isEdit && register && index !== undefined ? (
          <>
            <FloatInput label="Cantidad" {...register(`items.${index}.cantidad`)} inputMode="decimal" />
            <FloatInput
              label="Precio unit."
              {...register(`items.${index}.precioUnitario`)}
              inputMode="decimal"
              hint={precioDesact ? `Actual: $${Number(precioActual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : undefined}
            />
          </>
        ) : (
          <>
            <FloatInput label="Cantidad"    value={lCant}   onChange={e => setLCant(e.target.value)}   inputMode="decimal" />
            <FloatInput label="Precio unit." value={lPrecio} onChange={e => setLPrecio(e.target.value)} inputMode="decimal" />
          </>
        )}
      </div>

      {/* Alerta precio desactualizado */}
      {isEdit && precioDesact && setValue && index !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F57C00', background: '#FFF3E0', padding: '6px 10px', borderRadius: 6 }}>
          <AlertTriangle size={11} />
          Precio cambió a ${Number(precioActual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          <button type="button"
            onClick={() => setValue(`items.${index}.precioUnitario`, String(precioActual ?? 0))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F57C00', fontWeight: 700, fontSize: 11, textDecoration: 'underline' }}>
            Actualizar
          </button>
        </div>
      )}

      {/* Toggle bidón nuevo */}
      {isEdit && setValue && index !== undefined ? (
        <ToggleSwitch label="Bidón nuevo" value={eBidon ?? false} onChange={v => setValue(`items.${index!}.bidonNuevo`, v)} />
      ) : (
        <ToggleSwitch label="Bidón nuevo" value={lBidon} onChange={setLBidon} />
      )}

      {/* Subtotal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#8E8E93' }}>Subtotal</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#3DD6B5' }}>
          ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {lErr && <span style={{ color: '#D32F2F', fontSize: 11 }}>{lErr}</span>}

      {/* Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={handleConfirm}
          style={{ flex: 1, background: '#3DD6B5', color: '#fff', border: 'none', borderRadius: 8, height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}
          style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 12, cursor: 'pointer', padding: '6px 10px', whiteSpace: 'nowrap' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

export function DrawerPedido({ open, onClose, pedido, onSaved }: Props) {
  const crear  = useCrearPedido()
  const editar = useEditarPedido()
  const saving = crear.isPending || editar.isPending

  const { data: productos } = useProductos()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: buildDefaults(pedido),
    })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [addingNew,   setAddingNew]   = useState(false)
  const [notasOpen,   setNotasOpen]   = useState(false)

  useEffect(() => {
    if (!open) return
    reset(buildDefaults(pedido))
    setExpandedIdx(null)
    setAddingNew(false)
    setNotasOpen(false)
  }, [open, pedido])

  const tipoPrecio   = watch('tipoPrecio')
  const costoEnvio   = watch('costoEnvio')
  const costoBidones = watch('costoBidones')
  const totalManual  = watch('totalManual')
  const itemsWatch   = watch('items')

  const subtotalProductos = (itemsWatch ?? []).reduce(
    (acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.precioUnitario) || 0), 0
  )
  const totalCalculado = subtotalProductos + (Number(costoEnvio) || 0) + (Number(costoBidones) || 0)
  const totalMostrado  = totalManual ? Number(totalManual) : totalCalculado
  const totalEditado   = !!totalManual && Number(totalManual) !== totalCalculado

  const handleClose = () => { reset(); onClose() }

  const submit = async (data: FormData, accion: 'borrador' | 'confirmar') => {
    const mapped: CrearPedidoInput = {
      cliente_id:        data.clienteId,
      tipo_precio:       data.tipoPrecio,
      fecha_produccion:  data.fechaProduccion ?? '',
      direccion_entrega: data.direccionEntrega ?? '',
      notas_produccion:  data.notasProduccion ?? '',
      notas_internas:    data.notasInternas ?? '',
      costo_envio:       data.costoEnvio ?? '0',
      costo_bidones:     data.costoBidones ?? '0',
      total_manual:      data.totalManual ?? '',
      items: data.items.map((item): ItemForm => ({
        producto_id:       item.productoId,
        producto_nombre:   item.productoNombre,
        presentacion:      item.presentacion,
        cantidad:          item.cantidad,
        precio_unitario:   item.precioUnitario,
        precio_referencia: item.precioReferencia,
        costo_snapshot:    item.costoSnapshot,
        bidon_nuevo:       item.bidonNuevo,
      })),
      accion,
    }
    try {
      if (pedido) {
        await editar.mutateAsync({ id: pedido.id, ...mapped })
        onSaved('Pedido actualizado')
      } else {
        await crear.mutateAsync(mapped)
        onSaved(accion === 'confirmar' ? 'Pedido confirmado y enviado a producción' : 'Borrador guardado')
        reset()
      }
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al guardar') + '|error')
    }
  }

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 80)
  }, [])

  const handleAgregarNuevo = () => {
    setExpandedIdx(null)
    setAddingNew(true)
    scrollToBottom()
  }

  const handleItemAdded = (item: {
    productoId: string; productoNombre: string; presentacion: string
    cantidad: string; precioUnitario: string; precioReferencia: string; costoSnapshot: string; bidonNuevo: boolean
  }) => {
    append(item)
    setAddingNew(false)
    scrollToBottom()
  }

  const handleItemRemoved = (idx: number) => {
    remove(idx)
    if (expandedIdx === idx) setExpandedIdx(null)
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1)
  }

  const canEdit = !pedido || ['borrador', 'confirmado', 'en_produccion'].includes(pedido.estado)

  const footer = canEdit ? (
    <>
      <button
        type="button"
        onClick={handleSubmit(d => submit(d, 'confirmar'))}
        disabled={saving}
        style={{
          background: saving ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
          color: '#fff', border: 'none', borderRadius: 10,
          height: 44, fontSize: 14, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {saving
          ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Guardando…</>
          : pedido ? 'Guardar cambios' : <><Check size={15} /> Confirmar pedido <ArrowRight size={15} /> Producción</>
        }
      </button>
      {!pedido && (
        <button
          type="button"
          onClick={handleSubmit(d => submit(d, 'borrador'))}
          disabled={saving}
          style={{
            background: 'transparent', color: '#3DD6B5',
            border: '0.5px solid #3DD6B5', borderRadius: 10,
            height: 38, fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', width: '100%',
          }}
        >
          Guardar borrador
        </button>
      )}
    </>
  ) : undefined

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={pedido ? `Pedido P-${String(pedido.numero).padStart(5, '0')}` : 'Nuevo pedido'}
      footer={footer}
      scrollRef={scrollRef}
      panelStyle={{ width: '100%', maxWidth: 560 }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {!canEdit && (
          <div style={{
            background: '#FFF3E0', border: '1px solid #F57C00', borderRadius: 8,
            padding: '10px 12px', fontSize: 13, color: '#F57C00',
          }}>
            Este pedido está en estado <strong>{pedido?.estado}</strong> y no se puede editar.
          </div>
        )}

        {/* ── BLOQUE 1 — Cliente ──────────────────────────────────────────────── */}
        <div>
          <SecLabel label="Cliente" />
          <Controller
            name="clienteId"
            control={control}
            render={({ field, fieldState }) => (
              <SelectorCliente
                value={field.value}
                error={fieldState.error?.message}
                onChange={(id, tipo, dir) => {
                  field.onChange(id)
                  if (id) {
                    setValue('tipoPrecio', tipo)
                    setValue('direccionEntrega', dir)
                  }
                }}
              />
            )}
          />
        </div>

        <Divider />

        {/* ── BLOQUE 2 — Tipo de precio + Fecha ──────────────────────────────── */}
        <div className="form-grid-2">
          <ButtonGroup
            label="Tipo de precio"
            compact
            value={tipoPrecio}
            onChange={v => setValue('tipoPrecio', v as 'minorista' | 'mayorista')}
            options={[
              { value: 'minorista', label: 'Min.' },
              { value: 'mayorista', label: 'May.', color: '#7EB8E8' },
            ]}
          />
          <FloatInput
            label="Fecha de producción *"
            type="date"
            error={errors.fechaProduccion?.message}
            {...register('fechaProduccion')}
          />
        </div>

        <Divider />

        {/* ── BLOQUE 3 — Productos ────────────────────────────────────────────── */}
        <div>
          <SecLabel
            label="Productos"
            badge={fields.length > 0 ? `${fields.length} ítem${fields.length !== 1 ? 's' : ''}` : undefined}
          />

          {(errors.items?.root?.message || errors.items?.message) && (
            <p style={{ color: '#D32F2F', fontSize: 12, marginBottom: 8 }}>
              {errors.items?.root?.message ?? errors.items?.message}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.length === 0 && !addingNew && (
              <button type="button" onClick={handleAgregarNuevo}
                style={{
                  background: '#F5F7F9', border: '1.5px dashed #E5E5EA', borderRadius: 8,
                  padding: '20px', cursor: 'pointer', color: '#8E8E93',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13,
                  width: '100%',
                }}>
                <Package size={16} /> Agregar primer producto
              </button>
            )}

            {fields.map((field, i) => (
              expandedIdx === i ? (
                <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    background: '#EBF5FF', borderRadius: '8px 8px 0 0',
                    border: '0.5px solid #7EB8E8', borderBottom: 'none',
                  }}>
                    <ChevronUp size={13} color="#7EB8E8" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#7EB8E8', flex: 1 }}>
                      {watch(`items.${i}.productoNombre`) || 'Ítem'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleItemRemoved(i)}
                      aria-label={`Eliminar ${watch(`items.${i}.productoNombre`) || 'ítem'}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', lineHeight: 0, padding: 2 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#D32F2F' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ border: '0.5px solid #7EB8E8', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                    <ItemFormInline
                      index={i}
                      control={control}
                      register={register}
                      watch={watch}
                      setValue={setValue}
                      productos={productos ?? []}
                      tipoPrecio={tipoPrecio}
                      confirmLabel="Actualizar ítem"
                      onConfirm={() => setExpandedIdx(null)}
                      onCancel={() => setExpandedIdx(null)}
                    />
                  </div>
                </div>
              ) : (
                <ItemCard
                  key={field.id}
                  index={i}
                  watch={watch}
                  onEdit={() => { setAddingNew(false); setExpandedIdx(i) }}
                  onRemove={() => handleItemRemoved(i)}
                />
              )
            ))}

            {addingNew ? (
              <ItemFormInline
                productos={productos ?? []}
                tipoPrecio={tipoPrecio}
                confirmLabel="Agregar ítem"
                onConfirm={item => { if (item) handleItemAdded(item) }}
                onCancel={() => setAddingNew(false)}
              />
            ) : fields.length > 0 && (
              <button type="button" onClick={handleAgregarNuevo}
                style={{
                  background: 'transparent', border: '0.5px dashed #E5E5EA', borderRadius: 8,
                  height: 36, cursor: 'pointer', width: '100%',
                  color: '#8E8E93', fontSize: 12, fontWeight: 400,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7EB8E8'; (e.currentTarget as HTMLButtonElement).style.color = '#7EB8E8'; (e.currentTarget as HTMLButtonElement).style.background = '#F0F9FF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E5EA'; (e.currentTarget as HTMLButtonElement).style.color = '#8E8E93'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                + Agregar producto
              </button>
            )}
          </div>
        </div>

        <Divider />

        {/* ── BLOQUE 4 — Totales ──────────────────────────────────────────────── */}
        <div>
          <div style={{ background: '#F5F7F9', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>Subtotal</span>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>
                ${subtotalProductos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Envío con input inline */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>Envío</span>
              <input
                {...register('costoEnvio')}
                inputMode="decimal"
                placeholder="0"
                style={{
                  width: 80, height: 28, border: '0.5px solid #E5E5EA', borderRadius: 6,
                  padding: '0 8px', fontSize: 12, textAlign: 'right',
                  fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff', color: '#1C1C1E',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7EB8E8' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#E5E5EA' }}
              />
            </div>

            {/* Bidones con input inline */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>Bidones</span>
              <input
                {...register('costoBidones')}
                inputMode="decimal"
                placeholder="0"
                style={{
                  width: 80, height: 28, border: '0.5px solid #E5E5EA', borderRadius: 6,
                  padding: '0 8px', fontSize: 12, textAlign: 'right',
                  fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff', color: '#1C1C1E',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7EB8E8' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#E5E5EA' }}
              />
            </div>

            <div style={{ height: '0.5px', background: '#E5E5EA' }} />

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: totalEditado ? '#F57C00' : '#3DD6B5', letterSpacing: '-0.3px' }}>
                ${totalMostrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {totalEditado && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#F57C00' }}>
                <span>Modificado · calculado: ${totalCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                <button type="button" onClick={() => setValue('totalManual', '')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7EB8E8', fontSize: 11, fontWeight: 600, textDecoration: 'underline', padding: 0 }}>
                  Restaurar
                </button>
              </div>
            )}
          </div>

          {/* Total manual — campo oculto salvo que quieran override */}
          {!totalEditado && (
            <div style={{ marginTop: 6 }}>
              <FloatInput
                label="Total manual (opcional — deja vacío para calculado)"
                {...register('totalManual')}
                inputMode="decimal"
                style={{ textAlign: 'right' } as React.CSSProperties}
              />
            </div>
          )}
        </div>

        {/* ── BLOQUE 5 — Notas (colapsado) ────────────────────────────────────── */}
        <div style={{ border: '0.5px solid #E5E5EA', borderRadius: 8, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setNotasOpen(v => !v)}
            style={{
              width: '100%', padding: '9px 12px', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, color: '#1C1C1E' }}>
              Notas y detalles <span style={{ color: '#9CA3AF' }}>(opcional)</span>
            </span>
            <ChevronDown size={14} color="#8E8E93" style={{ transform: notasOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <div style={{ display: 'grid', gridTemplateRows: notasOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease' }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FloatInput label="Dirección de entrega" {...register('direccionEntrega')} />
                <FloatInput
                  label="Notas para producción"
                  as="textarea"
                  hint="Visible en el área de producción"
                  {...register('notasProduccion')}
                />
                <FloatInput
                  label="Notas internas (solo admin)"
                  as="textarea"
                  hint="Solo visible para administración"
                  {...register('notasInternas')}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </Drawer>
  )
}

// ─── Helper defaults ──────────────────────────────────────────────────────────

function buildDefaults(pedido: PedidoDetalle | null): FormData {
  return {
    clienteId:        pedido?.cliente_id         ?? '',
    tipoPrecio:       pedido?.tipo_precio         ?? 'minorista',
    fechaProduccion:  pedido?.fecha_produccion    ?? '',
    direccionEntrega: pedido?.direccion_entrega   ?? '',
    notasProduccion:  pedido?.notas_produccion    ?? '',
    notasInternas:    pedido?.notas_internas      ?? '',
    costoEnvio:       String(pedido?.costo_envio    ?? 0),
    costoBidones:     String(pedido?.costo_bidones  ?? 0),
    totalManual:      pedido?.total_manual != null ? String(pedido.total_manual) : '',
    items: pedido?.pedido_items?.map(i => ({
      productoId:       i.producto_id,
      productoNombre:   i.productos?.nombre ?? '',
      presentacion:     String(i.productos?.presentacion ?? ''),
      cantidad:         String(i.cantidad),
      precioUnitario:   String(i.precio_unitario),
      precioReferencia: String(i.precio_referencia),
      costoSnapshot:    String(i.costo_snapshot ?? 0),
      bidonNuevo:       i.bidon_nuevo,
    })) ?? [],
  }
}
