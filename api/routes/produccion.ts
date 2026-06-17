import { Hono } from 'hono'
import { eq, and, asc, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { pedidos, pedidoItems, productos, clientes } from '../../db/schema.js'

const router = new Hono()

// GET /api/produccion — pedidos EN PRODUCCION con ítems, SIN precios
router.get('/', async (c) => {
  const { fecha } = c.req.query()

  const conditions = [eq(pedidos.estado, 'en_produccion')]
  if (fecha) conditions.push(eq(pedidos.fechaProduccion, fecha))

  const rows = await db
    .select({
      id:              pedidos.id,
      numero:          pedidos.numero,
      estado:          pedidos.estado,
      fechaProduccion: pedidos.fechaProduccion,
      notasProduccion: pedidos.notasProduccion,
      direccionEntrega:pedidos.direccionEntrega,
      createdAt:       pedidos.createdAt,
      updatedAt:       pedidos.updatedAt,
      clienteId:       pedidos.clienteId,
      clienteNombre:   clientes.nombre,
    })
    .from(pedidos)
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .where(and(...conditions))
    .orderBy(asc(pedidos.fechaProduccion), asc(pedidos.numero))

  // Cargar ítems sin precio (solo nombre, cantidad, presentación, bidón)
  const pedidoIds = rows.map(r => r.id)
  const items = pedidoIds.length
    ? await db
        .select({
          pedidoId:    pedidoItems.pedidoId,
          productoId:  pedidoItems.productoId,
          cantidad:    pedidoItems.cantidad,
          bidonNuevo:  pedidoItems.bidonNuevo,
          nombre:      productos.nombre,
          fragancia:   productos.fragancia,
          presentacion:productos.presentacion,
        })
        .from(pedidoItems)
        .leftJoin(productos, eq(pedidoItems.productoId, productos.id))
        .where(inArray(pedidoItems.pedidoId, pedidoIds))
    : []

  const itemsPorPedido: Record<string, typeof items> = {}
  items.forEach(i => {
    if (!itemsPorPedido[i.pedidoId]) itemsPorPedido[i.pedidoId] = []
    itemsPorPedido[i.pedidoId].push(i)
  })

  return c.json(rows.map(r => ({ ...r, items: itemsPorPedido[r.id] ?? [] })))
})

// GET /api/produccion/listos — todos los LISTO_REPARTO (marcados hoy via updatedAt)
router.get('/listos', async (c) => {
  const hoyInicio = new Date()
  hoyInicio.setHours(0, 0, 0, 0)

  const rows = await db
    .select({
      id:              pedidos.id,
      numero:          pedidos.numero,
      estado:          pedidos.estado,
      fechaProduccion: pedidos.fechaProduccion,
      notasProduccion: pedidos.notasProduccion,
      updatedAt:       pedidos.updatedAt,
      clienteNombre:   clientes.nombre,
    })
    .from(pedidos)
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .where(
      and(
        eq(pedidos.estado, 'listo_reparto'),
        sql`${pedidos.updatedAt} >= ${hoyInicio.toISOString()}`
      )
    )
    .orderBy(asc(pedidos.numero))

  return c.json(rows)
})

// GET /api/produccion/resumen — totales por producto, agrupado por fecha
router.get('/resumen', async (c) => {
  const { fecha } = c.req.query()

  const conditions = [eq(pedidos.estado, 'en_produccion')]
  if (fecha) conditions.push(eq(pedidos.fechaProduccion, fecha))

  const rows = await db
    .select({
      productoId:       pedidoItems.productoId,
      nombreProducto:   productos.nombre,
      presentacion:     productos.presentacion,
      unidadMedida:     productos.unidadMedida,
      fechaProduccion:  pedidos.fechaProduccion,
      totalCantidad:    sql<number>`CAST(SUM(${pedidoItems.cantidad}) AS FLOAT)`,
      totalBidonNuevo:  sql<number>`CAST(SUM(CASE WHEN ${pedidoItems.bidonNuevo} THEN ${pedidoItems.cantidad}::numeric ELSE 0 END) AS FLOAT)`,
    })
    .from(pedidoItems)
    .innerJoin(pedidos,   eq(pedidoItems.pedidoId,   pedidos.id))
    .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
    .where(and(...conditions))
    .groupBy(pedidoItems.productoId, productos.nombre, productos.presentacion, productos.unidadMedida, pedidos.fechaProduccion)
    .orderBy(asc(pedidos.fechaProduccion), asc(productos.nombre))

  return c.json(rows)
})

export default router
