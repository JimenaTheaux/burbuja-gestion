# 04 — Funcionalidades por Módulo

## MÓDULO 1: Autenticación

### F1.1 — Login
- Formulario: email + contraseña con float labels
- Sin registro público; usuarios creados solo por Admin
- Sesión persistente (no expira sola)
- Redirección automática según rol al ingresar: `admin`/`superadmin` → `/admin`, `produccion` → `/produccion`, `repartidor` → `/repartidor`
- Error inline: "Credenciales incorrectas. Intentá de nuevo." — sin alert del browser

### F1.2 — Gestión de sesión
- Logout manual disponible siempre (footer del sidebar / menú hamburguesa)
- Si `activo = false` en `perfiles`, `useAuth` cierra sesión automáticamente

---

## MÓDULO 2: Pedidos

### F2.1 — Crear pedido (Admin)
Se abre en un drawer/sheet lateral (50% desktop, 100% mobile) con fondo oscurecido.

**Campos:**
- Cliente: selector con búsqueda por texto + botón "+ Cliente nuevo" que expande mini-form inline
- Fecha de producción (date picker nativo estilizado)
- Lista de ítems:
  - Producto (select del catálogo activo)
  - Cantidad
  - Precio unitario (precargado según tipo de cliente: mayorista/minorista; editable)
  - Subtotal calculado automáticamente
  - Bidón nuevo (checkbox por ítem)
- Costo de envío (opcional, numérico)
- Total: calculado automáticamente, editable manualmente (si se edita manualmente, se resalta visualmente)
- Notas internas (solo Admin)
- Notas para producción

**Comportamiento de precios:**
- Al seleccionar cliente, ítems precargan precio según tipo (mayorista/minorista)
- Admin puede modificar precio de cualquier ítem
- Total se recalcula al agregar/quitar ítems; si se edita manualmente, ese valor tiene precedencia
- Al guardar, el precio de cada ítem queda congelado como snapshot
- Cambios futuros en ABM no afectan pedidos ya creados

**Acciones footer del drawer:**
- "Guardar borrador" (botón secondary)
- "Confirmar pedido" (botón primary) → pasa a `en_produccion` automáticamente

**Validaciones:** al menos 1 ítem, cliente obligatorio, fecha de producción obligatoria.

### F2.1.1 — Marca de bidón nuevo
- Checkbox por ítem: "¿Bidón nuevo?"
- Campo `bidon_nuevo` boolean en `pedido_items`, default `false`
- Aparece como badge en detalle del pedido y en vista de producción

### F2.2 — Editar pedido (Admin)
- Disponible en estados `borrador`, `confirmado`, `en_produccion`
- Se abre en el mismo drawer lateral
- Muestra historial de cambios de estado
- **Alerta de precio desactualizado:** si el precio de un ítem cambió en ABM desde la creación, muestra alerta con precio original vs actual. Admin elige: mantener original o actualizar.

### F2.3 — Ver detalle de pedido
- Se abre en drawer lateral (no página nueva)
- Historial de estados con timestamps y usuario responsable

### F2.4 — Listado de pedidos (Admin)
- Vista principal: tabla con columnas Número · Cliente · Estado · Fecha prod. · Total · Acción
- Tabs: Todos / En producción / En reparto / Cerrados
- Filtros: por estado, por fecha de producción, por cliente
- Búsqueda por número de pedido o nombre de cliente
- Badges de estado con colores exactos de la tabla en `03_flujo_de_estados.md`

### F2.5 — Anular pedido (Admin)
- Disponible desde cualquier estado excepto `cerrado`
- Drawer con campo de motivo obligatorio
- El pedido anulado se oculta de vistas operativas pero queda en historial

---

## MÓDULO 3: Vista de Producción

> Rol `produccion` activo: login propio en `/produccion`. El Admin accede a la misma vista (mismo componente `ProduccionView`) en `/admin/produccion`, sin restricción a un operario en particular.

### F3.1 — Panel de pedidos a producir
- `/produccion` (rol producción) o `/admin/produccion` (Admin) — `ProduccionLayout` con bottom nav: Producción · Listos · Perfil
- Muestra únicamente pedidos en estado `en_produccion`
- **Desktop:** agrupado/kanban por fecha de producción
- **Mobile:** lista agrupada con encabezado de día separador
- Selector de fecha en el header (navega día a día)
- Por pedido: número, cliente, ítems (cantidad, presentación), notas de producción, badge "Bidón nuevo"
- **Sin precios, sin totales, sin datos de cobro** (excluidos de la query, no solo ocultos en UI)

### F3.2 — Lista resumen de producción
- Panel colapsable arriba de la vista
- Agrupado por artículo: nombre, presentación, cantidad total
- Descargable / imprimible

