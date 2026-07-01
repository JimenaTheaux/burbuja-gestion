import { useState, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Package, MoreHorizontal, Eye, EyeOff, Trash2, Pencil, ChevronDown, Check, X } from 'lucide-react'
import { Skeleton }       from '@/components/ui/skeleton'
import { Drawer }         from '@/components/common/Drawer'
import { FloatInput }     from '@/components/common/FloatInput'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import {
  useProductos, useCategorias,
  useCrearProducto, useEditarProducto, useCrearCategoria,
  useEditarCategoria, useBorrarCategoria, useBorrarProducto,
} from '@/services/productos'
import { useDebounce } from '@/hooks/useDebounce'
import { formatUnidad, type Producto } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const PRESENTACIONES = ['0.5', '3', '5', '10', '20'] as const

const schema = z.object({
  nombre:          z.string().min(1, 'El nombre es obligatorio'),
  fragancia:       z.string().optional(),
  categoriaId:     z.string().optional(),
  unidadMedida:    z.enum(['litros', 'un'], { message: 'Seleccioná una unidad' }),
  presentacion:    z.string().min(1, 'Requerido'),
  precioMinorista: z.string().min(1, 'Requerido').regex(/^\d+(\.\d{0,2})?$/, 'Precio inválido'),
  precioMayorista: z.string().min(1, 'Requerido').regex(/^\d+(\.\d{0,2})?$/, 'Precio inválido'),
  costoProduccion: z.string().optional().refine(v => !v || /^\d+(\.\d{0,2})?$/.test(v), 'Costo inválido'),
  codigo:          z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.unidadMedida === 'litros' && !PRESENTACIONES.includes(data.presentacion as typeof PRESENTACIONES[number])) {
    ctx.addIssue({ code: 'custom', path: ['presentacion'], message: 'Seleccioná una presentación' })
  }
})

type FormData = z.infer<typeof schema>

// ─── Drawer formulario ────────────────────────────────────────────────────────

interface DrawerProps {
  open:     boolean
  onClose:  () => void
  producto: Producto | null
  onSaved:  (msg: string) => void
}

const LABEL_S: React.CSSProperties = {
  fontSize: 10, fontWeight: 500, color: '#8E8E93',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 5,
}

