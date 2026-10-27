// Edge Function admin-usuarios — gestión de usuarios con la clave secreta.
//
// La clave secreta vive SOLO acá (antes estaba en el bundle del navegador).
// Cada request valida al llamador: token de sesión válido (auth.getUser) y
// perfil admin/superadmin activo. Sin token → 401. Otro rol o inactivo → 403.
//
// Deploy con --no-verify-jwt: el proyecto usa claves nuevas (sb_publishable_ /
// sb_secret_) y JWT ES256; la verificación de la plataforma solo entiende las
// legacy, así que la validación se hace acá
// (https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
//
// Secrets:
//   ADMIN_USUARIOS_ORIGINS  orígenes permitidos (CORS), separados por coma
//   SUPABASE_SECRET_KEYS    (automático) diccionario JSON, se usa 'default'
//   SUPABASE_SERVICE_ROLE_KEY (automático, legacy) respaldo hasta fin de 2026
//
// Acciones (POST { accion, ... }):
//   listar | crear | editar | resetear_password | eliminar

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'

const ROLES = ['admin', 'superadmin', 'produccion', 'repartidor']
const ROLES_ADMIN = ['admin', 'superadmin']
// Desactivar = ban en auth (no puede iniciar sesión ni renovar el token).
// Reactivar = ban_duration 'none'.
const BAN_DESACTIVADO = '876000h' // ~100 años
const PASSWORD_MIN = 6              // mismo mínimo que el formulario

const ORIGENES = (Deno.env.get('ADMIN_USUARIOS_ORIGINS') ?? '')
  .split(',').map(o => o.trim()).filter(Boolean)

class ErrorHttp extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje) }
}

function claveSecreta(): string {
  const dict = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (dict) {
    try {
      const clave = JSON.parse(dict)?.default
      if (clave) return clave
    } catch { /* formato inesperado: probar legacy */ }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  throw new Error('Falta la clave secreta (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY)')
}

function headersCors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Vary': 'Origin' }
  if (origin && ORIGENES.includes(origin)) {
    h['Access-Control-Allow-Origin']  = origin
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
  }
  return h
}

function json(cuerpo: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...headersCors(origin), 'Content-Type': 'application/json' },
  })
}

// ─── Autenticación del llamador ───────────────────────────────────────────────

async function autenticar(req: Request, admin: SupabaseClient): Promise<{ id: string; rol: string }> {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new ErrorHttp(401, 'Falta el token de sesión')

  // getUser valida contra el servidor de Auth (funciona con JWT ES256 y
  // detecta sesiones revocadas o usuarios baneados).
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErrorHttp(401, 'Sesión inválida')

  const { data: perfil } = await admin
    .from('perfiles').select('rol, activo').eq('id', data.user.id).maybeSingle()
  if (!perfil || !perfil.activo || !ROLES_ADMIN.includes(perfil.rol)) {
    throw new ErrorHttp(403, 'No autorizado')
  }
  return { id: data.user.id, rol: perfil.rol }
}

// ─── Validaciones ─────────────────────────────────────────────────────────────

function texto(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new ErrorHttp(400, `Falta ${campo}`)
  return v.trim()
}

function rolValido(v: unknown): string {
  if (typeof v !== 'string' || !ROLES.includes(v)) throw new ErrorHttp(400, 'Rol inválido')
  return v
}

function passwordValida(v: unknown): string {
  if (typeof v !== 'string' || v.length < PASSWORD_MIN) {
    throw new ErrorHttp(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  }
  return v
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

async function listar(admin: SupabaseClient) {
  const { data: perfiles, error } = await admin
    .from('perfiles').select('id, nombre, rol, activo, created_at').order('created_at')
  if (error) throw new Error(error.message)

  // listUsers pagina (máx. 1000 por página): recorrer todas.
  const emails = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error: e } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (e) throw new Error(e.message)
    for (const u of data.users) emails.set(u.id, u.email ?? '')
    if (data.users.length < 1000) break
  }

  return (perfiles ?? []).map(p => ({
    id:         p.id,
    user_id:    p.id,
    nombre:     p.nombre,
    rol:        p.rol,
    activo:     p.activo,
    created_at: p.created_at,
    updatedAt:  p.created_at,
    email:      emails.get(p.id) ?? '',
  }))
}

