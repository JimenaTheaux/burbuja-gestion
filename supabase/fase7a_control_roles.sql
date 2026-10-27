-- ═══════════════════════════════════════════════════════════════════════════
-- BURBUJA — Fase 7a: control de rol en RPCs + auth.uid() en el historial
-- ⚠ NO APLICADO. Revisar y ejecutar en Supabase → SQL Editor.
-- Re-ejecutable: CREATE OR REPLACE con las MISMAS firmas, DROP ... IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Compatibilidad con la PWA ya desplegada (antes del push del frontend):
--   - Firmas idénticas: cerrar_pedido(uuid,uuid,jsonb,text),
--     registrar_pago(uuid,uuid,text,numeric,date),
--     cambiar_estado_pedido(uuid,text,text,uuid,text),
--     anular_pedido(uuid,text,text,uuid).
--   - p_usuario_id se sigue aceptando pero se IGNORA: el historial registra
--     auth.uid() (el usuario real de la sesión).
--   - Admin/superadmin: mismo comportamiento que hoy.
--   - Lo único que cambia es que se rechaza a quien no tiene el rol, está
--     desactivado o no tiene perfil.
--
-- Hueco que también se cierra: `IF v_rol NOT IN (...)` con v_rol NULL da NULL
-- y NO entra al IF → un usuario sin perfil pasaba el chequeo (anular_pedido,
-- get_all_perfiles). Todos los chequeos usan ahora `v_rol IS NULL OR ...`.

-- ─── 0. PRE-CHEQUEO (correr ANTES y comparar con este archivo) ─────────────
-- cambiar_estado_pedido y anular_pedido se reescriben a partir de
-- supabase/rpcs_and_indexes.sql. Si en producción tienen lógica distinta,
-- avisar antes de ejecutar el resto.
--
-- select p.oid::regprocedure as funcion, pg_get_functiondef(p.oid) as definicion
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and p.proname in ('_rol_actual', 'cambiar_estado_pedido', 'anular_pedido',
--                     'get_all_perfiles', 'get_dashboard_stats', 'cerrar_pedido', 'registrar_pago')
-- order by p.proname, p.oid::regprocedure::text;

begin;

-- ─── 1. _rol_actual: NULL si el perfil está desactivado ─────────────────────
-- Todas las RPCs que lo usan dejan afuera a usuarios dados de baja aunque
-- todavía tengan una sesión válida.
create or replace function public._rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol::text from perfiles where id = auth.uid() and activo is true
$$;

