# 03 — Flujo de Estados del Pedido

## Ciclo de vida

```
[BORRADOR] ──► [CONFIRMADO] ──► [EN PRODUCCIÓN] ──► [LISTO REPARTO] ──► [EN REPARTO] ──► [CERRADO]
                                                                               │
                                                                               └──► [ENTREGA FALLIDA] ──► [LISTO REPARTO]
                    │
               [ANULADO] (desde cualquier estado excepto CERRADO, solo Admin)
```

El Admin puede hacer override de cualquier transición desde el dashboard. En el uso normal, `borrador`→`confirmado`→`en_produccion` los maneja el Admin al crear/confirmar el pedido; `en_produccion`→`listo_reparto` lo hace el rol Producción; `listo_reparto`→`en_reparto`→`cerrado`/`entrega_fallida` lo hace el rol Repartidor. Ver `02_roles_y_permisos.md` para el detalle por rol.

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
- **Acciones:** Marcar como "Listo para reparto" (Admin).
- **Visible en:** Vista Producción del Admin.

### `listo_reparto`
- **Quién lo establece:** Admin.
- **Qué significa:** Pedido armado, listo para salir.
- **Acciones:** Marcar como "En reparto" (Admin).
- **Visible en:** Vista Reparto del Admin.

### `en_reparto`
- **Quién lo establece:** Admin.
- **Qué significa:** Pedido en camino al cliente.
- **Acciones:** Cerrar pedido con cobro, o registrar entrega fallida (Admin).
- **Visible en:** Vista Reparto del Admin.

### `cerrado`
- **Quién lo establece:** Admin.
- **Qué significa:** Pedido entregado y cobro registrado. Estado final.
- **Campos obligatorios al cerrar:**
  - `forma_cobro`: efectivo / transferencia / pendiente
  - `monto_cobrado`: numérico (obligatorio si forma ≠ pendiente)
  - `estado_pago`: se deriva automáticamente de `forma_cobro`
- **Acciones disponibles:** Admin puede editar cobro (forma_cobro, monto_cobrado, fecha_cobro).
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
- **Quién lo establece:** Admin.
- **Qué significa:** No se pudo entregar. No es estado final.
- **Campos:** Motivo (texto libre).
- **Acciones:** Admin puede re-enviar a "Listo para reparto" para reagendar.

### `anulado`
- **Quién lo establece:** Solo Admin.
- **Desde qué estados:** Cualquiera excepto `cerrado`.
- **Campos:** Motivo de anulación (obligatorio).
- **Nota:** Queda en historial pero no aparece en vistas operativas.

---

## Reglas del flujo

1. Los estados avanzan en orden. El Admin puede hacer override desde cualquier estado.
2. Cada cambio registra: estado anterior, estado nuevo, usuario, timestamp en `pedido_historial`.
3. Un pedido `cerrado` solo permite editar campos de cobro. No puede anularse ni retroceder.
4. Usar siempre la RPC `cambiar_estado_pedido` para garantizar atomicidad (pedidos + historial en una sola transacción).

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
