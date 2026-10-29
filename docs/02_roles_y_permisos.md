# 02 — Roles y Permisos

## Estado actual

Los cuatro roles (`admin`, `superadmin`, `produccion`, `repartidor`) están **activos**. Cada uno tiene login propio y aterriza en su propio espacio según `perfiles.rol` (`RUTA_POR_ROL` en `LoginPage.tsx`):

| Rol | Ruta destino |
|---|---|
| `admin` / `superadmin` | `/admin` |
| `produccion` | `/produccion` |
| `repartidor` | `/repartidor` |

El Admin además puede ver las vistas operativas de Producción y Reparto desde `/admin/produccion` y `/admin/repartidor` — son el **mismo componente** (`ProduccionView` / `RepartidorView`) que usan los roles operativos, sin restricción a un usuario en particular: cualquier cuenta con rol `produccion` o `repartidor` ve y opera toda la cola de pedidos (no hay asignación de pedido a un repartidor específico).

RLS en Supabase restringe la **lectura** por rol (ver `06_estructura_de_datos.md`), pero los cambios de estado pasan por RPCs `SECURITY DEFINER` que no validan el rol del caller — ver nota de seguridad al final.

---

## Roles definidos

### ROL: Administración (`admin`) — **ACTIVO EN MVP**
**Quién:** Dueño o personal de oficina que gestiona pedidos, clientes y cierres.

**Puede:**
- Crear, editar y anular pedidos
- Ver todos los pedidos en cualquier estado
- Avanzar el estado de cualquier pedido manualmente
- Acceder al dashboard general (KPIs del día, pedidos por estado)
- Acceder al dashboard de ventas con KPIs (cantidad, ingresos, margen bruto, filtros de fechas)
- Registrar y editar clientes
- ABM de productos y precios (incluido `costo_produccion`)
- Ver y registrar el cierre de ventas (cobro)
- Editar forma de pago y monto cobrado en pedidos CERRADOS
- Exportar o compartir documento por pedido (JPG vía WhatsApp)
- Crear y gestionar usuarios del sistema
- Acceder a las vistas de Producción y Reparto
- Ver y gestionar egresos

**Vista principal:** Dashboard con KPIs + tablero de pedidos + gráfico semanal.

**Navegación desktop:** Sidebar blanco colapsable (240px / 64px).

**Navegación mobile:** Hamburguesa (menú completo) + bottom nav fijo con accesos directos: Dashboard · Pedidos · Egresos.

---

### ROL: Producción (`produccion`) — **ACTIVO**
**Quién:** Operario de planta que fabrica/arma los pedidos.

**Puede:**
- Ver pedidos en estado `en_produccion` (agrupados por fecha de producción, con ítems y notas de producción)
- Ver lista resumen de producción (cantidades por artículo)
- Marcar pedido como `listo_reparto`
- Ver listado de pedidos ya marcados como listos (`/produccion/listos`, solo lectura)
- Editar su propio perfil / contraseña

**No puede:** ver precios, totales, costos, ni datos de cobro. No tiene acceso a Pedidos, Clientes, Productos, Egresos ni Usuarios.

**Navegación:** `ProduccionLayout` con bottom nav (Producción · Listos · Perfil). Sin soporte offline.

---

### ROL: Repartidor (`repartidor`) — **ACTIVO**
**Quién:** Persona que entrega los pedidos y cobra.

**Puede:**
- Ver pedidos en `en_produccion` (con acción de emergencia), `listo_reparto` y `en_reparto`
- Marcar salida a reparto (`listo_reparto` → `en_reparto`)
- Registrar entrega + cobro (forma de cobro, monto, fecha de cobro, observaciones) → pasa a `cerrado`
- Registrar entrega fallida con motivo → pasa a `entrega_fallida`
- Avance de emergencia: retirar un pedido directo desde `en_produccion` → `en_reparto`
- Ver historial de entregas cerradas/fallidas del día (`/repartidor/historial`, solo lectura)
- Editar su propio perfil / contraseña
- Operar **sin conexión**: las acciones se encolan en IndexedDB y sincronizan al volver online

