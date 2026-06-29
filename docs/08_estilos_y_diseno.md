# 08 — Estilos y Diseño (Design System MVP)

## Fuente única de verdad visual
Este archivo se adjunta en CADA prompt a Claude. No inventar estilos fuera de este documento.

---

# PRINCIPIOS DE DISEÑO

- UI **limpia, fresca y que respire** — espaciado generoso, no saturar la pantalla
- **Mobile-first siempre** — diseñar para celular, escalar a desktop
- Jerarquía clara: estado → datos clave → acciones
- Estética redondeada y moderna — `border-radius` generoso en todos los elementos
- Sin gradientes decorativos, sin sombras pesadas
- **Iconos Lucide React exclusivamente** — cero emojis en toda la UI

---

# TOKENS DE DISEÑO

## Colores (tailwind.config.ts)

```typescript
colors: {
  primary:        '#3DD6B5',   // verde agua — marca, botones principales
  'primary-deep': '#28B99A',   // verde agua oscuro — hover, textos
  'primary-soft': '#E8FAF6',   // verde agua suave — fondos activos, badges
  sky:            '#7EB8E8',   // celeste — acento secundario
  'sky-soft':     '#EBF5FF',   // celeste suave — fondos alternativos
  ink:            '#1C1C1E',   // texto principal
  'ink-mid':      '#3A3A3C',   // texto secundario oscuro
  muted:          '#8E8E93',   // texto terciario, placeholders
  surface:        '#F5F7F9',   // fondo general de la app
  card:           '#FFFFFF',   // fondo de cards
  border:         '#E5E5EA',   // bordes suaves
  error:          '#F05252',
  'error-bg':     '#FEF2F2',
  warning:        '#C47B00',
  'warning-bg':   '#FFFDE7',
  'warning-border': '#FDE68A',
}
```

## Estados de pedido — valores exactos e inmutables

| Estado | bg (pill/badge) | color (texto) |
|---|---|---|
| borrador | `#F0F0F0` | `#9A9A9A` |
| confirmado | `#EBF5FF` | `#2B6CB0` |
| en_produccion | `#FFF3E0` | `#E65100` |
| listo_reparto | `#FFFDE7` | `#C47B00` |
| en_reparto | `#EBF5FF` | `#2B6CB0` |
| cerrado | `#E8FAF6` | `#28B99A` |
| entrega_fallida | `#FEF2F2` | `#C0392B` |
| anulado | `#F0F0F0` | `#9A9A9A` |

**Regla:** usar inline styles para estos colores. No crear clases Tailwind para estados.
**Regla:** nunca depender solo del color — siempre acompañar con texto del estado.

---

# TIPOGRAFÍA

Fuente: **Inter** (Google Fonts). Una sola fuente en todo el proyecto.

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

| Uso | CSS |
|---|---|
| Título de página | `font-size: 22px; font-weight: 800; letter-spacing: -0.5px` |
| Subtítulo / card title | `font-size: 13px; font-weight: 700` |
| Texto base | `font-size: 13-14px; font-weight: 400-500` |
| Texto secundario | `font-size: 12px; color: #8E8E93` |
| Label uppercase | `font-size: 9-10px; font-weight: 600-700; text-transform: uppercase; letter-spacing: 0.07-0.1em` |
| KPI grande | `font-size: 26px; font-weight: 800; letter-spacing: -1px` |
| Badge / micro | `font-size: 10px; font-weight: 700` |

---

# COMPONENTES

## Cards

```css
.card {
  background: #ffffff;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s ease;
}
```

Tailwind equivalente:
```
bg-white rounded-[20px] p-5 shadow-sm hover:shadow-md transition-shadow
```

## Cards con borde de estado (pedidos)

```tsx
<div
  className="bg-white rounded-[20px] p-4 shadow-sm hover:shadow-md transition-shadow"
  style={{ borderLeft: `4px solid ${colorDelEstado}` }}
>
```

## Badge de estado

```tsx
<span
  style={{
    backgroundColor: ESTADO_CONFIG[estado].bg,
    color: ESTADO_CONFIG[estado].color,
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: '99px',
    display: 'inline-block',
    whiteSpace: 'nowrap',
  }}
>
  {ESTADO_CONFIG[estado].label}
</span>
```

## Inputs con float label

