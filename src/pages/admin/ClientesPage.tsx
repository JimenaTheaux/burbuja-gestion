import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Users, ChevronDown } from 'lucide-react'
import { Skeleton }       from '@/components/ui/skeleton'
import { Drawer }         from '@/components/common/Drawer'
import { FloatInput }     from '@/components/common/FloatInput'
import { ButtonGroup }    from '@/components/common/ButtonGroup'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import {
  useClientes, useCrearCliente, useEditarCliente,
} from '@/services/clientes'
import { useDebounce } from '@/hooks/useDebounce'
import type { Cliente } from '@/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nombre:       z.string().min(1, 'El nombre es obligatorio'),
  telefono:     z.string().optional(),
  direccion:    z.string().optional(),
  tipo_cliente: z.enum(['minorista', 'mayorista']),
  notas:        z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ─── Drawer de formulario ─────────────────────────────────────────────────────

interface DrawerProps {
  open:    boolean
  onClose: () => void
  cliente: Cliente | null
  onSaved: (msg: string) => void
}

function ClienteDrawer({ open, onClose, cliente, onSaved }: DrawerProps) {
  const crear  = useCrearCliente()
  const editar = useEditarCliente()
  const saving = crear.isPending || editar.isPending
  const [notasOpen, setNotasOpen] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre:       cliente?.nombre       ?? '',
      telefono:     cliente?.telefono     ?? '',
      direccion:    cliente?.direccion    ?? '',
      tipo_cliente: cliente?.tipo_cliente ?? 'minorista',
      notas:        cliente?.notas        ?? '',
    },
  })

  const tipoVal = watch('tipo_cliente')

  const onSubmit = async (data: FormData) => {
    try {
      if (cliente) {
        await editar.mutateAsync({
          id:           cliente.id,
          nombre:       data.nombre,
          telefono:     data.telefono    || null,
          direccion:    data.direccion   || null,
          tipo_cliente: data.tipo_cliente,
          notas:        data.notas       || null,
        })
        onSaved('Cliente actualizado correctamente')
      } else {
        await crear.mutateAsync({
          nombre:       data.nombre,
          telefono:     data.telefono    || null,
          direccion:    data.direccion   || null,
          tipo_cliente: data.tipo_cliente,
          notas:        data.notas       || null,
          activo:       true,
        })
        onSaved('Cliente creado correctamente')
        reset()
      }
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al guardar') + '|error')
    }
  }

  const footer = (
    <>
      <button
        type="submit"
        form="cliente-form"
        disabled={saving}
        className="btn-press btn-drawer-primary"
        style={{
          background: saving ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Crear cliente'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="btn-press btn-drawer-ghost"
        style={{
          background: 'transparent', color: '#8E8E93',
          border: 'none', fontSize: 13,
          cursor: 'pointer',
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
      title={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      footer={footer}
    >
      <form
        id="cliente-form"
        onSubmit={handleSubmit(onSubmit)}
        className="drawer-form"
      >
        <FloatInput
          label="Nombre *"
          error={errors.nombre?.message}
          autoComplete="name"
          {...register('nombre')}
        />
        <FloatInput
          label="Teléfono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          {...register('telefono')}
        />

        {/* Dirección + Tipo en grid 2 columnas */}
        <div className="form-grid-2">
          <FloatInput
            label="Dirección de entrega"
            autoComplete="street-address"
            {...register('direccion')}
          />
          <ButtonGroup
            label="Tipo *"
            compact
            value={tipoVal}
            onChange={v => setValue('tipo_cliente', v, { shouldValidate: true })}
            error={errors.tipo_cliente?.message}
            options={[
              { value: 'minorista', label: 'Min.' },
              { value: 'mayorista', label: 'May.', color: '#7EB8E8' },
            ]}
          />
        </div>

        {/* Notas colapsado */}
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
              Notas <span style={{ color: '#9CA3AF' }}>(opcional)</span>
            </span>
            <ChevronDown size={14} color="#8E8E93" style={{ transform: notasOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <div style={{ display: 'grid', gridTemplateRows: notasOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease' }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0 12px 12px' }}>
                <FloatInput
                  label="Observaciones"
                  as="textarea"
                  {...register('notas')}
                />
              </div>
            </div>
          </div>
        </div>

        {cliente && (
          <div style={{ paddingTop: 16, borderTop: '0.5px solid #F5F7F9' }}>
            <button
              type="button"
              onClick={async () => {
                await editar.mutateAsync({ id: cliente.id, activo: !cliente.activo })
                onSaved(`Cliente ${!cliente.activo ? 'activado' : 'desactivado'}`)
                onClose()
              }}
              className="btn-press"
              style={{
                width: '100%', background: cliente.activo ? '#FDECEA' : '#E8F8F0',
                color: cliente.activo ? '#D32F2F' : '#2E9E5C',
                border: `1.5px solid ${cliente.activo ? '#D32F2F' : '#2E9E5C'}`,
                borderRadius: 10, padding: '10px 20px', minHeight: 40,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {cliente.activo ? 'Desactivar cliente' : 'Activar cliente'}
            </button>
          </div>
        )}
      </form>
    </Drawer>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgeTipo({ tipo }: { tipo: 'minorista' | 'mayorista' }) {
  const mayorista = tipo === 'mayorista'
  return (
    <span style={{
      backgroundColor: mayorista ? '#EBF5FF' : '#F5F7F9',
      color:           mayorista ? '#3DD6B5' : '#8E8E93',
      fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {tipo.toUpperCase()}
    </span>
  )
}

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
      {[160, 110, 180, 70, 60, 28].map((w, i) => (
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Skeleton style={{ height: 13, width: 150, borderRadius: 6 }} />
        <Skeleton style={{ height: 18, width: 64, borderRadius: 99 }} />
      </div>
      <Skeleton style={{ height: 11, width: 210, borderRadius: 6 }} />
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [q, setQ]                     = useState('')
  const [activoFiltro, setActivo]     = useState<ActivoFiltro>('activo')
  const [drawerOpen, setDrawer]       = useState(false)
  const [selected, setSelected]       = useState<Cliente | null>(null)
  const { toasts, show, dismiss }     = useToast()

  const qDebounced = useDebounce(q, 300)
  const { data: clientes, isLoading } = useClientes(qDebounced || undefined, ACTIVO_MAP[activoFiltro])

  const handleEdit  = (c: Cliente) => { setSelected(c); setDrawer(true) }
  const handleNew   = ()           => { setSelected(null); setDrawer(true) }
  const handleClose = ()           => { setDrawer(false); setSelected(null) }

  const handleSaved = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else                        show(msg, 'success')
  }

  return (
    <div style={{ animation: 'fadeSlideIn 0.18s ease' }}>
      <style>{`
        .cli-table { width: 100%; border-collapse: collapse; }
        .cli-table tbody tr { transition: background 0.1s; cursor: default; }
        .cli-table tbody tr:hover { background: #F9FAFB !important; }
        .cli-edit-btn:focus-visible { outline: 2px solid #7EB8E8; outline-offset: 2px; }
        .cli-card:focus-visible { outline: 2px solid #7EB8E8; outline-offset: 2px; }
        @media (max-width: 1023px) { .cli-desktop { display: none !important; } }
        @media (min-width: 1024px) { .cli-mobile  { display: none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="section-title">Clientes</h1>
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
          <Plus size={14} /> Nuevo cliente
        </button>
      </div>

      {/* Buscador + pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div role="search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <label htmlFor="cli-search" className="sr-only">Buscar clientes</label>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8E8E93', pointerEvents: 'none' }}
          />
          <input
            id="cli-search"
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
      <div className="cli-desktop">
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5EA', overflow: 'hidden' }}>
          <table className="cli-table" aria-label="Listado de clientes">
            <thead>
              <tr style={{ background: '#F5F7F9', borderBottom: '0.5px solid #E5E5EA' }}>
                {['Cliente', 'Contacto', 'Dirección', 'Tipo', 'Estado', 'Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 14px',
                      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#8E8E93',
                      textAlign: i === 5 ? 'right' : 'left',
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
              ) : !clientes?.length ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Users size={40} strokeWidth={1.2} color="#E5E5EA" />
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>Sin clientes</p>
                      <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
                        {q ? 'No hay clientes que coincidan con la búsqueda' : 'Agregá tu primer cliente'}
                      </p>
                      {!q && (
                        <button onClick={handleNew} className="btn-press" style={{
                          marginTop: 4, background: '#3DD6B5', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', minHeight: 40,
                        }}>
                          + Nuevo cliente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                clientes.map(c => (
                  <tr key={c.id} style={{ background: '#fff' }}>
                    <th
                      scope="row"
                      style={{
                        padding: '0 14px', height: 48,
                        fontSize: 13, fontWeight: 500, color: '#1C1C1E',
                        textAlign: 'left', borderBottom: '0.5px solid #F5F7F9',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.nombre}
                    </th>
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: c.telefono ? '#8E8E93' : '#E5E5EA', borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      {c.telefono ?? '—'}
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', maxWidth: 240 }}>
                      <span style={{ display: 'block', fontSize: 12, color: c.direccion ? '#8E8E93' : '#E5E5EA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.direccion ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      <BadgeTipo tipo={c.tipo_cliente} />
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', whiteSpace: 'nowrap' }}>
                      <BadgeActivo activo={c.activo ?? true} />
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F5F7F9', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEdit(c)}
                        className="cli-edit-btn"
                        aria-label={`Editar cliente ${c.nombre}`}
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && !!clientes?.length && (
            <div style={{ padding: '10px 14px', borderTop: '0.5px solid #F5F7F9' }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>
                {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────────── */}
      <div className="cli-mobile">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ShimmerCard key={i} />)
        ) : !clientes?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
            <Users size={40} strokeWidth={1.2} color="#E5E5EA" />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>Sin clientes</p>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>
              {q ? 'No hay clientes que coincidan' : 'Agregá tu primer cliente'}
            </p>
            {!q && (
              <button onClick={handleNew} className="btn-press" style={{
                background: '#3DD6B5', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', minHeight: 44,
              }}>
                + Nuevo cliente
              </button>
            )}
          </div>
        ) : (
          <>
            {clientes.map(c => (
              <div
                key={c.id}
                className="cli-card card-tappable"
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(c)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(c) } }}
                aria-label={`Editar cliente ${c.nombre}`}
                style={{
                  background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5EA',
                  padding: '12px 16px', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Línea 1 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {c.nombre}
                    </span>
                    <BadgeTipo tipo={c.tipo_cliente} />
                  </div>
                  {/* Línea 2 */}
                  <p style={{ fontSize: 12, color: '#8E8E93', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[c.telefono, c.direccion].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <button
                  onClick={e => e.stopPropagation()}
                  className="cli-edit-btn"
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{
                    width: 36, height: 36, flexShrink: 0,
                    background: 'transparent', border: '0.5px solid #E5E5EA', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#8E8E93',
                  }}
                >
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', padding: '12px 0', margin: 0 }}>
              {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
            </p>
          </>
        )}
      </div>

      <ClienteDrawer
        open={drawerOpen}
        onClose={handleClose}
        cliente={selected}
        onSaved={handleSaved}
      />

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
