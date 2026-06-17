import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { productos, categoriasProducto } from '../../db/schema.js'

const router = new Hono()

// GET /api/productos?q=texto&categoriaId=uuid
router.get('/', async (c) => {
  const q           = c.req.query('q')?.trim()
  const categoriaId = c.req.query('categoriaId')

  let rows = await db.select({
    id:              productos.id,
    codigo:          productos.codigo,
    nombre:          productos.nombre,
    fragancia:       productos.fragancia,
    categoriaId:     productos.categoriaId,
    unidadMedida:    productos.unidadMedida,
    presentacion:    productos.presentacion,
    precioMinorista: productos.precioMinorista,
    precioMayorista: productos.precioMayorista,
    activo:          productos.activo,
    createdAt:       productos.createdAt,
    updatedAt:       productos.updatedAt,
    categoriaNombre: categoriasProducto.nombre,
  })
  .from(productos)
  .leftJoin(categoriasProducto, eq(productos.categoriaId, categoriasProducto.id))
  .orderBy(desc(productos.createdAt))

  if (q)           rows = rows.filter(r => r.nombre.toLowerCase().includes(q.toLowerCase()))
  if (categoriaId) rows = rows.filter(r => r.categoriaId === categoriaId)

  return c.json(rows)
})

// GET /api/productos/categorias
router.get('/categorias', async (c) => {
  const rows = await db.select().from(categoriasProducto).orderBy(categoriasProducto.nombre)
  return c.json(rows)
})

// GET /api/productos/:id
router.get('/:id', async (c) => {
  const [row] = await db.select().from(productos).where(eq(productos.id, c.req.param('id')))
  if (!row) return c.json({ error: 'Producto no encontrado' }, 404)
  return c.json(row)
})

// POST /api/productos
router.post('/', async (c) => {
  const body = await c.req.json()
  const { nombre, fragancia, categoriaId, presentacion, precioMinorista, precioMayorista, codigo } = body

  if (!nombre?.trim())  return c.json({ error: 'El nombre es obligatorio' }, 400)
  if (!presentacion)    return c.json({ error: 'La presentación es obligatoria' }, 400)
  if (!precioMinorista) return c.json({ error: 'El precio minorista es obligatorio' }, 400)
  if (!precioMayorista) return c.json({ error: 'El precio mayorista es obligatorio' }, 400)

  const [row] = await db.insert(productos).values({
    nombre:          nombre.trim(),
    fragancia:       fragancia?.trim() || null,
    categoriaId:     categoriaId || null,
    unidadMedida:    'litros',
    presentacion:    String(presentacion),
    precioMinorista: String(precioMinorista),
    precioMayorista: String(precioMayorista),
    codigo:          codigo?.trim() || null,
    activo:          true,
  }).returning()

  return c.json(row, 201)
})

// PATCH /api/productos/:id
router.patch('/:id', async (c) => {
  const body = await c.req.json()
  const id   = c.req.param('id')
  const { nombre, fragancia, categoriaId, presentacion, precioMinorista, precioMayorista, codigo, activo } = body

  const [row] = await db.update(productos).set({
    ...(nombre          !== undefined && { nombre:          nombre.trim() }),
    ...(fragancia       !== undefined && { fragancia:       fragancia?.trim() || null }),
    ...(categoriaId     !== undefined && { categoriaId:     categoriaId || null }),
    ...(presentacion    !== undefined && { presentacion:    String(presentacion) }),
    ...(precioMinorista !== undefined && { precioMinorista: String(precioMinorista) }),
    ...(precioMayorista !== undefined && { precioMayorista: String(precioMayorista) }),
    ...(codigo          !== undefined && { codigo:          codigo?.trim() || null }),
    ...(activo          !== undefined && { activo }),
    updatedAt: new Date(),
  }).where(eq(productos.id, id)).returning()

  if (!row) return c.json({ error: 'Producto no encontrado' }, 404)
  return c.json(row)
})

// POST /api/productos/categorias
router.post('/categorias', async (c) => {
  const { nombre } = await c.req.json()
  if (!nombre?.trim()) return c.json({ error: 'Nombre obligatorio' }, 400)
  const [row] = await db.insert(categoriasProducto).values({ nombre: nombre.trim() }).returning()
  return c.json(row, 201)
})

export default router