**No puede:** ver precios de catálogo ni costos. No tiene acceso a Pedidos, Clientes, Productos, Egresos ni Usuarios.

**Navegación:** `RepartidorLayout` con bottom nav (Pedidos · Historial · Perfil), indicador de conexión y banners de sincronización.

---

### ROL: Superadmin (`superadmin`) — **RESERVADO**
Todo lo del admin + configuración técnica, gestión de roles, acceso a logs.

---

## Matriz de permisos

| Acción | Admin | Producción | Repartidor |
|---|:---:|:---:|:---:|
| Ver todos los pedidos | ✅ | — | — |
| Ver pedidos en producción | ✅ | ✅ | — |
| Ver pedidos listos/en reparto | ✅ | — | ✅ |
| Crear pedido | ✅ | ❌ | ❌ |
| Editar pedido (cualquier estado excepto `anulado`; en `cerrado` solo si el cobro está pendiente)* | ✅ | ❌ | ❌ |
| Anular pedido | ✅ | ❌ | ❌ |
| Ver precios, totales y margen | ✅ | ❌ | ❌ |
| Avanzar `en_produccion` → `listo_reparto` | ✅ | ✅ | ❌ |
| Avanzar `listo_reparto` → `en_reparto` | ✅ | ❌ | ✅ |
| Avance de emergencia `en_produccion` → `en_reparto` | ✅ | ❌ | ✅ |
| Registrar cobro / cerrar pedido | ✅ | ❌ | ✅ |
| Registrar entrega fallida | ✅ | ❌ | ✅ |
| Editar cobro en pedido cerrado | ✅ | ❌ | ❌ |
| ABM clientes / productos / usuarios / egresos | ✅ | ❌ | ❌ |
| Dashboard general + ventas + margen | ✅ | ❌ | ❌ |
| Operar sin conexión (offline queue) | — | ❌ | ✅ |
| Atajo: `listo_reparto` → `cerrado` directo, sin pasar por `en_reparto` | ✅ | ❌ | ❌ |

*Ver detalle de la regla de edición en `03_flujo_de_estados.md` (sección "Reglas del flujo").

---

## Notas
- Login con email + contraseña. Sin registro público.
- Sesión persistente (no expira sola).
- Los usuarios se desactivan, nunca se eliminan.
- El filtrado por rol en el frontend es vía `ProtectedRoute` (`src/components/common/ProtectedRoute.tsx`) según `roles` permitidos en cada ruta de `App.tsx`.
- **Validación de rol en las RPCs (aplicado en producción 2026-10-27):** `cambiar_estado_pedido`, `cerrar_pedido`, `anular_pedido` y `registrar_pago` validan el rol con `public._rol_actual()` — un usuario sin perfil o **desactivado** queda afuera aunque tenga una sesión válida. Solo `authenticated` puede ejecutarlas. Detalle en `supabase/rpcs_and_indexes.sql` y `06_estructura_de_datos.md` (sección RLS):
  - `cambiar_estado_pedido`: admin/superadmin cualquier transición; producción `en_produccion → listo_reparto`; repartidor `listo_reparto → en_reparto`, `en_reparto → entrega_fallida`, `en_produccion → en_reparto`.
  - `cerrar_pedido`: admin/superadmin y repartidor (este último solo desde `listo_reparto`, `en_reparto` o `entrega_fallida`).
  - `anular_pedido` y `registrar_pago`: solo admin/superadmin.
- **Gestión de usuarios (`/admin/usuarios`):** listar, crear, editar, desactivar y resetear contraseña pasan por la Edge Function `admin-usuarios`, que valida el token de sesión y exige admin/superadmin activo (sin sesión 401, otro rol 403). La clave secreta vive solo en esa función; el frontend usa únicamente la publishable key. Detalle en `06_estructura_de_datos.md` (sección RLS).
