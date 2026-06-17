import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { perfiles } from '../../db/schema.js'
import { neon } from '@neondatabase/serverless'
import { auth } from '../auth.js'

const router = new Hono()
const sql = neon(process.env.DATABASE_URL!)

// GET /api/usuarios — lista perfiles + email del user de better-auth
router.get('/', async (c) => {
  const rows = await sql`
    SELECT
      p.id, p.nombre, p.rol, p.activo, p.created_at,
      u.email, u.id AS user_id
    FROM perfiles p
    JOIN "user" u ON u.id = p.user_id
    ORDER BY p.nombre ASC
  `
  return c.json(rows)
})

// POST /api/usuarios — crea user en better-auth + perfil
router.post('/', async (c) => {
  const { nombre, email, password, rol } = await c.req.json()

  if (!nombre?.trim()) return c.json({ error: 'Nombre obligatorio' }, 400)
  if (!email?.trim())  return c.json({ error: 'Email obligatorio' }, 400)
  if (!password || password.length < 6) return c.json({ error: 'Contraseña mínimo 6 caracteres' }, 400)
  if (!rol)            return c.json({ error: 'Rol obligatorio' }, 400)

  // 1. Crear en better-auth
  const result = await auth.api.signUpEmail({
    body: { name: nombre.trim(), email: email.trim().toLowerCase(), password, role: rol },
  })

  if (!result?.user?.id) {
    return c.json({ error: 'No se pudo crear el usuario' }, 500)
  }

  // 2. Crear perfil
  const [perfil] = await db.insert(perfiles).values({
    userId: result.user.id,
    nombre: nombre.trim(),
    rol,
    activo: true,
  }).returning()

  return c.json({ ...perfil, email: result.user.email }, 201)
})

// PATCH /api/usuarios/:id — editar perfil (nombre, rol, activo)
router.patch('/:id', async (c) => {
  const id   = c.req.param('id')
  const body = await c.req.json()
  const { nombre, rol, activo } = body

  const [row] = await db.update(perfiles).set({
    ...(nombre !== undefined && { nombre: nombre.trim() }),
    ...(rol    !== undefined && { rol }),
    ...(activo !== undefined && { activo }),
  }).where(eq(perfiles.id, id)).returning()

  if (!row) return c.json({ error: 'Usuario no encontrado' }, 404)

  // Si cambia el rol, también actualizarlo en la tabla user de better-auth
  if (rol !== undefined) {
    await sql`UPDATE "user" SET role = ${rol} WHERE id = ${row.userId}`
  }

  return c.json(row)
})

export default router