async function crear(admin: SupabaseClient, body: Record<string, unknown>) {
  const nombre   = texto(body.nombre, 'el nombre')
  const email    = texto(body.email, 'el email').toLowerCase()
  const password = passwordValida(body.password)
  const rol      = rolValido(body.rol)

  // email_confirm: true → queda confirmado y Supabase no envía mail.
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nombre, rol },
  })
  if (error) throw new ErrorHttp(400, error.message)

  const { error: perfilErr } = await admin
    .from('perfiles').insert({ id: data.user.id, nombre, rol, activo: true })
  if (perfilErr) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw new ErrorHttp(400, perfilErr.message)
  }
  return { id: data.user.id }
}

async function editar(admin: SupabaseClient, llamador: { id: string; rol: string }, body: Record<string, unknown>) {
  const id = texto(body.id, 'el usuario')
  const patch: Record<string, unknown> = {}
  if (body.nombre !== undefined) patch.nombre = texto(body.nombre, 'el nombre')
  if (body.rol    !== undefined) patch.rol    = rolValido(body.rol)
  if (body.activo !== undefined) {
    if (typeof body.activo !== 'boolean') throw new ErrorHttp(400, 'activo inválido')
    patch.activo = body.activo
  }
  if (!Object.keys(patch).length) throw new ErrorHttp(400, 'Nada para actualizar')

  if (id === llamador.id) {
    if (patch.activo === false)                       throw new ErrorHttp(400, 'No podés desactivar tu propio usuario')
    if (patch.rol !== undefined && patch.rol !== llamador.rol) throw new ErrorHttp(400, 'No podés cambiar tu propio rol')
  }

  const { data: actualizado, error } = await admin
    .from('perfiles').update(patch).eq('id', id).select('id').maybeSingle()
  if (error) throw new ErrorHttp(400, error.message)
  if (!actualizado) throw new ErrorHttp(404, 'Usuario no encontrado')

  if (patch.activo !== undefined) {
    const { error: banErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: patch.activo ? 'none' : BAN_DESACTIVADO,
    })
    if (banErr) throw new Error(`Perfil actualizado pero falló el ${patch.activo ? 'desbloqueo' : 'bloqueo'} en Auth: ${banErr.message}`)
  }
  return { id }
}

async function resetearPassword(admin: SupabaseClient, body: Record<string, unknown>) {
  const id       = texto(body.id, 'el usuario')
  const password = passwordValida(body.password)
  const { error } = await admin.auth.admin.updateUserById(id, { password })
  if (error) throw new ErrorHttp(400, error.message)
  return { id }
}

// Sin botón en la UI: limpieza de usuarios de prueba.
async function eliminar(admin: SupabaseClient, llamador: { id: string }, body: Record<string, unknown>) {
  const id = texto(body.id, 'el usuario')
  if (id === llamador.id) throw new ErrorHttp(400, 'No podés eliminar tu propio usuario')
  const { error } = await admin.auth.admin.deleteUser(id) // perfiles: ON DELETE CASCADE
  if (error) throw new ErrorHttp(400, error.message)
  return { id }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (origin && !ORIGENES.includes(origin)) return json({ error: 'Origen no permitido' }, 403, origin)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersCors(origin) })
  if (req.method !== 'POST')    return json({ error: 'Método no permitido' }, 405, origin)

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveSecreta(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const llamador = await autenticar(req, admin)

    let body: Record<string, unknown>
    try { body = await req.json() } catch { throw new ErrorHttp(400, 'Body inválido') }

    switch (body.accion) {
      case 'listar':            return json(await listar(admin), 200, origin)
      case 'crear':             return json(await crear(admin, body), 200, origin)
      case 'editar':            return json(await editar(admin, llamador, body), 200, origin)
      case 'resetear_password': return json(await resetearPassword(admin, body), 200, origin)
      case 'eliminar':          return json(await eliminar(admin, llamador, body), 200, origin)
      default:                  throw new ErrorHttp(400, 'Acción desconocida')
    }
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message }, e.status, origin)
    console.error('[admin-usuarios]', e)
    return json({ error: e instanceof Error ? e.message : 'Error interno' }, 500, origin)
  }
})
