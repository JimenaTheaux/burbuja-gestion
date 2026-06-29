# 09 — Dashboard Admin: estructura y funcionamiento

## Resumen visual

El dashboard tiene cuatro secciones apiladas verticalmente:

```
┌─────────────────────────────────────────────────────┐
│  Topbar: título + filtros de período (desde / hasta) │
├──────────────┬──────────────┬───────────────────────┤
│  Pedidos     │ Total cobrado│  Pend. cobro          │
├──────────────┼──────────────┼───────────────────────┤
│  Costo prod. │ Ganancia neta│                       │
├──────────────┴──────────────┴───────────────────────┤
│  Evolución de ventas  │  Top ventas (tabs)          │
├───────────────────────┴─────────────────────────────┤
│  Resumen quincenal (tabla + botón Exportar Excel)    │
└─────────────────────────────────────────────────────┘
```

---

## Filtros de período

Dos inputs `type="date"` (`desde` / `hasta`) en el topbar.
Por defecto: primer día del mes actual → hoy.

Todas las queries de dinero filtran por `fecha_cobro`.
La query de conteo de pedidos filtra por `fecha_produccion`.
Los pendientes de cobro y de cierre son **globales** (sin filtro de fecha).

---

## KPIs — 5 cards (3 cols desktop / 2 cols mobile)

### Card 1 — Pedidos
- **Valor:** count de pedidos cuya `fecha_produccion` cae dentro del período
- **Subtítulo:** `N pendiente(s) de cierre` (count global de pedidos no cerrados/anulados)
- **Ícono:** `Package` (teal `#28B99A`)
- **Query:** `pedidos` filtrado por `fecha_produccion` en el período

### Card 2 — Total cobrado
- **Valor:** suma de `monto_cobrado` de pedidos `cerrado` + `cobrado` con `fecha_cobro` en el período
- **Subtítulo:** `Ef. $X · Tr. $Y` (desglose por forma de cobro)
- **Ícono:** `Banknote` (sky `#7EB8E8`)

### Card 3 — Pendiente de cobro
- **Valor:** suma de `monto_cobrado` de pedidos `cerrado` + `estado_pago = pendiente` (global, sin filtro de fecha)
- **Subtítulo:** botón `Ver detalle →` que abre el panel lateral `SheetPendientes`
- **Ícono:** `Clock` (warning si hay monto, teal si no)
- **Visual:** fondo `#FFF8F8` + borde rojizo cuando hay pendientes
- **Click:** abre sheet lateral con lista de pedidos pendientes y mini-form para registrar cobro

### Card 4 — Costo de producción
- **Valor:** `suma(cantidad × costo_snapshot)` de todos los ítems de pedidos cobrados del período
- **Subtítulo:** `ventas cobradas del período`
- **Ícono:** `FlaskConical` (sky `#7EB8E8`)
- **Nota:** usa `costo_snapshot` (precio congelado al crear el pedido), no el costo actual del producto

### Card 5 — Ganancia neta
- **Fórmula:** `totalCobrado − totalCostoProducción − totalEgresos`
- **Subtítulo:** `Egresos $X` (monto de egresos del período)
- **Ícono:** `BarChart2`
- **Visual condicional:**
  - Positiva → ícono y valor en `#28B99A`, fondo blanco normal
  - Negativa → ícono y valor en `#F05252`, fondo `#FEF2F2`

---

## Queries y hooks

### `usePedidosPeriodo(inicio, fin)`
```typescript
supabase.from('pedidos')
  .select('id, estado, fecha_produccion')
  .gte('fecha_produccion', inicio)
  .lte('fecha_produccion', fin)
```
Uso: conteo de pedidos de la card 1.

### `usePendientesCierre()`
```typescript
supabase.from('pedidos')
  .select('id')
  .not('estado', 'in', '("cerrado","anulado")')
```
Uso: subtítulo de la card 1 (count global).

### `usePedidosCobradosDetalle(desde, hasta)`
```typescript
supabase.from('pedidos')
  .select(`
    id, numero, monto_cobrado, forma_cobro, fecha_cobro, fecha_produccion,
    pedido_items (
      cantidad, costo_snapshot, precio_unitario,
      productos (
        nombre, fragancia,
        categorias_producto (nombre)
      )
    )
  `)
  .eq('estado', 'cerrado')
  .eq('estado_pago', 'cobrado')
  .gte('fecha_cobro', desde)
  .lte('fecha_cobro', hasta)
```
Uso: totalCobrado, totalEfectivo, totalTransf, totalCostoProducción, top ventas, tabla quincenal.

### `useEgresosDashboard(desde, hasta)`
```typescript
supabase.from('egresos')
  .select('monto, fecha_egreso')
  .gte('fecha_egreso', desde)
  .lte('fecha_egreso', hasta)
```
Uso: totalEgresos para la card Ganancia neta.