-- ─── 2. cambiar_estado_pedido: historial con auth.uid() ─────────────────────
create or replace function public.cambiar_estado_pedido(
  p_pedido_id       uuid,
  p_estado_nuevo    text,
  p_estado_anterior text,
  p_usuario_id      uuid  default null,   -- ignorado (compatibilidad)
  p_notas           text  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public._rol_actual();
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  if v_rol not in ('admin', 'superadmin') then
    if not (
      (v_rol = 'produccion' and p_estado_anterior = 'en_produccion' and p_estado_nuevo = 'listo_reparto')
      or (v_rol = 'repartidor' and p_estado_anterior = 'listo_reparto' and p_estado_nuevo = 'en_reparto')
      or (v_rol = 'repartidor' and p_estado_anterior = 'en_reparto'    and p_estado_nuevo = 'entrega_fallida')
      or (v_rol = 'repartidor' and p_estado_anterior = 'en_produccion' and p_estado_nuevo = 'en_reparto')
    ) then
      raise exception 'El rol % no puede pasar un pedido de % a %', v_rol, p_estado_anterior, p_estado_nuevo;
    end if;
  end if;

  update pedidos
  set estado     = p_estado_nuevo::estado_pedido,
      updated_at = now()
  where id = p_pedido_id;

  if not found then
    raise exception 'Pedido % no encontrado', p_pedido_id;
  end if;

  insert into pedido_historial (
    pedido_id, estado_anterior, estado_nuevo, usuario_id, notas, created_at
  ) values (
    p_pedido_id,
    case when p_estado_anterior is not null then p_estado_anterior::estado_pedido else null end,
    p_estado_nuevo::estado_pedido,
    auth.uid(),
    p_notas,
    now()
  );
end;
$$;

-- ─── 3. anular_pedido: chequeo NULL-safe + auth.uid() ───────────────────────
create or replace function public.anular_pedido(
  p_pedido_id       uuid,
  p_estado_anterior text,
  p_motivo          text,
  p_usuario_id      uuid default null    -- ignorado (compatibilidad)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public._rol_actual();
begin
  if v_rol is null or v_rol not in ('admin', 'superadmin') then
    raise exception 'El rol % no puede anular pedidos', coalesce(v_rol, '(sin rol)');
  end if;

  if p_estado_anterior = 'cerrado' then
    raise exception 'No se puede anular un pedido cerrado';
  end if;

  if p_estado_anterior = 'anulado' then
    raise exception 'El pedido ya está anulado';
  end if;

  update pedidos
  set estado           = 'anulado'::estado_pedido,
      motivo_anulacion = p_motivo,
      updated_at       = now()
  where id = p_pedido_id;

  if not found then
    raise exception 'Pedido % no encontrado', p_pedido_id;
  end if;

  insert into pedido_historial (
    pedido_id, estado_anterior, estado_nuevo, usuario_id, notas, created_at
  ) values (
    p_pedido_id,
    p_estado_anterior::estado_pedido,
    'anulado'::estado_pedido,
    auth.uid(),
    p_motivo,
    now()
  );
end;
$$;

-- ─── 4. registrar_pago: solo admin / superadmin ─────────────────────────────
-- Base: versión aplicada 2026-10-26 (fecha local). Solo se agrega el chequeo.
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
  v_total_pagado numeric;
  v_estado_pago  text;
begin
  if v_rol is null or v_rol not in ('admin', 'superadmin') then
    raise exception 'El rol % no puede registrar pagos', coalesce(v_rol, '(sin rol)');
  end if;

  select coalesce(total_manual, total_calculado)
  into   v_total_pedido
  from   pedidos where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado: %', p_pedido_id;
  end if;

  insert into pedido_pagos (pedido_id, forma_pago, monto, fecha_pago)
  values (p_pedido_id, p_forma_pago, p_monto, coalesce(p_fecha_pago, public.hoy_local()));

  select coalesce(sum(monto), 0)
  into   v_total_pagado
  from   pedido_pagos
  where  pedido_id = p_pedido_id;

  v_estado_pago := case when v_total_pagado >= v_total_pedido then 'cobrado' else 'pendiente' end;

  update pedidos
  set estado_pago   = v_estado_pago,
      monto_cobrado = v_total_pagado,
      updated_at    = now()
  where id = p_pedido_id;
end;
$function$;

-- ─── 5. cerrar_pedido (jsonb): rol + estado para repartidor + auth.uid() ────
-- Base: versión aplicada 2026-10-26 (fecha local).
--   admin / superadmin: sin restricción de estado (como hoy).
--   repartidor: solo pedidos en listo_reparto, en_reparto o entrega_fallida.
--     SIN chequeo de fecha: un cierre encolado offline puede sincronizarse
--     al día siguiente y la cola descarta lo que falla (se perdería el cobro).
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

  if v_rol = 'repartidor'
     and v_estado_anterior not in ('listo_reparto', 'en_reparto', 'entrega_fallida') then
    raise exception 'El repartidor no puede cerrar un pedido en estado %', v_estado_anterior;
  end if;

  v_total_pagado := 0;
  for pago in select * from jsonb_array_elements(p_pagos) loop
    v_total_pagado := v_total_pagado + (pago->>'monto')::numeric;
  end loop;

  for pago in select * from jsonb_array_elements(p_pagos) loop
    insert into pedido_pagos (pedido_id, forma_pago, monto, fecha_pago)
    values (
      p_pedido_id,
      pago->>'forma_pago',
      (pago->>'monto')::numeric,
      coalesce((pago->>'fecha_pago')::date, public.hoy_local())
    );
  end loop;

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

-- ─── 6. get_all_perfiles: chequeo NULL-safe (se borra en 7b) ────────────────
create or replace function public.get_all_perfiles()
returns table (
  id         uuid,
  nombre     text,
  rol        text,
  activo     boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := public._rol_actual();
begin
  if v_rol is null or v_rol not in ('admin', 'superadmin') then
    raise exception 'No autorizado';
  end if;

  return query
  select p.id, p.nombre, p.rol, p.activo, p.created_at
  from perfiles p
  order by p.created_at;
end;
$$;

-- ─── 7. Permisos: solo authenticated ────────────────────────────────────────
revoke all     on function public.cambiar_estado_pedido(uuid, text, text, uuid, text)      from public, anon;
revoke all     on function public.anular_pedido(uuid, text, text, uuid)                    from public, anon;
revoke all     on function public.registrar_pago(uuid, uuid, text, numeric, date)         from public, anon;
revoke all     on function public.cerrar_pedido(uuid, uuid, jsonb, text)                   from public, anon;
revoke all     on function public.get_all_perfiles()                                       from public, anon;
grant  execute on function public.cambiar_estado_pedido(uuid, text, text, uuid, text)      to authenticated;
grant  execute on function public.anular_pedido(uuid, text, text, uuid)                    to authenticated;
grant  execute on function public.registrar_pago(uuid, uuid, text, numeric, date)         to authenticated;
grant  execute on function public.cerrar_pedido(uuid, uuid, jsonb, text)                   to authenticated;
grant  execute on function public.get_all_perfiles()                                       to authenticated;

-- ─── 8. Funciones sin uso ───────────────────────────────────────────────────
-- Ninguna se usa desde src/ (verificado 2026-10-26).
drop function if exists public.get_dashboard_stats(date);
drop function if exists public.cerrar_pedido(uuid, text, text, numeric, text, text, date, uuid);

commit;

-- ─── 9. VERIFICACIÓN ────────────────────────────────────────────────────────
-- Esperado: una sola cerrar_pedido (jsonb), ninguna get_dashboard_stats,
-- todas SECURITY DEFINER, sin EXECUTE para anon.
select p.oid::regprocedure                      as funcion,
       p.prosecdef                              as security_definer,
       has_function_privilege('anon',          p.oid, 'execute') as anon_puede,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('_rol_actual', 'cambiar_estado_pedido', 'anular_pedido', 'registrar_pago',
                    'cerrar_pedido', 'get_all_perfiles', 'get_dashboard_stats')
order by p.proname, p.oid::regprocedure::text;

-- Chequeo de los textos: deben aparecer auth.uid() y el control de rol.
select p.proname,
       p.prosrc ilike '%auth.uid()%'          as usa_auth_uid,
       p.prosrc ilike '%v_rol is null%'       as chequeo_null_safe,
       p.prosrc ilike '%activo is true%'      as filtra_inactivos
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('_rol_actual', 'cambiar_estado_pedido', 'anular_pedido',
                    'registrar_pago', 'cerrar_pedido', 'get_all_perfiles')
order by p.proname;
