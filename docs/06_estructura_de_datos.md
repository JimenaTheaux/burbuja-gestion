# 06 — Estructura de Base de Datos (Supabase / PostgreSQL)

## Cliente Supabase (src/lib/supabase.ts)

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Cliente admin — solo para gestión de usuarios (resetear contraseñas)
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)
```

Variables de entorno necesarias:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

---

## Tablas

### `perfiles`
```sql
CREATE TABLE perfiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  rol       TEXT NOT NULL CHECK (rol IN ('admin', 'produccion', 'repartidor', 'superadmin')),
  activo    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

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
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  telefono      TEXT,
  direccion     TEXT,
  tipo_cliente  TEXT NOT NULL DEFAULT 'minorista'
                  CHECK (tipo_cliente IN ('minorista', 'mayorista')),
  notas         TEXT,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

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
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE
);
```

---

### `productos`

> Campo nuevo respecto a Limpimax: `costo_produccion`

```sql
CREATE TABLE productos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            TEXT UNIQUE,
  nombre            TEXT NOT NULL,
  fragancia         TEXT,
  categoria_id      UUID REFERENCES categorias_producto(id),
  unidad_medida     TEXT DEFAULT 'litros',
  presentacion      NUMERIC(5,1) NOT NULL,
  precio_minorista  NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_mayorista  NUMERIC(10,2) NOT NULL DEFAULT 0,
  costo_produccion  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- NUEVO: costo unitario de fabricación
  activo            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

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
  costo_produccion: number   // NUEVO
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
  'cerrado',
  'entrega_fallida',
  'anulado'
);

-- Nota: 'entregado' existe en el enum solo como compat con registros históricos.
-- El flujo actual nunca lo setea: en_reparto pasa directo a 'cerrado' vía la RPC
-- cerrar_pedido. La RPC legacy registrar_entrega (que sí seteaba 'entregado') se
-- eliminó de rpcs_and_indexes.sql — no tenía uso desde el frontend.

CREATE TABLE pedidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            SERIAL UNIQUE,
  cliente_id        UUID NOT NULL REFERENCES clientes(id),
  tipo_precio       TEXT NOT NULL CHECK (tipo_precio IN ('minorista', 'mayorista')),
  direccion_entrega TEXT,
  estado            estado_pedido NOT NULL DEFAULT 'borrador',
  fecha_produccion  DATE,
  notas_internas    TEXT,
  notas_produccion  TEXT,
  costo_envio       NUMERIC(10,2) DEFAULT 0,
  costo_bidones     NUMERIC(10,2) DEFAULT 0,
  total_calculado   NUMERIC(10,2) DEFAULT 0,
  total_manual      NUMERIC(10,2),
  forma_cobro       TEXT CHECK (forma_cobro IN ('efectivo', 'transferencia', 'pendiente')),
  monto_cobrado     NUMERIC(10,2),
  fecha_cobro       DATE,
  estado_pago       TEXT CHECK (estado_pago IN ('cobrado', 'pendiente')),
  notas_entrega     TEXT,
  motivo_falla      TEXT,
  motivo_anulacion  TEXT,
  creado_por        UUID REFERENCES perfiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
