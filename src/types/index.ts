// ─── Enums ───────────────────────────────────────────────────────────────────

export type EstadoPedido =
  | 'borrador'
  | 'confirmado'
  | 'en_produccion'
  | 'listo_reparto'
  | 'en_reparto'
  | 'entregado'     // deprecated — solo backward compat con registros históricos
  | 'cerrado'
  | 'entrega_fallida'
  | 'anulado'

export type Rol = 'admin' | 'produccion' | 'repartidor' | 'superadmin'

export type TipoCliente = 'minorista' | 'mayorista'
export type TipoPrecio  = 'minorista' | 'mayorista'
export type FormaCobro  = 'efectivo' | 'transferencia' | 'pendiente'
export type FormaPago   = 'efectivo' | 'transferencia'

// ─── Config de estados — valores exactos del design system ───────────────────

export const ESTADO_CONFIG: Record<EstadoPedido, { bg: string; color: string; label: string }> = {
  borrador:        { bg: '#F0F0F0', color: '#9A9A9A', label: 'Borrador' },
  confirmado:      { bg: '#EBF5FF', color: '#2B6CB0', label: 'Confirmado' },
  en_produccion:   { bg: '#FFF3E0', color: '#E65100', label: 'En producción' },
  listo_reparto:   { bg: '#FFFDE7', color: '#C47B00', label: 'Listo para reparto' },
  en_reparto:      { bg: '#EBF5FF', color: '#2B6CB0', label: 'En reparto' },
  entregado:       { bg: '#E8FAF6', color: '#28B99A', label: 'Entregado' },
  cerrado:         { bg: '#E8FAF6', color: '#28B99A', label: 'Cerrado' },
  entrega_fallida: { bg: '#FEF2F2', color: '#C0392B', label: 'Entrega fallida' },
  anulado:         { bg: '#F0F0F0', color: '#9A9A9A', label: 'Anulado' },
}

/** Estados desde los cuales se puede compartir la factura por WhatsApp */
export const ESTADOS_FACTURABLES: EstadoPedido[] = [
  'confirmado', 'en_produccion', 'listo_reparto', 'en_reparto', 'cerrado',
]

// ─── Entidades — snake_case exacto de Supabase ───────────────────────────────

export interface Perfil {
  id:         string
  nombre:     string
  rol:        Rol
  activo:     boolean
  created_at: string
}

export interface Cliente {
  id:           string
  nombre:       string
  telefono:     string | null
  direccion:    string | null
  tipo_cliente: TipoCliente
  notas:        string | null
  activo:       boolean
  created_at:   string
  updated_at:   string
}

export interface CategoriaProducto {
  id:     string
  nombre: string
}

export interface Producto {
  id:               string
  codigo:           string | null
  nombre:           string
  fragancia:        string | null
  categoria_id:     string | null
  unidad_medida:    string
  presentacion:     number
  precio_minorista: number
  precio_mayorista: number
  costo_produccion: number
  activo:           boolean
  created_at:       string
  updated_at:       string
  // Join opcional
  categorias_producto?: CategoriaProducto | null
}

export type PedidoPago = {
  id:         string
  pedido_id:  string
  forma_pago: FormaPago
  monto:      number
  fecha_pago: string
  created_at: string
}

export interface PedidoItem {
  id:                string
  pedido_id:         string
  producto_id:       string
  cantidad:          number
  precio_unitario:   number
  precio_referencia: number
  costo_snapshot:    number
  bidon_nuevo:       boolean
  // Join opcional
  productos?: Pick<Producto, 'nombre' | 'fragancia' | 'presentacion' | 'unidad_medida' | 'precio_minorista' | 'precio_mayorista'> | null
}

export interface PedidoHistorial {
  id:              string
  pedido_id:       string
  estado_anterior: EstadoPedido | null
  estado_nuevo:    EstadoPedido
  usuario_id:      string | null
  notas:           string | null
  created_at:      string
  // Join opcional
  perfiles?: { nombre: string } | null
}

export interface Pedido {
  id:               string
  numero:           number
  cliente_id:       string
  tipo_precio:      TipoPrecio
  direccion_entrega: string | null
  estado:           EstadoPedido
  fecha_produccion: string | null
  notas_internas:   string | null
  notas_produccion: string | null
  costo_envio:      number
  costo_bidones:    number
  total_calculado:  number
  total_manual:     number | null
  forma_cobro:      FormaCobro | null
  monto_cobrado:    number | null
  fecha_cobro:      string | null
  estado_pago:      'cobrado' | 'pendiente' | null
  notas_entrega:    string | null
  motivo_falla:     string | null
  motivo_anulacion: string | null
  creado_por:       string | null
  created_at:       string
  updated_at:       string
  // Joins opcionales
  clientes?:         Pick<Cliente, 'nombre' | 'direccion' | 'tipo_cliente' | 'telefono'> | null
  pedido_items?:     PedidoItem[]
  pedido_historial?: PedidoHistorial[]
}

// ─── Egresos ─────────────────────────────────────────────────────────────────

export type CategoriaEgreso =
  | 'sueldos'
  | 'alquiler'
  | 'drogueria'
  | 'grafica'
  | 'packaging'
  | 'luz'
  | 'otros'

export const CATEGORIA_EGRESO_LABELS: Record<CategoriaEgreso, string> = {
  sueldos:   'Sueldos',
  alquiler:  'Alquiler',
  drogueria: 'Droguería',
  grafica:   'Gráfica',
  packaging: 'Packaging',
  luz:       'Luz',
  otros:     'Otros',
}

export interface Egreso {
  id:             string
  fecha_egreso:   string
  categoria:      CategoriaEgreso
  concepto:       string
  monto:          number
  registrado_por: string | null
  created_at:     string
  updated_at:     string
  // Join opcional
  perfiles?: { nombre: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const formatNumero = (n: number): string => `P-${String(n).padStart(5, '0')}`

/** Litros y ml admiten decimales; cualquier otra unidad (unidades, un., etc.) es de conteo entero */
export const esUnidadEntera = (unidadMedida?: string | null): boolean =>
  unidadMedida !== 'litros' && unidadMedida !== 'ml'

/** Presentaciones fijas disponibles para productos en litros (valor guardado en DB) */
export const PRESENTACIONES_LITROS = ['0.5', '1', '3', '5', '10', '20'] as const

/** Label a mostrar para cada valor de presentación en litros */
export const PRESENTACION_LABELS: Record<string, string> = {
  '0.5': '500 ml',
  '1':   '1 L',
  '3':   '3 L',
  '5':   '5 L',
  '10':  '10 L',
  '20':  '20 L',
}

/** Formatea presentación + unidad para mostrar, ej: "500 ml", "20 L", "1 un." */
export const formatUnidad = (presentacion: number, unidadMedida: string): string => {
  if (unidadMedida === 'litros') return PRESENTACION_LABELS[String(presentacion)] ?? `${presentacion} L`
  if (unidadMedida === 'ml')     return `${presentacion}ml`
  return `${presentacion} un.`
}

/** Retorna el total a mostrar: manual si existe, calculado si no */
export const totalPedido = (
  pedido: Pick<Pedido, 'total_manual' | 'total_calculado'>
): number => pedido.total_manual ?? pedido.total_calculado
