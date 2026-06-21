# 06 — Estructura de Base de Datos (Supabase / PostgreSQL)

## Cliente Supabase (src/lib/supabase.ts)

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Variables de entorno necesarias:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

---

## Tablas en Supabase

### `perfiles`
Extiende `auth.users` de Supabase Auth.

```sql
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'produccion', 'repartidor', 'superadmin')),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tipo TypeScript:
```typescript
export type Perfil = {
  id: string
  nombre: string
  rol: 'admin' | 'produccion' | 'repartidor' | 'superadmin'
  activo: boolean
  created_at: string
}
```

---

### `clientes`

```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  tipo_cliente TEXT NOT NULL DEFAULT 'minorista' CHECK (tipo_cliente IN ('minorista', 'mayorista')),
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tipo TypeScript:
```typescript
export type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  direccion: string | null
  tipo_cliente: 'minorista' | 'mayorista'
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}
```

---

### `categorias_producto`

```sql
CREATE TABLE categorias_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE
);
```

---

### `productos`

```sql
CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  fragancia TEXT,
  categoria_id UUID REFERENCES categorias_producto(id),
  unidad_medida TEXT DEFAULT 'litros',
  presentacion NUMERIC(5,1) NOT NULL,
  precio_minorista NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_mayorista NUMERIC(10,2) NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tipo TypeScript:
```typescript
export type Producto = {
  id: string
  codigo: string | null
  nombre: string
  fragancia: string | null
  categoria_id: string | null
  unidad_medida: string
  presentacion: number
  precio_minorista: number
  precio_mayorista: number
  activo: boolean
  created_at: string
  updated_at: string
}
```

Presentaciones válidas: `[0.5, 3, 5, 10, 20]` litros.

---

### `pedidos`

```sql
CREATE TYPE estado_pedido AS ENUM (
  'borrador',
  'confirmado',
  'en_produccion',
  'listo_reparto',
  'en_reparto',
  'entregado',
  'cerrado',
  'entrega_fallida',
  'anulado'
);

CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  tipo_precio TEXT NOT NULL CHECK (tipo_precio IN ('minorista', 'mayorista')),
  direccion_entrega TEXT,
  estado estado_pedido NOT NULL DEFAULT 'borrador',
  fecha_produccion DATE,
  notas_internas TEXT,
  notas_produccion TEXT,
  costo_envio NUMERIC(10,2) DEFAULT 0,
  total_calculado NUMERIC(10,2) DEFAULT 0,
  total_manual NUMERIC(10,2),
  forma_cobro TEXT CHECK (forma_cobro IN ('efectivo', 'transferencia', 'pendiente')),
  monto_cobrado NUMERIC(10,2),
  fecha_cobro DATE,                        -- fecha en que ingresó el dinero (null si pendiente)
  notas_entrega TEXT,
  motivo_falla TEXT,
  motivo_anulacion TEXT,
  creado_por UUID REFERENCES perfiles(id),
  repartidor_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tipo TypeScript:
```typescript
export type EstadoPedido =
  | 'borrador'
  | 'confirmado'
  | 'en_produccion'
  | 'listo_reparto'
  | 'en_reparto'
  | 'entregado'   // deprecated — no usar en lógica nueva; se mantiene por registros históricos
  | 'cerrado'
  | 'entrega_fallida'
  | 'anulado'

export type Pedido = {
  id: string
  numero: number
  cliente_id: string
  tipo_precio: 'minorista' | 'mayorista'
  direccion_entrega: string | null
  estado: EstadoPedido
  fecha_produccion: string | null
  notas_internas: string | null
  notas_produccion: string | null
  costo_envio: number
  total_calculado: number
  total_manual: number | null
  forma_cobro: 'efectivo' | 'transferencia' | 'pendiente' | null
  monto_cobrado: number | null
  fecha_cobro: string | null   // fecha en que ingresó el dinero; null si pendiente
  estado_pago: 'cobrado' | 'pendiente' | null   // se deriva de forma_cobro al cerrar
  notas_entrega: string | null
  motivo_falla: string | null
  motivo_anulacion: string | null
  creado_por: string | null
  repartidor_id: string | null
  created_at: string
  updated_at: string
  // Joins opcionales
  clientes?: Cliente
  pedido_items?: PedidoItem[]
}

// Total a mostrar siempre:
// const total = pedido.total_manual ?? pedido.total_calculado
```

---

### `pedido_items`

```sql
CREATE TABLE pedido_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(10,3) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  precio_referencia NUMERIC(10,2) NOT NULL,
  bidon_nuevo BOOLEAN DEFAULT FALSE
);
```