### `useEvolucionRango(desde, hasta)`
```typescript
// Trae desde "mes anterior del inicio" hasta "hasta"
supabase.from('pedidos')
  .select('monto_cobrado, fecha_cobro, estado_pago, forma_cobro')
  .eq('estado', 'cerrado')
  .gte('fecha_cobro', mesAnteriorDesde)
  .lte('fecha_cobro', hasta)
```
Uso: gráfico de líneas (período actual vs mes anterior).

### `useDashboard()` (de `src/services/produccion.ts`)
Trae los pendientes de cobro con detalle de cliente e ítems.
Uso: card 3 y panel lateral `SheetPendientes`.

---

## Panel: Evolución de ventas

Gráfico de líneas (Chart.js) con dos series:
- **Período actual** — línea sólida `#3DD6B5`, puntos pequeños
- **Mes anterior** — línea punteada `#E5E5EA`, sin puntos

Eje X: días (si el período ≤ 31 días) o semanas agrupadas de 7 días.
Eje Y: oculto. Tooltip: montos en formato `es-AR`.

---

## Panel: Top ventas (tabs internos)

**Tab Categoría** — top 5 categorías por monto cobrado
```typescript
monto_categoria = suma(cantidad × precio_unitario) de todos los ítems del período
```
Muestra número de orden (badge verde), nombre y monto.

**Tab Producto** — top 5 productos por unidades vendidas
```typescript
cantidad_producto = suma(cantidad) de ítems agrupados por nombre + fragancia
```
Muestra número de orden (badge azul), nombre, fragancia (si tiene) y unidades.

Ambas listas se calculan **solo sobre pedidos cobrados** del período (misma fuente que `usePedidosCobradosDetalle`).

---

## Tabla quincenal

### Lógica de quincenas
El período seleccionado se divide en quincenas de más reciente a más antiguo:
- **Primera quincena del mes:** días 1 al 15
- **Segunda quincena del mes:** días 16 al último día del mes

### Columnas
| Período | Total vendido | Costo producción | Ganancia |
|---------|--------------|-----------------|---------|
| `DD/MM al DD/MM/YYYY` | `suma(monto_cobrado)` | `suma(cantidad × costo_snapshot)` | vendido − costo |

**Fila de totales** al pie: suma del período completo.
Ganancia en verde (`#28B99A`) si positiva, rojo (`#F05252`) si negativa.

### Exportación Excel
Botón "Exportar Excel" genera un `.xlsx` con las mismas filas + totales.
Nombre del archivo: `burbuja-resumen-YYYY-MM.xlsx` (año-mes del inicio del período).
Librería: `xlsx` (SheetJS).

---

## Panel lateral: Pendientes de cobro (`SheetPendientes`)

Se abre desde el botón "Ver detalle →" de la card 3.
Lista cada pedido pendiente con:
- Número de pedido, monto, cliente, fecha de producción
- Botón **Compartir factura** (WhatsApp via hook `useCompartirFactura`)
- Botón **Registrar cobro** → despliega mini-form inline con forma de cobro, monto y fecha

Al confirmar el cobro, el pedido desaparece de la lista y se refresca el dashboard.

---

## Cálculos derivados clave

```typescript
totalCobrado          = sum(monto_cobrado) de pedidosCobrados
totalEfectivo         = sum(monto_cobrado) donde forma_cobro === 'efectivo'
totalTransf           = sum(monto_cobrado) donde forma_cobro === 'transferencia'
totalCostoProduccion  = sum(item.cantidad × item.costo_snapshot) de todos los ítems
totalEgresos          = sum(egreso.monto) del período
gananciaNeta          = totalCobrado − totalCostoProduccion − totalEgresos
montoPendienteCobro   = dashData.pendientes.total  (global)
pendientesCierre      = count de pedidos not in (cerrado, anulado)  (global)
```

---

## Dependencias

| Paquete | Uso |
|---------|-----|
| `chart.js` + `react` bindings | Gráfico de líneas |
| `xlsx` (SheetJS) | Exportación Excel |
| `@tanstack/react-query` | Todas las queries con `keepPreviousData` |
| `lucide-react` | Íconos (Package, Banknote, Clock, FlaskConical, BarChart2, Download) |
| `@supabase/supabase-js` | Queries a la base de datos |

---

## Archivos involucrados

- `src/pages/admin/DashboardPage.tsx` — componente principal (todo en un archivo)
- `src/services/produccion.ts` — exporta `useDashboard()` y tipo `PedidoPendienteCobro`
- `src/services/pedidos.ts` — exporta `useEditarCobro()` y `fetchPedidoDetalle()`
- `src/hooks/useCompartirFactura.ts` — comparte factura por WhatsApp