### F3.3 — Marcar como "Listo para reparto"
- Botón por pedido (mínimo 44px) con confirmación simple
- Transición `en_produccion` → `listo_reparto` vía RPC `cambiar_estado_pedido`

### F3.4 — Listos para reparto (`/produccion/listos`)
- Vista de solo lectura: pedidos en `listo_reparto`, ya en cola para el repartidor
- Sin acciones — informativa

### Sin soporte offline
- Producción no usa `useOffline`/IndexedDB (se asume con conectividad estable en planta)

---

## MÓDULO 4: Vista de Reparto

> Rol `repartidor` activo: login propio en `/repartidor`. El Admin accede a la misma vista (mismo componente `RepartidorView`) en `/admin/repartidor`, sin restricción a un repartidor en particular. No hay asignación de pedido a un repartidor específico — cualquiera con el rol ve y opera toda la cola.

### F4.1 — Lista de pedidos
- `/repartidor` (rol repartidor) o `/admin/repartidor` (Admin) — `RepartidorLayout` con bottom nav: Pedidos · Historial · Perfil
- Muestra pedidos en `en_produccion` (con acción de emergencia, ver F4.4), `listo_reparto` y `en_reparto`
- Cards expandibles: número, cliente, dirección, total a cobrar (destacado), badge de estado; al expandir, ítems del pedido
- **Sin precios de catálogo ni costos** — solo cantidades e ítems

### F4.2 — Salir a repartir
- Botón "Salir a repartir" (individual por card, o en bloque desde la sección "Listos para salir")
- Transición `listo_reparto` → `en_reparto`

### F4.3 — Cerrar pedido (entrega + cobro)
- Mini-form inline en la card del pedido ("Registrar entrega")
- Campos: forma de cobro (Efectivo / Transferencia / Pendiente), fecha de cobro (default hoy, oculta si pendiente), monto cobrado, observaciones
- Al confirmar: pedido pasa a `cerrado` vía RPC `cerrar_pedido` (no usa la RPC legacy `registrar_entrega`/estado `entregado`)

### F4.4 — Registrar entrega fallida
- Form inline con campo de motivo (texto libre, obligatorio)
- Transición `en_reparto` → `entrega_fallida`
- Reagendar: Admin puede devolver el pedido a `listo_reparto` desde su vista

### F4.5 — Avance de emergencia
- Si un pedido sigue en `en_produccion` pero el repartidor ya lo retiró físicamente, botón "Ya retiré este pedido" con confirmación
- Transición directa `en_produccion` → `en_reparto`, queda registrada en el historial con nota "Avance de emergencia — repartidor"

### F4.6 — Historial (`/repartidor/historial`)
- Vista de solo lectura: pedidos `cerrado` y `entrega_fallida` del día (selector de fecha)
- Sin acciones — informativa

### Soporte offline (exclusivo de este rol)
- `useOffline` + IndexedDB (`offlineQueue`): si no hay conexión, las acciones (cambiar estado, cerrar pedido) se encolan localmente
- Indicador de conexión en el header (En línea / Sin conexión) y banners de sincronización pendiente/en curso
- Al recuperar conexión, sincroniza automáticamente la cola contra Supabase

---

## MÓDULO 5: Dashboard de Administración

### F5.1 — Resumen del día
Cards KPI (4 mínimo):
- **Pedidos hoy:** total count filtrado por `fecha_produccion = hoy`
- **Cobrado hoy:** suma de `monto_cobrado` donde `estado_pago = 'cobrado'` y `fecha_cobro = hoy` — con desglose efectivo / transferencia
- **Pendiente de cobro:** count + monto total de pedidos `cerrado` con `estado_pago = 'pendiente'` — alerta visual; al hacer clic abre panel con listado
- **Margen bruto:** `sum(monto_cobrado) - sum(costo_produccion × cantidad)` para pedidos cerrados del período — muestra porcentaje y monto absoluto

### F5.2 — Tablero de estados
- Conteo de pedidos por estado (hoy)
- Lista agrupada con badges; clic abre drawer con detalle y acciones

### F5.3 — Evolución semanal (gráfico)
- Barras de cobros agrupados por `fecha_cobro`, últimos 7 días
- Hoy destacado visualmente
- Totales: esta semana vs semana anterior

### F5.4 — Dashboard de ventas (KPIs con rango)
- Selector de rango: [Desde] [Hasta]; default = primer día del mes → hoy
- **Pedidos** (count, pendientes de cierre): filtrados por `fecha_produccion`
- **Cobros** (total, efectivo, transferencia): filtrados por `fecha_cobro`
- **Margen bruto del período:** `sum(monto_cobrado) - sum(costo_item × cantidad)` para pedidos cerrados en el rango
- Gráfico de evolución comparado con el mismo rango del mes anterior