export type EstadoPedido =
  | 'borrador'
  | 'confirmado'
  | 'en_produccion'
  | 'listo_reparto'
  | 'en_reparto'
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
  costo_bidones: number
  total_calculado: number
  total_manual: number | null
  forma_cobro: 'efectivo' | 'transferencia' | 'pendiente' | null
  monto_cobrado: number | null
  fecha_cobro: string | null
  estado_pago: 'cobrado' | 'pendiente' | null
  notas_entrega: string | null
  motivo_falla: string | null
  motivo_anulacion: string | null
  creado_por: string | null
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
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id         UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id       UUID NOT NULL REFERENCES productos(id),
  cantidad          NUMERIC(10,3) NOT NULL,
  precio_unitario   NUMERIC(10,2) NOT NULL,   -- snapshot del precio al momento de crear
  precio_referencia NUMERIC(10,2) NOT NULL,   -- precio actual del catálogo (para alerta de cambio)
  costo_snapshot    NUMERIC(10,2) NOT NULL DEFAULT 0, -- NUEVO: snapshot del costo_produccion al crear
  bidon_nuevo       BOOLEAN DEFAULT FALSE
);
```

```typescript
export type PedidoItem = {
  id: string
  pedido_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  precio_referencia: number
  costo_snapshot: number   // NUEVO: snapshot de costo al momento de crear el pedido
  bidon_nuevo: boolean
  // Join opcional
  productos?: Producto
  // subtotal = cantidad * precio_unitario
  // costo_total_item = cantidad * costo_snapshot
}
```

> `costo_snapshot` se congela al crear el pedido igual que `precio_unitario`. Cambios futuros en `costo_produccion` del producto no afectan pedidos existentes.

---

### `pedido_historial`
```sql
CREATE TABLE pedido_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior estado_pedido,
  estado_nuevo    estado_pedido NOT NULL,
  usuario_id      UUID REFERENCES perfiles(id),
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

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

### `egresos`
```sql
CREATE TABLE egresos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_egreso   DATE NOT NULL,
  categoria      TEXT NOT NULL CHECK (categoria IN (
                   'sueldos','alquiler','drogueria',
                   'grafica','packaging','luz','otros')),
  concepto       TEXT NOT NULL,
  monto          NUMERIC(10,2) NOT NULL,
  registrado_por UUID REFERENCES perfiles(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
export type CategoriaEgreso =
  | 'sueldos' | 'alquiler' | 'drogueria'
  | 'grafica' | 'packaging' | 'luz' | 'otros'

export type Egreso = {
  id: string
  fecha_egreso: string
  categoria: CategoriaEgreso
  concepto: string
  monto: number
  registrado_por: string | null
  created_at: string
  updated_at: string
  perfiles?: { nombre: string }
}

export const CATEGORIA_EGRESO_LABELS: Record<CategoriaEgreso, string> = {
  sueldos:   'Sueldos',
  alquiler:  'Alquiler',
  drogueria: 'Droguería',
  grafica:   'Gráfica',
  packaging: 'Packaging',
  luz:       'Luz',
  otros:     'Otros',
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

### Pedidos — Vista Producción (en_produccion + listo_reparto)
```typescript
const { data } = await supabase
  .from('pedidos')
  .select(`
    id, numero, estado, fecha_produccion, notas_produccion,
    clientes (nombre),
    pedido_items (
      id, cantidad, bidon_nuevo,
      productos (nombre, presentacion)
    )
  `)
  .in('estado', ['en_produccion', 'listo_reparto'])
  .order('fecha_produccion', { ascending: true })
```

### Pedidos — Vista Reparto (listo_reparto + en_reparto + entrega_fallida)
```typescript
const { data } = await supabase
  .from('pedidos')
  .select(`
    id, numero, estado, fecha_produccion, total_calculado, total_manual,
    forma_cobro, monto_cobrado,
    clientes (nombre, direccion, telefono),
    pedido_items (
      id, cantidad,
      productos (nombre, presentacion)
    )
  `)
  .in('estado', ['listo_reparto', 'en_reparto', 'entrega_fallida'])
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

### KPI Margen bruto del período
```typescript
// Traer pedidos cerrados con sus items y costos snapshot
const { data } = await supabase
  .from('pedidos')
  .select(`
    monto_cobrado, fecha_cobro,
    pedido_items (cantidad, costo_snapshot)
  `)
  .eq('estado', 'cerrado')
  .eq('estado_pago', 'cobrado')
  .gte('fecha_cobro', desde)
  .lte('fecha_cobro', hasta)

// Calcular en el cliente:
const totalCobrado = data.reduce((sum, p) => sum + (p.monto_cobrado ?? 0), 0)
const totalCosto = data.reduce((sum, p) =>
  sum + p.pedido_items.reduce((s, i) => s + i.cantidad * i.costo_snapshot, 0), 0
)
const margenBruto = totalCobrado - totalCosto
const margenPct = totalCobrado > 0 ? (margenBruto / totalCobrado) * 100 : 0
```

