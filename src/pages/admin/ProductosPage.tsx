import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton }       from '@/components/ui/skeleton'
import { FloatInput }     from '@/components/common/FloatInput'
import { ButtonGroup }    from '@/components/common/ButtonGroup'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import {
  useProductos, useCategorias,
  useCrearProducto, useEditarProducto, useCrearCategoria,
} from '@/services/productos'
import { useDebounce } from '@/hooks/useDebounce'
import type { Producto } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nombre:          z.string().min(1, 'El nombre es obligatorio'),
  fragancia:       z.string().optional(),
  categoriaId:     z.string().optional(),
  presentacion:    z.enum(['0.5', '3', '5', '10', '20'], { message: 'Seleccioná una presentación' }),
  precioMinorista: z.string().min(1, 'Requerido').regex(/^\d+(\.\d{0,2})?$/, 'Precio inválido'),
  precioMayorista: z.string().min(1, 'Requerido').regex(/^\d+(\.\d{0,2})?$/, 'Precio inválido'),
  codigo:          z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ─── Drawer formulario ────────────────────────────────────────────────────────

interface DrawerProps {
  open:     boolean
  onClose:  () => void
  producto: Producto | null
  onSaved:  (msg: string) => void
}

function ProductoDrawer({ open, onClose, producto, onSaved }: DrawerProps) {
  const crear    = useCrearProducto()
  const editar   = useEditarProducto()
  const crearCat = useCrearCategoria()
  const { data: categorias } = useCategorias()
  const [catText, setCatText] = useState('')
  const [catDrop, setCatDrop] = useState(false)
  const [catErr,  setCatErr]  = useState('')
  const saving = crear.isPending || editar.isPending

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre:          producto?.nombre                                                    ?? '',
      fragancia:       producto?.fragancia                                                 ?? '',
      categoriaId:     producto?.categoria_id                                              ?? '',
      presentacion:    (producto?.presentacion != null ? String(producto.presentacion) : '5') as FormData['presentacion'],
      precioMinorista: producto?.precio_minorista != null ? String(producto.precio_minorista) : '',
      precioMayorista: producto?.precio_mayorista != null ? String(producto.precio_mayorista) : '',
      codigo:          producto?.codigo                                                    ?? '',
    },
  })

  const presentacionVal = watch('presentacion')
  const categoriaVal    = watch('categoriaId')

  const onSubmit = async (data: FormData) => {
    const presentacionNum = parseFloat(data.presentacion)
    const minorista       = parseFloat(data.precioMinorista)
    const mayorista       = parseFloat(data.precioMayorista)
    try {
      if (producto) {
        await editar.mutateAsync({
          id:               producto.id,
          nombre:           data.nombre,
          fragancia:        data.fragancia   || null,
          categoria_id:     data.categoriaId || null,
          presentacion:     presentacionNum,
          precio_minorista: minorista,
          precio_mayorista: mayorista,
          codigo:           data.codigo      || null,
        })
        onSaved('Producto actualizado correctamente')
      } else {
        await crear.mutateAsync({
          nombre:           data.nombre,
          fragancia:        data.fragancia   || null,
          categoria_id:     data.categoriaId || null,
          unidad_medida:    'litros',
          presentacion:     presentacionNum,
          precio_minorista: minorista,
          precio_mayorista: mayorista,
          activo:           true,
          codigo:           data.codigo      || null,
        })
        onSaved('Producto creado correctamente')
        reset()
        setCatText('')
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
      presentacion:    (producto?.presentacion != null ? String(producto.presentacion) : '5') as FormData['presentacion'],
      precioMinorista: producto?.precio_minorista != null ? String(producto.precio_minorista) : '',
      precioMayorista: producto?.precio_mayorista != null ? String(producto.precio_mayorista) : '',
      codigo:          producto?.codigo                                                    ?? '',
    })
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
      setCatDrop(false)
    } catch {
      setCatErr('No se pudo crear la categoría')
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{producto ? 'Editar producto' : 'Nuevo producto'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>

          <FloatInput label="Nombre *"  error={errors.nombre?.message}  {...register('nombre')} />
          <FloatInput label="Fragancia" {...register('fragancia')} />
          <FloatInput label="Código (opcional)" {...register('codigo')} />

          {/* Categoría — combobox con creación inline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4A5568' }}>
              Categoría
            </span>
            <input type="hidden" {...register('categoriaId')} />
            {categoriaVal ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#E8F4FF', borderRadius: 10, border: '1.5px solid #1B9ED6',
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C' }}>{catText}</span>
                <button type="button"
                  onClick={() => { setValue('categoriaId', ''); setCatText(''); setCatErr('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B9ED6', fontSize: 12, fontWeight: 600 }}>
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
                  placeholder="Buscar o crear categoría…"
                  style={{ padding: '10px 14px', border: '1px solid rgba(105,105,105,0.4)', borderRadius: 10, fontSize: 14, outline: 0, width: '100%', fontFamily: 'Inter, sans-serif' }}
                />
                {catDrop && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #D1D5DB', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 4,
                  }}>
                    {catsFiltradas.map(cat => (
                      <button key={cat.id} type="button"
                        onClick={() => { setValue('categoriaId', cat.id); setCatText(cat.nombre); setCatDrop(false) }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'block', borderBottom: '1px solid #F4F6F8', fontSize: 14 }}>
                        {cat.nombre}
                      </button>
                    ))}
                    {puedeCrear && (
                      <button type="button" onClick={handleCrearCat} disabled={crearCat.isPending}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 14px',
                          background: '#F0F7FF', border: 'none',
                          cursor: crearCat.isPending ? 'not-allowed' : 'pointer',
                          fontSize: 13, color: '#0D5C8A', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 6,
                          borderTop: catsFiltradas.length > 0 ? '1px solid #F4F6F8' : 'none',
                        }}>
                        {crearCat.isPending ? 'Creando…' : `+ Crear "${catText.trim()}"`}
                      </button>
                    )}
                    {catsFiltradas.length === 0 && !puedeCrear && (
                      <div style={{ padding: '10px 14px', fontSize: 13, color: '#4A5568' }}>
                        {catText.trim() ? 'Sin coincidencias' : 'Escribí para buscar o crear'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {catErr && <p style={{ color: '#D32F2F', fontSize: 11, margin: '2px 0 0' }}>{catErr}</p>}
          </div>

          <ButtonGroup
            label="Presentación *"
            value={presentacionVal ?? ''}
            onChange={v => setValue('presentacion', v as FormData['presentacion'], { shouldValidate: true })}
            error={errors.presentacion?.message}
            options={[
              { value: '0.5', label: '500 ml' },
              { value: '3',   label: '3 L' },
              { value: '5',   label: '5 L' },
              { value: '10',  label: '10 L' },
              { value: '20',  label: '20 L' },
            ]}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FloatInput label="Precio minorista *" error={errors.precioMinorista?.message} {...register('precioMinorista')} inputMode="decimal" />
            <FloatInput label="Precio mayorista *" error={errors.precioMayorista?.message} {...register('precioMayorista')} inputMode="decimal" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <button type="submit" disabled={saving} style={{
              background: saving ? 'rgba(13,92,138,0.5)' : '#0D5C8A', color: '#fff',
              border: 'none', borderRadius: 10, padding: '13px 20px', minHeight: 44,
              fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
            </button>
            <button type="button" onClick={onClose} style={{
              background: 'transparent', color: '#0D5C8A', border: '1.5px solid #0D5C8A',
              borderRadius: 10, padding: '12px 20px', minHeight: 44,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </form>

        {producto && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #D1D5DB' }}>
            <button
              onClick={async () => {
                await editar.mutateAsync({ id: producto.id, activo: !producto.activo })
                onSaved(`Producto ${!producto.activo ? 'activado' : 'desactivado'}`)
                onClose()
              }}
              style={{
                width: '100%',
                background: producto.activo ? '#FDECEA' : '#E8F8F0',
                color: producto.activo ? '#D32F2F' : '#2E9E5C',
                border: `1.5px solid ${producto.activo ? '#D32F2F' : '#2E9E5C'}`,
                borderRadius: 10, padding: '12px 20px', minHeight: 44,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {producto.activo ? 'Desactivar producto' : 'Activar producto'}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
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
        <td key={i} style={{ padding: '10px 14px', borderBottom: '0.5px solid #F4F6F8' }}>
          <Skeleton style={{ height: 13, width: w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  )
}

function ShimmerCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #D1D5DB', padding: '12px 16px', marginBottom: 6 }}>
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

function presentacionLabel(p: number) {
  return p === 0.5 ? '500 ml' : `${p} L`
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [q, setQ]                 = useState('')
  const [catFiltro, setCat]       = useState('')
  const [activoFiltro, setActivo] = useState<ActivoFiltro>('activo')
  const [drawerOpen, setDrawer]   = useState(false)
  const [selected, setSelected]   = useState<Producto | null>(null)
  const { toasts, show, dismiss } = useToast()

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
    <div>
      <style>{`
        .prd-table { width: 100%; border-collapse: collapse; }
        .prd-table tbody tr { transition: background 0.1s; cursor: default; }
        .prd-table tbody tr:hover { background: #F9FAFB !important; }
        .prd-edit-btn:focus-visible { outline: 2px solid #1B9ED6; outline-offset: 2px; }
        .prd-card:focus-visible { outline: 2px solid #1B9ED6; outline-offset: 2px; }
        @media (max-width: 1023px) { .prd-desktop { display: none !important; } }
        @media (min-width: 1024px) { .prd-mobile  { display: none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>Productos</h1>
        <button
          onClick={handleNew}
          style={{
            background: '#0D5C8A', color: '#fff', border: 'none',
            borderRadius: 8, height: 36, padding: '0 14px',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={13} /> Nuevo producto
        </button>
      </div>

      {/* Buscador + categoría + pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div role="search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <label htmlFor="prd-search" className="sr-only">Buscar productos</label>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4A5568', pointerEvents: 'none' }}
          />
          <input
            id="prd-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre..."
            style={{
              width: '100%', height: 36, padding: '0 12px 0 32px',
              border: '0.5px solid #D1D5DB', borderRadius: 8,
              fontSize: 13, outline: 0, background: '#fff',
              boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
            }}
            onFocus={e => (e.target.style.borderColor = '#1B9ED6')}
            onBlur={e  => (e.target.style.borderColor = '#D1D5DB')}
          />
        </div>

        <select
          value={catFiltro}
          onChange={e => setCat(e.target.value)}
          style={{
            height: 36, padding: '0 10px',
            border: '0.5px solid #D1D5DB', borderRadius: 8,
            fontSize: 12, color: '#1A2B3C', background: '#fff',
            cursor: 'pointer', outline: 0,
          }}
        >
          <option value="">Todas las categorías</option>
          {categorias?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {(['todos', 'activo', 'inactivo'] as ActivoFiltro[]).map(v => {
            const isActive = activoFiltro === v
            return (
              <button
                key={v}
                onClick={() => setActivo(v)}
                style={{
                  height: 32, padding: '0 12px', borderRadius: 99,
                  border: `1px solid ${isActive ? '#0D5C8A' : '#D1D5DB'}`,
                  background: isActive ? '#0D5C8A' : '#fff',
                  color: isActive ? '#fff' : '#4A5568',
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
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #D1D5DB', overflow: 'hidden' }}>
          <table className="prd-table" aria-label="Listado de productos">
            <thead>
              <tr style={{ background: '#F4F6F8', borderBottom: '0.5px solid #D1D5DB' }}>
                {['Producto', 'Categoría', 'Presentación', 'Precio min.', 'Precio may.', 'Estado', 'Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 14px',
                      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#4A5568',
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
                    <p style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: '#4A5568', margin: 0 }}>
                      No se encontraron productos
                    </p>
                  </td>
                </tr>
              ) : (
                productos.map(p => (
                  <tr key={p.id} style={{ background: '#fff' }}>
                    <th
                      scope="row"
                      style={{
                        padding: '0 14px', height: 48,
                        fontSize: 13, fontWeight: 500, color: '#1A2B3C',
                        textAlign: 'left', borderBottom: '0.5px solid #F4F6F8',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.nombre}
                      {p.fragancia && (
                        <span style={{ fontWeight: 400, color: '#4A5568', fontSize: 12 }}> — {p.fragancia}</span>
                      )}
                    </th>
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: p.categorias_producto?.nombre ? '#4A5568' : '#D1D5DB', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      {p.categorias_producto?.nombre ?? '—'}
                    </td>
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: '#1A2B3C', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      {presentacionLabel(p.presentacion)}
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, color: '#4A5568', marginRight: 3 }}>Min</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#4A5568' }}>
                        ${Number(p.precio_minorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, color: '#4A5568', marginRight: 3 }}>May</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#0D5C8A' }}>
                        ${Number(p.precio_mayorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      <BadgeActivo activo={p.activo ?? true} />
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEdit(p)}
                        className="prd-edit-btn"
                        aria-label={`Editar producto ${p.nombre}`}
                        style={{
                          width: 28, height: 28,
                          background: 'transparent',
                          border: '0.5px solid #D1D5DB',
                          borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#4A5568',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F4F6F8')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                      >
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && !!productos?.length && (
            <div style={{ padding: '10px 14px', borderTop: '0.5px solid #F4F6F8' }}>
              <span style={{ fontSize: 12, color: '#4A5568' }}>
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
          <p style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: '#4A5568', margin: 0 }}>
            No se encontraron productos
          </p>
        ) : (
          <>
            {productos.map(p => (
              <div
                key={p.id}
                className="prd-card"
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(p)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(p) } }}
                aria-label={`Editar producto ${p.nombre}`}
                style={{
                  background: '#fff', borderRadius: 12, border: '0.5px solid #D1D5DB',
                  padding: '12px 16px', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = '#F9FAFB')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = '#fff')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Línea 1 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: '#1A2B3C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {p.nombre}
                    </span>
                    <BadgeActivo activo={p.activo ?? true} />
                  </div>
                  {/* Línea 2 */}
                  <p style={{ fontSize: 12, color: '#4A5568', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {presentacionLabel(p.presentacion)}
                    {p.categorias_producto?.nombre ? ` · ${p.categorias_producto.nombre}` : ''}
                  </p>
                  {/* Línea 3 */}
                  <p style={{ fontSize: 11, color: '#4A5568', margin: 0 }}>
                    Min ${Number(p.precio_minorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {' · '}
                    <span style={{ color: '#0D5C8A' }}>
                      May ${Number(p.precio_mayorista).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
                <button
                  onClick={e => e.stopPropagation()}
                  className="prd-edit-btn"
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{
                    width: 36, height: 36, flexShrink: 0,
                    background: 'transparent', border: '0.5px solid #D1D5DB', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#4A5568',
                  }}
                >
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#4A5568', textAlign: 'center', padding: '12px 0', margin: 0 }}>
              {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
            </p>
          </>
        )}
      </div>

      <ProductoDrawer key={selected?.id ?? 'new'} open={drawerOpen} onClose={handleClose} producto={selected} onSaved={handleSaved} />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
