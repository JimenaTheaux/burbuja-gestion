-- ═══════════════════════════════════════════════════════════════════════════
-- BURBUJA — RPCs, índices, helpers y permisos (estado de producción)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fuente de verdad del lado servidor. Refleja producción al 2026-10-27:
--   - Fecha local (Argentina)                 aplicado 2026-10-26
--   - Fase 7a: control de rol + auth.uid()     aplicado 2026-10-27
--   - Cierre/pago idempotentes                 aplicado 2026-10-27
--   - supabase/fase7b_limpieza.sql             ⚠ PENDIENTE (drop de
--     get_all_perfiles + revoke de _rol_actual a anon). Este archivo ya NO
--     define get_all_perfiles: correrlo entero no la vuelve a crear.
--
-- Re-ejecutable: CREATE OR REPLACE con las mismas firmas, IF [NOT] EXISTS.
-- Las correcciones de datos de una sola vez están al final, COMENTADAS.
--
-- Historial: antes vivían aparte supabase/fase7a_control_roles.sql y
-- supabase/fix_cerrar_y_pagos_duplicados.sql (ver git log).

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────

create index if not exists idx_pedidos_estado
  on pedidos(estado);

create index if not exists idx_pedidos_fecha_produccion
  on pedidos(fecha_produccion);

create index if not exists idx_pedidos_created_at
  on pedidos(created_at desc);

-- Query del repartidor (fecha + estado)
create index if not exists idx_pedidos_fecha_estado
  on pedidos(fecha_produccion, estado)
  where estado in ('en_produccion', 'listo_reparto', 'en_reparto');

-- Nota: no se puede indexar DATE(created_at) porque DATE() es STABLE (timezone-dependent).
-- idx_pedidos_created_at (created_at desc) ya cubre las queries de rango.

create index if not exists idx_pedido_historial_pedido_id
  on pedido_historial(pedido_id, created_at);

create index if not exists idx_pedido_items_pedido_id
  on pedido_items(pedido_id);

create index if not exists idx_perfiles_id
  on perfiles(id);

create index if not exists idx_clientes_nombre
  on clientes(nombre text_pattern_ops);   -- acelera ilike '%texto%'

-- Listado paginado de /admin/pedidos (filtro por estado + orden created_at desc)
create index if not exists pedidos_estado_created_idx
  on pedidos(estado, created_at desc);

-- Rangos de pagos del dashboard (pedido_pagos.fecha_pago)
create index if not exists pedido_pagos_fecha_idx
  on pedido_pagos(fecha_pago);


-- ─── Versiones previas / sin uso ────────────────────────────────────────────
-- Firmas viejas: CREATE OR REPLACE con otros parámetros crearía un overload.
-- Ninguna se usa desde src/ (verificado 2026-10-26).

drop function if exists public.cambiar_estado_pedido(uuid, estado_pedido, uuid, text);
drop function if exists public.cerrar_pedido(uuid, uuid, text, numeric, date, text);
drop function if exists public.cerrar_pedido(uuid, text, text, numeric, text, text, date, uuid);
drop function if exists public.get_dashboard_stats(date);
drop function if exists public.registrar_entrega(uuid, text, text, numeric, text, uuid);


begin;

-- ─── Helper: rol del usuario autenticado ────────────────────────────────────
-- NULL si no hay sesión, no hay perfil o el perfil está desactivado: las RPCs
-- dejan afuera a usuarios dados de baja aunque tengan una sesión válida.
-- Todos los chequeos usan `v_rol is null or v_rol not in (...)`: con v_rol
-- NULL, `not in` da NULL y no entraría al IF.

create or replace function public._rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol::text from perfiles where id = auth.uid() and activo is true
$$;

-- ─── Helper: fecha de hoy en Argentina ──────────────────────────────────────
-- La base corre en UTC: CURRENT_DATE después de las 21 h de Argentina ya es
-- el día siguiente. Todo "hoy" del lado del servidor pasa por hoy_local().

create or replace function public.hoy_local()
returns date
language sql
stable
set search_path to 'public'
as $$
  select (now() at time zone 'America/Argentina/Cordoba')::date;
$$;

alter table public.pedido_pagos
  alter column fecha_pago set default public.hoy_local();

-- ─── Políticas del repartidor (pedidos de hoy, en Argentina) ────────────────