### KPIs del dashboard — fechas
> `fecha_produccion` → para KPIs de pedidos (conteos, estados)
> `fecha_cobro` → para KPIs de cobros (montos, margen)

```typescript
// Pedidos del período
const { data: pedidos } = await supabase
  .from('pedidos')
  .select('id, estado, fecha_produccion')
  .gte('fecha_produccion', desde)
  .lte('fecha_produccion', hasta)

// Cobros del período
const { data: cobros } = await supabase
  .from('pedidos')
  .select('id, forma_cobro, monto_cobrado, fecha_cobro')
  .eq('estado', 'cerrado')
  .gte('fecha_cobro', desde)
  .lte('fecha_cobro', hasta)
```

### Cambio de estado (siempre via RPC)
```typescript
// Usar siempre la RPC para garantizar atomicidad
const { error } = await supabase.rpc('cambiar_estado_pedido', {
  p_pedido_id:      pedidoId,
  p_nuevo_estado:   nuevoEstado,
  p_usuario_id:     usuarioId,
  p_notas:          notasOpcionales ?? null
})
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
  confirmado:      { bg: '#EBF5FF', color: '#2B6CB0', label: 'Confirmado' },
  en_produccion:   { bg: '#FFF3E0', color: '#E65100', label: 'En producción' },
  listo_reparto:   { bg: '#FFFDE7', color: '#C47B00', label: 'Listo para reparto' },
  en_reparto:      { bg: '#EBF5FF', color: '#2B6CB0', label: 'En reparto' },
  cerrado:         { bg: '#E8FAF6', color: '#28B99A', label: 'Cerrado' },
  entrega_fallida: { bg: '#FEF2F2', color: '#C0392B', label: 'Entrega fallida' },
  anulado:         { bg: '#F0F0F0', color: '#9A9A9A', label: 'Anulado' },
}
```

---

## RLS (Row Level Security)

```sql
ALTER TABLE pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE egresos         ENABLE ROW LEVEL SECURITY;

-- Perfil propio
CREATE POLICY "perfil_propio" ON perfiles
  FOR SELECT USING (auth.uid() = id);

-- Admin: acceso total a todas las tablas
CREATE POLICY "admin_todo_pedidos" ON pedidos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

CREATE POLICY "admin_todo_clientes" ON clientes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

CREATE POLICY "admin_todo_productos" ON productos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

CREATE POLICY "admin_todo_egresos" ON egresos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

-- Producción: solo lectura de pedidos en_produccion y listo_reparto
CREATE POLICY "produccion_pedidos" ON pedidos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'produccion')
    AND estado IN ('en_produccion', 'listo_reparto')
  );

-- Repartidor: solo lectura de pedidos del día en estados relevantes
CREATE POLICY "repartidor_pedidos" ON pedidos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'repartidor')
    AND estado IN ('listo_reparto', 'en_reparto', 'entrega_fallida')
    AND fecha_produccion = CURRENT_DATE
  );
```

**Nota de seguridad:** estas policies son `FOR SELECT` únicamente — Producción y Repartidor nunca tienen `UPDATE` directo sobre `pedidos`. Todos los cambios de estado pasan por las RPCs `cambiar_estado_pedido` y `cerrar_pedido` (`SECURITY DEFINER` en `supabase/rpcs_and_indexes.sql`), que se ejecutan con privilegios elevados y bypasean RLS internamente. Esas RPCs (y `anular_pedido`) validan el rol del caller contra la transición pedida vía la función `public._rol_actual()` y ya no están otorgadas a `anon`, solo a `authenticated`. La cola offline del repartidor (`src/hooks/useOffline.ts`) también pasa por estas RPCs en vez de hacer `UPDATE` directo, así queda registrada en `pedido_historial` igual que el flujo online. **Recordatorio:** el SQL de `supabase/rpcs_and_indexes.sql` no se aplica solo — hay que ejecutarlo en el SQL Editor de Supabase para que el proyecto en producción quede sincronizado con el repo. (2026-06-29: al aplicarlo se confirmó que `anular_pedido` y `get_dashboard_stats` no existían todavía en la base — es decir, anular un pedido no funcionaba en producción antes de este SQL. `get_dashboard_stats` ya tenía fallback en `src/services/produccion.ts`, por eso no se notaba.)

