import { Hono } from 'hono'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { pedidos, pedidoItems, pedidoHistorial, clientes, productos, perfiles } from '../../db/schema.js'
import { auth } from '../auth.js'

const router = new Hono()

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers })
  return session?.user?.id ?? null
}

async function getPerfilId(userId: string): Promise<string | null> {
  const [p] = await db.select({ id: perfiles.id })
    .from(perfiles).where(eq(perfiles.userId, userId))
  return p?.id ?? null
}

type EstadoEnum = 'borrador'|'confirmado'|'en_produccion'|'listo_reparto'|'en_reparto'|'entregado'|'cerrado'|'entrega_fallida'|'anulado'

function registrarHistorial(pedidoId: string, estadoAnterior: string | null, estadoNuevo: string, usuarioId: string | null, notas?: string) {
  return db.insert(pedidoHistorial).values({
    pedidoId,
    estadoAnterior: (estadoAnterior ?? null) as EstadoEnum | null,
    estadoNuevo:    estadoNuevo as EstadoEnum,
    usuarioId,
    notas: notas ?? null,
  })
}

// ─── GET /api/pedidos ─────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const { estado, clienteId, fechaProduccion, q } = c.req.query()

  const conditions = []
  if (estado)          conditions.push(eq(pedidos.estado, estado as EstadoEnum))
  if (clienteId)       conditions.push(eq(pedidos.clienteId, clienteId))
  if (fechaProduccion) conditions.push(eq(pedidos.fechaProduccion, fechaProduccion))

  const rows = await db.select({
    id:               pedidos.id,
    numero:           pedidos.numero,
    estado:           pedidos.estado,
    tipoPrecio:       pedidos.tipoPrecio,
    direccionEntrega: pedidos.direccionEntrega,
    fechaProduccion:  pedidos.fechaProduccion,
    totalCalculado:   pedidos.totalCalculado,
    totalManual:      pedidos.totalManual,
    costoEnvio:       pedidos.costoEnvio,
    formaCobro:       pedidos.formaCobro,
    montoCobrado:     pedidos.montoCobrado,
    notasProduccion:  pedidos.notasProduccion,
    notasInternas:    pedidos.notasInternas,
    createdAt:        pedidos.createdAt,
    updatedAt:        pedidos.updatedAt,
    clienteId:        pedidos.clienteId,
    clienteNombre:    clientes.nombre,
  })
  .from(pedidos)
  .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
  .where(conditions.length ? and(...conditions) : undefined)
  .orderBy(desc(pedidos.createdAt))

  const filtrados = q
    ? rows.filter(r =>
        r.clienteNombre?.toLowerCase().includes(q.toLowerCase()) ||
        String(r.numero).padStart(5, '0').includes(q.replace(/^P-?0*/i, ''))
      )
    : rows

  return c.json(filtrados)
})

// ─── GET /api/pedidos/:id — detalle completo con items + historial ────────────

router.get('/:id', async (c) => {
  const id = c.req.param('id')

  const [pedido] = await db.select().from(pedidos)
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .where(eq(pedidos.id, id))

  if (!pedido?.pedidos) return c.json({ error: 'Pedido no encontrado' }, 404)

  const items = await db.select({
    id:               pedidoItems.id,
    pedidoId:         pedidoItems.pedidoId,
    productoId:       pedidoItems.productoId,
    cantidad:         pedidoItems.cantidad,
    precioUnitario:   pedidoItems.precioUnitario,
    precioReferencia: pedidoItems.precioReferencia,
    bidonNuevo:       pedidoItems.bidonNuevo,
    productoNombre:   productos.nombre,
    productoFragancia:productos.fragancia,
    productoPresentacion: productos.presentacion,
    precioMinoristaActual: productos.precioMinorista,
    precioMayoristaActual: productos.precioMayorista,
  })
  .from(pedidoItems)
  .leftJoin(productos, eq(pedidoItems.productoId, productos.id))
  .where(eq(pedidoItems.pedidoId, id))

  const historial = await db.select({
    id:             pedidoHistorial.id,
    estadoAnterior: pedidoHistorial.estadoAnterior,
    estadoNuevo:    pedidoHistorial.estadoNuevo,
    notas:          pedidoHistorial.notas,
    createdAt:      pedidoHistorial.createdAt,
    usuarioNombre:  perfiles.nombre,
  })
  .from(pedidoHistorial)
  .leftJoin(perfiles, eq(pedidoHistorial.usuarioId, perfiles.id))
  .where(eq(pedidoHistorial.pedidoId, id))
  .orderBy(pedidoHistorial.createdAt)

  // Aplanar join: { pedidos:{}, clientes:{} } → objeto plano con clienteNombre
  return c.json({
    ...pedido.pedidos,
    clienteNombre: pedido.clientes?.nombre ?? null,
    items,
    historial,
  })
})

// ─── POST /api/pedidos ────────────────────────────────────────────────────────