alter policy repartidor_pedidos_select on public.pedidos
using (
  exists (select 1 from perfiles
          where perfiles.id = auth.uid() and perfiles.rol = 'repartidor')
  and estado = any (array['listo_reparto','en_reparto','entrega_fallida']::estado_pedido[])
  and fecha_produccion = public.hoy_local()
);

alter policy repartidor_pedidos_update on public.pedidos
using (
  exists (select 1 from perfiles
          where perfiles.id = auth.uid() and perfiles.rol = 'repartidor')
  and estado = any (array['listo_reparto','en_reparto','entrega_fallida']::estado_pedido[])
  and fecha_produccion = public.hoy_local()
);


-- ─── RPC: cambiar_estado_pedido ─────────────────────────────────────────────
-- Cambia el estado y registra el historial en una transacción.
--   admin/superadmin: cualquier transición (override)
--   produccion:       en_produccion -> listo_reparto
--   repartidor:       listo_reparto -> en_reparto
--                     en_reparto    -> entrega_fallida
--                     en_produccion -> en_reparto (avance de emergencia)
-- p_usuario_id se acepta por compatibilidad pero se ignora: el historial
-- registra auth.uid().

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


-- ─── RPC: cerrar_pedido ─────────────────────────────────────────────────────
-- Cierra el pedido registrando los pagos (p_pagos = [{forma_pago, monto,
-- fecha_pago?}], puede ir vacío) en una transacción.
--   admin/superadmin: cualquier estado activo.
--   repartidor: solo listo_reparto, en_reparto o entrega_fallida. Sin chequeo
--     de fecha: un cierre encolado offline puede sincronizarse al día siguiente.
-- Idempotente: rechaza un pedido ya cerrado o anulado (doble toque /
-- reintento). monto_cobrado y estado_pago salen de TODOS los pagos del pedido.

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


-- ─── RPC: registrar_pago ────────────────────────────────────────────────────
-- Agrega un pago a un pedido (flujo normal: cerrado con saldo pendiente).
-- Solo admin/superadmin. Rechaza si el pedido ya está cobrado del todo (doble
-- toque). Un pago que supera el saldo se ACEPTA a propósito: la app pide
-- confirmación antes de enviarlo (FormPagos).

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


-- ─── RPC: anular_pedido ─────────────────────────────────────────────────────
-- Solo admin/superadmin (ver docs/03_flujo_de_estados.md).

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


-- ─── RPC: contar_pedidos_por_estado ─────────────────────────────────────────
-- Conteos de las píldoras de estado en /admin/pedidos (la lista está paginada,
-- no se puede contar en el cliente). SECURITY INVOKER: respeta RLS, cada rol
-- cuenta solo los pedidos que puede ver.

