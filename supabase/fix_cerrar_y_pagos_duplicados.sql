-- ═══════════════════════════════════════════════════════════════════════════
-- BURBUJA — cerrar_pedido idempotente + pagos duplicados
-- ⚠ NO APLICADO. Revisar y ejecutar en Supabase → SQL Editor, en orden.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hallazgos (prueba real 2026-10-27 + auditoría de datos):
--
-- A. cerrar_pedido no rechaza un pedido ya cerrado. En 4 pedidos el cierre se
--    ejecutó dos veces con 9–22 s de diferencia (historial "cerrado→cerrado")
--    y el pago quedó DUPLICADO: P-00024 (21/07), P-00108 (02/09), P-00135 (26/09),
--    P-00141 (02/10). "Total cobrado" del Dashboard suma $82.500 de más
--    ($22.000 en octubre). monto_cobrado/estado_pago de esos pedidos están bien.
--
-- B. cerrar_pedido calcula monto_cobrado y estado_pago solo con los pagos de
--    ESA llamada, ignorando pagos ya registrados. Hoy la UI no llega a ese
--    caso (los pagos parciales se registran después de cerrar), pero un pago
--    previo + cierre deja el pedido como 'pendiente' con monto incompleto.
--
-- Parte 1 corrige la función (A y B). Parte 2 borra los 4 pagos duplicados
-- con backup. Correr la parte 1 primero.

-- ─── PARTE 1: cerrar_pedido ─────────────────────────────────────────────────
-- Base: versión Fase 7a (rol + estado para repartidor + auth.uid()). Cambios:
--   + rechaza pedidos 'cerrado' o 'anulado' (idempotente ante doble envío y
--     reintentos de la cola offline; la cola descarta el error y no duplica)
--   + monto_cobrado / estado_pago = suma de TODOS los pagos del pedido
-- Misma firma: no rompe la PWA desplegada.

begin;

