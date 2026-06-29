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
| Editar pedido | ✅ | ❌ | ❌ |
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

---

## Notas
- Login con email + contraseña. Sin registro público.
- Sesión persistente (no expira sola).
- Los usuarios se desactivan, nunca se eliminan.
- El filtrado por rol en el frontend es vía `ProtectedRoute` (`src/components/common/ProtectedRoute.tsx`) según `roles` permitidos en cada ruta de `App.tsx`.
- **Validación de rol en las RPCs:** `cambiar_estado_pedido`, `cerrar_pedido` y `anular_pedido` validan el rol del caller (vía `perfiles.rol`) antes de aplicar la transición — ver `supabase/rpcs_and_indexes.sql`. El grant a `anon` se sacó (quedan solo para `authenticated`). **Pendiente de ejecutar:** este SQL está actualizado en el repo pero hay que correrlo en el SQL Editor de Supabase para que tome efecto en la base real — no se aplica solo. `get_dashboard_stats` (KPIs de ventas) sigue sin chequeo de rol propio dentro de la función, aunque ya no es accesible para `anon`; el frontend solo la llama desde el dashboard de Admin.