Tipo TypeScript:
```typescript
export type PedidoItem = {
  id: string
  pedido_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  precio_referencia: number
  bidon_nuevo: boolean
  // Join opcional
  productos?: Producto
  // Calculado en el cliente:
  // subtotal = cantidad * precio_unitario
}
```

---

### `pedido_historial`

```sql
CREATE TABLE pedido_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior estado_pedido,
  estado_nuevo estado_pedido NOT NULL,
  usuario_id UUID REFERENCES perfiles(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tipo TypeScript:
```typescript
export type PedidoHistorial = {
  id: string
  pedido_id: string
  estado_anterior: EstadoPedido | null
  estado_nuevo: EstadoPedido
  usuario_id: string | null
  notas: string | null
  created_at: string
  perfiles?: { nombre: string }
}
```

---

## Queries Supabase por caso de uso

### Pedidos — Admin (todos)
```typescript
const { data } = await supabase
  .from('pedidos')
  .select(`
    id, numero, estado, fecha_produccion, total_calculado, total_manual,
    clientes (id, nombre, direccion)
  `)
  .order('created_at', { ascending: false })
```

### Pedidos — Producción (todos los días, solo en_produccion)
```typescript
const { data } = await supabase
  .from('pedidos')
  .select(`
    id, numero, estado, fecha_produccion, notas_produccion, created_at,
    clientes (nombre),
    pedido_items (
      id, cantidad, bidon_nuevo,
      productos (nombre, presentacion)
    )
  `)
  .eq('estado', 'en_produccion')
  .order('fecha_produccion', { ascending: true })
```

### Pedidos — Producción filtrado por fecha
```typescript
const { data } = await supabase
  .from('pedidos')
  .select(`...`) // mismo select de arriba
  .eq('estado', 'en_produccion')
  .eq('fecha_produccion', fechaSeleccionada)
```

### Pedidos — Repartidor (solo hoy)
```typescript
const hoy = new Date().toISOString().split('T')[0]

const { data } = await supabase
  .from('pedidos')
  .select(`
    id, numero, estado, fecha_produccion, total_calculado, total_manual,
    forma_cobro, monto_cobrado,
    clientes (nombre, direccion, telefono),
    pedido_items (
      id, cantidad, bidon_nuevo,
      productos (nombre, presentacion)
    )
  `)
  .in('estado', ['en_produccion', 'listo_reparto', 'en_reparto'])
  .eq('fecha_produccion', hoy)
  .order('numero', { ascending: true })
```

### Detalle completo de un pedido
```typescript
const { data } = await supabase
  .from('pedidos')
  .select(`
    *,
    clientes (*),
    pedido_items (
      *,
      productos (*)
    ),
    pedido_historial (
      *,
      perfiles (nombre)
    )
  `)
  .eq('id', pedidoId)
  .single()
```

### Resumen de producción (agrupado por producto)
```typescript
// Hacer en el cliente agrupando los items de los pedidos en_produccion
// No hay GROUP BY nativo en Supabase JS — traer los items y agrupar en JS:
const { data } = await supabase
  .from('pedido_items')
  .select(`
    cantidad, bidon_nuevo,
    productos (nombre, presentacion),
    pedidos!inner (fecha_produccion, estado)
  `)
  .eq('pedidos.estado', 'en_produccion')

// Luego agrupar por producto en el cliente:
const resumen = data.reduce((acc, item) => {
  const key = item.productos.nombre + item.productos.presentacion
  if (!acc[key]) acc[key] = { ...item.productos, total: 0, bidon_nuevo: 0 }
  acc[key].total += Number(item.cantidad)
  if (item.bidon_nuevo) acc[key].bidon_nuevo += Number(item.cantidad)
  return acc
}, {})
```

### Cambio de estado + historial (siempre juntos)
```typescript
// 1. Actualizar estado del pedido
const { error: errorPedido } = await supabase
  .from('pedidos')
  .update({
    estado: nuevoEstado,
    updated_at: new Date().toISOString()
  })
  .eq('id', pedidoId)

if (errorPedido) throw errorPedido

// 2. Insertar en historial
await supabase
  .from('pedido_historial')
  .insert({
    pedido_id: pedidoId,
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    usuario_id: usuarioActualId,
    notas: notasOpcionales
  })
```

### Cobros pendientes (pedidos cerrados sin cobro confirmado)
```typescript
const { data: pendientes } = await supabase
  .from('pedidos')
  .select(`
    id, numero, fecha_produccion, fecha_cobro, total_calculado, total_manual,
    forma_cobro, monto_cobrado, estado_pago, created_at,
    clientes(nombre)
  `)
  .eq('estado', 'cerrado')
  .eq('estado_pago', 'pendiente')
  .order('fecha_produccion', { ascending: true })