create or replace function public.cerrar_pedido(
  p_pedido_id  uuid,
  p_usuario_id uuid,                     -- ignorado (compatibilidad)
  p_pagos      jsonb,
  p_notas      text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol             text := public._rol_actual();
  v_estado_anterior estado_pedido;
  v_total_pedido    numeric;
  v_pagado_ahora    numeric;
  v_total_pagado    numeric;
  v_estado_pago     text;
  pago              jsonb;
begin
  if v_rol is null or v_rol not in ('admin', 'superadmin', 'repartidor') then
    raise exception 'El rol % no puede cerrar pedidos', coalesce(v_rol, '(sin rol)');
  end if;

  select estado, coalesce(total_manual, total_calculado)
  into   v_estado_anterior, v_total_pedido
  from   pedidos
  where  id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado: %', p_pedido_id;
  end if;

  if v_estado_anterior in ('cerrado', 'anulado') then
    raise exception 'El pedido ya está %', v_estado_anterior;
  end if;

  if v_rol = 'repartidor'
     and v_estado_anterior not in ('listo_reparto', 'en_reparto', 'entrega_fallida') then
    raise exception 'El repartidor no puede cerrar un pedido en estado %', v_estado_anterior;
  end if;

  v_pagado_ahora := 0;
  for pago in select * from jsonb_array_elements(p_pagos) loop
    insert into pedido_pagos (pedido_id, forma_pago, monto, fecha_pago)
    values (
      p_pedido_id,
      pago->>'forma_pago',
      (pago->>'monto')::numeric,
      coalesce((pago->>'fecha_pago')::date, public.hoy_local())
    );
    v_pagado_ahora := v_pagado_ahora + (pago->>'monto')::numeric;
  end loop;

  -- Todos los pagos del pedido (incluye los registrados antes del cierre)
  select coalesce(sum(monto), 0) into v_total_pagado
  from   pedido_pagos where pedido_id = p_pedido_id;

  v_estado_pago := case when v_total_pagado >= v_total_pedido then 'cobrado' else 'pendiente' end;

  update pedidos
  set estado        = 'cerrado',
      estado_pago   = v_estado_pago,
      monto_cobrado = v_total_pagado,
      updated_at    = now()
  where id = p_pedido_id;

  insert into pedido_historial (pedido_id, estado_anterior, estado_nuevo, usuario_id, notas)
  values (
    p_pedido_id,
    v_estado_anterior,
    'cerrado',
    auth.uid(),
    coalesce(p_notas, 'Pagado $' || v_total_pagado || ' de $' || v_total_pedido)
  );
end;
$function$;

revoke all     on function public.cerrar_pedido(uuid, uuid, jsonb, text) from public, anon;
grant  execute on function public.cerrar_pedido(uuid, uuid, jsonb, text) to authenticated;

commit;

-- ─── PARTE 2: pagos duplicados ──────────────────────────────────────────────
-- Criterio: en un pedido cerrado, un pago idéntico (monto, forma_pago,
-- fecha_pago) a otro anterior del mismo pedido, cargado ≤ 2 minutos después.
-- Se borra el POSTERIOR. Esperado: 4 filas (P-00024, P-00108, P-00135, P-00141).

-- 2a. VISTA PREVIA (correr primero, revisar que sean exactamente esas 4)
select pd.numero, dup.id as pago_a_borrar, dup.monto, dup.forma_pago, dup.fecha_pago,
       orig.created_at as original_creado, dup.created_at as duplicado_creado
from pedido_pagos dup
join pedido_pagos orig
  on  orig.pedido_id  = dup.pedido_id
  and orig.monto      = dup.monto
  and orig.forma_pago = dup.forma_pago
  and orig.fecha_pago = dup.fecha_pago
  and orig.created_at < dup.created_at
  and dup.created_at - orig.created_at <= interval '2 minutes'
join pedidos pd on pd.id = dup.pedido_id
where pd.estado = 'cerrado'
order by pd.numero;

-- 2b. BORRADO con backup (correr solo si 2a devolvió las 4 filas esperadas)
begin;

create table if not exists public._backup_pagos_duplicados_20261027 as
select dup.*
from pedido_pagos dup
join pedido_pagos orig
  on  orig.pedido_id  = dup.pedido_id
  and orig.monto      = dup.monto
  and orig.forma_pago = dup.forma_pago
  and orig.fecha_pago = dup.fecha_pago
  and orig.created_at < dup.created_at
  and dup.created_at - orig.created_at <= interval '2 minutes'
join pedidos pd on pd.id = dup.pedido_id
where pd.estado = 'cerrado';

alter table public._backup_pagos_duplicados_20261027 enable row level security;
revoke all on public._backup_pagos_duplicados_20261027 from anon, authenticated;

select count(*) as respaldados from public._backup_pagos_duplicados_20261027;  -- esperado: 4

delete from pedido_pagos p
using public._backup_pagos_duplicados_20261027 b
where p.id = b.id;

commit;

-- 2c. VERIFICACIÓN: ningún pedido cerrado con pagos ≠ monto_cobrado
select pd.numero, pd.monto_cobrado, coalesce(sum(pp.monto), 0) as suma_pagos
from pedidos pd
left join pedido_pagos pp on pp.pedido_id = pd.id
where pd.estado = 'cerrado'
group by pd.id, pd.numero, pd.monto_cobrado
having coalesce(sum(pp.monto), 0) <> coalesce(pd.monto_cobrado, 0)
order by pd.numero;   -- esperado: 0 filas

-- ─── Secuencia de pedidos.numero (prueba del 2026-10-27) ────────────────────
-- El pedido de prueba P-00173 se borró. Si NO se creó ningún pedido real
-- después (max(numero) sigue en 172), esto evita el salto de numeración.
-- Si ya existe un pedido 173 o mayor, NO correrlo.
-- select setval(pg_get_serial_sequence('public.pedidos', 'numero'), (select max(numero) from public.pedidos));
