import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CategoriaEgreso } from '@/types'

const KEY = ['categorias-egreso']

// ─── useCategoriasEgreso — activas, ordenadas (para selects) ──────────────────

export function useCategoriasEgreso() {
  return useQuery({
    queryKey: KEY,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_egreso')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as CategoriaEgreso[]
    },
  })
}

// ─── useCategoriasEgresoAdmin — todas (incluye inactivas), para el ABM ────────

export function useCategoriasEgresoAdmin() {
  return useQuery({
    queryKey: [...KEY, 'admin'],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_egreso')
        .select('*')
        .order('orden', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as CategoriaEgreso[]
    },
  })
}

// ─── useCrearCategoriaEgreso ────────────────────────────────────────────────

export function useCrearCategoriaEgreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (datos: { nombre: string; slug: string; orden?: number }) => {
      const { error } = await supabase.from('categorias_egreso').insert(datos)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// ─── useEditarCategoriaEgreso ───────────────────────────────────────────────

export function useEditarCategoriaEgreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...datos }: Partial<CategoriaEgreso> & { id: string }) => {
      const { error } = await supabase.from('categorias_egreso').update(datos).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// ─── useEliminarCategoriaEgreso — soft delete: marca inactivo ─────────────────

export function useEliminarCategoriaEgreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categorias_egreso')
        .update({ activo: false })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
