-- ═══════════════════════════════════════════════════════════════════════════
-- BURBUJA — cierres/pagos idempotentes + 11 pagos duplicados
-- ⚠ NO APLICADO. Revisar y ejecutar en Supabase → SQL Editor, en orden.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hallazgos (auditoría 2026-10-27, confirmado por Facu como error de doble toque
-- cuando la app no se refrescaba):
--
-- A. Doble CIERRE (cerrar_pedido no rechazaba un pedido ya cerrado):
--    P-00024, P-00108, P-00135, P-00141. Pago duplicado; monto_cobrado bien.
--
-- B. Doble REGISTRO DE PAGO (registrar_pago no rechazaba un pedido ya cobrado):
--    P-00006, P-00043, P-00055, P-00082, P-00113, P-00123 (Mala Pinta) y P-00012.
--    Pago duplicado y monto_cobrado al DOBLE.
--
--    En los 11, quitando el pago repetido la suma queda EXACTAMENTE en el total.
--    "Total cobrado" del Dashboard: $724.900 de más
--    (jul $123.400 · ago $267.000 · sep $312.500 · oct $22.000).
--
-- C. cerrar_pedido calculaba monto_cobrado solo con los pagos de esa llamada
--    (ignoraba pagos previos). Hoy la UI no llega a ese caso; se corrige igual.
--
-- Parte 1 corrige las funciones. Parte 2 borra los 11 pagos con backup y
-- recalcula monto_cobrado / estado_pago. Correr la parte 1 primero.

-- ─── PARTE 1: funciones ─────────────────────────────────────────────────────
-- Mismas firmas que Fase 7a (no rompe la PWA desplegada).

begin;

-- cerrar_pedido: + rechaza 'cerrado'/'anulado'; monto_cobrado = TODOS los pagos
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

  -- Doble toque / reintento: el segundo cierre no hace nada
  if v_estado_anterior in ('cerrado', 'anulado') then
    raise exception 'El pedido ya está %', v_estado_anterior;
  end if;

  if v_rol = 'repartidor'
     and v_estado_anterior not in ('listo_reparto', 'en_reparto', 'entrega_fallida') then
    raise exception 'El repartidor no puede cerrar un pedido en estado %', v_estado_anterior;
  end if;

  for pago in select * from jsonb_array_elements(p_pagos) loop
    insert into pedido_pagos (pedido_id, forma_pago, monto, fecha_pago)
    values (
      p_pedido_id,
      pago->>'forma_pago',
      (pago->>'monto')::numeric,
      coalesce((pago->>'fecha_pago')::date, public.hoy_local())
    );
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

