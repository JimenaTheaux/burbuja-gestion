import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/types'

const KEY = ['clientes']

const SELECT = 'id, nombre, telefono, direccion, tipo_cliente, notas, activo, created_at, updated_at'

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useClientes = (q?: string) =>
  useQuery({
    queryKey:        [...KEY, q],
    placeholderData: keepPreviousData,
    staleTime:       1000 * 60 * 2,
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select(SELECT)
        .eq('activo', true)
        .order('nombre', { ascending: true })

      if (q) query = query.ilike('nombre', `%${q}%`)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as Cliente[]
    },
  })

export const useCliente = (id: string) =>
  useQuery({
    queryKey: [...KEY, id],
    enabled:  !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select(SELECT)
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data)  throw new Error('Cliente no encontrado')
      return data as Cliente
    },
  })

export const useCrearCliente = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nombre:       payload.nombre,
          telefono:     payload.telefono    || null,
          direccion:    payload.direccion   || null,
          tipo_cliente: payload.tipo_cliente,
          notas:        payload.notas       || null,
          activo:       payload.activo      ?? true,
        })
        .select(SELECT)
        .single()

      if (error) throw new Error(error.message)
      return data as Cliente
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const useEditarCliente = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Cliente> & { id: string }) => {
      const patch: Partial<Record<keyof Cliente, unknown>> = {}
      if (payload.nombre       !== undefined) patch.nombre       = payload.nombre
      if (payload.telefono     !== undefined) patch.telefono     = payload.telefono     || null
      if (payload.direccion    !== undefined) patch.direccion    = payload.direccion    || null
      if (payload.tipo_cliente !== undefined) patch.tipo_cliente = payload.tipo_cliente
      if (payload.notas        !== undefined) patch.notas        = payload.notas        || null
      if (payload.activo       !== undefined) patch.activo       = payload.activo

      const { data, error } = await supabase
        .from('clientes')
        .update(patch)
        .eq('id', id)
        .select(SELECT)
        .single()

      if (error) throw new Error(error.message)
      return data as Cliente
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
