# 03 — Flujo de Estados del Pedido

## Ciclo de vida

```
[BORRADOR] ──► [CONFIRMADO] ──► [EN PRODUCCIÓN] ──► [LISTO REPARTO] ──► [EN REPARTO] ──► [CERRADO]
                                                            │                                  ▲
                                                            └──────────────────────────────────┘
                                                              atajo Admin (panel /admin/pedidos):
                                                              "Registrar entrega" cierra directo,
                                                              sin pasar por EN REPARTO
                                                            │
                                                            └──► [ENTREGA FALLIDA] ──► [LISTO REPARTO]
                    │
               [ANULADO] (desde cualquier estado excepto CERRADO, solo Admin)
```

El Admin puede hacer override de cualquier transición desde el dashboard. En el uso normal operativo (Producción/Repartidor), `borrador`→`confirmado`→`en_produccion` los maneja el Admin al crear/confirmar el pedido; `en_produccion`→`listo_reparto` lo hace el rol Producción; `listo_reparto`→`en_reparto`→`cerrado`/`entrega_fallida` lo hace el rol Repartidor desde su propia vista (`/repartidor`) — este camino no cambió.

Desde el panel de Admin (`/admin/pedidos`), la acción rápida de un pedido en `listo_reparto` es **"Registrar entrega"**: abre el detalle con el formulario de cobro y cierra el pedido directo a `cerrado`, **sin pasar por `en_reparto`**. Es un atajo administrativo (para cuando el Admin registra la entrega/cobro manualmente, sin que el pedido haya pasado por el circuito del Repartidor); `en_reparto` sigue existiendo y el Admin puede seguir enviando un pedido ahí como override manual si quiere mantener ese paso intermedio.

Cada transición registra: estado anterior, estado nuevo, usuario, timestamp.

---

## Descripción de cada estado

### `borrador`
- **Quién lo crea:** Admin
- **Qué significa:** Pedido iniciado, puede estar incompleto.
- **Acciones disponibles:** Editar, confirmar, anular.

### `confirmado`
- **Quién lo establece:** Admin al completar el pedido.
- **Qué significa:** Pedido completo, listo para producción.
- **Acciones:** Enviar a producción, editar, anular.

### `en_produccion`
- **Quién lo establece:** Admin (al confirmar pasa automáticamente).
- **Qué significa:** El pedido está siendo fabricado/armado.
- **Acciones:** Marcar como "Listo para reparto" (Admin), editar pedido (Admin).
- **Visible en:** Vista Producción del Admin.

### `listo_reparto`
- **Quién lo establece:** Producción (o Admin).
- **Qué significa:** Pedido armado, listo para salir.
- **Acciones:**
  - Rol Repartidor (vista `/repartidor`): marcar "En reparto" → pasa a `en_reparto`.
  - Panel Admin (`/admin/pedidos`): acción rápida **"Registrar entrega"** → abre el cobro y cierra directo a `cerrado` (atajo, salta `en_reparto`). El Admin también puede, como override manual, mandarlo a `en_reparto` igual que el Repartidor.
  - Editar pedido (Admin).
- **Visible en:** Vista Reparto del Admin y del Repartidor.

### `en_reparto`
- **Quién lo establece:** Rol Repartidor (o Admin como override manual).
- **Qué significa:** Pedido en camino al cliente. Sigue siendo el paso real que usa el Repartidor en su propia vista; para el Admin es opcional (ver atajo en `listo_reparto`).
- **Acciones:** Cerrar pedido con cobro, registrar entrega fallida, editar pedido (Admin).
- **Visible en:** Vista Reparto del Admin y del Repartidor.

### `cerrado`
- **Quién lo establece:** Admin.
- **Qué significa:** Pedido entregado y cobro registrado. Estado final.
- **Campos obligatorios al cerrar:**
  - `forma_cobro`: efectivo / transferencia / pendiente
  - `monto_cobrado`: numérico (obligatorio si forma ≠ pendiente)
  - `estado_pago`: se deriva automáticamente de `forma_cobro`
- **Acciones disponibles:**
  - Admin puede editar cobro (forma_cobro, monto_cobrado, fecha_cobro) siempre, sin importar `estado_pago`.
  - Si `estado_pago = 'pendiente'`, Admin también puede editar el pedido completo (cliente, ítems, cantidades, precios, notas, fecha de producción) desde "Editar pedido". El total se recalcula y el dashboard/KPIs se refrescan automáticamente al guardar.
  - Si `estado_pago = 'cobrado'`, el pedido ya no se puede editar (solo queda el editor de cobro de arriba) — evita alterar un total ya facturado/cobrado.
- **No se puede anular ni retroceder.**

#### Relación `fecha_cobro` / `estado_pago`

| forma_cobro | estado_pago | fecha_cobro |
|---|---|---|
| efectivo / transferencia | cobrado | fecha seleccionada al cerrar |
| pendiente | pendiente | null |

- `fecha_cobro` = fecha en que ingresó el dinero (no la fecha del pedido).
- KPIs de cobros filtran por `fecha_cobro`. KPIs de pedidos filtran por `fecha_produccion`.
- Pedidos con `estado_pago = 'pendiente'` tienen `fecha_cobro = null` y no aparecen en KPIs de cobros hasta que se registre el cobro.
- Al editar cobro en pedido cerrado, `estado_pago` se recalcula automáticamente.

### `entrega_fallida`
- **Quién lo establece:** Admin (o Repartidor desde su vista).
- **Qué significa:** No se pudo entregar. No es estado final.
- **Campos:** Motivo (texto libre).
- **Acciones:** Admin puede re-enviar a "Listo para reparto" para reagendar, o editar el pedido.

### `anulado`
- **Quién lo establece:** Solo Admin.
- **Desde qué estados:** Cualquiera excepto `cerrado`.
- **Campos:** Motivo de anulación (obligatorio).
- **Nota:** Queda en historial pero no aparece en vistas operativas.

---

## Reglas del flujo

1. Los estados avanzan en orden. El Admin puede hacer override desde cualquier estado.
2. Cada cambio registra: estado anterior, estado nuevo, usuario, timestamp en `pedido_historial`.
3. Desde el panel de Admin, `listo_reparto` puede pasar directo a `cerrado` ("Registrar entrega"), sin pasar por `en_reparto`. El circuito real del Repartidor (`listo_reparto` → `en_reparto` → `cerrado`/`entrega_fallida`) no cambia — sigue validado por rol en la RPC `cerrar_pedido`/`cambiar_estado_pedido`.
4. **Edición de pedidos (solo Admin):** disponible en cualquier estado excepto `anulado`. En `cerrado`, solo mientras `estado_pago = 'pendiente'` — una vez cobrado, el pedido queda fijo y solo se puede editar el cobro (forma, monto, fecha).
5. Un pedido `cerrado` con `estado_pago = 'cobrado'` no puede anularse, retroceder ni editarse (salvo el cobro).
6. Usar siempre las RPCs `cambiar_estado_pedido` / `cerrar_pedido` para garantizar atomicidad (pedidos + historial en una sola transacción).

---

## Colores por estado (UI)

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

**Regla:** usar SIEMPRE estos valores exactos con inline styles. No crear clases Tailwind para estados.
**Regla:** nunca depender solo del color — siempre acompañar con texto del estado.

Badge: `font-size: 10px, font-weight: 700, padding: 3px 9px, border-radius: 99px`
