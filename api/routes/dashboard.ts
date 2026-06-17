import { Hono } from 'hono'
import { eq, and, sql, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { pedidos } from '../../db/schema.js'

const router = new Hono()

// GET /api/dashboard — KPIs del día + totales de la semana
router.get('/', async (c) => {
  const hoy    = new Date().toISOString().split('T')[0]
  const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0)
  const hoyEnd   = new Date(); hoyEnd.setHours(23, 59, 59, 999)

  // Todos los pedidos de hoy (creados o con fechaProduccion = hoy)
  const todosHoy = await db
    .select({
      estado:      pedidos.estado,
      formaCobro:  pedidos.formaCobro,
      montoCobrado:pedidos.montoCobrado,
      totalCalculado: pedidos.totalCalculado,
      totalManual:    pedidos.totalManual,
      fechaProduccion: pedidos.fechaProduccion,
    })
    .from(pedidos)
    .where(eq(pedidos.fechaProduccion, hoy))

  // Todos los pedidos activos (no anulados ni cerrados) para el tablero
  const activos = await db
    .select({ estado: pedidos.estado, id: pedidos.id })
    .from(pedidos)
    .where(
      sql`${pedidos.estado} NOT IN ('anulado', 'cerrado')`
    )

  // KPIs del día
  const porEstado: Record<string, number> = {}
  todosHoy.forEach(p => {
    porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1
  })

  const porEstadoActivos: Record<string, number> = {}
  activos.forEach(p => {
    porEstadoActivos[p.estado] = (porEstadoActivos[p.estado] ?? 0) + 1
  })

  // Cobros del día
  const cobrados = todosHoy.filter(p =>
    p.formaCobro && p.formaCobro !== 'pendiente' && p.montoCobrado
  )
  const totalEfectivo     = cobrados.filter(p => p.formaCobro === 'efectivo')
    .reduce((acc, p) => acc + Number(p.montoCobrado ?? 0), 0)
  const totalTransferencia = cobrados.filter(p => p.formaCobro === 'transferencia')
    .reduce((acc, p) => acc + Number(p.montoCobrado ?? 0), 0)

  // Pedidos con cobro pendiente o sin cobro registrado (formaCobro = 'pendiente' o NULL)
  const cobrandoPendientes = await db
    .select({ id: pedidos.id, formaCobro: pedidos.formaCobro })
    .from(pedidos)
    .where(
      and(
        inArray(pedidos.estado, ['entregado', 'cerrado']),
        or(eq(pedidos.formaCobro, 'pendiente'), isNull(pedidos.formaCobro))
      )
    )

  // Pedidos del día para el tablero (con datos básicos)
  const pedidosHoyCompletos = await db
    .select({
      id:              pedidos.id,
      numero:          pedidos.numero,
      estado:          pedidos.estado,
      totalCalculado:  pedidos.totalCalculado,
      totalManual:     pedidos.totalManual,
      formaCobro:      pedidos.formaCobro,
      montoCobrado:    pedidos.montoCobrado,
      fechaProduccion: pedidos.fechaProduccion,
      clienteId:       pedidos.clienteId,
    })
    .from(pedidos)
    .where(eq(pedidos.fechaProduccion, hoy))

  return c.json({
    hoy: {
      total:                todosHoy.length,
      porEstado,
      totalEfectivo,
      totalTransferencia,
      totalCobrado:         totalEfectivo + totalTransferencia,
      cobrandoPendientes:   cobrandoPendientes.length,
    },
    activos: {
      total:       activos.length,
      porEstado:   porEstadoActivos,
    },
    pedidosHoy: pedidosHoyCompletos,
  })
})

export default router
