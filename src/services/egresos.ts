import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from '@/store/authStore'
import type { Egreso, CategoriaEgreso } from '@/types'

const KEY = queryKeys.egresos.all()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ultimoDiaMes(anio: number, mes: number): string {
  return new Date(anio, mes, 0).toISOString().split('T')[0]
}

function primerDiaMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEgreso(row: any): Egreso {
  return {
    ...row,
    monto: Number(row.monto ?? 0),
  } as Egreso
}

// ─── useEgresos ───────────────────────────────────────────────────────────────

export const useEgresos = (mes: number, anio: number, categoria?: CategoriaEgreso) =>
  useQuery({
    queryKey:  [...KEY, mes, anio, categoria ?? null],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      let q = supabase
        .from('egresos')
        .select('*, perfiles(nombre)')
        .gte('fecha_egreso', primerDiaMes(anio, mes))
        .lte('fecha_egreso', ultimoDiaMes(anio, mes))
        .order('fecha_egreso', { ascending: false })

      if (categoria) q = q.eq('categoria', categoria)

      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []).map(parseEgreso)
    },
  })

// ─── useCrearEgreso ───────────────────────────────────────────────────────────

export const useCrearEgreso = () => {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)

  return useMutation({
    mutationFn: async (datos: {
      fecha_egreso:   string
      categoria:      CategoriaEgreso
      concepto:       string
      monto:          number
      registrado_por?: string
    }) => {
      const { data, error } = await supabase
        .from('egresos')
        .insert({
          fecha_egreso:   datos.fecha_egreso,
          categoria:      datos.categoria,
          concepto:       datos.concepto,
          monto:          datos.monto,
          registrado_por: datos.registrado_por ?? usuario?.id ?? null,
        })
        .select('*, perfiles(nombre)')
        .single()

      if (error) throw new Error(error.message)
      return parseEgreso(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// ─── useEditarEgreso ──────────────────────────────────────────────────────────

export const useEditarEgreso = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...datos }: Partial<Omit<Egreso, 'created_at' | 'updated_at' | 'perfiles'>> & { id: string }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (datos.fecha_egreso   !== undefined) patch.fecha_egreso   = datos.fecha_egreso
      if (datos.categoria      !== undefined) patch.categoria      = datos.categoria
      if (datos.concepto       !== undefined) patch.concepto       = datos.concepto
      if (datos.monto          !== undefined) patch.monto          = datos.monto
      if (datos.registrado_por !== undefined) patch.registrado_por = datos.registrado_por

      const { data, error } = await supabase
        .from('egresos')
        .update(patch)
        .eq('id', id)
        .select('*, perfiles(nombre)')
        .single()

      if (error) throw new Error(error.message)
      return parseEgreso(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

// ─── useEliminarEgreso ────────────────────────────────────────────────────────

export const useEliminarEgreso = () => {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('egresos')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY })
      const snapshots = qc.getQueriesData<Egreso[]>({ queryKey: KEY })
      qc.setQueriesData<Egreso[]>({ queryKey: KEY }, (old) => {
        if (!Array.isArray(old)) return old
        return old.filter(e => e.id !== id)
      })
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
