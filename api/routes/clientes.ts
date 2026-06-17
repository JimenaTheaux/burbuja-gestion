import { Hono } from 'hono'
import { eq, ilike, or, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { clientes } from '../../db/schema.js'

const router = new Hono()

// GET /api/clientes?q=texto
router.get('/', async (c) => {
  const q = c.req.query('q')?.trim()

  const rows = q
    ? await db.select().from(clientes)
        .where(or(ilike(clientes.nombre, `%${q}%`), ilike(clientes.direccion, `%${q}%`)))
        .orderBy(desc(clientes.createdAt))
    : await db.select().from(clientes).orderBy(desc(clientes.createdAt))

  return c.json(rows)
})

// GET /api/clientes/:id
router.get('/:id', async (c) => {
  const [row] = await db.select().from(clientes).where(eq(clientes.id, c.req.param('id')))
  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404)
  return c.json(row)
})

// POST /api/clientes
router.post('/', async (c) => {
  const body = await c.req.json()
  const { nombre, cuit, telefono, direccion, tipocliente, notas } = body

  if (!nombre?.trim()) return c.json({ error: 'El nombre es obligatorio' }, 400)

  const [row] = await db.insert(clientes).values({
    nombre:      nombre.trim(),
    cuit:        cuit?.replace(/\D/g, '') || null,
    telefono:    telefono?.trim() || null,
    direccion:   direccion?.trim() || null,
    tipocliente: tipocliente ?? 'minorista',
    notas:       notas?.trim() || null,
    activo:      true,
  }).returning()

  return c.json(row, 201)
})

// PATCH /api/clientes/:id
router.patch('/:id', async (c) => {
  const body = await c.req.json()
  const id = c.req.param('id')
  const { nombre, cuit, telefono, direccion, tipocliente, notas, activo } = body

  const [row] = await db.update(clientes).set({
    ...(nombre     !== undefined && { nombre:      nombre.trim() }),
    ...(cuit       !== undefined && { cuit:        cuit?.replace(/\D/g, '') || null }),
    ...(telefono   !== undefined && { telefono:    telefono?.trim() || null }),
    ...(direccion  !== undefined && { direccion:   direccion?.trim() || null }),
    ...(tipocliente !== undefined && { tipocliente }),
    ...(notas      !== undefined && { notas:       notas?.trim() || null }),
    ...(activo     !== undefined && { activo }),
    updatedAt: new Date(),
  }).where(eq(clientes.id, id)).returning()

  if (!row) return c.json({ error: 'Cliente no encontrado' }, 404)
  return c.json(row)
})

export default router