router.post('/', async (c) => {
  const userId   = await getUserId(c.req.raw.headers)
  const perfilId = userId ? await getPerfilId(userId) : null

  const body = await c.req.json()
  const {
    clienteId, tipoPrecio, direccionEntrega, fechaProduccion,
    notasInternas, notasProduccion, costoEnvio, totalManual,
    items = [], accion = 'borrador',     // accion: 'borrador' | 'confirmar'
  } = body

  if (!clienteId)   return c.json({ error: 'El cliente es obligatorio' }, 400)
  if (!tipoPrecio)  return c.json({ error: 'El tipo de precio es obligatorio' }, 400)
  if (!items.length) return c.json({ error: 'Agregá al menos un ítem' }, 400)
  if (!fechaProduccion) return c.json({ error: 'La fecha de producción es obligatoria' }, 400)

  // Calcular total
  const totalCalculado = items.reduce((acc: number, item: { cantidad: string; precioUnitario: string }) =>
    acc + Number(item.cantidad) * Number(item.precioUnitario), 0
  ) + Number(costoEnvio ?? 0)

  const estadoInicial = accion === 'confirmar' ? 'en_produccion' : 'borrador'

  const [pedido] = await db.insert(pedidos).values({
    clienteId,
    tipoPrecio,
    direccionEntrega: direccionEntrega ?? null,
    fechaProduccion:  fechaProduccion ?? null,
    estado:           estadoInicial,
    notasInternas:    notasInternas ?? null,
    notasProduccion:  notasProduccion ?? null,
    costoEnvio:       String(costoEnvio ?? 0),
    totalCalculado:   String(totalCalculado),
    totalManual:      totalManual ? String(totalManual) : null,
    creadoPor:        perfilId,
  }).returning()

  // Insertar ítems
  if (items.length) {
    await db.insert(pedidoItems).values(
      items.map((item: { productoId: string; cantidad: string; precioUnitario: string; precioReferencia: string; bidonNuevo?: boolean }) => ({
        pedidoId:         pedido.id,
        productoId:       item.productoId,
        cantidad:         String(item.cantidad),
        precioUnitario:   String(item.precioUnitario),
        precioReferencia: String(item.precioReferencia),
        bidonNuevo:       item.bidonNuevo ?? false,
      }))
    )
  }

  // Historial inicial
  await registrarHistorial(pedido.id, null, estadoInicial, perfilId)

  return c.json(pedido, 201)
})

// ─── PATCH /api/pedidos/:id — editar pedido ───────────────────────────────────

router.patch('/:id', async (c) => {
  const id   = c.req.param('id')
  const body = await c.req.json()
  const {
    clienteId, tipoPrecio, direccionEntrega, fechaProduccion,
    notasInternas, notasProduccion, costoEnvio, totalManual,
    items,
  } = body

  const [existing] = await db.select().from(pedidos).where(eq(pedidos.id, id))
  if (!existing) return c.json({ error: 'Pedido no encontrado' }, 404)

  if (!['borrador', 'confirmado', 'en_produccion'].includes(existing.estado)) {
    return c.json({ error: 'No se puede editar un pedido en este estado' }, 400)
  }

  // Recalcular total si se actualizan los ítems
  let totalCalculado = Number(existing.totalCalculado)
  if (items) {
    totalCalculado = items.reduce((acc: number, item: { cantidad: string; precioUnitario: string }) =>
      acc + Number(item.cantidad) * Number(item.precioUnitario), 0
    ) + Number(costoEnvio ?? existing.costoEnvio ?? 0)
  }

  const [updated] = await db.update(pedidos).set({
    ...(clienteId        !== undefined && { clienteId }),
    ...(tipoPrecio       !== undefined && { tipoPrecio }),
    ...(direccionEntrega !== undefined && { direccionEntrega }),
    ...(fechaProduccion  !== undefined && { fechaProduccion }),
    ...(notasInternas    !== undefined && { notasInternas }),
    ...(notasProduccion  !== undefined && { notasProduccion }),
    ...(costoEnvio       !== undefined && { costoEnvio:     String(costoEnvio) }),
    ...(totalManual      !== undefined && { totalManual:    totalManual ? String(totalManual) : null }),
    ...(items            !== undefined && { totalCalculado: String(totalCalculado) }),
    updatedAt: new Date(),
  }).where(eq(pedidos.id, id)).returning()

  // Reemplazar ítems si se enviaron
  if (items) {
    await db.delete(pedidoItems).where(eq(pedidoItems.pedidoId, id))
    if (items.length) {
      await db.insert(pedidoItems).values(
        items.map((item: { productoId: string; cantidad: string; precioUnitario: string; precioReferencia: string; bidonNuevo?: boolean }) => ({
          pedidoId:         id,
          productoId:       item.productoId,
          cantidad:         String(item.cantidad),
          precioUnitario:   String(item.precioUnitario),
          precioReferencia: String(item.precioReferencia),
          bidonNuevo:       item.bidonNuevo ?? false,
        }))
      )
    }
  }

  return c.json(updated)
})

