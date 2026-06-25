import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import { Skeleton }       from '@/components/ui/skeleton'
import { Drawer }         from '@/components/common/Drawer'
import { FloatInput }     from '@/components/common/FloatInput'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import { useAuthStore }   from '@/store/authStore'
import { supabase }       from '@/lib/supabase'
import { useQuery }       from '@tanstack/react-query'
import {
  useEgresos, useCrearEgreso, useEditarEgreso, useEliminarEgreso,
} from '@/services/egresos'
import type { Egreso, CategoriaEgreso } from '@/types'
import { CATEGORIA_EGRESO_LABELS } from '@/types'

// ─── Colores por categoría ────────────────────────────────────────────────────

const CATEGORIA_COLORS: Record<CategoriaEgreso, { bg: string; color: string }> = {
  sueldos:   { bg: '#E8F4FF', color: '#0D5C8A' },
  alquiler:  { bg: '#FFF3E0', color: '#E65100' },
  drogueria: { bg: '#E8F8F0', color: '#145A32' },
  grafica:   { bg: '#F3E8FF', color: '#6B21A8' },
  packaging: { bg: '#FFF9E6', color: '#B45309' },
  luz:       { bg: '#FFFDE7', color: '#F57F17' },
  otros:     { bg: '#F4F6F8', color: '#4A5568' },
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
  categoria:      z.enum(['sueldos','alquiler','drogueria','grafica','packaging','luz','otros']),
  concepto:       z.string().min(3, 'Mínimo 3 caracteres'),
  monto:          z.string().refine(v => parseFloat(v) > 0, 'El monto debe ser mayor a 0'),
  registrado_por: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ─── Hook usuarios activos ────────────────────────────────────────────────────

function useUsuariosActivos() {
  return useQuery({
    queryKey: ['perfiles-activos'],
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

function BadgeCategoria({ categoria }: { categoria: CategoriaEgreso }) {
  const { bg, color } = CATEGORIA_COLORS[categoria]
  return (
    <span style={{
      backgroundColor: bg, color,
      fontSize: 9, fontWeight: 600,
      padding: '2px 8px', borderRadius: 99,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {CATEGORIA_EGRESO_LABELS[categoria].toUpperCase()}
    </span>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function ShimmerRow() {
  return (
    <tr>
      {[80, 90, 180, 100, 70, 56].map((w, i) => (
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
  height: 36, border: '0.5px solid #D1D5DB', borderRadius: 8,
  padding: '0 28px 0 10px', fontSize: 12, color: '#1A2B3C',
  background: '#fff', outline: 'none', appearance: 'none',
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
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
  const { data: usuarios } = useUsuariosActivos()
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
    fontSize: 10, fontWeight: 500, color: '#4A5568',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    display: 'block', marginBottom: 5,
  }
  const inputBase: React.CSSProperties = {
    width: '100%', border: '0.5px solid #D1D5DB', borderRadius: 8,
    fontFamily: 'Inter, sans-serif', color: '#1A2B3C', outline: 'none',
    background: '#fff', boxSizing: 'border-box', fontSize: 14,
    transition: 'border-color 0.15s',
  }
  const focusOn  = (e: React.FocusEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B9ED6' }
  const focusOff = (e: React.FocusEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB' }

  const footer = (
    <>
      <button
        type="submit"
        form="egreso-form"
        disabled={saving}
        className="btn-press"
        style={{
          background: saving ? 'rgba(13,92,138,0.5)' : '#0D5C8A',
          color: '#fff', border: 'none', borderRadius: 10,
          height: 44, fontSize: 14, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', width: '100%',
        }}
      >
        {saving ? 'Guardando…' : egreso ? 'Guardar cambios' : 'Registrar egreso'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="btn-press"
        style={{
          background: 'transparent', color: '#4A5568', border: 'none',
          height: 36, fontSize: 13, cursor: 'pointer', width: '100%',
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
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
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
                    {(Object.keys(CATEGORIA_EGRESO_LABELS) as CategoriaEgreso[]).map(k => (
                      <option key={k} value={k}>{CATEGORIA_EGRESO_LABELS[k]}</option>
                    ))}
                  </select>
                )}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#4A5568', fontSize: 10 }}>▼</span>
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
                fontSize: 13, color: '#4A5568', pointerEvents: 'none', userSelect: 'none',
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
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#4A5568', fontSize: 10 }}>▼</span>
            </div>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EgresosPage() {
  const hoyDate  = new Date()
  const [mes,  setMes]  = useState(hoyDate.getMonth() + 1)
  const [anio, setAnio] = useState(hoyDate.getFullYear())
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaEgreso | ''>('')

  const [drawerOpen, setDrawer]   = useState(false)
  const [selected, setSelected]   = useState<Egreso | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const { toasts, show, dismiss } = useToast()

  const { data: egresos, isLoading } = useEgresos(mes, anio, categoriaFiltro || undefined)
  const eliminar = useEliminarEgreso()

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
  const categoriaActiva = categoriaFiltro as CategoriaEgreso | ''

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      <style>{`
        .eg-table { width: 100%; border-collapse: collapse; }
        .eg-table tbody tr { transition: background 0.1s; }
        .eg-table tbody tr:hover { background: #F9FAFB !important; }
        .eg-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; transition: all 0.1s; }
        .eg-btn:focus-visible { outline: 2px solid #1B9ED6; outline-offset: 2px; }
        .eg-sel { position: relative; display: inline-block; }
        .eg-sel::after { content: '▼'; position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-size: 9px; color: #4A5568; pointer-events: none; }
        @media (max-width: 1023px) { .eg-desktop { display: none !important; } }
        @media (min-width: 1024px) { .eg-mobile  { display: none !important; } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title">Egresos</h1>
        <button
          onClick={handleNew}
          className="btn-press"
          style={{
            background: '#0D5C8A', color: '#fff', border: 'none',
            borderRadius: 10, height: 36, padding: '0 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} /> Agregar egreso
        </button>
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
            onChange={e => setCategoriaFiltro(e.target.value as CategoriaEgreso | '')}
            style={{ ...SELECT_STYLE, minWidth: 160 }}
          >
            <option value="">Todas las categorías</option>
            {(Object.keys(CATEGORIA_EGRESO_LABELS) as CategoriaEgreso[]).map(k => (
              <option key={k} value={k}>{CATEGORIA_EGRESO_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Resumen del período ──────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10,
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: '#4A5568' }}>
          Total en {mesLabel} {anio}
          {categoriaActiva && ` · ${CATEGORIA_EGRESO_LABELS[categoriaActiva]}`}
        </span>
        <span style={{ fontSize: 18, fontWeight: 500, color: '#1A2B3C', letterSpacing: '-0.3px' }}>
          {formatMonto(totalPeriodo)}
        </span>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
      <div className="eg-desktop">
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #D1D5DB', overflow: 'hidden' }}>
          <table className="eg-table" aria-label="Listado de egresos">
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '0.5px solid #D1D5DB' }}>
                {['Fecha','Categoría','Concepto','Registrado por','Monto','Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 14px', fontSize: 10, fontWeight: 500,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: '#4A5568', textAlign: i === 4 ? 'right' : i === 5 ? 'right' : 'left',
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
                      <Receipt size={36} strokeWidth={1.2} color="#D1D5DB" />
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>
                        Sin egresos para {mesLabel} {anio}
                      </p>
                      <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>
                        Registrá el primer egreso del período
                      </p>
                      <button
                        onClick={handleNew}
                        className="btn-press"
                        style={{
                          marginTop: 4, background: '#0D5C8A', color: '#fff', border: 'none',
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
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: '#4A5568', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      {formatFecha(e.fecha_egreso)}
                    </td>

                    {/* Categoría */}
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      <BadgeCategoria categoria={e.categoria} />
                    </td>

                    {/* Concepto */}
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', maxWidth: 260 }}>
                      <span style={{ fontSize: 13, color: '#1A2B3C', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.concepto}
                      </span>
                    </td>

                    {/* Registrado por */}
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: '#4A5568', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      {e.perfiles?.nombre ?? '—'}
                    </td>

                    {/* Monto */}
                    <td style={{ padding: '0 14px', height: 48, fontSize: 13, fontWeight: 500, color: '#1A2B3C', borderBottom: '0.5px solid #F4F6F8', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatMonto(e.monto)}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', textAlign: 'right' }}>
                      {confirmId === e.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#4A5568', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
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
                            style={{ background: 'transparent', border: 'none', color: '#4A5568', height: 28, padding: '0 8px', fontSize: 11 }}
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
                              border: '0.5px solid #D1D5DB', color: '#4A5568',
                            }}
                            onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.background = '#F4F6F8' }}
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
                              border: '0.5px solid #D1D5DB', color: '#4A5568',
                            }}
                            onMouseEnter={ev => {
                              const b = ev.currentTarget as HTMLButtonElement
                              b.style.color = '#D32F2F'
                              b.style.borderColor = '#D32F2F'
                              b.style.background = '#FDECEA'
                            }}
                            onMouseLeave={ev => {
                              const b = ev.currentTarget as HTMLButtonElement
                              b.style.color = '#4A5568'
                              b.style.borderColor = '#D1D5DB'
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
            <div style={{ padding: '10px 14px', borderTop: '0.5px solid #F4F6F8' }}>
              <span style={{ fontSize: 12, color: '#4A5568' }}>
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
            <Receipt size={36} strokeWidth={1.2} color="#D1D5DB" />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>
              Sin egresos para {mesLabel} {anio}
            </p>
            <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>
              Registrá el primer egreso del período
            </p>
            <button
              onClick={handleNew}
              className="btn-press"
              style={{
                background: '#0D5C8A', color: '#fff', border: 'none',
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
                  background: '#fff', borderRadius: 12, border: '0.5px solid #D1D5DB',
                  padding: '12px 16px', marginBottom: 6,
                }}
              >
                {/* Línea 1: fecha + monto */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: '#4A5568' }}>{formatFecha(e.fecha_egreso)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2B3C' }}>{formatMonto(e.monto)}</span>
                </div>

                {/* Línea 2: badge + concepto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, overflow: 'hidden' }}>
                  <BadgeCategoria categoria={e.categoria} />
                  <span style={{ fontSize: 13, color: '#1A2B3C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      <span style={{ fontSize: 11, color: '#4A5568' }}>¿Eliminar?</span>
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
                        style={{ background: 'transparent', border: 'none', color: '#4A5568', height: 28, padding: '0 6px', fontSize: 11 }}
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
                        style={{ width: 32, height: 32, background: 'transparent', border: '0.5px solid #D1D5DB', color: '#4A5568' }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmId(e.id)}
                        className="eg-btn btn-press"
                        aria-label={`Eliminar ${e.concepto}`}
                        style={{ width: 32, height: 32, background: 'transparent', border: '0.5px solid #D1D5DB', color: '#4A5568' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#4A5568', textAlign: 'center', padding: '12px 0', margin: 0 }}>
              {egresos.length} {egresos.length === 1 ? 'egreso' : 'egresos'}
            </p>
          </>
        )}
      </div>

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
