import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { FloatInput }     from '@/components/common/FloatInput'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToast }       from '@/hooks/useToast'
import { useAuth }        from '@/hooks/useAuth'
import { useCambiarPasswordPropio } from '@/services/usuarios'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  passwordActual: z.string().min(1, 'Ingresá tu contraseña actual'),
  passwordNuevo:  z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar:      z.string().min(1, 'Confirmá la contraseña'),
}).refine(d => d.passwordNuevo === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path:    ['confirmar'],
})

type FormData = z.infer<typeof schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROL_LABEL: Record<string, string> = {
  admin:      'Administración',
  superadmin: 'Superadmin',
  produccion: 'Producción',
  repartidor: 'Repartidor',
}

function getIniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

// ─── PasswordField — input con toggle de visibilidad ─────────────────────────

function PasswordField({
  label, error, ...rest
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <FloatInput
      label={label}
      type={show ? 'text' : 'password'}
      error={error}
      autoComplete="off"
      rightSlot={
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          tabIndex={-1}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8E8E93', padding: 0, display: 'flex' }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      }
      {...rest}
    />
  )
}

// ─── PerfilPage ───────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { usuario } = useAuth()
  const { toasts, show, dismiss } = useToast()
  const cambiarPw = useCambiarPasswordPropio()

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { passwordActual: '', passwordNuevo: '', confirmar: '' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await cambiarPw.mutateAsync({
        passwordActual: data.passwordActual,
        passwordNuevo:  data.passwordNuevo,
      })
      show('Contraseña actualizada correctamente', 'success')
      reset()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Error al cambiar contraseña', 'error')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', animation: 'fadeSlideIn 0.18s ease' }}>
      <h1 className="section-title" style={{ marginBottom: 20 }}>Mi perfil</h1>

      {/* Card — identidad */}
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '18px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#3DD6B5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0,
        }}>
          {usuario ? getIniciales(usuario.nombre) : '—'}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#1C1C1E' }}>
            {usuario?.nombre ?? '—'}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#8E8E93' }}>
            {usuario?.rol ? ROL_LABEL[usuario.rol] ?? usuario.rol : '—'}
          </p>
        </div>
      </div>

      {/* Card — cambiar contraseña */}
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '20px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <p style={{
          margin: '0 0 16px', fontSize: 10, fontWeight: 600,
          color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Cambiar contraseña
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          noValidate
        >
          <PasswordField
            label="Contraseña actual *"
            error={errors.passwordActual?.message}
            {...register('passwordActual')}
          />

          <PasswordField
            label="Nueva contraseña *"
            error={errors.passwordNuevo?.message}
            {...register('passwordNuevo')}
          />

          <PasswordField
            label="Confirmar nueva contraseña *"
            error={errors.confirmar?.message}
            {...register('confirmar')}
          />

          <p style={{
            margin: 0, fontSize: 12, color: '#8E8E93',
            background: '#F5F7F9', borderRadius: 8, padding: '8px 10px',
          }}>
            Mínimo 8 caracteres. La sesión se mantiene activa al cambiar.
          </p>

          <button
            type="submit"
            disabled={cambiarPw.isPending}
            className="btn-press"
            style={{
              background:   cambiarPw.isPending ? 'rgba(61,214,181,0.5)' : '#3DD6B5',
              color:        '#fff',
              border:       'none',
              borderRadius: 10,
              height:       44,
              fontSize:     14,
              fontWeight:   600,
              cursor:       cambiarPw.isPending ? 'not-allowed' : 'pointer',
              marginTop:    4,
            }}
          >
            {cambiarPw.isPending ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