```css
.form-label {
  position: relative;
}

.form-label .input {
  width: 100%;
  padding: 10px 10px 20px 10px;
  outline: 0;
  border: 1px solid rgba(142, 142, 147, 0.4);
  border-radius: 10px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  transition: border-color 0.15s ease;
  background: #ffffff;
}

.form-label .input:focus {
  border-color: #3DD6B5;
}

.form-label .input:valid {
  border-color: #28B99A;
}

.form-label span {
  position: absolute;
  left: 10px;
  top: 15px;
  color: #8E8E93;
  font-size: 14px;
  cursor: text;
  transition: all 0.15s ease;
  pointer-events: none;
}

.form-label .input:focus + span,
.form-label .input:not(:placeholder-shown) + span {
  top: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #3DD6B5;
}

.form-label .input:valid + span {
  color: #28B99A;
}
```

## Botones

```css
/* Primary */
.btn-primary {
  background: #3DD6B5;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  min-height: 44px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease;
  font-family: 'Inter', sans-serif;
}
.btn-primary:hover { background: #28B99A; }
.btn-primary:active { transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Ghost / Secondary */
.btn-ghost {
  background: transparent;
  border: 1px solid #E5E5EA;
  border-radius: 10px;
  padding: 7px 13px;
  min-height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: #8E8E93;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
  font-family: 'Inter', sans-serif;
}
.btn-ghost:hover { border-color: #3DD6B5; color: #28B99A; }

/* Destructivo */
.btn-danger {
  background: #FEF2F2;
  color: #C0392B;
  border: 1px solid #F05252;
  border-radius: 10px;
  padding: 8px 16px;
  min-height: 44px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
}
.btn-danger:hover { background: #fee2e2; }
```

## Alert / Banner

```tsx
// Alerta de atención (warning)
<div style={{
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: '20px',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
}}>
  <div style={{
    width: 38, height: 38,
    background: '#FEF3C7',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#D97706',
    flexShrink: 0,
  }}>
    <AlertCircle size={18} />
  </div>
  <div>...</div>
</div>
```

## Pulse dot (elemento activo)

```css
.pulse-dot {
  width: 7px;
  height: 7px;
  background: #3DD6B5;
  border-radius: 50%;
  display: inline-block;
  position: relative;
}
.pulse-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #3DD6B5;
  animation: pulseRing 1.5s ease-out infinite;
}
@keyframes pulseRing {
  0%   { transform: scale(1);   opacity: 1; }
  100% { transform: scale(2.8); opacity: 0; }
}
```

---

# LAYOUT

## Sidebar (Admin — desktop)

```
Estado abierto:  width 240px
Estado cerrado:  width 64px (solo íconos, sin texto)
Transición:      width 0.2s ease
Fondo:           #FFFFFF
Borde derecho:   1px solid #E5E5EA
```

```tsx
const { isOpen, toggle } = useSidebar()

<main style={{ marginLeft: isOpen ? '240px' : '64px', transition: 'margin 0.2s ease' }}>
```

**Estructura del sidebar:**
- Logo arriba: marca "Bu" 36×36px, `border-radius: 12px`, degradado `#3DD6B5 → #7EB8E8`
- Al lado del logo (solo abierto): texto "burbuja" `font-weight: 800` + subtexto "Limpieza Superpoderosa" `9px uppercase`
- Secciones con label uppercase `9px`: Principal · Gestión · Vistas operativas
- Nav items abierto: ícono Lucide (15px) + texto `13px font-weight: 500`
- Nav items cerrado: solo ícono, centrado
- Item activo: `background: #E8FAF6, color: #28B99A, font-weight: 600`; ícono en `#28B99A`
- Hover: `background: #F5F7F9, color: #3A3A3C`
- Badge en ítem: `background: #3DD6B5, color: white, 9px, border-radius: 99px`
- Footer: avatar iniciales (degradado teal→sky, 32px, border-radius 10px) + nombre + rol + ícono chevron
- Botón toggle colapsado: en el borde del sidebar, ícono `ChevronLeft` / `ChevronRight`
- **En mobile: sidebar OCULTO** — reemplazado por hamburguesa + bottom nav

## Hamburguesa (mobile — Admin)

```
Posición: topbar, lado izquierdo
Ícono: Menu (lucide, 22px) → X al abrir
Al abrir: overlay oscuro + menú deslizable desde la izquierda (100% alto, 80% ancho máx 320px)
El menú contiene: todas las páginas igual que el sidebar desktop
Fondo menú: #FFFFFF
Cierre: tap en overlay o en X
```

