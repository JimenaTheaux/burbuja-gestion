import { useState } from 'react'
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

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}
        >
          <FloatInput label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />
          <FloatInput label="Teléfono" {...register('telefono')} type="tel" />
          <FloatInput label="Dirección de entrega" {...register('direccion')} />

          <ButtonGroup
            label="Tipo de cliente *"
            value={tipoVal}
            onChange={v => setValue('tipo_cliente', v, { shouldValidate: true })}
            error={errors.tipo_cliente?.message}
            options={[
              { value: 'minorista', label: 'Minorista' },
              { value: 'mayorista', label: 'Mayorista', color: '#1B9ED6' },
            ]}
          />

          <FloatInput label="Observaciones" {...register('notas')} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background:     saving ? 'rgba(13,92,138,0.5)' : '#0D5C8A',
                color:          '#fff', border: 'none', borderRadius: 10,
                padding:        '13px 20px', minHeight: 44,
                fontSize:       15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Crear cliente'}
            </button>
            <button
              type="button" onClick={onClose}
              style={{
                background: 'transparent', color: '#0D5C8A',
                border: '1.5px solid #0D5C8A', borderRadius: 10,
                padding: '12px 20px', minHeight: 44,
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>

        {cliente && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #D1D5DB' }}>
            <button
              onClick={async () => {
                await editar.mutateAsync({ id: cliente.id, activo: !cliente.activo })
                onSaved(`Cliente ${!cliente.activo ? 'activado' : 'desactivado'}`)
                onClose()
              }}
              style={{
                width: '100%', background: cliente.activo ? '#FDECEA' : '#E8F8F0',
                color: cliente.activo ? '#D32F2F' : '#2E9E5C',
                border: `1.5px solid ${cliente.activo ? '#D32F2F' : '#2E9E5C'}`,
                borderRadius: 10, padding: '12px 20px', minHeight: 44,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {cliente.activo ? 'Desactivar cliente' : 'Activar cliente'}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgeTipo({ tipo }: { tipo: 'minorista' | 'mayorista' }) {
  const mayorista = tipo === 'mayorista'
  return (
    <span style={{
      backgroundColor: mayorista ? '#E8F4FF' : '#F4F6F8',
      color:           mayorista ? '#0D5C8A' : '#4A5568',
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
    <div>
      <style>{`
        .cli-table { width: 100%; border-collapse: collapse; }
        .cli-table tbody tr { transition: background 0.1s; cursor: default; }
        .cli-table tbody tr:hover { background: #F9FAFB !important; }
        .cli-edit-btn:focus-visible { outline: 2px solid #1B9ED6; outline-offset: 2px; }
        .cli-card:focus-visible { outline: 2px solid #1B9ED6; outline-offset: 2px; }
        @media (max-width: 1023px) { .cli-desktop { display: none !important; } }
        @media (min-width: 1024px) { .cli-mobile  { display: none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: '#1A2B3C', margin: 0 }}>Clientes</h1>
        <button
          onClick={handleNew}
          style={{
            background: '#0D5C8A', color: '#fff', border: 'none',
            borderRadius: 8, height: 36, padding: '0 14px',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={13} /> Nuevo cliente
        </button>
      </div>

      {/* Buscador + pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div role="search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <label htmlFor="cli-search" className="sr-only">Buscar clientes</label>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4A5568', pointerEvents: 'none' }}
          />
          <input
            id="cli-search"
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
      <div className="cli-desktop">
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #D1D5DB', overflow: 'hidden' }}>
          <table className="cli-table" aria-label="Listado de clientes">
            <thead>
              <tr style={{ background: '#F4F6F8', borderBottom: '0.5px solid #D1D5DB' }}>
                {['Cliente', 'Contacto', 'Dirección', 'Tipo', 'Estado', 'Acciones'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      padding: '8px 14px',
                      fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#4A5568',
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
                    <p style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: '#4A5568', margin: 0 }}>
                      No se encontraron clientes
                    </p>
                  </td>
                </tr>
              ) : (
                clientes.map(c => (
                  <tr key={c.id} style={{ background: '#fff' }}>
                    <th
                      scope="row"
                      style={{
                        padding: '0 14px', height: 48,
                        fontSize: 13, fontWeight: 500, color: '#1A2B3C',
                        textAlign: 'left', borderBottom: '0.5px solid #F4F6F8',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.nombre}
                    </th>
                    <td style={{ padding: '0 14px', height: 48, fontSize: 12, color: c.telefono ? '#4A5568' : '#D1D5DB', borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      {c.telefono ?? '—'}
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', maxWidth: 240 }}>
                      <span style={{ display: 'block', fontSize: 12, color: c.direccion ? '#4A5568' : '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.direccion ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      <BadgeTipo tipo={c.tipo_cliente} />
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', whiteSpace: 'nowrap' }}>
                      <BadgeActivo activo={c.activo ?? true} />
                    </td>
                    <td style={{ padding: '0 14px', height: 48, borderBottom: '0.5px solid #F4F6F8', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEdit(c)}
                        className="cli-edit-btn"
                        aria-label={`Editar cliente ${c.nombre}`}
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

          {!isLoading && !!clientes?.length && (
            <div style={{ padding: '10px 14px', borderTop: '0.5px solid #F4F6F8' }}>
              <span style={{ fontSize: 12, color: '#4A5568' }}>
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
          <p style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: '#4A5568', margin: 0 }}>
            No se encontraron clientes
          </p>
        ) : (
          <>
            {clientes.map(c => (
              <div
                key={c.id}
                className="cli-card"
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(c)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(c) } }}
                aria-label={`Editar cliente ${c.nombre}`}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: '#1A2B3C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {c.nombre}
                    </span>
                    <BadgeTipo tipo={c.tipo_cliente} />
                  </div>
                  {/* Línea 2 */}
                  <p style={{ fontSize: 12, color: '#4A5568', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
