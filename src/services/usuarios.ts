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
      const { data: perfiles, error } = await supabase.rpc('get_all_perfiles')

      if (error) throw new Error(error.message)

      // Emails via service role (opcional — solo si la key está configurada)
      let emailMap = new Map<string, string>()
      if (supabaseAdmin) {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
        if (authData?.users) {
          emailMap = new Map(authData.users.map(u => [u.id, u.email ?? '']))
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (perfiles ?? []).map((p: any): UsuarioConEmail => ({
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

      // 2. Insertar perfil
      const { error: perfilErr } = await supabase
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
      const patch: Record<string, unknown> = {}
      if (data.nombre !== undefined) patch.nombre = data.nombre
      if (data.rol    !== undefined) patch.rol    = data.rol
      if (data.activo !== undefined) patch.activo = data.activo

      const { error } = await supabase
        .from('perfiles')
        .update(patch)
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