## Bottom nav (mobile — Admin)

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #ffffff;
  border-top: 1px solid #E5E5EA;
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}
```

3 ítems fijos: **Dashboard · Pedidos · Egresos**
Ícono Lucide (20px) + label `10px font-weight: 500`.
Ítem activo: `color: #3DD6B5`. Inactivo: `color: #8E8E93`.

## Topbar

```css
.topbar {
  height: 58px;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #E5E5EA;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 50;
}
```

## Drawer / Sheet lateral (formularios)

```css
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  animation: fadeIn 0.15s ease;
}

.drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 50%;       /* Desktop */
  background: #F5F7F9;
  z-index: 201;
  overflow-y: auto;
  padding: 24px;
  animation: slideIn 0.2s ease;
}

@media (max-width: 768px) {
  .drawer { width: 100%; }
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Regla:** todos los formularios (pedidos, clientes, productos, usuarios, egresos) se abren en este drawer. Nunca páginas nuevas para formularios.

## Área de contenido principal

```css
.main-content {
  min-height: 100vh;
  background: #F5F7F9;
  padding: 28px;
  padding-bottom: 72px; /* espacio bottom nav mobile */
}

@media (max-width: 768px) {
  .main-content {
    padding: 16px;
    padding-bottom: 72px;
  }
}
```

## Sección header

```tsx
// Barra lateral verde + label uppercase
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <div style={{ width: 3, height: 13, background: '#3DD6B5', borderRadius: 99 }} />
  <span style={{ fontSize: 11, fontWeight: 700, color: '#3A3A3C', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
    {titulo}
  </span>
</div>
```

---

# PATRONES POR VISTA

## Dashboard (Admin)
- Page label `10px uppercase` + Heading `22px 800`
- Banner de alerta si hay cobros pendientes
- KPI grid (4 columnas desktop, 2 mobile)
- Gráfico de barras semanal (Chart.js)
- Tablero de estados en card lateral
- Tabla de pedidos recientes con tabs y filtros

## Pedidos (Admin)
- Tabla con columnas: Número · Cliente · Estado · Fecha prod. · Total · →
- Tabs: Todos / En producción / En reparto / Cerrados
- Filtros: search + chips (Hoy / Fecha / Cliente)
- Paginación

## Vista Producción (Admin — página /produccion)
- Sin precios ni totales en ningún lado
- Lista agrupada por fecha de producción
- Botón "Listo para reparto" por pedido (mínimo 44px)
- Panel resumen colapsable (totales por producto)

## Vista Reparto (Admin — página /reparto)
- Cards con: cliente, dirección, total a cobrar (número grande)
- Badge de estado prominente
- Botones de acción por card

---

# UX RULES

- Tap targets mínimo **44px** de altura en mobile
- **Feedback inmediato:** hover, active, loading en toda interacción
- **Estados vacíos obligatorios:** mensaje + ícono Lucide cuando lista vacía
- **Confirmación** antes de acciones destructivas (modal, no `window.confirm()`)
- Errores en lenguaje simple: "No se pudo guardar el pedido, intentá de nuevo."
- **Float labels** en todos los inputs de formulario
- **Drawers** para todos los formularios — no páginas nuevas

---

# ANTI-PATTERNS — nunca hacer esto

- No usar `window.alert()` o `window.confirm()` — siempre componentes de UI
- No abrir formularios en páginas nuevas — siempre drawers
- No usar emojis en ningún lado — siempre íconos Lucide
- No inventar colores de estado — usar la tabla exacta de este documento
- No saturar con colores fuera de la paleta definida
- No mezclar estilos de cards en la misma vista
- No usar más de una fuente (solo Inter)
- No poner más de 4 acciones en una misma card
- No usar sidebar en mobile — hamburguesa + bottom nav
- No mostrar precios en la vista Producción

---

# NAMING DE COMPONENTES

| Componente | Nombre |
|---|---|
| Badge de estado | `BadgeEstado` |
| Card de pedido (tabla row) | `FilaPedido` |
| Card KPI | `CardKPI` |
| Drawer/Sheet lateral | `Drawer` |
| Sidebar colapsable | `Sidebar` |
| Menú hamburguesa mobile | `HamburgerMenu` |
| Input con float label | `FloatInput` |
| Dot animado | `PulseDot` |
| Barra lateral de sección | `SectionTitle` |
| Botón primary | `BtnPrimary` |
| Botón ghost | `BtnGhost` |
| Layout admin | `AdminLayout` |
| Bottom nav mobile | `BottomNav` |
| Banner de alerta | `AlertBanner` |

**Regla:** si un elemento se repite 2 veces → crear componente reutilizable.