function ProductoDrawer({ open, onClose, producto, onSaved }: DrawerProps) {
  const crear    = useCrearProducto()
  const editar   = useEditarProducto()
  const crearCat = useCrearCategoria()
  const { data: categorias } = useCategorias()
  const [catText, setCatText] = useState('')
  const [catDrop, setCatDrop] = useState(false)
  const [catErr,  setCatErr]  = useState('')
  const [activo,  setActivo]  = useState(producto?.activo ?? true)
  const saving = crear.isPending || editar.isPending

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre:          producto?.nombre                                                    ?? '',
      fragancia:       producto?.fragancia                                                 ?? '',
      categoriaId:     producto?.categoria_id                                              ?? '',
      unidadMedida:    producto?.unidad_medida === 'un' ? 'un' : 'litros',
      presentacion:    producto?.presentacion != null ? String(producto.presentacion) : '5',
      precioMinorista: producto?.precio_minorista != null ? String(producto.precio_minorista) : '',
      precioMayorista: producto?.precio_mayorista != null ? String(producto.precio_mayorista) : '',
      codigo:          producto?.codigo                                                    ?? '',
    },
  })

  const categoriaVal  = watch('categoriaId')
  const unidadMedidaVal = watch('unidadMedida')

  const onSubmit = async (data: FormData) => {
    const presentacionNum = data.unidadMedida === 'un' ? 1 : parseFloat(data.presentacion)
    const minorista       = parseFloat(data.precioMinorista)
    const mayorista       = parseFloat(data.precioMayorista)
    const costoProduccion = data.costoProduccion ? parseFloat(data.costoProduccion) : 0
    try {
      if (producto) {
        await editar.mutateAsync({
          id:               producto.id,
          nombre:           data.nombre,
          fragancia:        data.fragancia   || null,
          categoria_id:     data.categoriaId || null,
          unidad_medida:    data.unidadMedida,
          presentacion:     presentacionNum,
          precio_minorista: minorista,
          precio_mayorista: mayorista,
          costo_produccion: costoProduccion,
          codigo:           data.codigo      || null,
          activo,
        })
        onSaved('Producto actualizado correctamente')
      } else {
        await crear.mutateAsync({
          nombre:           data.nombre,
          fragancia:        data.fragancia   || null,
          categoria_id:     data.categoriaId || null,
          unidad_medida:    data.unidadMedida,
          presentacion:     presentacionNum,
          precio_minorista: minorista,
          precio_mayorista: mayorista,
          costo_produccion: costoProduccion,
          activo,
          codigo:           data.codigo      || null,
        })
        onSaved('Producto creado correctamente')
        reset()
        setCatText('')
        setActivo(true)
      }
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al guardar') + '|error')
    }
  }

  useEffect(() => {
    if (!open) return
    reset({
      nombre:          producto?.nombre                                                    ?? '',
      fragancia:       producto?.fragancia                                                 ?? '',
      categoriaId:     producto?.categoria_id                                              ?? '',
      unidadMedida:    producto?.unidad_medida === 'un' ? 'un' : 'litros',
      presentacion:    producto?.presentacion != null ? String(producto.presentacion) : '5',
      precioMinorista: producto?.precio_minorista != null ? String(producto.precio_minorista) : '',
      precioMayorista: producto?.precio_mayorista != null ? String(producto.precio_mayorista) : '',
      costoProduccion: producto?.costo_produccion != null ? String(producto.costo_produccion) : '0',
      codigo:          producto?.codigo                                                    ?? '',
    })
    setActivo(producto?.activo ?? true)
  }, [open, producto])

  useEffect(() => {
    if (!open) { setCatText(''); setCatDrop(false); setCatErr(''); return }
    if (producto?.categoria_id && categorias) {
      const cat = categorias.find(c => c.id === producto.categoria_id)
      setCatText(cat?.nombre ?? '')
    } else if (!producto?.categoria_id) {
      setCatText('')
    }
  }, [open, categorias, producto])

  const catsFiltradas = (categorias ?? []).filter(c =>
    !catText || c.nombre.toLowerCase().includes(catText.toLowerCase())
  )
  const puedeCrear = catText.trim().length > 0 &&
    !catsFiltradas.some(c => c.nombre.toLowerCase() === catText.trim().toLowerCase())

  const handleCrearCat = async () => {
    const nombre = catText.trim()
    if (!nombre) return
    setCatErr('')
    try {
      const nueva = await crearCat.mutateAsync(nombre)
      setValue('categoriaId', nueva.id)
      setCatText(nueva.nombre)
      setCatDrop(false)
    } catch {
      setCatErr('No se pudo crear la categoría')
    }
  }

  const footer = (
    <>
      <button
        type="submit"
        form="producto-form"
        disabled={saving}
        className="btn-press"
        style={{
          background: saving ? 'rgba(61,214,181,0.5)' : '#3DD6B5', color: '#fff',
          border: 'none', borderRadius: 10, height: 44, width: '100%',
          fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="btn-press"
        style={{
          background: 'transparent', color: '#8E8E93',
          border: 'none', height: 36, width: '100%',
          fontSize: 13, cursor: 'pointer',
        }}
      >
        Cancelar
      </button>
    </>
  )

  const selectStyle: CSSProperties = {
    width: '100%', padding: '0 28px 0 12px',
    border: '0.5px solid #E5E5EA', borderRadius: 8,
    fontFamily: 'Inter, sans-serif', background: '#fff',
    appearance: 'none', outline: 'none', cursor: 'pointer',
    color: '#1C1C1E', boxSizing: 'border-box',
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={producto ? 'Editar producto' : 'Nuevo producto'}
      footer={footer}
    >
      <form
        id="producto-form"
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Grid 1: Nombre + Categoría */}
        <div className="form-grid-2">
          <FloatInput label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />

          {/* Categoría — combobox con creación inline */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={LABEL_S}>Categoría</span>
            <input type="hidden" {...register('categoriaId')} />
            {categoriaVal ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 10px 0 12px', background: '#EBF5FF', borderRadius: 8,
                border: '0.5px solid #7EB8E8', height: 40,
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catText}</span>
                <button type="button"
                  onClick={() => { setValue('categoriaId', ''); setCatText(''); setCatErr('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7EB8E8', fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={catText}
                  onChange={e => { setCatText(e.target.value); setCatDrop(true); setCatErr('') }}
                  onFocus={() => setCatDrop(true)}
                  onBlur={() => setTimeout(() => setCatDrop(false), 150)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setCatDrop(false); return }
                    if (e.key === 'Enter' && puedeCrear) { e.preventDefault(); handleCrearCat() }
                  }}
                  placeholder="Buscar o crear…"
                  className="fi-input"
                  style={{ padding: '0 12px', border: '0.5px solid #E5E5EA', borderRadius: 8, outline: 0, width: '100%', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', background: '#fff', color: '#1C1C1E' }}
                />
                {catDrop && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #E5E5EA', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 4,
                  }}>
                    {catsFiltradas.map(cat => (
                      <button key={cat.id} type="button"
                        onClick={() => { setValue('categoriaId', cat.id); setCatText(cat.nombre); setCatDrop(false) }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'block', borderBottom: '0.5px solid #F5F7F9', fontSize: 13 }}>
                        {cat.nombre}
                      </button>
                    ))}
                    {puedeCrear && (
                      <button type="button" onClick={handleCrearCat} disabled={crearCat.isPending}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px',
                          background: '#F0F7FF', border: 'none',
                          cursor: crearCat.isPending ? 'not-allowed' : 'pointer',
                          fontSize: 12, color: '#3DD6B5', fontWeight: 600,
                          borderTop: catsFiltradas.length > 0 ? '0.5px solid #F5F7F9' : 'none',
                        }}>
                        {crearCat.isPending ? 'Creando…' : `+ Crear "${catText.trim()}"`}
                      </button>
                    )}
                    {catsFiltradas.length === 0 && !puedeCrear && (
                      <div style={{ padding: '8px 12px', fontSize: 12, color: '#8E8E93' }}>
                        {catText.trim() ? 'Sin coincidencias' : 'Escribí para buscar o crear'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {catErr && <p style={{ color: '#D32F2F', fontSize: 11, margin: '4px 0 0' }}>{catErr}</p>}
          </div>
        </div>

        {/* Grid 2: Fragancia + Unidad */}
        <div className="form-grid-2">
          <FloatInput label="Fragancia" {...register('fragancia')} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={LABEL_S}>Unidad *</span>
            <div style={{ position: 'relative' }}>
              <select
                {...register('unidadMedida', {
                  onChange: e => {
                    if (e.target.value === 'un') {
                      setValue('presentacion', '1', { shouldValidate: true })
                    } else if (!PRESENTACIONES.includes(watch('presentacion') as typeof PRESENTACIONES[number])) {
                      setValue('presentacion', '5', { shouldValidate: true })
                    }
                  },
                })}
                className="fi-input"
                style={{ ...selectStyle, borderColor: errors.unidadMedida ? '#D32F2F' : '#E5E5EA' }}
              >
                <option value="litros">Litros</option>
                <option value="un">Unidades</option>
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8E8E93' }} />
            </div>
            {errors.unidadMedida && <span style={{ color: '#D32F2F', fontSize: 11, marginTop: 4 }}>{errors.unidadMedida.message}</span>}
          </div>
        </div>

        {/* Presentación */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={LABEL_S}>Presentación *</span>
          {unidadMedidaVal === 'un' ? (
            <input
              readOnly
              {...register('presentacion')}
              className="fi-input"
              style={{ ...selectStyle, background: '#F5F7F9', color: '#9CA3AF', cursor: 'not-allowed', padding: '0 12px' }}
            />
          ) : (
            <div style={{ position: 'relative' }}>
              <select
                {...register('presentacion')}
                className="fi-input"
                style={{ ...selectStyle, borderColor: errors.presentacion ? '#D32F2F' : '#E5E5EA' }}
              >
                <option value="0.5">500 ml</option>
                <option value="3">3 L</option>
                <option value="5">5 L</option>
                <option value="10">10 L</option>
                <option value="20">20 L</option>
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8E8E93' }} />
            </div>
          )}
          {errors.presentacion && <span style={{ color: '#D32F2F', fontSize: 11, marginTop: 4 }}>{errors.presentacion.message}</span>}
        </div>

        {/* Precio min + Precio may */}
        <div className="form-grid-2">
          <FloatInput label="Precio minorista *" error={errors.precioMinorista?.message} {...register('precioMinorista')} inputMode="decimal" />
          <FloatInput label="Precio mayorista *" error={errors.precioMayorista?.message} {...register('precioMayorista')} inputMode="decimal" />
        </div>

        <div>
          <FloatInput label="Costo de producción" error={errors.costoProduccion?.message} {...register('costoProduccion')} inputMode="decimal" />
          <p style={{ fontSize: 11, color: '#8E8E93', margin: '5px 0 0' }}>
            Costo interno de fabricación. No visible para clientes. Se usa para calcular el margen.
          </p>
        </div>

        <FloatInput label="Código (opcional)" {...register('codigo')} />

        {/* Toggle activo/inactivo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '0.5px solid #E5E5EA' }}>
          <span style={{ fontSize: 13, color: '#8E8E93' }}>Producto activo</span>
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            onClick={() => setActivo(v => !v)}
            style={{
              width: 36, height: 20, borderRadius: 99,
              background: activo ? '#3DD6B5' : '#E5E5EA',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s ease', flexShrink: 0, padding: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: activo ? 18 : 2,
              width: 16, height: 16, background: '#fff', borderRadius: '50%',
              transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'block',
            }} />
          </button>
        </div>
      </form>
    </Drawer>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgeActivo({ activo }: { activo: boolean }) {
  return (
    <span style={{
      backgroundColor: activo ? '#E8F8F0' : '#F0F0F0',
      color:           activo ? '#145A32' : '#9A9A9A',
      fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {activo ? 'ACTIVO' : 'INACTIVO'}
    </span>
  )
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function ShimmerRow() {
  return (
    <tr>
      {[160, 90, 55, 90, 90, 55, 28].map((w, i) => (
        <td key={i} style={{ padding: '10px 14px', borderBottom: '0.5px solid #F5F7F9' }}>
          <Skeleton style={{ height: 13, width: w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

function ShimmerCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5EA', padding: '12px 16px', marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <Skeleton style={{ height: 13, width: 140, borderRadius: 6 }} />
        <Skeleton style={{ height: 18, width: 56, borderRadius: 99 }} />
      </div>
      <Skeleton style={{ height: 11, width: 160, borderRadius: 6, marginBottom: 4 }} />
      <Skeleton style={{ height: 11, width: 130, borderRadius: 6 }} />
    </div>
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ActivoFiltro = 'todos' | 'activo' | 'inactivo'

const ACTIVO_MAP: Record<ActivoFiltro, boolean | null> = {
  todos: null, activo: true, inactivo: false,
}

const ACTIVO_LABELS: Record<ActivoFiltro, string> = {
  todos: 'Todos', activo: 'Activos', inactivo: 'Inactivos',
}

// ─── Gestión de categorías ────────────────────────────────────────────────────

interface CatDrawerProps {
  open:    boolean
  onClose: () => void
  onMsg:   (msg: string) => void
}

function CategoriasDrawer({ open, onClose, onMsg }: CatDrawerProps) {
  const { data: categorias, isLoading } = useCategorias()
  const crear  = useCrearCategoria()
  const editar = useEditarCategoria()
  const borrar = useBorrarCategoria()

  const [editId,     setEditId]     = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [deleteId,   setDeleteId]   = useState<string | null>(null)
  const [newNombre,  setNewNombre]  = useState('')
  const [showNew,    setShowNew]    = useState(false)

  const resetAll = () => { setEditId(null); setDeleteId(null); setShowNew(false); setNewNombre('') }

  useEffect(() => { if (!open) resetAll() }, [open])

  const handleSaveEdit = async () => {
    if (!editId || !editNombre.trim()) return
    try {
      await editar.mutateAsync({ id: editId, nombre: editNombre.trim() })
      setEditId(null)
      onMsg('Categoría actualizada')
    } catch {
      onMsg('Error al actualizar la categoría|error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await borrar.mutateAsync(id)
      setDeleteId(null)
      onMsg('Categoría eliminada')
    } catch (e) {
      setDeleteId(null)
      if (e instanceof Error && e.message === 'HAS_ACTIVE_PRODUCTS')
        onMsg('No se puede borrar. Tiene productos activos asociados.|error')
      else
        onMsg('Error al borrar la categoría|error')
    }
  }

  const handleCrear = async () => {
    if (!newNombre.trim()) return
    try {
      await crear.mutateAsync(newNombre.trim())
      setNewNombre(''); setShowNew(false)
      onMsg('Categoría creada')
    } catch {
      onMsg('Error al crear la categoría|error')
    }
  }

  const footer = (
    <button
      type="button"
      onClick={onClose}
      className="btn-press"
      style={{ background: 'transparent', color: '#8E8E93', border: 'none', height: 40, width: '100%', fontSize: 14, cursor: 'pointer' }}
    >
      Cerrar
    </button>
  )

  const inputStyle: CSSProperties = {
    flex: 1, height: 32, padding: '0 10px',
    border: '1.5px solid #7EB8E8', borderRadius: 6,
    fontSize: 13, outline: 0, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  }
  const btnIconStyle: CSSProperties = {
    width: 32, height: 32, background: 'transparent', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  }

  return (
    <Drawer open={open} onClose={onClose} title="Gestionar categorías" footer={footer}>
      {/* Nueva categoría */}
      {showNew ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            autoFocus
            value={newNombre}
            onChange={e => setNewNombre(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCrear()
              if (e.key === 'Escape') { setShowNew(false); setNewNombre('') }
            }}
            placeholder="Nombre de categoría"
            style={{ ...inputStyle, height: 36 }}
          />
          <button
            onClick={handleCrear}
            disabled={crear.isPending || !newNombre.trim()}
            style={{
              height: 36, padding: '0 14px', background: '#3DD6B5', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: crear.isPending ? 'not-allowed' : 'pointer', flexShrink: 0,
            }}
          >
            {crear.isPending ? '…' : 'Crear'}
          </button>
          <button
            onClick={() => { setShowNew(false); setNewNombre('') }}
            style={{ ...btnIconStyle, border: '0.5px solid #E5E5EA', width: 36, height: 36, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="btn-press"
          style={{
            width: '100%', height: 40, background: '#F5F7F9',
            border: '0.5px dashed #7EB8E8', borderRadius: 10,
            color: '#7EB8E8', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Plus size={14} /> Nueva categoría
        </button>
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Cargando…</div>
      ) : !categorias?.length ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>No hay categorías aún</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categorias.map(cat => (
            <div key={cat.id} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E5EA', overflow: 'hidden' }}>
              {editId === cat.id ? (
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    style={inputStyle}
                  />
                  <button
                    onClick={handleSaveEdit}
                    disabled={editar.isPending || !editNombre.trim()}
                    style={{
                      height: 32, padding: '0 10px', background: '#3DD6B5', color: '#fff',
                      border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      cursor: editar.isPending ? 'not-allowed' : 'pointer', flexShrink: 0,
                    }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    style={{ ...btnIconStyle, border: '0.5px solid #E5E5EA', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : deleteId === cat.id ? (
                <div style={{ padding: '10px 14px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: '#1C1C1E' }}>
                    ¿Borrar <strong>{cat.nombre}</strong>?{' '}
                    <span style={{ color: '#8E8E93' }}>Los productos quedarán sin categoría.</span>
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={borrar.isPending}
                      style={{
                        flex: 1, height: 36, background: '#D32F2F', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: borrar.isPending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {borrar.isPending ? 'Borrando…' : 'Sí, borrar'}
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      style={{
                        flex: 1, height: 36, background: 'transparent', color: '#8E8E93',
                        border: '0.5px solid #E5E5EA', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px 0 14px', height: 48 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#1C1C1E' }}>{cat.nombre}</span>
                  <button
                    onClick={() => { setEditId(cat.id); setEditNombre(cat.nombre); setDeleteId(null) }}
                    aria-label={`Editar ${cat.nombre}`}
                    style={{ ...btnIconStyle, color: '#8E8E93' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F5F7F9')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setDeleteId(cat.id); setEditId(null) }}
                    aria-label={`Borrar ${cat.nombre}`}
                    style={{ ...btnIconStyle, color: '#9A9A9A' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FDECEA')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}

// ─── Action sheet — acciones rápidas sobre producto ───────────────────────────

type ActionStep = 'menu' | 'confirm-toggle' | 'confirm-delete'

interface ActionSheetProps {
  product:  Producto | null
  step:     ActionStep
  onClose:  () => void
  onStep:   (s: ActionStep) => void
  onToggle: () => Promise<void>
  onDelete: () => Promise<void>
  toggling: boolean
  deleting: boolean
}

function ProductActionSheet({ product, step, onClose, onStep, onToggle, onDelete, toggling, deleting }: ActionSheetProps) {
  if (!product) return null

  const sheetBtn = (onClick: () => void, disabled: boolean, style: CSSProperties, children: ReactNode) => (
    <button onClick={onClick} disabled={disabled} className="btn-press" style={{ width: '100%', height: 48, border: 'none', borderRadius: 10, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', ...style }}>
      {children}
    </button>
  )

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          zIndex: 301,
          padding: '20px 16px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          maxWidth: 480, margin: '0 auto',
          animation: 'slideUp 0.22s ease',
        }}
      >
        {step === 'menu' && (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
              {product.nombre}
              {product.fragancia && <span style={{ fontWeight: 400, color: '#8E8E93' }}> — {product.fragancia}</span>}
            </p>
            {sheetBtn(
              () => onStep('confirm-toggle'), false,
              { background: '#F5F7F9', color: '#1C1C1E', marginBottom: 4 },
              <>
                {product.activo ? <EyeOff size={16} color="#8E8E93" /> : <Eye size={16} color="#8E8E93" />}
                {product.activo ? 'Inactivar producto' : 'Activar producto'}
              </>
            )}
            <div style={{ height: 1, background: '#F0F0F0', margin: '8px 0' }} />
            {sheetBtn(
              () => onStep('confirm-delete'), false,
              { background: '#FFF5F5', color: '#D32F2F', fontWeight: 600, marginBottom: 8 },
              <><Trash2 size={16} /> Borrar producto</>
            )}
            <button onClick={onClose} style={{ width: '100%', height: 44, background: 'transparent', color: '#8E8E93', border: 'none', fontSize: 14, cursor: 'pointer' }}>
              Cancelar
            </button>
          </>
        )}

        {step === 'confirm-toggle' && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
              {product.activo ? `¿Inactivar "${product.nombre}"?` : `¿Activar "${product.nombre}"?`}
            </p>
            {product.activo && (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8E8E93' }}>No aparecerá en nuevos pedidos.</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: product.activo ? 0 : 16 }}>
              <button
                onClick={onToggle}
                disabled={toggling}
                className="btn-press"
                style={{ flex: 1, height: 44, background: '#3DD6B5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: toggling ? 'not-allowed' : 'pointer' }}
              >
                {toggling ? '…' : 'Confirmar'}
              </button>
              <button
                onClick={() => onStep('menu')}
                style={{ flex: 1, height: 44, background: 'transparent', color: '#8E8E93', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {step === 'confirm-delete' && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
              ¿Borrar &ldquo;{product.nombre}&rdquo;?
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8E8E93' }}>
              Esta acción no se puede deshacer. Los pedidos existentes no se verán afectados — conservan el precio snapshot.
            </p>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="btn-press"
              style={{ width: '100%', height: 44, background: '#D32F2F', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', marginBottom: 8 }}
            >
              {deleting ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button
              onClick={() => onStep('menu')}
              style={{ width: '100%', height: 44, background: 'transparent', color: '#8E8E93', border: 'none', fontSize: 14, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [q, setQ]                 = useState('')
  const [catFiltro, setCat]       = useState('')
  const [activoFiltro, setActivo] = useState<ActivoFiltro>('activo')
  const [drawerOpen, setDrawer]   = useState(false)
  const [selected, setSelected]   = useState<Producto | null>(null)
  const [catDrawer, setCatDrawer] = useState(false)
  const [actionProduct, setActionProduct] = useState<Producto | null>(null)
  const [actionStep, setActionStep]       = useState<ActionStep>('menu')
  const { toasts, show, dismiss } = useToast()

  const editarP = useEditarProducto()
  const borrarP = useBorrarProducto()

  const handleOpenAction = (p: Producto) => { setActionProduct(p); setActionStep('menu') }
  const handleCloseAction = () => setActionProduct(null)

  const handleToggleProduct = async () => {
    if (!actionProduct) return
    try {
      await editarP.mutateAsync({ id: actionProduct.id, activo: !actionProduct.activo })
      handleCloseAction()
    } catch {
      show('Error al actualizar el producto', 'error')
      handleCloseAction()
    }
  }

  const handleDeleteProduct = async () => {
    if (!actionProduct) return
    const nombre = actionProduct.nombre
    try {
      await borrarP.mutateAsync(actionProduct.id)
      handleCloseAction()
      show(`"${nombre}" eliminado`, 'success')
    } catch (e) {
      handleCloseAction()
      if (e instanceof Error && e.message === 'HAS_ORDERS')
        show('No se puede borrar. El producto tiene pedidos asociados. Podés inactivarlo en su lugar.', 'error')
      else
        show('Error al borrar el producto', 'error')
    }
  }

  const qDebounced = useDebounce(q, 300)

  // Fetch por texto y activo; categoría se filtra localmente
  const { data: allProductos, isLoading } = useProductos(qDebounced || undefined, undefined, ACTIVO_MAP[activoFiltro])
  const { data: categorias }              = useCategorias()

  const productos = catFiltro
    ? allProductos?.filter(p => p.categoria_id === catFiltro)
    : allProductos

  const handleEdit  = (p: Producto) => { setSelected(p); setDrawer(true) }
  const handleNew   = ()             => { setSelected(null); setDrawer(true) }
  const handleClose = ()             => { setDrawer(false); setSelected(null) }

  const handleSaved = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else                        show(msg, 'success')
  }

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      <style>{`
        .prd-table { width: 100%; border-collapse: collapse; }
        .prd-table tbody tr { transition: background 0.1s; cursor: default; }
        .prd-table tbody tr:hover { background: #F9FAFB !important; }
        .prd-edit-btn:focus-visible { outline: 2px solid #7EB8E8; outline-offset: 2px; }
        .prd-card:focus-visible { outline: 2px solid #7EB8E8; outline-offset: 2px; }
        @media (max-width: 1023px) { .prd-desktop { display: none !important; } }
        @media (min-width: 1024px) { .prd-mobile  { display: none !important; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title">Productos</h1>
        <button
          onClick={handleNew}
          className="btn-press"
          style={{
            background: '#3DD6B5', color: '#fff', border: 'none',
            borderRadius: 10, height: 40, padding: '0 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} /> Nuevo producto
        </button>
      </div>

      {/* Buscador + categoría + pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div role="search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <label htmlFor="prd-search" className="sr-only">Buscar productos</label>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8E8E93', pointerEvents: 'none' }}
          />
          <input
            id="prd-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre..."
            style={{
              width: '100%', height: 36, padding: '0 12px 0 32px',
              border: '0.5px solid #E5E5EA', borderRadius: 8,
              fontSize: 13, outline: 0, background: '#fff',
              boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
            }}
            onFocus={e => (e.target.style.borderColor = '#7EB8E8')}
            onBlur={e  => (e.target.style.borderColor = '#E5E5EA')}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={catFiltro}
            onChange={e => setCat(e.target.value)}
            style={{
              height: 36, padding: '0 10px',
              border: '0.5px solid #E5E5EA', borderRadius: 8,
              fontSize: 12, color: '#1C1C1E', background: '#fff',
              cursor: 'pointer', outline: 0,
            }}
          >
            <option value="">Todas las categorías</option>
            {categorias?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button
            onClick={() => setCatDrawer(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#7EB8E8', fontSize: 11, fontWeight: 500,
              whiteSpace: 'nowrap', padding: '0 2px',
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            Gestionar
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {(['todos', 'activo', 'inactivo'] as ActivoFiltro[]).map(v => {
            const isActive = activoFiltro === v
            return (
              <button
                key={v}
                onClick={() => setActivo(v)}
                style={{
                  height: 32, padding: '0 12px', borderRadius: 99,
                  border: `1px solid ${isActive ? '#3DD6B5' : '#E5E5EA'}`,
                  background: isActive ? '#3DD6B5' : '#fff',
                  color: isActive ? '#fff' : '#8E8E93',
                  fontSize: 12, fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.1s',
                }}
              >
                {ACTIVO_LABELS[v]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
      <div className="prd-desktop">
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5EA', overflow: 'hidden' }}>
          <table className="prd-table" aria-label="Listado de productos">
            <thead>
              <tr style={{ background: '#F5F7F9', borderBottom: '0.5px solid #E5E5EA' }}>
                {['Producto', 'Categoría', 'Presentación', 'Precio min.', 'Precio may.', 'Estado', 'Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 14px',
                      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#8E8E93',
                      textAlign: i === 6 ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <ShimmerRow key={i} />)
              ) : !productos?.length ? (
                <tr>
                  <td colSpan={7}>
                    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Package size={40} strokeWidth={1.2} color="#E5E5EA" />
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>Sin productos</p>
                      <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
                        {q ? 'No hay productos que coincidan' : 'Agregá productos al catálogo'}
                      </p>
                      {!q && (
                        <button onClick={handleNew} className="btn-press" style={{
                          marginTop: 4, background: '#3DD6B5', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', minHeight: 40,
                        }}>
                          + Nuevo producto
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                productos.map(p => (
                  <tr key={p.id} style={{ background: '#fff' }}>
                    <th
                      scope="row"
                      style={{
                        padding: '0 14px', height: 48,
                        fontSize: 13, fontWeight: 500, color: '#1C1C1E',
                        textAlign: 'left', borderBottom: '0.5px solid #F5F7F9',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.nombre}
                      {p.fragancia && (
                        <span style={{ fontWeight: 400, color: '#8E8E93', fontSize: 12 }}> — {p.fragancia}</span>
                      )}
                    </th>
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: p.categorias_producto?.nombre ? '#8E8E93' : '#E5E5EA', borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      {p.categorias_producto?.nombre ?? '—'}
                    </td>
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: '#1C1C1E', borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      {formatUnidad(p.presentacion, p.unidad_medida)}
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, color: '#8E8E93', marginRight: 3 }}>Min</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#8E8E93' }}>
                        ${Number(p.precio_minorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, color: '#8E8E93', marginRight: 3 }}>May</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#3DD6B5' }}>
                        ${Number(p.precio_mayorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      <BadgeActivo activo={p.activo ?? true} />
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleEdit(p)}
                        className="prd-edit-btn"
                        aria-label={`Editar producto ${p.nombre}`}
                        style={{
                          width: 28, height: 28,
                          background: 'transparent',
                          border: '0.5px solid #E5E5EA',
                          borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#8E8E93',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F5F7F9')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleOpenAction(p)}
                        className="prd-edit-btn"
                        aria-label={`Más acciones para ${p.nombre}`}
                        style={{
                          width: 28, height: 28, marginLeft: 4,
                          background: 'transparent',
                          border: '0.5px solid #E5E5EA',
                          borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#8E8E93',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F5F7F9')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && !!productos?.length && (
            <div style={{ padding: '10px 14px', borderTop: '0.5px solid #F5F7F9' }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>
                {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────────── */}
      <div className="prd-mobile">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ShimmerCard key={i} />)
        ) : !productos?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
            <Package size={40} strokeWidth={1.2} color="#E5E5EA" />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>Sin productos</p>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
              {q ? 'No hay productos que coincidan' : 'Agregá productos al catálogo'}
            </p>
            {!q && (
              <button onClick={handleNew} className="btn-press" style={{
                background: '#3DD6B5', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', minHeight: 44,
              }}>
                + Nuevo producto
              </button>
            )}
          </div>
        ) : (
          <>
            {productos.map(p => (
              <div
                key={p.id}
                className="prd-card card-tappable"
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(p)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(p) } }}
                aria-label={`Editar producto ${p.nombre}`}
                style={{
                  background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5EA',
                  padding: '12px 16px', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Línea 1 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {p.nombre}
                    </span>
                    <BadgeActivo activo={p.activo ?? true} />
                  </div>
                  {/* Línea 2 */}
                  <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatUnidad(p.presentacion, p.unidad_medida)}
                    {p.categorias_producto?.nombre ? ` · ${p.categorias_producto.nombre}` : ''}
                  </p>
                  {/* Línea 3 */}
                  <p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>
                    Min ${Number(p.precio_minorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {' · '}
                    <span style={{ color: '#3DD6B5' }}>
                      May ${Number(p.precio_mayorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleOpenAction(p) }}
                  className="prd-edit-btn"
                  aria-label={`Más acciones para ${p.nombre}`}
                  style={{
                    width: 36, height: 36, flexShrink: 0,
                    background: 'transparent', border: '0.5px solid #E5E5EA', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#8E8E93',
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', padding: '12px 0', margin: 0 }}>
              {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
            </p>
          </>
        )}
      </div>

      <ProductoDrawer key={selected?.id ?? 'new'} open={drawerOpen} onClose={handleClose} producto={selected} onSaved={handleSaved} />
      <CategoriasDrawer open={catDrawer} onClose={() => setCatDrawer(false)} onMsg={handleSaved} />
      <ProductActionSheet
        product={actionProduct}
        step={actionStep}
        onClose={handleCloseAction}
        onStep={setActionStep}
        onToggle={handleToggleProduct}
        onDelete={handleDeleteProduct}
        toggling={editarP.isPending}
        deleting={borrarP.isPending}
      />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
