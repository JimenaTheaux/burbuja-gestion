import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Perfil, Rol } from '@/types'

// Cliente admin — solo para listUsers (emails) si la service role key está configurada.
// Si no está configurada, los emails aparecen vacíos pero el listado funciona igual.
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined
const SERVICE_KEY_VALID = SERVICE_KEY && !SERVICE_KEY.startsWith('REEMPLAZAR')

const supabaseAdmin = SERVICE_KEY_VALID
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  : null

export interface UsuarioConEmail extends Omit<Perfil, 'updatedAt'> {
  email:     string
  user_id:   string
  updatedAt: string
}

const KEY = ['usuarios']

// ─── Listar usuarios ──────────────────────────────────────────────────────────

export const useUsuarios = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      // RPC con SECURITY DEFINER — bypasea RLS para devolver todos los perfiles.
      const { data: perfilesRaw, error } = await supabase.rpc('get_all_perfiles')

      if (error) throw new Error(error.message)

      const perfiles = (perfilesRaw ?? []) as {
        id: string; nombre: string; rol: string; activo: boolean; created_at: string
      }[]

      // Emails via service role (opcional — solo si la key está configurada)
      let emailMap = new Map<string, string>()
      if (supabaseAdmin) {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
        if (authData?.users) {
          emailMap = new Map(authData.users.map(u => [u.id, u.email ?? '']))
        }
      }

      return perfiles.map((p): UsuarioConEmail => ({
        id:         p.id,
        user_id:    p.id,
        nombre:     p.nombre,
        rol:        p.rol as Rol,
        activo:     p.activo,
        created_at: p.created_at,
        updatedAt:  p.created_at,
        email:      emailMap.get(p.id) ?? '',
      }))
    },
  })

// ─── Crear usuario ────────────────────────────────────────────────────────────

export const useCrearUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { nombre: string; email: string; password: string; rol: string }) => {
      if (!supabaseAdmin) throw new Error('Service role key no configurada — configurá VITE_SUPABASE_SERVICE_ROLE_KEY en .env.local')

      // 1. Crear en auth.users con email confirmado
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email:         data.email,
        password:      data.password,
        email_confirm: true,
        user_metadata: { nombre: data.nombre, rol: data.rol },
      })

      if (authErr) throw new Error(authErr.message)
      const userId = authUser.user.id

      // 2. Insertar perfil (con supabaseAdmin: no hay policy RLS de INSERT en perfiles)
      const { error: perfilErr } = await supabaseAdmin
        .from('perfiles')
        .insert({ id: userId, nombre: data.nombre, rol: data.rol, activo: true })

      if (perfilErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        throw new Error(perfilErr.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// ─── Editar usuario ───────────────────────────────────────────────────────────

export const useEditarUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nombre?: string; rol?: string; activo?: boolean }) => {
      if (!supabaseAdmin) throw new Error('Service role key no configurada — configurá VITE_SUPABASE_SERVICE_ROLE_KEY en .env.local')

      const patch: Record<string, unknown> = {}
      if (data.nombre !== undefined) patch.nombre = data.nombre
      if (data.rol    !== undefined) patch.rol    = data.rol
      if (data.activo !== undefined) patch.activo = data.activo

      // supabaseAdmin: no hay policy RLS de UPDATE en perfiles (solo perfil_propio SELECT)
      const { error } = await supabaseAdmin
        .from('perfiles')
        .update(patch)
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
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
    mutationFn: async ({ userId, passwordNuevo }: {
      userId:        string
      passwordNuevo: string
    }) => {
      if (!supabaseAdmin)
        throw new Error('Service role key no configurada — verificá VITE_SUPABASE_SERVICE_ROLE_KEY')

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: passwordNuevo,
      })
      if (error) throw new Error(error.message)
    },
  })