-- registrar_pago: + rechaza si el pedido ya está cobrado del todo
create or replace function public.registrar_pago(
  p_pedido_id  uuid,
  p_usuario_id uuid,                     -- ignorado (compatibilidad)
  p_forma_pago text,
  p_monto      numeric,
  p_fecha_pago date default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol          text := public._rol_actual();
  v_total_pedido numeric;
  v_pagado_antes numeric;
  v_total_pagado numeric;
  v_estado_pago  text;
begin
  if v_rol is null or v_rol not in ('admin', 'superadmin') then
    raise exception 'El rol % no puede registrar pagos', coalesce(v_rol, '(sin rol)');
  end if;

  select coalesce(total_manual, total_calculado)
  into   v_total_pedido
  from   pedidos where id = p_pedido_id
  for update;                            -- serializa dos toques simultáneos

  if not found then
    raise exception 'Pedido no encontrado: %', p_pedido_id;
  end if;

  select coalesce(sum(monto), 0) into v_pagado_antes
  from   pedido_pagos where pedido_id = p_pedido_id;

  -- Doble toque: el segundo pago llega con el pedido ya cobrado
  if v_pagado_antes >= v_total_pedido then
    raise exception 'El pedido ya está cobrado ($% de $%)', v_pagado_antes, v_total_pedido;
  end if;

  insert into pedido_pagos (pedido_id, forma_pago, monto, fecha_pago)
  values (p_pedido_id, p_forma_pago, p_monto, coalesce(p_fecha_pago, public.hoy_local()));

  v_total_pagado := v_pagado_antes + p_monto;
  v_estado_pago  := case when v_total_pagado >= v_total_pedido then 'cobrado' else 'pendiente' end;

  update pedidos
  set estado_pago   = v_estado_pago,
      monto_cobrado = v_total_pagado,
      updated_at    = now()
  where id = p_pedido_id;
end;
$function$;

revoke all     on function public.cerrar_pedido(uuid, uuid, jsonb, text)          from public, anon;
revoke all     on function public.registrar_pago(uuid, uuid, text, numeric, date) from public, anon;
grant  execute on function public.cerrar_pedido(uuid, uuid, jsonb, text)          to authenticated;
grant  execute on function public.registrar_pago(uuid, uuid, text, numeric, date) to authenticated;

commit;

-- ─── PARTE 2: pagos duplicados ──────────────────────────────────────────────
-- Criterio: en un pedido cerrado, un pago idéntico (monto, forma_pago,
-- fecha_pago) a otro anterior del mismo pedido, cargado ≤ 2 minutos después.
-- Se borra el POSTERIOR.

-- 2a. VISTA PREVIA — esperado: 11 filas
--     P-00006, 12, 24, 43, 55, 82, 108, 113, 123, 135, 141
--     y en TODAS: suma_sin_duplicado = total_pedido
select pd.numero, dup.id as pago_a_borrar, dup.monto, dup.forma_pago, dup.fecha_pago,
       coalesce(pd.total_manual, pd.total_calculado) as total_pedido,
       pd.monto_cobrado as monto_cobrado_hoy,
       (select sum(x.monto) from pedido_pagos x where x.pedido_id = pd.id) - dup.monto as suma_sin_duplicado,
       dup.created_at - orig.created_at as diferencia
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

-- 2b. BORRADO con backup + recálculo (correr solo si 2a dio lo esperado)
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

select count(*) as respaldados from public._backup_pagos_duplicados_20261027;  -- esperado: 11

delete from pedido_pagos p
using public._backup_pagos_duplicados_20261027 b
where p.id = b.id;

-- monto_cobrado / estado_pago desde los pagos que quedan
update pedidos pd
set monto_cobrado = s.suma,
    estado_pago   = case when s.suma >= coalesce(pd.total_manual, pd.total_calculado)
                         then 'cobrado' else 'pendiente' end,
    updated_at    = now()
from (
  select pp.pedido_id, sum(pp.monto) as suma
  from pedido_pagos pp
  where pp.pedido_id in (select distinct pedido_id from public._backup_pagos_duplicados_20261027)
  group by pp.pedido_id
) s
where pd.id = s.pedido_id;

commit;

-- 2c. VERIFICACIÓN — esperado: 0 filas
--     (ningún pedido cerrado con pagos ≠ monto_cobrado, ni cobrado de más)
select pd.numero, pd.monto_cobrado,
       coalesce(sum(pp.monto), 0) as suma_pagos,
       coalesce(pd.total_manual, pd.total_calculado) as total
from pedidos pd
left join pedido_pagos pp on pp.pedido_id = pd.id
where pd.estado = 'cerrado'
group by pd.id, pd.numero, pd.monto_cobrado, pd.total_manual, pd.total_calculado
having coalesce(sum(pp.monto), 0) <> coalesce(pd.monto_cobrado, 0)
    or coalesce(sum(pp.monto), 0) > coalesce(pd.total_manual, pd.total_calculado)
order by pd.numero;

-- ─── Secuencia de pedidos.numero (prueba del 2026-10-27) ────────────────────
-- El pedido de prueba P-00173 se borró. Verificado 2026-10-27: max(numero) = 172.
-- Si sigue en 172, esto evita el salto (el próximo será P-00173). Si ya hay un
-- pedido 173 o mayor, NO correrlo.
-- select setval(pg_get_serial_sequence('public.pedidos', 'numero'), (select max(numero) from public.pedidos));
