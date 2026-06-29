# 01 — Contexto y Visión del Proyecto

## Nombre del proyecto
> **Burbuja Limpieza Superpoderosa — Burbuja Gestión**

## Descripción general
Sistema interno de gestión de pedidos para una empresa de fabricación y distribución de productos de limpieza. PWA centralizada que permite registrar, seguir y cerrar pedidos en tiempo real, desde el alta hasta el cobro.

Reemplaza el flujo manual actual: cuadernos → foto → WhatsApp → otro cuaderno.

## Problema que resuelve
- Doble y triple registro de la misma información
- Imposibilidad de ver el estado real de un pedido en cualquier momento
- Cierres de venta sin trazabilidad ni registro centralizado
- Falta de visibilidad sobre margen de ganancia por pedido y período

## Objetivo del MVP
Digitalizar el ciclo de vida completo de un pedido, desde su registro inicial hasta la producción, el reparto, el cobro y el cierre — con visibilidad total para el rol Admin y un espacio de trabajo propio para Producción y Reparto.

## Alcance del MVP

### Incluido
- Registro de pedidos con productos, cantidades y precios snapshot
- Flujo de estados: Borrador → Confirmado → En producción → Listo para reparto → En reparto → Cerrado (con Entrega fallida y Anulado como ramas)
- Cuatro roles activos: Administración (`admin`/`superadmin`), Producción, Repartidor — cada uno con login y espacio propio
- Panel de control (Admin) con vista global, KPIs de ventas y KPI de margen bruto
- Cierre de venta con registro de forma de pago (efectivo / transferencia / pendiente) — lo hace el rol Repartidor o el Admin
- ABM de productos y clientes (Admin)
- Campo `costo_produccion` por producto para cálculo de margen
- Generación de documento por pedido (tipo factura para el cliente)
- Compartir factura por WhatsApp (JPG)
- Módulo de egresos con categorías
- Funcionalidad offline (IndexedDB) para el rol Repartidor: encola acciones sin conexión y sincroniza al volver online

### Fuera del alcance (MVP)
- Gestión de stock de materias primas
- Facturación electrónica / integración AFIP
- Contabilidad o reportes financieros avanzados
- Integración con sistemas externos
- App móvil nativa (es PWA instalable desde Chrome)
- Notificaciones push (post-MVP)
- Asignación de pedido a un repartidor específico (hoy cualquier cuenta `repartidor` ve y opera toda la cola)

## Usuarios del sistema

| Rol | Dispositivo principal | Contexto de uso |
|---|---|---|
| Administración (`admin`/`superadmin`) | Celular Android / notebook | Oficina y campo, siempre con conexión |
| Producción | Tablet / celular en planta | Planta, conexión estable, sin precios |
| Repartidor | Celular Android en la calle | Campo, conexión intermitente — soporte offline |

---

## Identidad visual

| Token | HEX | Uso |
|---|---|---|
| primary | `#3DD6B5` | Verde agua — marca, botones principales, acento dominante |
| primary-deep | `#28B99A` | Verde agua oscuro — hover, textos sobre fondo claro |
| primary-soft | `#E8FAF6` | Verde agua suave — fondos activos, badges, highlights |
| sky | `#7EB8E8` | Celeste — acento secundario, gráficos, variantes |
| sky-soft | `#EBF5FF` | Celeste suave — fondos alternativos |
| surface | `#F5F7F9` | Fondo general de la app |
| card | `#FFFFFF` | Fondo de cards |
| ink | `#1C1C1E` | Texto principal |
| ink-mid | `#3A3A3C` | Texto secundario oscuro |
| muted | `#8E8E93` | Texto terciario, placeholders |
| border | `#E5E5EA` | Bordes suaves |
| error | `#F05252` | Errores y estados destructivos |
| error-bg | `#FEF2F2` | Fondo error |
| success | `#28B99A` | Confirmaciones (usar primary-deep) |
| warning | `#C47B00` | Alertas |
| warning-bg | `#FFFDE7` | Fondo advertencia |

**Tipografía:** Inter (Google Fonts) — pesos 400 / 500 / 600 / 700 / 800 / 900.

**Iconografía:** Lucide React exclusivamente. Cero emojis en la UI.

**Estética general:** limpia, fresca, redondeada. Sidebar blanco. Cards con sombra mínima y `border-radius: 20px`. Espaciado generoso. La interfaz debe "respirar".

---

## Logo

Archivo: `Logo_sin_fondo_negro.png` (512×512px mínimo para PWA).

- Tipografía redondeada, letras en verde agua (`#3DD6B5`)
- La "o" de "burbuja" en celeste (`#7EB8E8`) con forma de burbuja
- Tagline: "LIMPIEZA SUPERPODEROSA" en negro

En el sidebar: marca con iniciales "Bu" sobre fondo degradado `#3DD6B5 → #7EB8E8`, `border-radius: 12px`, 36×36px.

---

## Visión a futuro (post-MVP)
- Activación de roles `produccion` y `repartidor` con sus vistas ya construidas
- Funcionalidad offline para el Repartidor
- Múltiples usuarios Admin
- Gestión de stock de insumos
- Reportes de ventas y rendimiento exportables
- Integración WhatsApp automática
- Facturación electrónica (AFIP)
- Notificaciones push (Web Push API)
