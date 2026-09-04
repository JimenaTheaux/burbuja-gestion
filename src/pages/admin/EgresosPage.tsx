import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Receipt, Tags, Check, X } from 'lucide-react'
import { Skeleton }       from '@/components/ui/skeleton'
import { Drawer }         from '@/components/common/Drawer'
import { FloatInput }     from '@/components/common/FloatInput'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import { useAuthStore }   from '@/store/authStore'
import { supabase }       from '@/lib/supabase'
import { useQuery }       from '@tanstack/react-query'
import { queryKeys }      from '@/lib/queryKeys'
import {
  useEgresos, useCrearEgreso, useEditarEgreso, useEliminarEgreso,
} from '@/services/egresos'
import {
  useCategoriasEgreso, useCategoriasEgresoAdmin,
  useCrearCategoriaEgreso, useEditarCategoriaEgreso, useEliminarCategoriaEgreso,
} from '@/services/categoriasEgreso'
import type { Egreso, CategoriaEgreso } from '@/types'

// ─── Colores por categoría ────────────────────────────────────────────────────
// Paleta fija para los slugs conocidos; cualquier categoría nueva (creada desde
// el ABM) cae en el estilo neutro de "otros".

const CATEGORIA_COLORS: Record<string, { bg: string; color: string }> = {
  sueldo:        { bg: '#EBF5FF', color: '#3DD6B5' },
  todo_droga:    { bg: '#E8F8F0', color: '#145A32' },
  mym_fragancia: { bg: '#F3E8FF', color: '#6B21A8' },
  envases:       { bg: '#FFF9E6', color: '#B45309' },
  casa:          { bg: '#FFF3E0', color: '#E65100' },
  servicios:     { bg: '#FFFDE7', color: '#F57F17' },
  otros:         { bg: '#F5F7F9', color: '#8E8E93' },
}

function colorCategoria(slug: string): { bg: string; color: string } {
  return CATEGORIA_COLORS[slug] ?? CATEGORIA_COLORS.otros
}

function nombreCategoria(categorias: CategoriaEgreso[], slug: string): string {
  return categorias.find(c => c.slug === slug)?.nombre ?? slug
}

