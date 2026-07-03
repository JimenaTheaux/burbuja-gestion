import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Settings, Mail, Eye, EyeOff, KeyRound, ChevronDown } from 'lucide-react'
import { Drawer }           from '@/components/common/Drawer'
import { Skeleton }         from '@/components/ui/skeleton'
import { FloatInput }       from '@/components/common/FloatInput'
import { ButtonGroup }      from '@/components/common/ButtonGroup'
import { BadgeRol, BadgeActivo } from '@/components/common/BadgeEstado'
import { EmptyState }       from '@/components/common/EmptyState'
import { ToastContainer }   from '@/components/common/ToastContainer'
import { useToast }         from '@/hooks/useToast'
import { useAuth }          from '@/hooks/useAuth'
import {
  useUsuarios, useCrearUsuario, useEditarUsuario, useResetPasswordUsuario,
  type UsuarioConEmail,
} from '@/services/usuarios'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROL_OPTIONS = [
  { value: 'admin',      label: 'Admin',      color: '#7EB8E8' },
  { value: 'produccion', label: 'Producción', color: '#F57C00' },
  { value: 'repartidor', label: 'Repartidor', color: '#2E9E5C' },
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const crearSchema = z.object({
  nombre:   z.string().min(1, 'El nombre es obligatorio'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol:      z.enum(['admin', 'produccion', 'repartidor']),
})

const editarSchema = z.object({
  nombre:   z.string().min(1, 'El nombre es obligatorio'),
  rol:      z.enum(['admin', 'produccion', 'repartidor']),
})

type CrearForm  = z.infer<typeof crearSchema>
type EditarForm = z.infer<typeof editarSchema>

// ─── Drawer crear ─────────────────────────────────────────────────────────────

interface CrearDrawerProps {
  open:    boolean
  onClose: () => void
  onSaved: (msg: string) => void
}

function CrearUsuarioDrawer({ open, onClose, onSaved }: CrearDrawerProps) {
  const crear  = useCrearUsuario()
  const saving = crear.isPending

  const { register, handleSubmit, reset, watch, setValue: setVal, formState: { errors } } = useForm<CrearForm>({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre: '', email: '', password: '', rol: 'admin' },
  })

  const rolVal = watch('rol')

  const onSubmit = async (data: CrearForm) => {
    try {
      await crear.mutateAsync(data)
      onSaved('Usuario creado correctamente')
      reset()
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al crear usuario') + '|error')
    }
  }

  const footer = (
    <>
      <button
        type="submit"
        form="crear-usuario-form"
        disabled={saving}
        className="btn-press btn-drawer-primary"
        style={{
          background: saving ? 'rgba(61,214,181,0.5)' : '#3DD6B5', color: '#fff',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Creando…' : 'Crear usuario'}
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
    <Drawer open={open} onClose={onClose} title="Nuevo usuario" footer={footer}>
      <form
        id="crear-usuario-form"
        onSubmit={handleSubmit(onSubmit)}
        className="drawer-form"
      >
        {/* Nombre + Email */}
        <div className="form-grid-2">
          <FloatInput label="Nombre completo *" error={errors.nombre?.message}   {...register('nombre')} />
          <FloatInput label="Email *"           error={errors.email?.message}    {...register('email')} type="email" autoComplete="off" />
        </div>

        <FloatInput
          label="Contraseña inicial *"
          error={errors.password?.message}
          {...register('password')}
          type="password"
          autoComplete="new-password"
        />

        <ButtonGroup
          label="Rol *"
          compact
          value={rolVal}
          onChange={v => setVal('rol', v as CrearForm['rol'], { shouldValidate: true })}
          error={errors.rol?.message}
          options={ROL_OPTIONS}
        />

        <p style={{ fontSize: 12, color: '#8E8E93', background: '#F5F7F9', borderRadius: 8, padding: '8px 10px', margin: 0 }}>
          El usuario recibirá sus credenciales. Pedile que cambie la contraseña al ingresar.
        </p>
      </form>
    </Drawer>
  )
}

// ─── ResetPasswordSection — colapsable dentro del drawer de editar ────────────

const resetSchema = z.object({
  passwordNuevo: z.string().min(6, 'Mínimo 6 caracteres'),
})
type ResetForm = z.infer<typeof resetSchema>

function ResetPasswordSection({ userId, onSaved }: { userId: string; onSaved: (msg: string) => void }) {
  const [open,    setOpen]    = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const resetPw = useResetPasswordUsuario()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { passwordNuevo: '' },
  })

  const onSubmit = async (data: ResetForm) => {
    try {
      await resetPw.mutateAsync({ userId, passwordNuevo: data.passwordNuevo })
      onSaved('Contraseña restablecida correctamente')
      reset()
      setOpen(false)
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al restablecer contraseña') + '|error')
    }
  }

  return (
    <div style={{ border: '0.5px solid #E5E5EA', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); if (open) reset() }}
        style={{
          width: '100%', padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <KeyRound size={14} color="#8E8E93" />
          <span style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 500 }}>Restablecer contraseña</span>
        </div>
        <ChevronDown
          size={14}
          color="#8E8E93"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {/* Form inline */}
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.2s ease',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#8E8E93', background: '#FFF3E0', borderRadius: 6, padding: '6px 10px' }}>
              El usuario deberá usar esta contraseña en su próximo inicio de sesión.
            </p>

            <FloatInput
              label="Nueva contraseña *"
              type={showPw ? 'text' : 'password'}
              error={errors.passwordNuevo?.message}
              autoComplete="new-password"
              rightSlot={
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Ocultar' : 'Mostrar'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8E8E93', padding: 0, display: 'flex' }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
              {...register('passwordNuevo')}
            />

            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={resetPw.isPending}
              className="btn-press"
              style={{
                background:   resetPw.isPending ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
                color:        '#fff',
                border:       'none',
                borderRadius: 8,
                height:       40,
                fontSize:     13,
                fontWeight:   600,
                cursor:       resetPw.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {resetPw.isPending ? 'Guardando…' : 'Confirmar nueva contraseña'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer editar ────────────────────────────────────────────────────────────

interface EditarDrawerProps {
  open:    boolean
  onClose: () => void
  usuario: UsuarioConEmail | null
  onSaved: (msg: string) => void
  selfId:  string
}

function EditarUsuarioDrawer({ open, onClose, usuario, onSaved, selfId }: EditarDrawerProps) {
  const editar = useEditarUsuario()
  const saving = editar.isPending
  const isSelf = usuario?.user_id === selfId

  const { register, handleSubmit, watch, setValue: setVal, formState: { errors } } = useForm<EditarForm>({
    resolver: zodResolver(editarSchema),
    values: { nombre: usuario?.nombre ?? '', rol: (usuario?.rol ?? 'admin') as EditarForm['rol'] },
  })

  const rolVal = watch('rol')

  const onSubmit = async (data: EditarForm) => {
    if (!usuario) return
    try {
      await editar.mutateAsync({ id: usuario.id, ...data })
      onSaved('Usuario actualizado')
      onClose()
    } catch (e) {
      onSaved((e instanceof Error ? e.message : 'Error al guardar') + '|error')
    }
  }

  const footer = usuario ? (
    <>
      <button
        type="submit"
        form="editar-usuario-form"
        disabled={saving}
        className="btn-press btn-drawer-primary"
        style={{
          background: saving ? 'rgba(61,214,181,0.5)' : '#3DD6B5', color: '#fff',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {!isSelf && (
        <button
          type="button"
          onClick={async () => {
            await editar.mutateAsync({ id: usuario.id, activo: !usuario.activo })
            onSaved(`Usuario ${!usuario.activo ? 'activado' : 'desactivado'}`)
            onClose()
          }}
          className="btn-press btn-drawer-ghost"
          style={{
            background: usuario.activo ? '#FDECEA' : '#E8F8F0',
            color: usuario.activo ? '#D32F2F' : '#2E9E5C',
            border: `1.5px solid ${usuario.activo ? '#D32F2F' : '#2E9E5C'}`,
            borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {usuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
        </button>
      )}
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
  ) : undefined

  return (
    <Drawer open={open} onClose={onClose} title="Editar usuario" footer={footer}>
      {usuario && (
        <form
          id="editar-usuario-form"
          onSubmit={handleSubmit(onSubmit)}
          className="drawer-form"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#F5F7F9', borderRadius: 8 }}>
            <Mail size={13} color="#8E8E93" />
            <span style={{ fontSize: 13, color: '#8E8E93' }}>{usuario.email}</span>
          </div>

          <FloatInput label="Nombre *" error={errors.nombre?.message} {...register('nombre')} />

          <ButtonGroup
            label="Rol *"
            compact
            value={rolVal}
            onChange={v => setVal('rol', v as EditarForm['rol'], { shouldValidate: true })}
            error={errors.rol?.message}
            disabled={isSelf}
            options={ROL_OPTIONS}
          />

          {isSelf && (
            <p style={{ fontSize: 12, color: '#F57C00', background: '#FFF3E0', borderRadius: 8, padding: '8px 10px', margin: 0 }}>
              No podés cambiar tu propio rol.
            </p>
          )}

          {/* Sección restablecer contraseña */}
          <div style={{ paddingTop: 4 }}>
            <ResetPasswordSection userId={usuario.user_id} onSaved={onSaved} />
          </div>
        </form>
      )}
    </Drawer>
  )
}

// ─── Card usuario ─────────────────────────────────────────────────────────────

function UsuarioCard({
  usuario, onEdit, isSelf,
}: { usuario: UsuarioConEmail; onEdit: () => void; isSelf: boolean }) {
  function getIniciales(nombre: string) {
    return nombre.split(' ').slice(0,2).map(p => p[0]?.toUpperCase() ?? '').join('')
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: '16px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: '#3DD6B5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
      }}>
        {getIniciales(usuario.nombre)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1C1E' }}>
            {usuario.nombre}
            {isSelf && <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 400 }}> (vos)</span>}
          </span>
          <BadgeRol rol={usuario.rol} />
          <BadgeActivo activo={usuario.activo ?? true} />
        </div>
        <p style={{ fontSize: 12, color: '#8E8E93', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Mail size={12} /> {usuario.email}
        </p>
      </div>

      <button onClick={onEdit} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: '#8E8E93', padding: 6, borderRadius: 8,
        display: 'flex', alignItems: 'center', flexShrink: 0,
      }} title="Editar">
        <Edit2 size={16} />
      </button>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [crearOpen, setCrear]   = useState(false)
  const [editarOpen, setEditar] = useState(false)
  const [selected, setSelected] = useState<UsuarioConEmail | null>(null)
  const { toasts, show, dismiss } = useToast()
  const { usuario: self } = useAuth()

  const { data: usuarios, isLoading } = useUsuarios()

  const handleEdit  = (u: UsuarioConEmail) => { setSelected(u); setEditar(true) }
  const handleSaved = (msg: string) => {
    if (msg.endsWith('|error')) show(msg.replace('|error', ''), 'error')
    else                        show(msg, 'success')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="section-title">Usuarios</h1>
        <button onClick={() => setCrear(true)} style={{
          background: '#3DD6B5', color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 16px', minHeight: 40,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <Skeleton key={i} style={{ height: 76, borderRadius: 20 }} />)}
        </div>
      ) : !usuarios?.length ? (
        <EmptyState
          icon={Settings}
          title="No hay usuarios"
          message="Creá el primer usuario del sistema."
          action={
            <button onClick={() => setCrear(true)} style={{
              background: '#3DD6B5', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', minHeight: 44,
            }}>
              + Nuevo usuario
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {usuarios.map(u => (
            <UsuarioCard
              key={u.id}
              usuario={u}
              onEdit={() => handleEdit(u)}
              isSelf={u.user_id === self?.id}
            />
          ))}
          <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 4 }}>
            {usuarios.length} {usuarios.length === 1 ? 'usuario' : 'usuarios'}
          </p>
        </div>
      )}

      <CrearUsuarioDrawer open={crearOpen} onClose={() => setCrear(false)} onSaved={handleSaved} />
      <EditarUsuarioDrawer
        open={editarOpen}
        onClose={() => { setEditar(false); setSelected(null) }}
        usuario={selected}
        onSaved={handleSaved}
        selfId={self?.id ?? ''}
      />

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