create or replace function public.contar_pedidos_por_estado()
returns table (estado text, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.estado::text as estado, count(*)::bigint as cantidad
  from public.pedidos p
  group by p.estado
$$;


-- ─── Usuarios ───────────────────────────────────────────────────────────────
-- El listado/alta/edición de usuarios va por la Edge Function admin-usuarios
-- (supabase/functions/admin-usuarios). get_all_perfiles ya no se usa: se borra
-- con supabase/fase7b_limpieza.sql.


-- ─── Permisos: solo authenticated ───────────────────────────────────────────
-- (EXECUTE se otorga a PUBLIC por defecto: hay que revocar de public Y anon.)

revoke all     on function public.cambiar_estado_pedido(uuid, text, text, uuid, text) from public, anon;
revoke all     on function public.anular_pedido(uuid, text, text, uuid)               from public, anon;
revoke all     on function public.registrar_pago(uuid, uuid, text, numeric, date)    from public, anon;
revoke all     on function public.cerrar_pedido(uuid, uuid, jsonb, text)              from public, anon;
revoke all     on function public.contar_pedidos_por_estado()                         from public, anon;
revoke all     on function public._rol_actual()                                       from public, anon;  -- ⚠ 7b, pendiente
grant  execute on function public.cambiar_estado_pedido(uuid, text, text, uuid, text) to authenticated;
grant  execute on function public.anular_pedido(uuid, text, text, uuid)               to authenticated;
grant  execute on function public.registrar_pago(uuid, uuid, text, numeric, date)    to authenticated;
grant  execute on function public.cerrar_pedido(uuid, uuid, jsonb, text)              to authenticated;
grant  execute on function public.contar_pedidos_por_estado()                         to authenticated;
grant  execute on function public._rol_actual()                                       to authenticated;
grant  execute on function public.hoy_local()                                         to authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECCIONES DE DATOS (UNA SOLA VEZ — ya ejecutadas, comentadas a propósito)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 2026-10-26: fecha_pago en UTC ──────────────────────────────────────────
-- 25 pagos cargados entre 21 y 24 h (Argentina) habían quedado con fecha_pago
-- del día siguiente. Backup en public._backup_pedido_pagos_fecha_20261026.
--
-- begin;
-- create table if not exists public._backup_pedido_pagos_fecha_20261026 as
-- select id, fecha_pago, created_at
-- from public.pedido_pagos
-- where fecha_pago = (created_at at time zone 'UTC')::date
--   and fecha_pago <> (created_at at time zone 'America/Argentina/Cordoba')::date;
-- select count(*) from public._backup_pedido_pagos_fecha_20261026;  -- esperado: 25
-- update public.pedido_pagos p
-- set fecha_pago = (p.created_at at time zone 'America/Argentina/Cordoba')::date
-- from public._backup_pedido_pagos_fecha_20261026 b
-- where p.id = b.id;
-- commit;

-- ─── 2026-10-27: 11 pagos duplicados ────────────────────────────────────────
-- Doble cierre (P-00024, 108, 135, 141) y doble registro de pago (P-00006, 12,
-- 43, 55, 82, 113, 123) cuando la app no refrescaba: $724.900 de más en
-- "Total cobrado" (jul $123.400 · ago $267.000 · sep $312.500 · oct $22.000).
-- Criterio: pago idéntico (monto, forma, fecha) a otro anterior del mismo
-- pedido cerrado, cargado ≤ 2 min después; se borró el posterior.
-- Backup en public._backup_pagos_duplicados_20261027 (RLS, sin acceso anon/authenticated).
-- Verificación posterior: solo P-00011 ($29.001 sobre $29.000), pago real confirmado.
--
-- begin;
-- create table if not exists public._backup_pagos_duplicados_20261027 as
-- select dup.*
-- from pedido_pagos dup
-- join pedido_pagos orig
--   on  orig.pedido_id  = dup.pedido_id
--   and orig.monto      = dup.monto
--   and orig.forma_pago = dup.forma_pago
--   and orig.fecha_pago = dup.fecha_pago
--   and orig.created_at < dup.created_at
--   and dup.created_at - orig.created_at <= interval '2 minutes'
-- join pedidos pd on pd.id = dup.pedido_id
-- where pd.estado = 'cerrado';
-- alter table public._backup_pagos_duplicados_20261027 enable row level security;
-- revoke all on public._backup_pagos_duplicados_20261027 from anon, authenticated;
-- delete from pedido_pagos p using public._backup_pagos_duplicados_20261027 b where p.id = b.id;
-- update pedidos pd
-- set monto_cobrado = s.suma,
--     estado_pago   = case when s.suma >= coalesce(pd.total_manual, pd.total_calculado)
--                          then 'cobrado' else 'pendiente' end,
--     updated_at    = now()
-- from (
--   select pp.pedido_id, sum(pp.monto) as suma
--   from pedido_pagos pp
--   where pp.pedido_id in (select distinct pedido_id from public._backup_pagos_duplicados_20261027)
--   group by pp.pedido_id
-- ) s
-- where pd.id = s.pedido_id;
-- commit;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Funciones: una sola versión de cada una, sin EXECUTE para anon.
select p.oid::regprocedure                      as funcion,
       p.prosecdef                              as security_definer,
       has_function_privilege('anon',          p.oid, 'execute') as anon_puede,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('_rol_actual', 'hoy_local', 'cambiar_estado_pedido', 'anular_pedido',
                    'registrar_pago', 'cerrar_pedido', 'contar_pedidos_por_estado',
                    'get_all_perfiles', 'get_dashboard_stats', 'registrar_entrega')
order by p.proname, p.oid::regprocedure::text;

-- Pedidos cerrados con pagos ≠ monto_cobrado o cobrados de más.
-- Esperado: solo P-00011 (pago real de $29.001 sobre $29.000).
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