function slugify(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const MESES_CORTOS = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
]

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`
}

function formatMonto(n: number): string {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function hoy(): string {
  return new Date().toISOString().split('T')[0]
}

function aniosDisponibles(): number[] {
  const actual = new Date().getFullYear()
  return [actual - 2, actual - 1, actual, actual + 1].filter(y => y <= actual)
}

// ─── Schema Zod ───────────────────────────────────────────────────────────────

const schema = z.object({
  fecha_egreso:   z.string().min(1, 'La fecha es obligatoria'),
  categoria:      z.string().min(1, 'La categoría es obligatoria'),
  concepto:       z.string().min(3, 'Mínimo 3 caracteres'),
  monto:          z.string().refine(v => parseFloat(v) > 0, 'El monto debe ser mayor a 0'),
  registrado_por: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ─── Hook usuarios activos ────────────────────────────────────────────────────

function useUsuariosActivos() {
  return useQuery({
    queryKey: queryKeys.perfilesActivos(),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; nombre: string }[]
    },
  })
}

// ─── Badge categoría ──────────────────────────────────────────────────────────

function BadgeCategoria({ slug, categorias }: { slug: string; categorias: CategoriaEgreso[] }) {
  const { bg, color } = colorCategoria(slug)
  const label = nombreCategoria(categorias, slug)
  return (
    <span style={{
      backgroundColor: bg, color,
      fontSize: 9, fontWeight: 600,
      padding: '2px 8px', borderRadius: 99,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {label.toUpperCase()}
    </span>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function ShimmerRow() {
  return (
    <tr>
      {[80, 90, 180, 100, 70, 56].map((w, i) => (
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Skeleton style={{ height: 12, width: 80, borderRadius: 6 }} />
        <Skeleton style={{ height: 14, width: 70, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <Skeleton style={{ height: 18, width: 70, borderRadius: 99 }} />
        <Skeleton style={{ height: 12, width: 140, borderRadius: 6 }} />
      </div>
      <Skeleton style={{ height: 11, width: 110, borderRadius: 6 }} />
    </div>
  )
}

// ─── Select estilizado ────────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  height: 36, border: '0.5px solid #E5E5EA', borderRadius: 8,
  padding: '0 28px 0 10px', fontSize: 12, color: '#1C1C1E',
  background: '#fff', outline: 'none', appearance: 'none',
  cursor: 'pointer', fontFamily: 'Inter Variable, sans-serif',
}

// ─── Drawer de crear/editar ───────────────────────────────────────────────────

interface EgresoDrawerProps {
  open:    boolean
  onClose: () => void
  egreso:  Egreso | null
  onSaved: (msg: string) => void
}

function EgresoDrawer({ open, onClose, egreso, onSaved }: EgresoDrawerProps) {
  const crear    = useCrearEgreso()
  const editar   = useEditarEgreso()
  const usuario  = useAuthStore(s => s.usuario)
  const { data: usuarios }   = useUsuariosActivos()
  const { data: categorias = [] } = useCategoriasEgreso()
  const saving   = crear.isPending || editar.isPending

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha_egreso:   egreso?.fecha_egreso   ?? hoy(),
      categoria:      egreso?.categoria      ?? undefined,
      concepto:       egreso?.concepto       ?? '',
      monto:          egreso ? String(egreso.monto) : '',
      registrado_por: egreso?.registrado_por ?? usuario?.id ?? '',
    },
  })

  // Reset al abrir con datos nuevos
  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        fecha_egreso:   data.fecha_egreso,
        categoria:      data.categoria,
        concepto:       data.concepto,
        monto:          parseFloat(data.monto),
        registrado_por: data.registrado_por || undefined,
      }

      if (egreso) {
        await editar.mutateAsync({ id: egreso.id, ...payload })
        onSaved('Egreso actualizado correctamente')
      } else {
        await crear.mutateAsync(payload)
        onSaved('Egreso registrado correctamente')
        reset()
      }
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al guardar') + '|error')
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    display: 'block', marginBottom: 5,
  }
  const inputBase: React.CSSProperties = {
    width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 8,
    fontFamily: 'Inter Variable, sans-serif', color: '#1C1C1E', outline: 'none',
    background: '#fff', boxSizing: 'border-box', fontSize: 14,
    transition: 'border-color 0.15s',
  }
  const focusOn  = (e: React.FocusEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = '#7EB8E8' }
  const focusOff = (e: React.FocusEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E5EA' }

  const footer = (
    <>
      <button
        type="submit"
        form="egreso-form"
        disabled={saving}
        className="btn-press btn-drawer-primary"
        style={{
          background: saving ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Guardando…' : egreso ? 'Guardar cambios' : 'Registrar egreso'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="btn-press btn-drawer-ghost"
        style={{
          background: 'transparent', color: '#8E8E93', border: 'none',
          fontSize: 13, cursor: 'pointer',
        }}
      >
        Cancelar
      </button>
    </>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={egreso ? 'Editar egreso' : 'Nuevo egreso'}
      footer={footer}
    >
      <form
        id="egreso-form"
        onSubmit={handleSubmit(onSubmit)}
        className="drawer-form"
      >
        {/* Fecha + Categoría en grid 2 col desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {/* Fecha */}
          <div>
            <label htmlFor="egreso-fecha" style={labelStyle}>Fecha *</label>
            <input
              id="egreso-fecha"
              type="date"
              {...register('fecha_egreso')}
              onFocus={focusOn}
              onBlur={focusOff}
              style={{ ...inputBase, padding: '0 12px', height: 40 }}
            />
            {errors.fecha_egreso && (
              <span style={{ color: '#D32F2F', fontSize: 11, marginTop: 4, display: 'block' }}>
                {errors.fecha_egreso.message}
              </span>
            )}
          </div>

          {/* Categoría */}
          <div>
            <label htmlFor="egreso-cat" style={labelStyle}>Categoría *</label>
            <div style={{ position: 'relative' }}>
              <Controller
                control={control}
                name="categoria"
                render={({ field }) => (
                  <select
                    id="egreso-cat"
                    {...field}
                    onFocus={focusOn}
                    onBlur={focusOff}
                    style={{ ...inputBase, padding: '0 28px 0 12px', height: 40, appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Seleccioná una categoría</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.nombre}</option>
                    ))}
                  </select>
                )}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8E8E93', fontSize: 10 }}>▼</span>
            </div>
            {errors.categoria && (
              <span style={{ color: '#D32F2F', fontSize: 11, marginTop: 4, display: 'block' }}>
                {errors.categoria.message}
              </span>
            )}
          </div>
        </div>

        {/* Concepto */}
        <FloatInput
          label="Concepto *"
          placeholder="Ej: Pago proveedor materias primas"
          error={errors.concepto?.message}
          {...register('concepto')}
        />

        {/* Monto + Registrado por en grid 2 col desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {/* Monto con prefijo $ */}
          <div>
            <label htmlFor="egreso-monto" style={labelStyle}>Monto *</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 13, color: '#8E8E93', pointerEvents: 'none', userSelect: 'none',
              }}>$</span>
              <input
                id="egreso-monto"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                {...register('monto')}
                onFocus={focusOn}
                onBlur={focusOff}
                style={{ ...inputBase, padding: '0 12px 0 24px', height: 40 }}
              />
            </div>
            {errors.monto && (
              <span style={{ color: '#D32F2F', fontSize: 11, marginTop: 4, display: 'block' }}>
                {errors.monto.message}
              </span>
            )}
          </div>

          {/* Registrado por */}
          <div>
            <label htmlFor="egreso-reg" style={labelStyle}>Registrado por</label>
            <div style={{ position: 'relative' }}>
              <Controller
                control={control}
                name="registrado_por"
                render={({ field }) => (
                  <select
                    id="egreso-reg"
                    {...field}
                    onFocus={focusOn}
                    onBlur={focusOff}
                    style={{ ...inputBase, padding: '0 28px 0 12px', height: 40, appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Sin asignar</option>
                    {(usuarios ?? []).map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                )}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8E8E93', fontSize: 10 }}>▼</span>
            </div>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

// ─── Drawer de gestión de categorías ───────────────────────────────────────────
// Minimal a propósito: crear, renombrar, desactivar/reactivar. Nada de slugs
// ni ordenamiento manual expuestos — eso queda como detalle interno.

interface CategoriasDrawerProps {
  open:    boolean
  onClose: () => void
}

function CategoriasDrawer({ open, onClose }: CategoriasDrawerProps) {
  const { data: categorias = [], isLoading } = useCategoriasEgresoAdmin()
  const crear    = useCrearCategoriaEgreso()
  const editar   = useEditarCategoriaEgreso()
  const eliminar = useEliminarCategoriaEgreso()

  const [nuevoNombre, setNuevoNombre] = useState('')

  const [editandoId, setEditandoId]         = useState<string | null>(null)
  const [editandoNombre, setEditandoNombre] = useState('')

  const [confirmId, setConfirmId]     = useState<string | null>(null)
  const [avisoConteo, setAvisoConteo] = useState<number | null>(null)
  const [checkingId, setCheckingId]   = useState<string | null>(null)

  const inputSt: React.CSSProperties = {
    height: 38, border: '0.5px solid #E5E5EA', borderRadius: 8,
    padding: '0 12px', fontSize: 13, fontFamily: 'Inter Variable, sans-serif',
    color: '#1C1C1E', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box',
  }

  const activas   = categorias.filter(c => c.activo)
  const inactivas = categorias.filter(c => !c.activo)

  const handleCrear = async () => {
    const nombre = nuevoNombre.trim()
    const slug   = slugify(nombre)
    if (!nombre || !slug) return
    await crear.mutateAsync({ nombre, slug, orden: categorias.length })
    setNuevoNombre('')
  }

  const handleGuardarNombre = async (id: string) => {
    const nombre = editandoNombre.trim()
    if (!nombre) { setEditandoId(null); return }
    await editar.mutateAsync({ id, nombre })
    setEditandoId(null)
  }

  const handlePedirDesactivar = async (cat: CategoriaEgreso) => {
    setCheckingId(cat.id)
    const { count } = await supabase
      .from('egresos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria', cat.slug)
    setCheckingId(null)
    setAvisoConteo(count ?? 0)
    setConfirmId(cat.id)
  }

  const handleDesactivar = async (id: string) => {
    await eliminar.mutateAsync(id)
    setConfirmId(null)
    setAvisoConteo(null)
  }

  const handleReactivar = async (id: string) => {
    await editar.mutateAsync({ id, activo: true })
  }

  const filaCategoria = (cat: CategoriaEgreso) => (
    <div key={cat.id} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 12px', borderRadius: 10, background: '#fff',
      border: '0.5px solid #E5E5EA', gap: 8, flexWrap: 'wrap',
    }}>
      {editandoId === cat.id ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 160 }}>
          <input
            autoFocus
            value={editandoNombre}
            onChange={e => setEditandoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleGuardarNombre(cat.id); if (e.key === 'Escape') setEditandoId(null) }}
            style={{ ...inputSt, height: 32, flex: 1 }}
          />
          <button
            onClick={() => handleGuardarNombre(cat.id)}
            className="eg-btn btn-press"
            aria-label="Guardar nombre"
            style={{ width: 28, height: 28, background: '#E8FAF6', color: '#28B99A', border: 'none', flexShrink: 0 }}
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => setEditandoId(null)}
            className="eg-btn btn-press"
            aria-label="Cancelar edición"
            style={{ width: 28, height: 28, background: 'transparent', color: '#8E8E93', border: 'none', flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      ) : confirmId === cat.id ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontSize: 12, color: '#8E8E93', flex: 1, minWidth: 140 }}>
            {checkingId === cat.id
              ? 'Verificando…'
              : avisoConteo && avisoConteo > 0
                ? `"${cat.nombre}" tiene ${avisoConteo} egreso${avisoConteo === 1 ? '' : 's'} asociado${avisoConteo === 1 ? '' : 's'}. Se desactiva, no se borran.`
                : `¿Desactivar "${cat.nombre}"?`}
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => handleDesactivar(cat.id)}
              disabled={eliminar.isPending}
              className="btn-press"
              style={{
                background: '#FDECEA', color: '#D32F2F', border: '0.5px solid #D32F2F', borderRadius: 8,
                height: 30, padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {eliminar.isPending ? '…' : 'Desactivar'}
            </button>
            <button
              onClick={() => { setConfirmId(null); setAvisoConteo(null) }}
              className="btn-press"
              style={{ background: 'transparent', border: 'none', color: '#8E8E93', height: 30, padding: '0 8px', fontSize: 12, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <span style={{ fontSize: 13, fontWeight: 500, color: cat.activo ? '#1C1C1E' : '#8E8E93' }}>
            {cat.nombre}
          </span>
          {cat.activo ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { setEditandoId(cat.id); setEditandoNombre(cat.nombre) }}
                className="eg-btn btn-press"
                aria-label={`Editar ${cat.nombre}`}
                style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: '#8E8E93' }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handlePedirDesactivar(cat)}
                disabled={checkingId === cat.id}
                className="eg-btn btn-press"
                aria-label={`Desactivar ${cat.nombre}`}
                style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: '#8E8E93' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleReactivar(cat.id)}
              className="btn-press"
              style={{
                height: 26, padding: '0 10px', background: 'transparent',
                border: '0.5px solid #E5E5EA', borderRadius: 8, color: '#28B99A',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reactivar
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title="Categorías de egreso">
      {/* Nueva categoría — siempre a mano, arriba */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCrear() }}
          placeholder="Nueva categoría…"
          style={inputSt}
        />
        <button
          onClick={handleCrear}
          disabled={crear.isPending || !nuevoNombre.trim()}
          className="btn-press"
          aria-label="Agregar categoría"
          style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 8,
            background: nuevoNombre.trim() ? '#3DD6B5' : '#E5E5EA',
            color: '#fff', border: 'none',
            cursor: nuevoNombre.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} style={{ height: 42, borderRadius: 10 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activas.map(filaCategoria)}

          {inactivas.length > 0 && (
            <>
              <p style={{
                fontSize: 10, fontWeight: 500, color: '#8E8E93', textTransform: 'uppercase',
                letterSpacing: '0.06em', margin: '10px 0 0',
              }}>
                Inactivas
              </p>
              {inactivas.map(filaCategoria)}
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EgresosPage() {
  const hoyDate  = new Date()
  const [mes,  setMes]  = useState(hoyDate.getMonth() + 1)
  const [anio, setAnio] = useState(hoyDate.getFullYear())
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')

  const [drawerOpen, setDrawer]   = useState(false)
  const [selected, setSelected]   = useState<Egreso | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [categoriasOpen, setCategoriasOpen] = useState(false)

  const { toasts, show, dismiss } = useToast()

  const { data: egresos, isLoading } = useEgresos(mes, anio, categoriaFiltro || undefined)
  const eliminar = useEliminarEgreso()

  // Todas las categorías (activas + inactivas) — para poder mostrar el nombre
  // correcto en egresos históricos aunque su categoría ya no esté activa.
  const { data: categoriasTodas = [] } = useCategoriasEgresoAdmin()
  const categoriasActivas = useMemo(() => categoriasTodas.filter(c => c.activo), [categoriasTodas])

  const totalPeriodo = useMemo(
    () => (egresos ?? []).reduce((acc, e) => acc + e.monto, 0),
    [egresos],
  )

  const handleNew   = () => { setSelected(null); setDrawer(true) }
  const handleEdit  = (e: Egreso) => { setSelected(e); setDrawer(true) }
  const handleClose = () => { setDrawer(false); setSelected(null) }

  const handleSaved = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else                        show(msg, 'success')
  }

  const handleEliminar = async (id: string) => {
    try {
      await eliminar.mutateAsync(id)
      setConfirmId(null)
      show('Egreso eliminado', 'success')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error al eliminar', 'error')
    }
  }

  const mesLabel = MESES[mes - 1]
  const categoriaActiva = categoriaFiltro

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      <style>{`
        .eg-table { width: 100%; border-collapse: collapse; }
        .eg-table tbody tr { transition: background 0.1s; }
        .eg-table tbody tr:hover { background: #F9FAFB !important; }
        .eg-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; transition: all 0.1s; }
        .eg-btn:focus-visible { outline: 2px solid #7EB8E8; outline-offset: 2px; }
        .eg-sel { position: relative; display: inline-block; }
        .eg-sel::after { content: '▼'; position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-size: 9px; color: #8E8E93; pointer-events: none; }
        @media (max-width: 1023px) { .eg-desktop { display: none !important; } }
        @media (min-width: 1024px) { .eg-mobile  { display: none !important; } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title">Egresos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCategoriasOpen(true)}
            className="btn-press"
            aria-label="Gestionar categorías de egreso"
            style={{
              background: '#fff', color: '#8E8E93', border: '0.5px solid #E5E5EA',
              borderRadius: 10, height: 36, padding: '0 14px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3DD6B5'; e.currentTarget.style.color = '#28B99A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5EA'; e.currentTarget.style.color = '#8E8E93' }}
          >
            <Tags size={14} /> Categorías
          </button>
          <button
            onClick={handleNew}
            className="btn-press"
            style={{
              background: '#3DD6B5', color: '#fff', border: 'none',
              borderRadius: 10, height: 36, padding: '0 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Agregar egreso
          </button>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {/* Mes */}
        <div className="eg-sel">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            style={SELECT_STYLE}
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* Año */}
        <div className="eg-sel">
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            style={SELECT_STYLE}
          >
            {aniosDisponibles().map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Categoría */}
        <div className="eg-sel">
          <select
            value={categoriaFiltro}
            onChange={e => setCategoriaFiltro(e.target.value)}
            style={{ ...SELECT_STYLE, minWidth: 160 }}
          >
            <option value="">Todas las categorías</option>
            {categoriasActivas.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Resumen del período ──────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '0.5px solid #E5E5EA', borderRadius: 10,
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: '#8E8E93' }}>
          Total en {mesLabel} {anio}
          {categoriaActiva && ` · ${nombreCategoria(categoriasTodas, categoriaActiva)}`}
        </span>
        <span style={{ fontSize: 18, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.3px' }}>
          {formatMonto(totalPeriodo)}
        </span>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
      <div className="eg-desktop">
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E5EA', overflow: 'hidden' }}>
          <table className="eg-table" aria-label="Listado de egresos">
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '0.5px solid #E5E5EA' }}>
                {['Fecha','Categoría','Concepto','Registrado por','Monto','Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 14px', fontSize: 10, fontWeight: 500,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: '#8E8E93', textAlign: i === 4 ? 'right' : i === 5 ? 'right' : 'left',
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
              ) : !egresos?.length ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Receipt size={36} strokeWidth={1.2} color="#E5E5EA" />
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>
                        Sin egresos para {mesLabel} {anio}
                      </p>
                      <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
                        Registrá el primer egreso del período
                      </p>
                      <button
                        onClick={handleNew}
                        className="btn-press"
                        style={{
                          marginTop: 4, background: '#3DD6B5', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', minHeight: 40,
                        }}
                      >
                        + Agregar egreso
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                egresos.map(e => (
                  <tr key={e.id} style={{ background: '#fff' }}>
                    {/* Fecha */}
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: '#8E8E93', borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      {formatFecha(e.fecha_egreso)}
                    </td>

                    {/* Categoría */}
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      <BadgeCategoria slug={e.categoria} categorias={categoriasTodas} />
                    </td>

                    {/* Concepto */}
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', maxWidth: 260 }}>
                      <span style={{ fontSize: 13, color: '#1C1C1E', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.concepto}
                      </span>
                    </td>

                    {/* Registrado por */}
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: '#8E8E93', borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      {e.perfiles?.nombre ?? '—'}
                    </td>

                    {/* Monto */}
                    <td style={{ padding: '0 14px', height: 48, fontSize: 13, fontWeight: 500, color: '#1C1C1E', borderBottom: '0.5px solid #F5F7F9', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatMonto(e.monto)}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', textAlign: 'right' }}>
                      {confirmId === e.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#8E8E93', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                          <button
                            onClick={() => handleEliminar(e.id)}
                            disabled={eliminar.isPending}
                            className="eg-btn btn-press"
                            style={{
                              background: '#FDECEA', color: '#D32F2F',
                              border: '0.5px solid #D32F2F',
                              height: 28, padding: '0 10px', fontSize: 11, fontWeight: 600,
                            }}
                          >
                            {eliminar.isPending ? '…' : 'Sí, eliminar'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="eg-btn btn-press"
                            style={{ background: 'transparent', border: 'none', color: '#8E8E93', height: 28, padding: '0 8px', fontSize: 11 }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleEdit(e)}
                            className="eg-btn btn-press"
                            aria-label={`Editar egreso ${e.concepto}`}
                            style={{
                              width: 28, height: 28, background: 'transparent',
                              border: '0.5px solid #E5E5EA', color: '#8E8E93',
                            }}
                            onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.background = '#F5F7F9' }}
                            onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setConfirmId(e.id)}
                            className="eg-btn btn-press"
                            aria-label={`Eliminar egreso ${e.concepto}`}
                            style={{
                              width: 28, height: 28, background: 'transparent',
                              border: '0.5px solid #E5E5EA', color: '#8E8E93',
                            }}
                            onMouseEnter={ev => {
                              const b = ev.currentTarget as HTMLButtonElement
                              b.style.color = '#D32F2F'
                              b.style.borderColor = '#D32F2F'
                              b.style.background = '#FDECEA'
                            }}
                            onMouseLeave={ev => {
                              const b = ev.currentTarget as HTMLButtonElement
                              b.style.color = '#8E8E93'
                              b.style.borderColor = '#E5E5EA'
                              b.style.background = 'transparent'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && !!egresos?.length && (
            <div style={{ padding: '10px 14px', borderTop: '0.5px solid #F5F7F9' }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>
                {egresos.length} {egresos.length === 1 ? 'egreso' : 'egresos'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────────── */}
      <div className="eg-mobile">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ShimmerCard key={i} />)
        ) : !egresos?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
            <Receipt size={36} strokeWidth={1.2} color="#E5E5EA" />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>
              Sin egresos para {mesLabel} {anio}
            </p>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
              Registrá el primer egreso del período
            </p>
            <button
              onClick={handleNew}
              className="btn-press"
              style={{
                background: '#3DD6B5', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', minHeight: 44,
              }}
            >
              + Agregar egreso
            </button>
          </div>
        ) : (
          <>
            {egresos.map(e => (
              <div
                key={e.id}
                style={{
                  background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5EA',
                  padding: '12px 16px', marginBottom: 6,
                }}
              >
                {/* Línea 1: fecha + monto */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>{formatFecha(e.fecha_egreso)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{formatMonto(e.monto)}</span>
                </div>

                {/* Línea 2: badge + concepto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, overflow: 'hidden' }}>
                  <BadgeCategoria slug={e.categoria} categorias={categoriasTodas} />
                  <span style={{ fontSize: 13, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.concepto}
                  </span>
                </div>

                {/* Línea 3: registrado por */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {e.perfiles?.nombre ?? '—'}
                  </span>

                  {/* Acciones o confirmación */}
                  {confirmId === e.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#8E8E93' }}>¿Eliminar?</span>
                      <button
                        onClick={() => handleEliminar(e.id)}
                        disabled={eliminar.isPending}
                        className="eg-btn btn-press"
                        style={{
                          background: '#FDECEA', color: '#D32F2F',
                          border: '0.5px solid #D32F2F',
                          height: 28, padding: '0 10px', fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {eliminar.isPending ? '…' : 'Sí'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="eg-btn btn-press"
                        style={{ background: 'transparent', border: 'none', color: '#8E8E93', height: 28, padding: '0 6px', fontSize: 11 }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleEdit(e)}
                        className="eg-btn btn-press"
                        aria-label={`Editar ${e.concepto}`}
                        style={{ width: 32, height: 32, background: 'transparent', border: '0.5px solid #E5E5EA', color: '#8E8E93' }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmId(e.id)}
                        className="eg-btn btn-press"
                        aria-label={`Eliminar ${e.concepto}`}
                        style={{ width: 32, height: 32, background: 'transparent', border: '0.5px solid #E5E5EA', color: '#8E8E93' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', padding: '12px 0', margin: 0 }}>
              {egresos.length} {egresos.length === 1 ? 'egreso' : 'egresos'}
            </p>
          </>
        )}
      </div>

      <CategoriasDrawer
        open={categoriasOpen}
        onClose={() => setCategoriasOpen(false)}
      />

      <EgresoDrawer
        open={drawerOpen}
        onClose={handleClose}
        egreso={selected}
        onSaved={handleSaved}
      />

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
