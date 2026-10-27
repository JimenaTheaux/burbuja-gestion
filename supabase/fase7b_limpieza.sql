-- ═══════════════════════════════════════════════════════════════════════════
-- BURBUJA — Fase 7b: limpieza de permisos
-- ⚠ NO APLICADO. Revisar y ejecutar en Supabase → SQL Editor, en orden.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. DROP get_all_perfiles: reemplazada por la Edge Function admin-usuarios
--    (Fase 7a). Ningún archivo de src/ ni supabase/functions la llama
--    (verificado 2026-10-27).
-- 2. REVOKE _rol_actual a anon: es SECURITY DEFINER y solo tiene sentido con
--    sesión. EXECUTE viene de PUBLIC por defecto, así que se revoca de PUBLIC
--    y anon y se re-otorga a authenticated.

-- ─── 0. PRE-CHEQUEO ─────────────────────────────────────────────────────────
-- a) Policies que usan _rol_actual() y para qué roles. Si alguna aplica a
--    anon o public, avisar ANTES de correr el paso 2: una consulta sin sesión
--    pasaría de "0 filas" a error de permisos.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where coalesce(qual, '') ilike '%_rol_actual%'
   or coalesce(with_check, '') ilike '%_rol_actual%';

-- b) Otras funciones de la base que llaman a get_all_perfiles. Esperado: 0 filas.
select p.oid::regprocedure as funcion
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.prosrc ilike '%get_all_perfiles%'
  and p.proname <> 'get_all_perfiles';

-- ─── 1 y 2 ──────────────────────────────────────────────────────────────────
begin;

drop function if exists public.get_all_perfiles();

revoke all     on function public._rol_actual() from public, anon;
grant  execute on function public._rol_actual() to authenticated;

commit;

-- ─── 3. VERIFICACIÓN ────────────────────────────────────────────────────────
-- Esperado: get_all_perfiles no aparece; _rol_actual con anon_puede = false y
-- authenticated_puede = true.
select p.oid::regprocedure                      as funcion,
       has_function_privilege('anon',          p.oid, 'execute') as anon_puede,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('_rol_actual', 'get_all_perfiles');

-- Después: probar en la app login + Pedidos + Usuarios (admin) y que el
-- repartidor vea sus pedidos del día.
