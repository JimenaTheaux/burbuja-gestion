-- ═══════════════════════════════════════════════════════════════════════════
-- BURBUJA — RPCs atómicas + índices de performance
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────
-- Cubren las queries más frecuentes. Si ya existen, IF NOT EXISTS los ignora.

CREATE INDEX IF NOT EXISTS idx_pedidos_estado
  ON pedidos(estado);

CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_produccion
  ON pedidos(fecha_produccion);

CREATE INDEX IF NOT EXISTS idx_pedidos_created_at
  ON pedidos(created_at DESC);

-- Índice compuesto para la query del repartidor (fecha + estado)
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_estado
  ON pedidos(fecha_produccion, estado)
  WHERE estado IN ('en_produccion', 'listo_reparto', 'en_reparto');

-- Nota: no se puede indexar DATE(created_at) porque DATE() es STABLE (timezone-dependent).
-- El índice idx_pedidos_created_at (created_at DESC) ya cubre las queries de rango del dashboard.

CREATE INDEX IF NOT EXISTS idx_pedido_historial_pedido_id
  ON pedido_historial(pedido_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido_id
  ON pedido_items(pedido_id);

CREATE INDEX IF NOT EXISTS idx_perfiles_id
  ON perfiles(id);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre
  ON clientes(nombre text_pattern_ops);   -- acelera ilike '%texto%'

-- Listado paginado de /admin/pedidos (filtro por estado + orden created_at desc)
CREATE INDEX IF NOT EXISTS pedidos_estado_created_idx
  ON pedidos(estado, created_at DESC);

-- Rangos de pagos del dashboard (pedido_pagos.fecha_pago)
CREATE INDEX IF NOT EXISTS pedido_pagos_fecha_idx
  ON pedido_pagos(fecha_pago);


-- ─── Limpieza de versiones previas ──────────────────────────────────────────
-- Las firmas en producción no coinciden con las nuevas (distintos parámetros),
-- así que CREATE OR REPLACE crearía un overload en vez de reemplazarlas. Las
-- borramos por su firma real antes de crear las nuevas más abajo.
-- (anular_pedido, get_dashboard_stats y registrar_entrega no existen todavía
-- en esta base — los DROP IF EXISTS de abajo son no-op para esos casos.)

DROP FUNCTION IF EXISTS public.cambiar_estado_pedido(uuid, estado_pedido, uuid, text);
DROP FUNCTION IF EXISTS public.cerrar_pedido(uuid, uuid, text, numeric, date, text);
DROP FUNCTION IF EXISTS public.anular_pedido(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(date);
DROP FUNCTION IF EXISTS public.registrar_entrega(uuid, text, text, numeric, text, uuid);


-- ─── Helper: rol del usuario autenticado ────────────────────────────────────
-- Usado por todas las RPCs de transición de estado para validar que el rol del
-- caller puede hacer la transición pedida. Sin esto, cualquier sesión
-- autenticada podía mover cualquier pedido a cualquier estado (las RPCs son
-- SECURITY DEFINER y bypasean RLS).

CREATE OR REPLACE FUNCTION public._rol_actual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol::text FROM perfiles WHERE id = auth.uid()
$$;


-- ─── RPC 1: cambiar_estado_pedido ───────────────────────────────────────────
-- Cambia el estado y registra en historial en una sola transacción atómica.
-- Antes: 2 HTTP requests (update + insert). Ahora: 1 HTTP request, 2 queries DB.
-- Valida que el rol del caller pueda hacer la transición pedida:
--   admin/superadmin: cualquier transición (override)
--   produccion:       en_produccion -> listo_reparto
--   repartidor:       listo_reparto -> en_reparto
--                      en_reparto    -> entrega_fallida
--                      en_produccion -> en_reparto (avance de emergencia)

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(
  p_pedido_id       uuid,
  p_estado_nuevo    text,
  p_estado_anterior text,
  p_usuario_id      uuid  DEFAULT NULL,
  p_notas           text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text := public._rol_actual();
BEGIN
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_rol NOT IN ('admin', 'superadmin') THEN
    IF NOT (
      (v_rol = 'produccion' AND p_estado_anterior = 'en_produccion' AND p_estado_nuevo = 'listo_reparto')
      OR (v_rol = 'repartidor' AND p_estado_anterior = 'listo_reparto' AND p_estado_nuevo = 'en_reparto')
      OR (v_rol = 'repartidor' AND p_estado_anterior = 'en_reparto'    AND p_estado_nuevo = 'entrega_fallida')
      OR (v_rol = 'repartidor' AND p_estado_anterior = 'en_produccion' AND p_estado_nuevo = 'en_reparto')
    ) THEN
      RAISE EXCEPTION 'El rol % no puede pasar un pedido de % a %', v_rol, p_estado_anterior, p_estado_nuevo;
    END IF;
  END IF;

  UPDATE pedidos
  SET
    estado     = p_estado_nuevo::estado_pedido,
    updated_at = NOW()
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado', p_pedido_id;
  END IF;

  INSERT INTO pedido_historial (
    pedido_id, estado_anterior, estado_nuevo, usuario_id, notas, created_at
  ) VALUES (
    p_pedido_id,
    CASE WHEN p_estado_anterior IS NOT NULL
         THEN p_estado_anterior::estado_pedido
         ELSE NULL END,
    p_estado_nuevo::estado_pedido,
    p_usuario_id,
    p_notas,
    NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text, text, uuid, text)
  TO authenticated;


-- ─── RPC 2: cerrar_pedido ────────────────────────────────────────────────────
-- Cierra el pedido con cobro: estado + forma_cobro + monto_cobrado + estado_pago
-- + notas_entrega + fecha_cobro, todo en una transacción atómica (incluye
-- fecha_cobro acá adentro para no depender de un UPDATE directo aparte, que
-- requeriría una policy RLS de escritura para produccion/repartidor).
-- Reemplaza la RPC legacy `registrar_entrega` (que dejaba el pedido en
-- 'entregado' en vez de 'cerrado' — ver docs/06_estructura_de_datos.md).
-- Solo admin/superadmin y repartidor pueden cerrar pedidos.
--
-- ⚠ DESACTUALIZADA (2026-10-26): la app usa la versión
-- cerrar_pedido(uuid, uuid, jsonb, text) — ver sección "Fecha local" al final.
-- Correr esta definición crea un overload de 8 parámetros que la app no usa.

CREATE OR REPLACE FUNCTION public.cerrar_pedido(
  p_pedido_id       uuid,
  p_estado_anterior text,
  p_forma_cobro     text,
  p_monto_cobrado   numeric DEFAULT NULL,
  p_estado_pago     text    DEFAULT NULL,
  p_notas_entrega   text    DEFAULT NULL,
  p_fecha_cobro     date    DEFAULT NULL,
  p_usuario_id      uuid    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text := public._rol_actual();
BEGIN
  IF v_rol NOT IN ('admin', 'superadmin', 'repartidor') THEN
    RAISE EXCEPTION 'El rol % no puede cerrar pedidos', v_rol;
  END IF;

  UPDATE pedidos
  SET
    estado        = 'cerrado'::estado_pedido,
    forma_cobro   = p_forma_cobro,
    monto_cobrado = p_monto_cobrado,
    estado_pago   = p_estado_pago,
    notas_entrega = p_notas_entrega,
    fecha_cobro   = p_fecha_cobro,
    updated_at    = NOW()
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado', p_pedido_id;
  END IF;

  INSERT INTO pedido_historial (
    pedido_id, estado_anterior, estado_nuevo, usuario_id, notas, created_at
  ) VALUES (
    p_pedido_id,
    p_estado_anterior::estado_pedido,
    'cerrado'::estado_pedido,
    p_usuario_id,
    p_notas_entrega,
    NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerrar_pedido(uuid, text, text, numeric, text, text, date, uuid)
  TO authenticated;


-- ─── RPC 3: anular_pedido ───────────────────────────────────────────────────
-- Anula con validación y registra historial en una transacción.
-- Solo admin/superadmin puede anular (ver docs/03_flujo_de_estados.md).

CREATE OR REPLACE FUNCTION public.anular_pedido(
  p_pedido_id       uuid,
  p_estado_anterior text,
  p_motivo          text,
  p_usuario_id      uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text := public._rol_actual();
BEGIN
  IF v_rol NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'El rol % no puede anular pedidos', v_rol;
  END IF;

  IF p_estado_anterior = 'cerrado' THEN
    RAISE EXCEPTION 'No se puede anular un pedido cerrado';
  END IF;

  IF p_estado_anterior = 'anulado' THEN
    RAISE EXCEPTION 'El pedido ya está anulado';
  END IF;

  UPDATE pedidos
  SET
    estado           = 'anulado'::estado_pedido,
    motivo_anulacion = p_motivo,
    updated_at       = NOW()
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado', p_pedido_id;
  END IF;

  INSERT INTO pedido_historial (
    pedido_id, estado_anterior, estado_nuevo, usuario_id, notas, created_at
  ) VALUES (
    p_pedido_id,
    p_estado_anterior::estado_pedido,
    'anulado'::estado_pedido,
    p_usuario_id,
    p_motivo,
    NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.anular_pedido(uuid, text, text, uuid)
  TO authenticated;


-- ─── RPC 4: get_dashboard_stats ──────────────────────────────────────────────
-- Devuelve KPIs del dashboard en una sola query en vez de 2 HTTP requests.
-- Retorna JSON con estructura { hoy: {...}, activos: {...}, pedidosHoy: [...] }

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_fecha date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  pedidos_hoy AS (
    SELECT
      id, numero, estado::text, total_calculado, total_manual,
      forma_cobro, monto_cobrado, fecha_produccion, cliente_id
    FROM pedidos
    WHERE created_at::date = p_fecha
  ),
  hoy_agg AS (
    SELECT
      COUNT(*)::int                                                         AS total,
      COALESCE(
        jsonb_object_agg(estado, cnt) FILTER (WHERE cnt > 0),
        '{}'::jsonb
      )                                                                     AS por_estado,
      COALESCE(SUM(
        CASE WHEN estado IN ('entregado','cerrado') AND forma_cobro = 'efectivo'
             THEN COALESCE(monto_cobrado, 0) ELSE 0 END), 0)              AS total_efectivo,
      COALESCE(SUM(
        CASE WHEN estado IN ('entregado','cerrado') AND forma_cobro = 'transferencia'
             THEN COALESCE(monto_cobrado, 0) ELSE 0 END), 0)              AS total_transferencia,
      COALESCE(SUM(
        CASE WHEN estado IN ('entregado','cerrado')
             THEN COALESCE(monto_cobrado, 0) ELSE 0 END), 0)              AS total_cobrado,
      COUNT(
        CASE WHEN estado IN ('entregado','cerrado')
             AND (forma_cobro = 'pendiente' OR forma_cobro IS NULL)
             THEN 1 END)::int                                              AS cobrando_pendientes
    FROM (
      SELECT *, COUNT(*) OVER (PARTITION BY estado) AS cnt
      FROM pedidos_hoy
    ) t
  ),
  activos_agg AS (
    SELECT
      COUNT(*)::int                                        AS total,
      COALESCE(
        jsonb_object_agg(estado, cnt) FILTER (WHERE cnt > 0),
        '{}'::jsonb
      )                                                    AS por_estado
    FROM (
      SELECT estado::text, COUNT(*) AS cnt
      FROM pedidos
      WHERE estado NOT IN ('cerrado'::estado_pedido, 'anulado'::estado_pedido)
      GROUP BY estado
    ) t
  )
  SELECT json_build_object(
    'hoy', json_build_object(
      'total',              h.total,
      'porEstado',          h.por_estado,
      'totalEfectivo',      h.total_efectivo,
      'totalTransferencia', h.total_transferencia,
      'totalCobrado',       h.total_cobrado,
      'cobrandoPendientes', h.cobrando_pendientes
    ),
    'activos', json_build_object(
      'total',     a.total,
      'porEstado', a.por_estado
    ),
    'pedidosHoy', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',              ph.id,
        'numero',          ph.numero,
        'estado',          ph.estado,
        'totalCalculado',  ph.total_calculado::text,
        'totalManual',     ph.total_manual::text,
        'formaCobro',      ph.forma_cobro,
        'montoCobrado',    ph.monto_cobrado::text,
        'fechaProduccion', ph.fecha_produccion,
        'clienteId',       ph.cliente_id
      )), '[]'::json)
      FROM pedidos_hoy ph
    )
  )
  FROM hoy_agg h, activos_agg a
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(date)
  TO authenticated;


-- ─── RPC 5: get_all_perfiles ─────────────────────────────────────────────────
-- Devuelve todos los perfiles para la vista de admin de Usuarios. perfiles solo
-- tiene la policy RLS "perfil_propio" (SELECT de la fila propia), así que sin
-- esta RPC (SECURITY DEFINER) el listado quedaba vacío para todos. Solo
-- admin/superadmin puede listar todos los usuarios.

CREATE OR REPLACE FUNCTION public.get_all_perfiles()
RETURNS TABLE (
  id         uuid,
  nombre     text,
  rol        text,
  activo     boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._rol_actual() NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nombre, p.rol, p.activo, p.created_at
  FROM perfiles p
  ORDER BY p.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_perfiles()
  TO authenticated;


-- ─── RPC 6: contar_pedidos_por_estado ───────────────────────────────────────
-- Conteos de las píldoras de estado en /admin/pedidos (la lista está paginada,
-- no se puede contar en el cliente). SECURITY INVOKER: respeta RLS, cada rol
-- cuenta solo los pedidos que puede ver. (Aplicada en producción 2026-10-26.)

CREATE OR REPLACE FUNCTION public.contar_pedidos_por_estado()
RETURNS TABLE (estado text, cantidad bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.estado::text AS estado, count(*)::bigint AS cantidad
  FROM public.pedidos p
  GROUP BY p.estado
$$;

REVOKE ALL     ON FUNCTION public.contar_pedidos_por_estado() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.contar_pedidos_por_estado() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- FECHA LOCAL (Argentina) — aplicado en producción 2026-10-26
-- ═══════════════════════════════════════════════════════════════════════════
-- La base corre en UTC: CURRENT_DATE después de las 21 h de Argentina ya es
-- el día siguiente. Pagos registrados de noche quedaban con fecha_pago de
-- mañana y el repartidor dejaba de ver los pedidos del día. Todo "hoy" del
-- lado del servidor pasa por hoy_local().
--
-- Pendiente (Fase 7): registrar_pago y cerrar_pedido son SECURITY DEFINER sin
-- control de rol y toman p_usuario_id del cliente.

begin;

-- 1. Helper: fecha de hoy en Argentina
create or replace function public.hoy_local()
returns date
language sql
stable
set search_path to 'public'
as $$
  select (now() at time zone 'America/Argentina/Cordoba')::date;
$$;

grant execute on function public.hoy_local() to authenticated;

-- 2. Default de columna
alter table public.pedido_pagos
  alter column fecha_pago set default public.hoy_local();

-- 3. Políticas repartidor (mantiene roles y comando)
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

-- 4. registrar_pago: default local
create or replace function public.registrar_pago(
  p_pedido_id uuid,
  p_usuario_id uuid,
  p_forma_pago text,
  p_monto numeric,
  p_fecha_pago date default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total_pedido numeric;
  v_total_pagado numeric;
  v_estado_pago  text;
begin
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

-- 5. cerrar_pedido (jsonb): fecha local
create or replace function public.cerrar_pedido(
  p_pedido_id uuid,
  p_usuario_id uuid,
  p_pagos jsonb,
  p_notas text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado_anterior estado_pedido;
  v_total_pedido    numeric;
  v_total_pagado    numeric;
  v_estado_pago     text;
  pago              jsonb;
begin
  select estado, coalesce(total_manual, total_calculado)
  into   v_estado_anterior, v_total_pedido
  from   pedidos
  where  id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado: %', p_pedido_id;
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
    p_usuario_id,
    coalesce(p_notas, 'Pagado $' || v_total_pagado || ' de $' || v_total_pedido)
  );
end;
$function$;

commit;

-- ─── Corrección de datos (UNA SOLA VEZ — ya ejecutada 2026-10-26) ──────────
-- 25 pagos cargados entre 21 y 24 h (Argentina) habían quedado con fecha_pago
-- del día siguiente (default UTC). Backup en public._backup_pedido_pagos_fecha_20261026.
-- Comentada para que correr este archivo no la repita.
--
-- begin;
--
-- create table if not exists public._backup_pedido_pagos_fecha_20261026 as
-- select id, fecha_pago, created_at
-- from public.pedido_pagos
-- where fecha_pago = (created_at at time zone 'UTC')::date
--   and fecha_pago <> (created_at at time zone 'America/Argentina/Cordoba')::date;
--
-- select count(*) from public._backup_pedido_pagos_fecha_20261026;  -- esperado: 25
--
-- update public.pedido_pagos p
-- set fecha_pago = (p.created_at at time zone 'America/Argentina/Cordoba')::date
-- from public._backup_pedido_pagos_fecha_20261026 b
-- where p.id = b.id;
--
-- commit;


-- ─── Verificar que las funciones existen ────────────────────────────────────
SELECT
  proname   AS funcion,
  pg_get_function_identity_arguments(oid) AS argumentos
FROM pg_proc
WHERE proname IN (
  'cambiar_estado_pedido',
  'cerrar_pedido',
  'anular_pedido',
  'get_dashboard_stats',
  'get_all_perfiles',
  'contar_pedidos_por_estado',
  'registrar_pago',
  'hoy_local',
  '_rol_actual'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;