---

## MÓDULO 6: ABM de Clientes (Admin)

### F6.1 — Lista de clientes
- Búsqueda por nombre o dirección
- Indicador activo / inactivo
- Botón "+ Nuevo cliente" abre drawer lateral

### F6.2 — Crear / editar cliente (en drawer)
- Nombre (obligatorio), teléfono, dirección, tipo (Mayorista / Minorista), observaciones

### F6.3 — Ingreso rápido desde formulario de pedido
- Mini-form inline sin salir del drawer de pedido
- Campos: nombre + teléfono + dirección

---

## MÓDULO 7: ABM de Productos (Admin)

### F7.1 — Lista de productos
- Búsqueda por nombre, filtro por categoría
- Indicador activo / inactivo
- Botón "+ Nuevo producto" abre drawer

### F7.2 — Crear / editar producto (en drawer)
- Categoría, nombre (obligatorio), fragancia
- Unidad: litros (fijo)
- Presentación: lista fija `[0.5, 3, 5, 10, 20]` litros
- Precio minorista y mayorista
- **`costo_produccion`** (NUEVO): costo de fabricación por unidad — numérico, default 0 — se usa para calcular margen bruto en el dashboard
- Activo / inactivo

**Lógica de precios:**
- Dos precios de venta: minorista y mayorista
- Un costo de producción: para cálculo de margen interno (no visible al cliente)
- Cambiar precios en ABM no modifica pedidos ya existentes (snapshot)

**Borrar producto:**
- Solo si no tiene pedidos asociados. Si tiene historial, solo se puede inactivar.

---

## MÓDULO 8: Perfil y Cambio de Contraseña

### F8.1 — Mi perfil (Admin)
Accesible desde footer del sidebar → `/admin/perfil`.

- Card de identidad: avatar con iniciales, nombre, rol (solo lectura)
- Formulario "Cambiar contraseña": contraseña actual + nueva + confirmar
- Toggle visibilidad en cada campo
- Implementación: `supabase.auth.updateUser({ password })` previo re-auth con `signInWithPassword`

### F8.2 — Resetear contraseña de un usuario (Admin)
Desde drawer de editar usuario en `/admin/usuarios`.

- Sección colapsable "Restablecer contraseña"
- Campo: nueva contraseña (mínimo 6 caracteres)
- Requiere `VITE_SUPABASE_SERVICE_ROLE_KEY`
- El Admin no puede resetearse a sí mismo desde aquí — usa "Mi perfil"

---

## MÓDULO 9: Gestión de Usuarios (Admin)

### F9.1 — Lista de usuarios
- Nombre, email, rol, activo/inactivo
- Botón "+ Nuevo usuario" abre drawer

### F9.2 — Crear usuario (en drawer)
- Nombre, email, contraseña temporal, rol

### F9.3 — Editar / desactivar usuario
- Cambiar nombre, rol o estado activo
- No se eliminan, solo se desactivan

---

## MÓDULO 10: Generación de documentos

### F10.1 — Documento por pedido (para cliente)
- Desde detalle del pedido
- Contenido: número, fecha, datos del cliente, productos, precios, total
- Formato: vista imprimible / PDF

### F10.2 — Compartir factura por WhatsApp (JPG)
- Genera la factura como imagen JPG (html2canvas sobre `FacturaCanvas`)
- Mobile con Web Share API: selector nativo de apps
- Desktop: descarga JPG + abre WhatsApp Web con número del cliente (`wa.me/54[telefono]`)
- Loading state en el botón: "Generando…"
- Si falla: toast de error

---

## MÓDULO 11: Egresos (Admin)

### F11.1 — Listado de egresos
- Tabla: Fecha · Categoría · Concepto · Registrado por · Monto · Acciones
- Filtro por mes/año (default: mes actual) y por categoría
- Total del período visible arriba
- Botón "+ Agregar egreso" abre drawer

### F11.2 — Registrar / editar egreso (drawer)
- Fecha (obligatorio, default hoy)
- Categoría (obligatorio): sueldos · alquiler · droguería · gráfica · packaging · luz · otros
- Concepto (texto libre, obligatorio)
- Monto (numérico, obligatorio)
- Registrado por (select usuarios activos, default usuario actual)

### F11.3 — Eliminar egreso
- Confirmación antes de borrar definitivamente
- No hay soft delete

---

## MÓDULO 12: Notificaciones (fuera del MVP)
Post-MVP. Web Push API.