**Gestión de usuarios (`perfiles`):** a diferencia de `pedidos`/`clientes`/`productos`/`egresos`, `perfiles` **no tiene** policy `admin_todo_*` — solo tiene `perfil_propio` (`SELECT` de la fila propia). Esto es intencional para no dar `SELECT`/`UPDATE` abierto sobre roles vía RLS, pero implica que el admin necesita otro camino para listar y editar usuarios:
- **Listar** (`useUsuarios` en `src/services/usuarios.ts`): usa la RPC `get_all_perfiles` (RPC 5 en `supabase/rpcs_and_indexes.sql`, `SECURITY DEFINER`, valida `admin`/`superadmin` vía `_rol_actual()`). Esta RPC no existía en la base de producción hasta el 2026-07-01 (mismo problema que `anular_pedido`/`get_dashboard_stats` arriba) — la página de Usuarios mostraba la lista vacía sin ningún error visible.
- **Crear** (`useCrearUsuario`) y **editar** (`useEditarUsuario`): usan el cliente `supabaseAdmin` (con `service_role_key`) en vez del cliente normal para el `INSERT`/`UPDATE` sobre `perfiles`, ya que no hay policy de escritura que se lo permita al cliente normal.
- **`supabaseAdmin`** (`src/services/usuarios.ts`) también se usa para `auth.admin.createUser`, `listUsers`, `updateUserById` y `deleteUser` — operaciones que solo existen en la Admin API de Supabase Auth, no en SQL.
- **Riesgo aceptado:** la `service_role_key` se carga como `VITE_SUPABASE_SERVICE_ROLE_KEY`, y por ser una var `VITE_*`, Vite la incluye en el bundle de JS servido al navegador. Cualquiera que inspeccione el bundle puede extraerla y obtener acceso total de lectura/escritura a **toda** la base (bypasea RLS en todas las tablas, no solo `perfiles`). Se optó por esto para no montar una Supabase Edge Function todavía. Si se quiere sacar ese riesgo más adelante, mover `crear/editar perfil` y las llamadas a `auth.admin.*` a una Edge Function server-side (la key nunca sale del servidor).
- (2026-07-01: RPC `get_all_perfiles` creada y ejecutada en producción, `service_role_key` configurada en `.env.local` y Vercel. Confirmado funcionando: listar, crear y editar usuarios desde `/admin/usuarios`.)

---

## Índices

```sql
CREATE INDEX idx_pedidos_estado          ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha_produccion ON pedidos(fecha_produccion);
CREATE INDEX idx_pedidos_fecha_cobro      ON pedidos(fecha_cobro);
CREATE INDEX idx_pedidos_estado_pago      ON pedidos(estado_pago);
CREATE INDEX idx_pedidos_cliente          ON pedidos(cliente_id);
CREATE INDEX idx_pedido_items_pedido      ON pedido_items(pedido_id);
CREATE INDEX idx_historial_pedido         ON pedido_historial(pedido_id);
CREATE INDEX idx_egresos_fecha            ON egresos(fecha_egreso);
```

---

## Crear usuario Admin inicial (SQL Editor de Supabase)

```sql
-- 1. Crear desde Dashboard → Authentication → Users → "Add user"
-- 2. Copiar el UUID generado
-- 3. Ejecutar:
INSERT INTO perfiles (id, nombre, rol, activo)
VALUES (
  'uuid-del-usuario-creado',
  'Administración',
  'admin',
  true
);
```