```

### KPIs del dashboard — dos fechas distintas

> **fecha_produccion** → cuándo se produce/entrega el pedido  
> **fecha_cobro** → cuándo ingresó el dinero (null si pendiente de cobro)  
> Los KPIs de pedidos (conteos, estados) se filtran por `fecha_produccion`.  
> Los KPIs de cobros (total cobrado, efectivo, transferencia) se filtran por `fecha_cobro`.

```typescript
// Pedidos del período (por fecha de producción)
const { data: pedidos } = await supabase
  .from('pedidos')
  .select('id, estado, fecha_produccion')
  .gte('fecha_produccion', desde)
  .lte('fecha_produccion', hasta)

// Cobros del período (por fecha de cobro)
const { data: cobros } = await supabase
  .from('pedidos')
  .select('id, forma_cobro, monto_cobrado, fecha_cobro')
  .eq('estado', 'cerrado')
  .gte('fecha_cobro', desde)   // registros con fecha_cobro null no aparecen
  .lte('fecha_cobro', hasta)
```

---

## Crear usuario Admin (SQL Editor de Supabase)

```sql
-- 1. El usuario se crea desde Supabase Dashboard → Authentication → Users
-- O vía SQL:
SELECT supabase_auth.create_user(
  email := 'admin@limpimax.com',
  password := 'contraseña-segura',
  email_confirmed := true
);

-- 2. Insertar perfil (reemplazar el UUID con el id generado en el paso 1)
INSERT INTO perfiles (id, nombre, rol, activo)
VALUES (
  'uuid-del-usuario-creado',
  'Administración',
  'admin',
  true
);
```

Forma más simple — desde Supabase Dashboard:
1. Authentication → Users → "Add user" → email + password
2. Copiar el UUID del usuario creado
3. SQL Editor → ejecutar solo el INSERT en perfiles con ese UUID

---

## RLS (Row Level Security)

```sql
-- Habilitar RLS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Perfiles: cada usuario lee su propio perfil
CREATE POLICY "perfil_propio" ON perfiles
  FOR SELECT USING (auth.uid() = id);

-- Admin: acceso total
CREATE POLICY "admin_todo" ON pedidos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

-- Producción: solo pedidos en_produccion y listo_reparto
CREATE POLICY "produccion_pedidos" ON pedidos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'produccion')
    AND estado IN ('en_produccion', 'listo_reparto')
  );

-- Repartidor: pedidos del día en estados relevantes
CREATE POLICY "repartidor_pedidos" ON pedidos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'repartidor')
    AND estado IN ('en_produccion', 'listo_reparto', 'en_reparto', 'entregado')
    AND fecha_produccion = CURRENT_DATE
  );

-- Clientes y productos: solo autenticados
CREATE POLICY "auth_clientes" ON clientes
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_productos" ON productos
  FOR ALL USING (auth.uid() IS NOT NULL);
```

---

## Índices

```sql
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha_produccion ON pedidos(fecha_produccion);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX idx_historial_pedido ON pedido_historial(pedido_id);
```

---

## Formato de número de pedido

```typescript
const formatNumero = (n: number): string => `P-${String(n).padStart(5, '0')}`
// 41 → "P-00041"
```

---

## ESTADO_CONFIG — objeto global para la UI

```typescript
export const ESTADO_CONFIG: Record<EstadoPedido, { bg: string; color: string; label: string }> = {
  borrador:        { bg: '#F0F0F0', color: '#9A9A9A', label: 'Borrador' },
  confirmado:      { bg: '#E8F4FF', color: '#1B9ED6', label: 'Confirmado' },
  en_produccion:   { bg: '#FFF3E0', color: '#F57C00', label: 'En producción' },
  listo_reparto:   { bg: '#FFFDE7', color: '#F9A825', label: 'Listo para reparto' },
  en_reparto:      { bg: '#E3F2FD', color: '#1565C0', label: 'En reparto' },
  entregado:       { bg: '#E8F8F0', color: '#2E9E5C', label: 'Entregado' }, // deprecated
  cerrado:         { bg: '#D4EDDA', color: '#145A32', label: 'Cerrado' },
  entrega_fallida: { bg: '#FDECEA', color: '#D32F2F', label: 'Entrega fallida' },
  anulado:         { bg: '#ECEFF1', color: '#455A64', label: 'Anulado' },
}
// Nota: 'entregado' se mantiene en ESTADO_CONFIG solo por backward compat con registros históricos.
// No usar en lógica nueva. El flujo en_reparto → cerrado reemplaza los dos pasos anteriores.
```
