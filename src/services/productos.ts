import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Producto, CategoriaProducto } from '@/types'

const KEY     = ['productos']
const CAT_KEY = ['categorias']

// Supabase devuelve NUMERIC como string — parseamos a number para coincidir con el tipo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseProducto(row: any): Producto {
  return {
    ...row,
    presentacion:     Number(row.presentacion),
    precio_minorista: Number(row.precio_minorista),
    precio_mayorista: Number(row.precio_mayorista),
    categorias_producto: row.categorias_producto ?? null,
  } as Producto
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useProductos = (q?: string, categoriaId?: string, activo: boolean | null = true) =>
  useQuery({
    queryKey:        [...KEY, q, categoriaId, activo],
    placeholderData: keepPreviousData,
    staleTime:       1000 * 60 * 5,
    queryFn: async () => {
      let query = supabase
        .from('productos')
        .select('*, categorias_producto(id, nombre)')
        .order('nombre', { ascending: true })

      if (activo !== null) query = query.eq('activo', activo)
      if (categoriaId)     query = query.eq('categoria_id', categoriaId)
      if (q)               query = query.ilike('nombre', `%${q}%`)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []).map(parseProducto)
    },
  })

export const useCategorias = () =>
  useQuery({
    queryKey:  CAT_KEY,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_producto')
        .select('id, nombre')
        .order('nombre', { ascending: true })

      if (error) throw new Error(error.message)
      return (data ?? []) as CategoriaProducto[]
    },
  })

export const useCrearProducto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Producto, 'id' | 'created_at' | 'updated_at' | 'categorias_producto'>) => {
      const { data, error } = await supabase
        .from('productos')
        .insert({
          nombre:           payload.nombre,
          fragancia:        payload.fragancia     || null,
          categoria_id:     payload.categoria_id  || null,
          unidad_medida:    payload.unidad_medida  ?? 'litros',
          presentacion:     payload.presentacion,
          precio_minorista: payload.precio_minorista,
          precio_mayorista: payload.precio_mayorista,
          activo:           payload.activo ?? true,
          codigo:           payload.codigo || null,
        })
        .select('*, categorias_producto(id, nombre)')
        .single()

      if (error) throw new Error(error.message)
      return parseProducto(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const useEditarProducto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Producto> & { id: string }) => {
      const patch: Record<string, unknown> = {}
      if (payload.nombre           !== undefined) patch.nombre           = payload.nombre
      if (payload.fragancia        !== undefined) patch.fragancia        = payload.fragancia    || null
      if (payload.categoria_id     !== undefined) patch.categoria_id     = payload.categoria_id || null
      if (payload.unidad_medida    !== undefined) patch.unidad_medida    = payload.unidad_medida
      if (payload.presentacion     !== undefined) patch.presentacion     = payload.presentacion
      if (payload.precio_minorista !== undefined) patch.precio_minorista = payload.precio_minorista
      if (payload.precio_mayorista !== undefined) patch.precio_mayorista = payload.precio_mayorista
      if (payload.activo           !== undefined) patch.activo           = payload.activo
      if (payload.codigo           !== undefined) patch.codigo           = payload.codigo || null

      const { data, error } = await supabase
        .from('productos')
        .update(patch)
        .eq('id', id)
        .select('*, categorias_producto(id, nombre)')
        .single()

      if (error) throw new Error(error.message)
      return parseProducto(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const useCrearCategoria = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nombre: string) => {
      const { data, error } = await supabase
        .from('categorias_producto')
        .insert({ nombre })
        .select('id, nombre')
        .single()

      if (error) throw new Error(error.message)
      return data as CategoriaProducto
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAT_KEY }),
  })
}