// ─── PATCH /api/pedidos/:id/estado ───────────────────────────────────────────

router.patch('/:id/estado', async (c) => {
  const id     = c.req.param('id')
  const body   = await c.req.json()
  const { estado: nuevoEstado, notas } = body

  const userId   = await getUserId(c.req.raw.headers)
  const perfilId = userId ? await getPerfilId(userId) : null

  const [existing] = await db.select().from(pedidos).where(eq(pedidos.id, id))
  if (!existing) return c.json({ error: 'Pedido no encontrado' }, 404)

  if (existing.estado === 'cerrado' && nuevoEstado === 'anulado') {
    return c.json({ error: 'No se puede anular un pedido cerrado' }, 400)
  }

  const [updated] = await db.update(pedidos)
    .set({ estado: nuevoEstado, updatedAt: new Date() })
    .where(eq(pedidos.id, id))
    .returning()

  await registrarHistorial(id, existing.estado, nuevoEstado, perfilId, notas)

  return c.json(updated)
})

// ─── POST /api/pedidos/:id/anular ─────────────────────────────────────────────

router.post('/:id/anular', async (c) => {
  const id   = c.req.param('id')
  const { motivo } = await c.req.json()

  if (!motivo?.trim()) return c.json({ error: 'El motivo es obligatorio' }, 400)

  const userId   = await getUserId(c.req.raw.headers)
  const perfilId = userId ? await getPerfilId(userId) : null

  const [existing] = await db.select().from(pedidos).where(eq(pedidos.id, id))
  if (!existing) return c.json({ error: 'Pedido no encontrado' }, 404)
  if (existing.estado === 'cerrado') return c.json({ error: 'No se puede anular un pedido cerrado' }, 400)

  const [updated] = await db.update(pedidos)
    .set({ estado: 'anulado', motivoAnulacion: motivo.trim(), updatedAt: new Date() })
    .where(eq(pedidos.id, id))
    .returning()

  await registrarHistorial(id, existing.estado, 'anulado', perfilId, motivo)

  return c.json(updated)
})

// ─── PATCH /api/pedidos/:id/cobro — editar cobro (solo entregado/cerrado) ────

router.patch('/:id/cobro', async (c) => {
  const id = c.req.param('id')
  const { formaCobro, montoCobrado } = await c.req.json()

  if (!formaCobro) return c.json({ error: 'La forma de cobro es obligatoria' }, 400)

  const userId   = await getUserId(c.req.raw.headers)
  const perfilId = userId ? await getPerfilId(userId) : null

  const [existing] = await db.select().from(pedidos).where(eq(pedidos.id, id))
  if (!existing) return c.json({ error: 'Pedido no encontrado' }, 404)

  if (!['entregado', 'cerrado'].includes(existing.estado)) {
    return c.json({ error: 'Solo se puede editar el cobro de pedidos entregados o cerrados' }, 400)
  }

  const [updated] = await db.update(pedidos)
    .set({
      formaCobro,
      montoCobrado: montoCobrado ? String(montoCobrado) : null,
      updatedAt:    new Date(),
    })
    .where(eq(pedidos.id, id))
    .returning()

  await registrarHistorial(id, existing.estado, existing.estado, perfilId, 'Cobro editado')

  return c.json(updated)
})

// ─── GET /api/pedidos/dia/:fecha — pedidos del día para imprimir ──────────────

router.get('/dia/:fecha', async (c) => {
  const fecha = c.req.param('fecha')

  const rows = await db
    .select({
      id:               pedidos.id,
      numero:           pedidos.numero,
      estado:           pedidos.estado,
      tipoPrecio:       pedidos.tipoPrecio,
      direccionEntrega: pedidos.direccionEntrega,
      totalCalculado:   pedidos.totalCalculado,
      totalManual:      pedidos.totalManual,
      costoEnvio:       pedidos.costoEnvio,
      formaCobro:       pedidos.formaCobro,
      montoCobrado:     pedidos.montoCobrado,
      notasProduccion:  pedidos.notasProduccion,
      clienteId:        pedidos.clienteId,
      clienteNombre:    clientes.nombre,
      clienteTelefono:  clientes.telefono,
    })
    .from(pedidos)
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .where(eq(pedidos.fechaProduccion, fecha))
    .orderBy(pedidos.numero)

  const pedidoIds = rows.map(r => r.id)
  const items = pedidoIds.length
    ? await db
        .select({
          pedidoId:    pedidoItems.pedidoId,
          cantidad:    pedidoItems.cantidad,
          nombre:      productos.nombre,
          fragancia:   productos.fragancia,
          presentacion:productos.presentacion,
          precioUnitario: pedidoItems.precioUnitario,
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

export default router
