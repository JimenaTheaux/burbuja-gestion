import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_CATALOGO } from '@/lib/queryClient'
import type { Perfil } from '@/types'

// Gestión de usuarios vía Edge Function admin-usuarios (supabase/functions/).
// La clave secreta vive solo en la función; la función valida que el llamador
// sea admin/superadmin activo. El frontend no tiene ninguna clave privilegiada.

export interface UsuarioConEmail extends Omit<Perfil, 'updatedAt'> {
  email:     string
  user_id:   string
  updatedAt: string
}

const KEY = queryKeys.usuarios.all()

// Llama a la función y devuelve el mensaje de error que ella misma arma
// ("No autorizado", "Rol inválido", errores de Auth…) en vez del genérico.
async function adminUsuarios<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-usuarios', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalle = await error.context.json().catch(() => null) as { error?: string } | null
      throw new Error(detalle?.error ?? 'Error en la gestión de usuarios')
    }
    throw new Error('Gestión de usuarios no disponible temporalmente')
  }
  return data as T
}

// ─── Listar usuarios (con emails) ─────────────────────────────────────────────

export const useUsuarios = () =>
  useQuery({
    queryKey:  KEY,
    staleTime: STALE_CATALOGO,
    queryFn:   () => adminUsuarios<UsuarioConEmail[]>({ accion: 'listar' }),
  })

// ─── Crear usuario ────────────────────────────────────────────────────────────

export const useCrearUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { nombre: string; email: string; password: string; rol: string }) =>
      adminUsuarios({ accion: 'crear', ...data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// ─── Editar usuario (nombre, rol, activo) ─────────────────────────────────────
// Desactivar también bloquea el usuario en Auth; reactivar lo desbloquea.

export const useEditarUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; nombre?: string; rol?: string; activo?: boolean }) =>
      adminUsuarios({ accion: 'editar', id, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      // selector de usuarios en Egresos (nombre / activo)
      qc.invalidateQueries({ queryKey: queryKeys.perfilesActivos() })
    },
  })
}

// ─── Cambiar propia contraseña (cualquier rol autenticado) ────────────────────

export const useCambiarPasswordPropio = () =>
  useMutation({
    mutationFn: async ({ passwordActual, passwordNuevo }: {
      passwordActual: string
      passwordNuevo:  string
    }) => {
      // Re-autenticar con contraseña actual para validar antes de cambiar
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('No se pudo obtener el usuario de sesión')

      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: passwordActual,
      })
      if (reAuthErr) throw new Error('La contraseña actual es incorrecta')

      const { error } = await supabase.auth.updateUser({ password: passwordNuevo })
      if (error) throw new Error(error.message)
    },
  })

// ─── Admin resetea contraseña de otro usuario ─────────────────────────────────

export const useResetPasswordUsuario = () =>
  useMutation({
    mutationFn: ({ userId, passwordNuevo }: { userId: string; passwordNuevo: string }) =>
      adminUsuarios({ accion: 'resetear_password', id: userId, password: passwordNuevo }),
  })
